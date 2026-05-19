# Capi Studio — Status pós-Onda 33

> **Snapshot da sessão 2026-05-18 (Onda 33).** Pattern Creation MVP entregue.
> Branch `onda-33`, 7 commits. Próximo: Ondas 34 (locks unificados) ou 35
> (modelo de tipos formal), dependendo da prioridade do operador.

---

## Resumo

A Onda 33 transforma o editor de padrão (`PadraoEditorPage`) em um **editor
mínimo de padrões inteligentes** conforme a spec "templates inteligentes".

**Filosofia da entrega**: nenhuma tela nova, nenhuma feature visual nova,
nenhum refactor grande. Estendeu-se o `LayerMeta` com **6 campos opcionais**,
adicionou-se **5 métodos puros** na engine, **5 thin wrappers** na
CanvasEngine, e **1 painel UI** dentro do editor existente.

Retrocompat total: padrões salvos antes da Onda 33 abrem sem erro com
todos os campos novos `undefined`. Zero migration SQL.

---

## Estado real do código (baseline)

- **typecheck**: ✅ verde
- **lint**: ✅ 0 errors, 6 warnings (pré-existentes — `react-refresh/only-export-components`)
- **testes**: ✅ **580/580** passando (566 → 571 → 580, +14 testes novos na onda)
- **branch**: `onda-33` (a partir de `onda-29`, 7 commits)

---

## Commits do ciclo

| Commit    | Fase | Tema                                                                                                                                       |
| --------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `a3bd1e5` | 33.A | Estende `LayerMeta` com 6 campos opcionais + tipos (`PatternRole`, `ProcessType`, `MachineCode`, `LayerLocks`, `LayerBoundsMm`, `FitMode`) |
| `b7e9c68` | 33.D | `lib/machine-codes.ts` — SOT do mapping M1/M2/M3 ↔ ids do banco. 5 testes.                                                                 |
| `ac68fe4` | 33.B | `engine-layers.ts` — 4 funções puras: `setPatternRole`, `setProcessRouting`, `setLayerLocks`, `convertToArea` + helper `hasChildren`       |
| `3ac5a3d` | 33.C | `canvas-engine.ts` — 5 métodos thin-wrapper expostos publicamente                                                                          |
| `9eb075b` | 33.F | `tests/core/canvas/pattern-meta.test.ts` — 9 testes (roundtrip, retrocompat, convertToArea)                                                |
| `3f0a1f4` | 33.E | `PatternClassificationPanel.tsx` + integração no `PadraoEditorPage`                                                                        |
| _este_    | docs | `STATUS-ONDA-33.md`                                                                                                                        |

---

## O que ganhou de capacidade

### Schema (`src/data/schema.ts`)

`LayerMeta` agora carrega (opcional, em todas as 3 variantes):

```ts
patternRole?: 'PRODUCT' | 'APPLIQUE' | 'CONTOUR' | 'TEXT_AREA' | 'LOGO_AREA'
processType?: 'corte' | 'gravacao' | 'marcacao'
machineTargets?: ('M1' | 'M2' | 'M3')[]   // dedupe + truncate em 3
boundsMm?: { x, y, width, height }        // só para AREAs
fitMode?: 'contain'                        // só para LOGO_AREA, default
lockGranular?: { position?, scale?, rotation?, structure? }
```

Persistência: tudo dentro de `canvasJson.capi.layers[i]` via spread em
`engine-serialization`. Zero migration. Padrões antigos abrem normalmente
com tudo undefined.

### Engine (`src/core/canvas/engine-layers.ts` + `canvas-engine.ts`)

5 novos métodos públicos:

```ts
engine.setPatternRole(id, role | undefined)
engine.setProcessRouting(id, processType, machineTargets)
engine.setLayerLocks(id, patch | null)
engine.convertToArea(id, role): boolean
engine.hasChildren(id): boolean
```

