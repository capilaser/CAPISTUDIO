# ADR 008 — Onda 5: Texturas como propriedade de camada

**Status:** Aceito
**Data:** 2026-05-06
**Onda:** 5

---

## Contexto

A Onda 5 implementa a aplicação de materiais (PNGs ABS Escovado) nas
camadas visuais do canvas. Os 4 PNGs e os registros em `materials` já
existem desde a Onda 1. O asset protocol Tauri 2.x foi habilitado na
Onda 4.5. O trabalho desta onda é:

1. Vincular material a camada
2. Renomear débito técnico (`patterns.default_texture_id` → `default_material_id`)
3. UI de seleção: 2 dropdowns encadeados (família → cor)
4. Re-implementar `applyMaterialToSvg` do v1: PNG clipado pelo SVG base
5. Cache `MATERIAL_PNG_CACHE` para troca instantânea

---

## Decisões

### 1. Textura é propriedade de camada (LayerMeta.materialId)

**Decisão:** `LayerMeta` ganha `materialId: string | null`.

**Alternativas descartadas:**

| Alternativa                                     | Motivo do descarte                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Estado Zustand store                            | Volátil — perde ao fechar app, sem persistência nativa                          |
| `patterns.defaultMaterialId` (único por padrão) | Confunde padrão mestre com arte do pedido — viola separação RF-3.8              |
| Campo dedicado em `orders`                      | Duplica informação já presente no `canvasJson` — fonte da verdade seria ambígua |

**Raciocínio:** O `canvasJson` é a fonte da verdade do estado visual do
canvas (ADR 005). `LayerMeta` já carrega `kind`, `operation`, `machines`
— o `materialId` tem a mesma natureza: é metadado da camada, não do
padrão nem do pedido em si. Cada camada visual pode ter material
próprio, o que suporta a Onda 5.5 (placa composta).

**Default de material por padrão:** `patterns.defaultMaterialId` define
qual material a camada visual herda ao abrir um padrão. Override no
pedido salvo em `orders.canvasJson` — padrão mestre nunca é tocado.

---

### 2. Renomeação defaultTextureId → defaultMaterialId

**Débito técnico:** Na Onda 1, a tabela `textures` foi renomeada para
`materials`, mas a coluna `patterns.default_texture_id` ficou com o
nome antigo e FK apontando para tabela inexistente.

**Decisão:** Migration `0004_rename_default_texture_to_material.sql`
renomeia a coluna e atualiza o FK para `materials(id)`.

**Impacto:** Nenhum dado existente é perdido. Padrões sem material
atribuído permanecem com `NULL` — comportamento correto.

---

### 3. Material acessível em ambos os modos (Operador e Designer)

**Decisão:** Os 2 dropdowns de material ficam visíveis nos dois modos.
**Não** vão atrás do toggle "Edição Avançada".

**Raciocínio:** Material é parte do fluxo operacional primário — o
Operador precisa escolher Prata vs Rose Gold antes de salvar o pedido.
Esconder material atrás de um toggle avançado quebraria o fluxo de
Arte Rápida (CLAUDE.md fluxo 1, passo 3–4).

**Impacto nos requisitos:** RF-3.1, RF-3.2 e RF-3.3 do
`02-REQUIREMENTS.md` descrevem Modo Operador como "menos
funcionalidades" que Modo Designer. Essa decisão formaliza que
**Operador vs Designer é diferença de layout, não de permissão.**

---

### 4. Operador vs Designer é layout, não permissão

**Antes (RF-3.1 implícito):** Operador = subconjunto restrito de
funções. Designer = tudo mais.

**Agora (formalizado neste ADR):**

- Mesmas funções disponíveis nos dois modos
- **Operador:** layout enxuto, ferramentas avançadas atrás do toggle
- **Designer:** layout completo, tudo visível por padrão

**O toggle "Edição Avançada" no Operador esconde APENAS:**

- Criação/mover/redimensionar slots
- Propriedades numéricas em mm (painel X, Y, W, H)
- Réguas e guias visuais
- Ungroup vetorial (Ctrl+U)

**Acessível nos dois modos (sem toggle):**

- Upload e troca de logo
- Edição de nome e profissão
- Troca de material/cor ← formalizado nesta onda
- Seleção de fonte
- Painel de camadas (Opção D-completa, ver ADR 009)
- Histórico (Ctrl+Z / Ctrl+Y)
- Salvar pedido / exportar

---

### 5. UI: 2 dropdowns encadeados, sem thumbnail real

**Decisão:**

- Dropdown 1: família (`SELECT FROM material_families`)
- Dropdown 2: cor (`SELECT FROM materials WHERE family_id = ?`)
- Item do Dropdown 2: bolinha `swatch` (hex, **16px**) + label
- **SEM thumbnail real do PNG** no dropdown
- Página de teste `/dev/materials-test` (Checkpoint A): bolinha **24px**
  - label + thumbnail PNG real (apenas para validação visual da
    Onda 5, não vai pra UI final)

