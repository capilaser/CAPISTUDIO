# ADR 008 — Estrutura Hierárquica de Camadas + Bancos de Componentes

**Data:** 2026-05-07
**Status:** Aceito
**Implementação:** Onda 6 (estrutura de camadas + canvas) e Onda 6.5 (bancos de componentes)

---

## Contexto

Durante o planejamento da Onda 6, três informações estruturais novas surgiram da
conversa com o usuário (dono da empresa de gravação a laser) e precisam ser
formalizadas antes de qualquer implementação:

1. **Camadas têm hierarquia.** Uma camada principal representa uma **peça física**
   (base, aplique). Cada peça tem **sub-camadas de operação** (gravação, marcação,
   corte) que serão executadas na máquina sobre aquela peça.
2. **Componentes reutilizáveis vivem em bancos.** Apliques, gravações e marcações
   recorrentes não devem ser desenhadas a cada padrão — ficam catalogadas em bancos
   próprios, arrastáveis pro canvas.
3. **SVGs importados são tratados apenas pelos contornos.** Cores internas, fills
   e estilos do Corel são descartados na importação. O Capi pinta a peça via
   textura PNG (Onda 5), nunca via fill do SVG original.

O modelo de camadas atual (Ondas 3-5 fechadas) é **flat**: todos os objetos do
canvas vivem no mesmo nível, sem agrupamento por peça física. Isso funcionou pra
broche simples (1 peça), mas não escala pra placa com múltiplos apliques.

---

## Decisão

### 1. Hierarquia de camadas

```
CAMADA PRINCIPAL (peça física)
├── id, name, zIndex, visible, locked
├── svg (contorno da peça, do Corel)
├── textureId (FK → textures, opcional)
└── SUB-CAMADAS DE OPERAÇÃO
    ├── id, name, parentLayerId
    ├── kind: "production"
    ├── operation: corte | gravação | marcação | aplique | contorno | corte-laser | gravação-aplique
    ├── machines[]: array de FKs → machines
    ├── content: SVG, texto, ou logo (objeto Fabric)
    └── (sub-camadas NÃO podem ter filhos — só 2 níveis)
```

**Regras invariantes:**

- Toda camada principal **tem pelo menos 1 sub-camada de operação** (a operação que
  produz a peça em si — geralmente "corte").
- Sub-camada **obrigatoriamente** tem `operation` (1 de 7) + `machines` (1 a 3
  máquinas, mínimo 1).
- Hierarquia é **fixa em 2 níveis**: principal → operação. Sem sub-sub-camadas.
- Mover sub-camada entre camadas principais é permitido (drag).

### 2. Bancos de Componentes

Três bancos novos, todos seguindo o padrão da tabela existente `svg_bases`:

| Banco                  | Tabela       | Conteúdo                                                                     | Exemplo                                                                                             |
| ---------------------- | ------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Banco de Apliques**  | `appliques`  | SVG do contorno da peça aplicada                                             | "Aplique Dourado D", "Aplique Retangular"                                                           |
| **Banco de Gravações** | `engravings` | SVG de elementos gráficos pra gravar (logos genéricos, ícones, ornamentos)   | "Símbolo de Justiça", "Caduceu Médico"                                                              |
| **Banco de Marcações** | `markings`   | SVG de marcações pré-cadastradas (alfabetos pra corte, contornos referência) | "Letras Centrale Sans para corte", "Contorno Aplique 2 (mesmo do banco apliques, mas pra marcação)" |

Schema padrão pra cada uma das 3 tabelas:

```typescript
{
  id: text PRIMARY KEY,
  name: text NOT NULL,
  filePath: text NOT NULL,        // SVG no appData
  thumbnailPath: text,            // PNG miniatura
  widthMm: real,                  // dimensão real do SVG
  heightMm: real,
  tags: text (JSON array),
  metadata: text (JSON, opcional) // dados específicos do tipo
  createdAt: integer (timestamp),
  deletedAt: integer (timestamp, soft delete)
}
```

### 3. Tratamento de SVG importado

**Regra firme:** ao importar SVG (banco de bases, apliques, gravações, marcações,
ou upload livre), o Capi **descarta toda informação de cor**:

- `fill="#xxx"`, `stroke="#xxx"` → ignorados na renderização
- Classes CSS internas (`.fil0`, `.fil1`...) → ignoradas
- `<style>` interno → descartado
- `<font>` embutida do Corel → descartada (Capi usa fontes do banco próprio)

O que é **preservado**:

