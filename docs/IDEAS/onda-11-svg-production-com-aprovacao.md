# IDEA — Onda 11: SVG production com fluxo de aprovação de pedido

**Origem:** 2026-05-11, Onda 9 Fase 9F (mudança de escopo)
**Status:** Motor SVG pronto e testado; UI + status fica pra Onda 11

## Resumo

A Fase 9F entregou apenas a UI de **PNG mockup** (mostrar pro cliente).
A UI de SVG production (mandar arquivo pra máquina) **NÃO entrou** na
Onda 9 — fica pra Onda 11 junto com o subsistema de **status do pedido**
e **histórico**.

## Por que separar

Fluxo real do Gabriell:

1. Faz arte → salva pedido → gera PNG → manda pro cliente
2. Cliente pede ajuste → edita pedido → gera PNG novo
3. Cliente **aprova** → aí sim SVG production é liberado pra máquina

Sem status de aprovação no pedido, o usuário pode acidentalmente
exportar SVG pra produção em pedido pendente — risco real de mandar
arquivo errado pra máquina. A barreira UI vem da **lógica de pedido
aprovado**, não do motor de export.

## O que JÁ está pronto (Onda 9)

Os 4 commits do motor SVG (`f0f5dd9`, `dcc476c`, `0afe247`, `4826594`,
`c06fa3e`) entregam tudo que o motor precisa:

- `src/core/export/svg-exporter.ts` — `exportSvgByMachine(canvas, options)`
  - Cores semânticas (preto/azul/vermelho)
  - viewBox em mm
  - Z-order preservado
  - LayerMeta.visible respeitado
  - 1 SVG por máquina envolvida
  - **`textRouting?: Map<id, {operation, machines?}>`** já preparado pro
    dialog de aprovação override por slot
- `src/core/export/svg-text-converter.ts` — texto vetorizado via opentype.js
- 30 testes verdes (15 svg-exporter + 10 svg-text-converter + 3 textRouting +
  2 integração)
- Cobertura ≥85% em ambos módulos

**Não há retrabalho.** A Onda 11 só chama o motor existente quando o
status do pedido for "aprovado".

## O que PRECISA ser feito na Onda 11

### 1. Schema: status do pedido

Tabela `orders` já existe (Onda 8). Adicionar:

```sql
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE orders ADD COLUMN approved_at INTEGER;
ALTER TABLE orders ADD COLUMN approved_by TEXT;
```

`status ∈ {'pendente', 'aprovado', 'cancelado'}`. Default `'pendente'`.

### 2. Tela de histórico de pedidos

Nova rota `/pedidos` ou similar:

- Lista pedidos com status (badge colorido)
- Filtro por status / cliente / data
- Click no pedido → reabre no canvas pra editar
- Botão "Aprovar" (visível só em pedidos `pendente`)

### 3. Dialog de confirmação antes de exportar SVG

Briefing original da Fase 9F descrevia este dialog:

```
═══════════════════════════════════════════════
   EXPORTAR SVGs PRODUÇÃO — Pedido aprovado
═══════════════════════════════════════════════

   Cliente:    João Silva
   Profissão:  Advogado
   Status:     ✅ Aprovado em 2026-05-12 15:30

   Camadas envolvidas:
   ┌─────────────────────────────────────────┐
   │ Aplique 1            corte    fiber     │
   │ Balança Advogado     gravação fiber     │
   │ Nome (texto)         [gravação ▾] *      │
   │ Profissão (texto)    [gravação ▾] *      │
   └─────────────────────────────────────────┘
   * Editável: usuário pode trocar a operação
     do texto antes de exportar

   Pasta:      C:\Users\Gabriell\Documents\Capi
               [Escolher...]

   Vai gerar 2 SVGs:
   - JoaoSilva-Advogado_FiberLaser.svg

   ─────────────────────────────────────────────
                  [Cancelar]    [Exportar]
═══════════════════════════════════════════════
```

Pontos:

- Mostra resumo de TODAS as camadas que vão exportar
- Slots de texto: dropdown editável (gravação/marcação/corte) — alimenta
  `textRouting` Map do svg-exporter
- Apliques/gravações/marcações: read-only (operação travada no cadastro)
- Override é por slot, por pedido — NÃO persiste no padrão (CLAUDE.md)
- Botão "Exportar" só chama `exportSvgByMachine` com `textRouting`
  composto a partir dos dropdowns

### 4. Naming PascalCase pra arquivo

Decisão #2 da Onda 9: `{Nome-Profissao}_{MaquinaPascalCase}.svg`

- `master-biro` → `MasterBiro`
- `fiber-laser` → `FiberLaser`
- `due-laser` → `DueLaser`

Helper sugerido: `machineIdToPascalCase(id)` em `src/lib/machine-naming.ts`.
Pode ser inline no service da Onda 11.

### 5. Service análogo ao png-export-service

`src/services/svg-export-service.ts` orquestrando:

- `exportSvgByMachine` (motor existente)
- Loop pra escrever múltiplos arquivos via TauriIO.writeFile
- Persistir `settings.export.lastFolderProduction` (separado de
  `lastFolder` do PNG, ou compartilhar — decisão de produto)
- Abrir Explorer no final

### 6. Auditoria de aprovação

Cada export SVG production deve registrar em `export_history`:

```ts
interface ExportHistoryEntry {
  id: string;
  orderId: string;
  approvedAt: number;
  approvedBy: string | null;
  files: Array<{ machineId: string; path: string; sizeBytes: number }>;
  exportedAt: number;
}
```

Permite rastrear: "esse pedido foi exportado pra máquina X em tal data,
arquivo aqui". Útil pra depuração de fábrica e prevenção de re-export
acidental.

### 7. Validação: SVGs só exportam se pedido aprovado

Se o usuário tentar exportar SVG production em pedido `pendente`:

- Toast erro: "Pedido pendente — aprove antes de exportar SVG"
- Botão "Exportar SVG" no canvas-test/canvas real fica disabled enquanto
  status ≠ `'aprovado'`

## Limitações conhecidas (carregadas da Onda 9)

- **Roboto Slab Variable** vira placeholder XML (não path real). Toast
  pede vetorização manual. Ver
  `fontes-variable-suportadas-opentype.md`.
- **Texto solto** sem aplique pai precisa de override `machines` no
  textRouting OU lança erro de rota (pra forçar UI mostrar erro claro).

## Hashes da Onda 9 que servem de base

- `f0f5dd9` — schema operation/machines
- `dcc476c` — repos validados
- `0afe247` — motor SVG export
- `4826594` — texto via opentype.js
- `c06fa3e` — textRouting opcional (preparado pra dialog 9F→11)

Total Onda 9: 14 commits. Onda 11 estimativa: ~6-8 commits adicionais.