**Raciocínio:** Thumbnail do PNG requer carregamento assíncrono via
asset protocol, adiciona complexidade sem ganho funcional relevante.
O swatch hex (já seedado) é suficiente para identificação visual de
cor. A textura real aparece imediatamente no canvas após seleção.

**Posição:** Painel lateral direito, contextual à camada visual
selecionada. Some quando não há camada visual selecionada.

---

### 6. applyMaterialToSvg — algoritmo a confirmar no Checkpoint C.0

**Referência v1:** Função `applyMaterialToSvg` (ou equivalente) no
`renderer/index.html` do v1 (em
`C:\Users\Gabriell\Desktop\PROGRAMÃO\renderer\index.html`).

**Estratégia a confirmar no Checkpoint C.0:** O v1 implementa clip
do PNG pelo contorno do SVG da base. Algoritmo exato (clone +
clipPath, mask, ou composite) será confirmado lendo
`renderer/index.html` antes de re-implementar. **Atualizar este ADR
com o algoritmo real na Fase Final** após implementação.

**Implementação v2 (estrutura, independente do algoritmo):**

- Módulo puro: `core/canvas/material-applier.ts`
- Função: `applyMaterialToSvg(svgGroup: fabric.Group, img: HTMLImageElement)`
- Zero dependência de DOM além do que o Fabric.js exige
- Testável com mocks de Fabric

**Filtro obrigatório:** `kind === 'visual'` — camadas `production`
ignoram `materialId` totalmente.

---

### 7. Cache MATERIAL_PNG_CACHE

**Decisão:** `Map<materialId, HTMLImageElement>` pré-carregado no boot.

**Raciocínio:** Os 4 PNGs ABS Escovado têm tamanho fixo e são sempre
necessários. Pré-carregar no boot garante troca < 100ms (meta RF-8.1).
Mesmo padrão do `FontLoader` da Onda 4.5.

**Acesso runtime:** `resolveResource('resources/materials/X.png')` +
`convertFileSrc(absPath)` — igual às fontes. Asset protocol já
configurado com `scope: ["**"]`.

---

### 8. Escopo Onda 5: broches simples (1 camada visual com material)

**Incluído:**

- 1 peça, 1 material na camada visual base
- 4 PNGs já seedados (ABS Escovado: Prata, Rose Gold, Dourado, Bronze)
- Persistência em `canvasJson` (patterns e orders)
- Default via `patterns.defaultMaterialId`

**Excluído (Onda 5.5):**

- Placa composta: múltiplas camadas com materiais diferentes
- Cada letra do grupo com material individual

---

### 9. Camada visual sem material atribuído — fallback cinza neutro

**Decisão:** Quando `LayerMeta.materialId === null`, a camada visual
renderiza com **fill cinza neutro** (`ink-400` da paleta — `#8a8e92`)
e contorno do SVG normal.

**Raciocínio:** Estado neutro/incompleto deve ser visualmente óbvio
mas não alarmante. Cinza médio comunica "ainda não tem material" sem
confundir com erro. Bate com idioma industrial-utilitário (Lightburn
usa cinzas pra estado neutro).

**Não fazer:**

- ❌ Xadrez de transparência (vibe Photoshop, fora do idioma)
- ❌ Borda vermelha (sugere erro, mas ausência de material não é erro)
- ❌ Placeholder com texto

---

## Impacto em requisitos

`projeto/02-REQUIREMENTS.md` foi atualizado com:

1. **RF-3.1** — parágrafo adicionado: "Operador vs Designer é diferença
   de layout, não de permissão."
2. **RF-3.2** — seção reescrita: layout em 3 zonas + ações mapeadas por zona.
3. **RF-3.3** — nota adicionada: lista do que o toggle esconde no Operador.
4. **RF-3.10 (novo)** — "Aplicação de materiais às camadas"
5. **RF-3.11 (novo)** — "Sidebar esquerda hierárquica"
6. **RF-3.12 (novo)** — "Topbar de padrões inline"

---

## Pendências futuras (follow-up documentado)

| Item                                                                             | Onda        |
| -------------------------------------------------------------------------------- | ----------- |
| Placa composta (múltiplas camadas com materiais diferentes)                      | 5.5         |
| Undo formal de troca de material (hoje best-effort via Fabric)                   | 11          |
| Atualizar `01-DATABASE.md`: textures→materials, colunas corretas                 | backlog     |
| Restringir asset protocol scope de `["**"]` pra `["$RESOURCE/**"]` antes do .msi | pré-release |

---

## Referências