`convertToArea` é a operação **destrutiva** central: captura bounds em mm
do vetor selecionado, remove o objeto Fabric, cria um placeholder Rect
tracejado roxo (#a78bfa, dashArray [4,3]) no mesmo lugar, preserva o ID
original (invariante Onda 31), e troca o `LayerMeta` por
`VisualLayerMeta` com `patternRole`, `boundsMm`, e `fitMode: 'contain'`
para LOGO_AREA.

Rejeições do `convertToArea`:

- `role` ≠ TEXT_AREA/LOGO_AREA → false
- id inexistente → false
- objeto Fabric não encontrado → false
- camada principal com filhos → false (slot vazaria do aplique pai)

### Mapping M1/M2/M3 (`src/lib/machine-codes.ts`)

Single-source-of-truth da tradução:

```ts
M1 ↔ master-biro
M2 ↔ fiber-laser
M3 ↔ due-laser
```

Onda 33 persiste **códigos M1/M2/M3** em canvasJson. Quando a Onda 40
(export) for atacar, a tradução acontece nesse arquivo único — sem drift.

### UI (`PadraoEditorPage` + novo `PatternClassificationPanel`)

Painel mínimo abaixo do `ObjectPropertiesPanel`, aparece quando há camada
selecionada:

- Dropdown "Papel na spec" (5 valores + "Sem classificação")
- Dropdown "Processo" (3 valores + "Sem processo")
- 3 checkboxes M1/M2/M3 com rótulo humano (ex: "M1 (Master Biro)")
- 4 toggles de lock granular (Posição/Escala/Rotação/Estrutura)

Confirmação destrutiva: selecionar TEXT_AREA/LOGO_AREA no dropdown abre
um `Dialog` explicando "O vetor real vai ser removido". Toast.success
em conversão bem-sucedida, toast.error quando há filhos diretos.

Estética intencionalmente espartana — UI bonita fica para Ondas 34+.
Princípio "utilizável > bonito" mantido.

---

## Formato exato no canvasJson

Exemplo de pattern Onda 33 com 3 elementos classificados:

```json
{
  "version": "...",
  "objects": [
    /* fabric serialized */
  ],
  "capi": {
    "items": [{ "productId": "broche-60x25", "offsetX": 0, "offsetY": 0 }],
    "units": "mm",
    "schemaVersion": 3,
    "layers": [
      {
        "kind": "principal",
        "id": "uuid-1",
        "name": "Base broche",
        "appliqueId": "...",
        "materialId": null,
        "parentLayerId": null,
        "visible": true,
        "locked": false,
        "zIndex": 0,
        "originalBounds": { "left": 0, "top": 0, "width": 60, "height": 25 },
        "patternRole": "PRODUCT",
        "processType": "corte",
        "machineTargets": ["M1"]
      },
      {
        "kind": "visual",
        "id": "uuid-2",
        "name": "Contorno",
        "materialId": null,
        "parentLayerId": "uuid-1",
        "visible": true,
        "locked": false,
        "zIndex": 1,
        "patternRole": "CONTOUR",
        "processType": "corte",
        "machineTargets": ["M2"]
      },
      {
        "kind": "visual",
        "id": "uuid-3",
        "name": "Área Nome",
        "materialId": null,
        "parentLayerId": "uuid-1",
        "visible": true,
        "locked": false,
        "zIndex": 2,
        "patternRole": "TEXT_AREA",
        "boundsMm": { "x": 8, "y": 4, "width": 44, "height": 8 },
        "processType": "gravacao",
        "machineTargets": ["M2", "M3"],
        "lockGranular": { "structure": true }
      }
    ]
  }
}
```

---

## Testes (14 novos)

**`tests/lib/machine-codes.test.ts`** (5 testes):

1. Bijetividade `MACHINE_CODE_TO_ID` ↔ `MACHINE_ID_TO_CODE`
2. `machineCodeToId` — 3 valores corretos
3. `machineIdToCode` — 3 valores corretos
4. `machineIdToCode` retorna undefined pra id desconhecido
5. `MACHINE_LABEL` tem entrada para cada código

**`tests/core/canvas/pattern-meta.test.ts`** (9 testes):

1. `setPatternRole` grava + undefined remove
2. `setProcessRouting` dedupe e trunca em 3 itens
3. `setLayerLocks` patch parcial + null limpa
4. **Roundtrip** serialize → deserialize preserva os 6 campos
5. **Retrocompat** — canvasJson antigo (sem patternRole) abre OK
6. `convertToArea` — vetor removido, placeholder no mesmo lugar (stroke #a78bfa), ID preservado, boundsMm em mm
7. `convertToArea` LOGO_AREA seta `fitMode: 'contain'` automático
8. `convertToArea` rejeita role inválido e id inexistente
9. `hasChildren` retorna boolean correto

Suite total: **566 → 580 verdes** (+14, +2.5%).

---

## Decisões registradas

1. **Persistência em LayerMeta opcional** (decisão Gabriell) — escolhido sobre bucket separado para evitar criar mais um zumbi tipo `pattern_layers`. Spread em engine-serialization é zero-custo.
2. **`convertToArea` é destrutiva e preserva ID** — combinado o caminho mais alinhado com a spec ("AREA não salva curvas, salva bounds"). ID preservado pra não quebrar `parentLayerId` em filhos.
3. **Principal com filhos rejeita conversão** — slot vazaria do aplique pai e ficaria órfão na hierarquia.
4. **Vocabulário M1/M2/M3 spec direto** — mais curto, alinhado com docs. Mapeamento isolado em `lib/machine-codes.ts`.
5. **Validação "≥1 máquina obrigatória" adiada pra Onda 40 (export)** — Onda 33 só persiste o que veio. Engine deduplica + trunca a 3.
6. **`lockGranular` convive com `locked` legacy** — quando granular presente, vence. Onda 34 unifica.
7. **Painel separado em `PatternClassificationPanel.tsx`** — não inflar `ObjectPropertiesPanel`. Mantém componentes < 300 linhas (regra CLAUDE.md).
8. **`PadraoEditorPage` não foi refatorado** — apenas integração mínima (+95 linhas, todas localizadas). Refactor maior fica para ondas template-first depois (Onda 41+).

---

## O que NÃO foi feito (escopo explicitamente excluído)

- ❌ Nenhuma mudança em export (`svg-exporter`, `dxf-exporter`, `png-exporter`)
- ❌ Nenhuma mudança no fluxo de pedido (`NovoPedidoPage`, `PatternBar`)
- ❌ Nenhuma Asset Library (Onda 36)
- ❌ Nenhuma migration SQL
- ❌ `pattern_layers` continua zumbi (Onda 36)
- ❌ UI bonita (intencional — utilizável > polido)
- ❌ Detecção automática de PRODUCT/APPLIQUE/CONTOUR ao importar SVG (Onda 41)
- ❌ Aplicar pattern Onda 33 em pedido (Onda 45)
- ❌ Locks granulares conectados em flags Fabric (Onda 34)
- ❌ Refactor da `PadraoEditorPage` para template-first (Onda 41+)

---

## Próximos passos sugeridos

A Onda 33 entregou a fundação. As próximas ondas podem ir em 3 direções:

1. **Onda 34 — Locks granulares unificados** (1-2 dias). Conecta o
   `lockGranular` aos `lockMovementX/Y/ScalingX/Y/Rotation` Fabric.
   Implementa `structure` lock via validação no engine. Migração 1-pra-N
   do `LayerMeta.locked: boolean` legacy.

2. **Onda 35 — Modelo de tipos formal** (3-4 dias). Promove
   `patternRole` opcional → discriminator real da union LayerMeta.
   Migra canvasJson `schemaVersion=3 → 4`. Faz PRODUCT/APPLIQUE/CONTOUR
   virarem tipos formais, eliminando `kind: 'principal'|'visual'|'operation'`
   ambíguo. Pré-requisito de Ondas 37+ (AREA vs ASSET).

3. **Onda 36 — Asset Library unificada** (3-5 dias). Página `/banco`
   substituída por tabs (Produtos, Apliques, Logos, TextosPadrao,
   Contornos, GravacoesPadrao, Marcacoes). Inclui remover tabelas zumbi
   (`pattern_layers`, `order_overrides`).

Decisão de qual atacar primeiro depende do que doer mais no fluxo
template-first do operador. Recomendação: **Onda 34** se a UX de locks
granulares for a próxima dor visível, **Onda 35** se prioridade é
fechar o modelo de tipos antes de mexer em UI extra.

---

## Métricas

| Métrica                               | Antes Onda 33                    | Depois Onda 33                                                                       | Δ    |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ | ---- |
| Schema `LayerMeta` — campos opcionais | 3 (opacity/colorLabel/blendMode) | 9                                                                                    | +6   |
| `engine-layers.ts` linhas             | 681                              | 909                                                                                  | +228 |
| `canvas-engine.ts` linhas             | 2.250                            | 2.331                                                                                | +81  |
| Novos arquivos                        | —                                | 4 (machine-codes, PatternClassificationPanel, pattern-meta.test, machine-codes.test) | +4   |
| Testes verdes                         | 566                              | 580                                                                                  | +14  |
| Tabelas SQL                           | 22                               | 22                                                                                   | 0    |
| Migrations SQL                        | 12                               | 12                                                                                   | 0    |
| `PadraoEditorPage.tsx` linhas         | 492                              | 649                                                                                  | +157 |
| Typecheck                             | ✅                               | ✅                                                                                   | OK   |
| Lint errors                           | 0                                | 0                                                                                    | OK   |
| API pública alterada                  | —                                | apenas adição (5 métodos novos)                                                      | OK   |