- Contornos (`<path>`, `<rect>`, `<circle>`, `<polygon>`)
- ViewBox (fonte autoritativa de coordenadas — mantém regra do ADR 005)
- Dimensões reais em mm declaradas no header

**Renderização visual:**

- Cor do contorno = sempre `stroke: var(--ink-700)` no canvas, fino (~0.5pt)
- Preenchimento = textura PNG do material (Onda 5), nunca fill direto

**Justificativa:** Corel exporta SVG com fills, mas no Capi a cor da peça vem
sempre da textura escolhida. Manter fills do Corel polui o canvas e cria conflito
com o sistema de texturas.

### 4. Mapeamento das fixtures de teste

Os SVGs reais do usuário ficam em `tests/fixtures/` como **referência oficial**:

```
tests/fixtures/
├── camadas-base/
│   ├── broche-simples.svg          → CAMADA_0_-_BROCHE.svg (60x25mm, path único)
│   ├── broche-completo.svg         → LOGO___NOME___TRAÇO.svg (broche montado, referência visual)
│   ├── placa-base.svg              → PLACA_2_camada_0.svg (300x90mm, retângulo arredondado)
│   └── placa-completa.svg          → PLACA_INTEIRA.svg (placa montada, referência visual)
├── apliques/
│   ├── aplique-1-formato-D.svg     → APLIQUE_1.svg (100x90mm)
│   ├── aplique-2-pill.svg          → APLIQUE_2.svg (95x15mm, retângulo arredondado)
│   └── aplique-3.svg               → 1778198937249_APLIQUE_3.svg
└── README.md (descreve cada fixture)
```

**Fixture oficial da Onda 6:** placa base + 3 apliques (cenário B definido com
o usuário em conversa de planejamento).

---

## Consequências

### Schema (mudanças necessárias)

1. **Nova coluna em `pattern_slots`:** `parentLayerId text` (FK self-reference,
   nullable até a camada existir).
2. **Nova tabela `pattern_layers`** — a camada principal:
   ```typescript
   {
     (id,
       patternId,
       name,
       zIndex,
       visible,
       locked,
       svgFilePath,
       textureId,
       widthMm,
       heightMm,
       positionXmm,
       positionYmm); // posição da camada no canvas
   }
   ```
3. **3 novas tabelas de bancos:** `appliques`, `engravings`, `markings`.
4. **Migration nova** (`drizzle-kit generate`) embarcada no binário.

### LayerMeta (no canvasJson)

Tipo expandido:

```typescript
type LayerMeta = {
  id: string;
  parentLayerId: string | null; // null = camada principal
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  kind: 'principal' | 'operation' | 'visual';
  operation?: string; // obrigatório se kind === "operation"
  machines?: string[]; // obrigatório se kind === "operation"
};
```

### UX implícita

- Painel de slots (Onda 6) renderiza agrupado por camada principal.
- Painel de camadas (Onda 7) mostra árvore expandível: principal → operações.
- Criar padrão (Onda 8.5): arrasta camada base + arrasta apliques + define slots.
- Adicionar aplique a pedido aprovado: `+Adicionar` no painel → escolhe do banco
  de apliques → vira nova camada principal no canvas.

### Implementação

- **Onda 6 (B+):** schema + canvas + painel de slots agrupado. Implementa hierarquia
  real, **mas só lê** dos bancos (não cria UI de gerenciamento).
- **Onda 6.5:** UI dos bancos (CRUD básico de apliques/gravações/marcações no Banco
  de Ativos). Pode ser feita em paralelo ou logo depois.
- **Onda 7:** painel de camadas hierárquico, edição de TIPO+MÁQUINA, drag entre
  camadas.

---

## Não-objetivos (NÃO entra agora)

- Sub-sub-camadas (sub-camada com filhos). Hierarquia é **2 níveis fixos**.
- Variantes de aplique (mesmo aplique em tamanhos diferentes). Fica pra Fase 2.
- Compartilhamento de bancos entre instalações. Fica pra Fase 2 (cloud sync).
- Editor vetorial de aplique dentro do Capi. Apliques vêm prontos do Corel,
  sempre. Capi não substitui Corel, apenas usa os SVGs gerados.

---

## Follow-up

- [ ] Onda 6 — implementar schema + canvas + painel de slots (Caminho B+)
- [ ] Onda 6.5 — UI de gerenciamento dos 3 bancos no Banco de Ativos
- [ ] Onda 7 — painel de camadas com edição completa
- [ ] Onda 8.5 — fluxo de criação de padrão usando bancos
- [ ] Validar: parser de SVG descarta cores corretamente em todas as 4 tabelas de
      origem (svg_bases, appliques, engravings, markings)