- ADR 005 — Canvas engine Fabric.js, mm, viewBox autoritativo
- ADR 007 — Banco de fontes: asset protocol OPT-IN, resolveResource path
- ADR 009 — Layout Onda 5: sidebar esquerda + topbar de padrões
- `src/data/schema.ts` — definição de `LayerMeta` e `materials`
- `projeto/02-REQUIREMENTS.md` RF-3.1, RF-3.3, RF-3.5, RF-8.1
- `projeto/06-VISION.md` — visão estendida do produto (registro de visão futura)

---

## Implementação final (Onda 5 — Checkpoint C)

### Algoritmo definitivo

Decisão arquitetural validada após investigação de 2 cenários:

- ✅ **ESCOLHIDO:** `fabric.clipPath` com `absolutePositioned: true` + `fabric.Pattern` como `fill` (estratégias ortogonais no pipeline `Object.ts > drawObject`)
- ❌ **DESCARTADO:** canvas off-screen pré-renderizado + `fabric.Pattern` com clip "baked"

**Razão da escolha:** `Pattern` + canvas off-screen falhou quando o objeto Fabric é maior que o produto — o `patternTransform` escalava o canvas inteiro junto com o clip. O Cenário 1 (`clipPath absolutePositioned`) é idiomático Fabric e mantém o clip "parado" no canvas independente do tamanho do objeto.

---

### Fix de origin obrigatório

Ao criar `fabric.Path` como `clipPath`, é **obrigatório** passar `originX: 'left'` e `originY: 'top'`. Sem isso, Fabric usa `'center'` como default e auto-centraliza o path nas coordenadas do bounding box, gerando clipPath em posição errada (observado: `left=-91, top=-38.5` em vez de `left=0, top=0`).

---

### Strip + Restore simétrico em serialize()

O `clipPath` é derivado de `productPaths` (estado interno da engine, não do JSON salvo). Ao serializar:

1. Strip do `fill` (Pattern) e do `clipPath` (set `transparent` / `undefined`)
2. `canvas.toObject()` — JSON limpo, sem estado derivado
3. Restore simétrico de ambos na mesma iteração

No `deserialize`, `applyMaterialToLayer` re-cria o `clipPath` via `buildProductClipPath()` deterministicamente a partir do SVG do produto.

---

### Performance medida (RF-8.1)

Validação empírica com botão temporário no `RightPanel` (removido após medição):

| Rodada           | Média    | Mínimo  | Máximo   |
| ---------------- | -------- | ------- | -------- |
| 1 — cold parcial | 18.12 ms | 0.20 ms | 32.30 ms |
| 2 — cache quente | 0.24 ms  | 0.10 ms | 0.40 ms  |
| 3 — cache quente | 0.18 ms  | 0.10 ms | 0.30 ms  |
| 4 — cache quente | 0.20 ms  | 0.10 ms | 0.30 ms  |

**Meta RF-8.1 (< 200ms): atendida com folga em todos os cenários.**

- Pior caso (cold path): **32.3 ms** — 6× abaixo da meta
- Caso quente: **< 0.5 ms** — 400× abaixo da meta

`materialImageCache` + `preloadMaterials` no boot reduzem trocas de ~30 ms para < 0.5 ms (≈ 60× mais rápido).

---

### Riscos conhecidos do Fabric.js 6.9.1

| #   | Issue                                                                                               | Impacto atual                                                                                | Follow-up                                                           |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **#8517** — `toDataUrl()` com `clipPath absolutePositioned` tem bug                                 | Não afeta canvas visual nem `serialize/deserialize` (usa `canvas.toObject`, não `toDataUrl`) | Validar exportação PNG na Onda 9 e aplicar workaround se necessário |
| 2   | **#7742** — `fabric.Group` como `clipPath` com `absolutePositioned` tem comportamento inconsistente | Mitigado: compound path string (`productPaths.join(' ')`) em vez de `fabric.Group`           | Sem ação necessária                                                 |

---

## Lições aprendidas

### 1. Causa raiz vs sintoma

As "2 linhas cinzas" no print inicial pareciam um bug do clip, mas eram o `stroke` do SVG do broche sendo desenhado por cima da textura pelo Fabric (`drawObject` aplica `stroke` após `fill`). A heurística A2 (expandir rect insetado pelo stroke) foi implementada e depois revertida após experimento decisivo — remover o `stroke` do SVG por 30 segundos provou que o clip sempre esteve correto.

### 2. Separação visual/production

O stroke cosmético no `canvas-test` é aceitável: na Onda 6/9, o broche terá `kind='production'` e não renderizará no PNG mockup — só irá para o SVG de exportação. Não é bug, é comportamento esperado de visualização de dev.

### 3. Princípio: experimento antes de teoria

Quando há problema visual ambíguo, o teste mais barato (remover stroke, trocar cor, simplificar SVG) deve vir **antes** de fix arquitetural. O experimento de 30 segundos evitou um fix de código desnecessário e revelou a causa raiz real.
