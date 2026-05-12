# ADR 016 — Onda 9: Exportação por máquina/operação + PNG mockup

**Data:** 2026-05-11
**Status:** Aceito (Fases 9A–9F entregues)
**Implementação:** Onda 9 (8 commits A–E + 5 commits F + docs = 14 commits)

---

## Contexto

A Onda 9 entregou o subsistema de **exportação** do Capi Studio:

- **Banco operacional de marcações** (3º banco, espelho de apliques/gravações)
- **Motor SVG por máquina/operação** com cores semânticas e texto vetorizado
- **Motor PNG mockup** em 300 DPI com texturas
- **UI de exportação PNG** (dialog com auto-fill, persistência de pasta, abertura
  automática do Explorer)

**Mudança de escopo durante a fase 9F:** o Gabriell revelou que o fluxo real
de negócio dele não pode liberar SVG production sem aprovação prévia do
cliente:

> 1. Faz arte → salva pedido → gera **PNG** → manda pro cliente
> 2. Cliente pede ajuste → edita → gera PNG novo
> 3. Cliente **aprova** → aí sim SVG production é liberado pra máquina

Sem status de aprovação, o usuário pode exportar SVG errado e mandar
pra produção. Por isso a **UI de export SVG ficou pra Onda 11** (junto com
status de pedido + tela de aprovação). O motor SVG está pronto, testado
e esperando.

---

## Decisões

### 1. Cores semânticas no SVG production

Cada operação tem cor de stroke fixa que o software laser interpreta:

| Operação | Cor      | Hex       |
| -------- | -------- | --------- |
| corte    | preto    | `#000000` |
| marcação | azul     | `#0000FF` |
| gravação | vermelho | `#FF0000` |

**Por quê:** padrão herdado do v1 e do fluxo do Gabriell na máquina. Software
de laser lê stroke (não fill) como caminho a executar — output é `stroke-only,
fill: none`.

### 2. SVG sempre em mm puros (sem px/DPI)

```svg
<svg width="300mm" height="90mm" viewBox="0 0 300 90">
```

Coordenadas dos paths reescaladas via `<g transform="scale(0.25)">` que
empacota o output do Fabric (que é em px). Reaproveita `obj.toSVG()` sem
ter que reparsear paths.

**Por quê:** o software de laser dele lê mm direto. Sem precisar configurar
DPI, sem ambiguidade, sem perda de precisão.

### 3. Z-order do canvas preservado no SVG

Ordem em `canvas.getObjects()` (z-order Fabric: 0 = fundo, último = topo)
vira ordem de elementos no SVG. Último renderizado = visualmente no topo.

**Por quê:** se o usuário sobrepôs gravação numa região do aplique e a
gravação ficou por cima visualmente, a produção precisa respeitar isso.

### 4. Texto vetorizado via opentype.js

Texto não vai como `<text>` — vira `<path d="…">` produzido por
opentype.js a partir da fonte real do banco. Operação default = `gravacao`
(briefing — texto é gravação normalmente). Machines herdadas do
`PrincipalLayerMeta` pai (aplique).

**Override por slot:** `SvgExportOptions.textRouting` aceita um Map
`textId → {operation, machines?}` que substitui o default. Preparado
pro dialog de confirmação da Onda 11 permitir o usuário trocar a
operação de cada slot de texto antes de exportar.

**Limitação documentada:** opentype.js falha com Roboto Slab Variable
(GSUB substFormat 2 não suportado). Fallback graceful: o texto vira
placeholder XML + callback `onTextConversionError` pra UI mostrar toast.
Outras 4 fontes bundled funcionam (Bebas, Montserrat, Caveat, Playfair).
Ver IDEA `fontes-variable-suportadas-opentype.md`.

### 5. PNG mockup em 300 DPI com texturas via Fabric Pattern nativo

`canvas.toDataURL({ multiplier: dpi/101.6 })` renderiza Pattern fills
nativamente em Canvas2D. Texturas (PNGs da Onda 5 aplicadas como
`fabric.Pattern`) **aparecem automaticamente** no PNG, sem
reimplementação.

`MM_TO_PX = 4` significa canvas nativo = 4 px/mm = 101.6 px/inch. Pra
300 DPI, multiplier ≈ 2.9527. Fórmula exposta em `dpiToMultiplier()`.

### 6. Naming de arquivo

`{normalizeAssetName(cliente)}-{normalizeAssetName(profissao)}_mockup.png`

- `"João Silva" + "Advogado"` → `"joao-silva-advogado_mockup.png"`
- Cliente vazio → `"mockup.png"` (placeholder previsível)
- `normalizeAssetName` (Onda 8.5): NFD desacentação + lowercase +
  espaços → hífen + remove caracteres não [a-z0-9.-]

Pra SVG production (Onda 11), naming será
`{Nome-Profissao}_{MaquinaPascalCase}.svg` (ex.
`JoaoSilva-Advogado_FiberLaser.svg`).

### 7. AssetLookupFn injetado (svg-exporter)

O motor SVG não importa repositories diretamente. Recebe
`AssetLookupFn = (id) => Promise<AssetExportInfo | null>` como dependência
injetada. Em runtime a UI compõe um lookup que tenta os 3 bancos
(applique → engraving → marking); em testes recebe `vi.fn()` mock.

**Por quê:** mantém o motor como core puro (testável em Node sem
Tauri/SQLite) + facilita reuso futuro (export em lote, cache pré-aquecido,
etc).

### 8. TauriIO injetado (png-export-service)

Mesma estratégia pro orquestrador PNG: o service não importa
`@tauri-apps/plugin-*`. Recebe `TauriIO` (writeFile/openFolder/documentDir/
joinPath) como interface injetada. Runtime: `makeTauriIO()` em arquivo
separado compõe os plugins reais. Testes: mock plain.

### 9. SVG production sem UI de aprovação fica pra Onda 11

Decisão de produto crítica revelada na Fase 9F. **Motor SVG não é tempo
perdido** — está testado (15 testes svg-exporter + 13 svg-text-converter +
2 textRouting), aguardando ser chamado pela Onda 11 quando o pedido
for aprovado. Ver IDEA `onda-11-svg-production-com-aprovacao.md`.

### 10. Texto solto sem aplique pai → erro explícito

`VisualLayerMeta` de texto sem `parentLayerId` apontando pra um
`PrincipalLayerMeta` (aplique) lança erro de rota com mensagem clara.
Texto override via `textRouting` com `machines` explícito pode pular
essa exigência (caso futuro: exportar texto pra máquina diferente do
aplique).

### 11. Roteamento de routing por LayerMeta.kind

| LayerMeta.kind               | Routing                                        |
| ---------------------------- | ---------------------------------------------- |
| `principal` (aplique)        | `assetLookup(appliqueId)`                      |
| `visual` com `engravingId`   | `assetLookup(engravingId)`                     |
| `visual` com `markingId`     | `assetLookup(markingId)`                       |
| `visual` (texto fabric.Text) | `gravacao` + machines do principal pai         |
| `visual` (rect/slot avulso)  | **erro** — sem rota                            |
| `operation`                  | ignorada (sub-layer sem objeto Fabric próprio) |

### 12. Persistência de pasta de export em settings

`settings.export.lastFolder` armazena a última pasta usada. Próxima
exportação usa como default. Override via dialog "Escolher…" sobrescreve.

**Por quê:** Gabriell usa pasta fixa pra exports do dia-a-dia. Re-escolher
toda vez seria ergonomicamente ruim. Settings.export.\* é prefix
reservado pra futuras opções (DPI default, formato default, etc.)

### 13. Permissões Tauri 2 capabilities

Tauri 2 substitui `tauri.conf.json plugins.*.allow` por capabilities
explícitas em `src-tauri/capabilities/default.json`. Onda 9.F adiciona:

```json
"dialog:default", "dialog:allow-open", "dialog:allow-save",
"fs:default", "fs:allow-write-file", "fs:allow-mkdir",
{ "identifier": "fs:scope", "allow": [{ "path": "**" }] },
"shell:default", "shell:allow-open"
```

`fs:scope` em `**` autoriza escrever em qualquer pasta — necessário
porque o Gabriell pode escolher pasta arbitrária no dialog.

---

## Consequências

### Positivas

- **Fluxo pronto pro dia-a-dia:** o Gabriell já consegue gerar PNG mockup
  pro cliente. Único caminho realmente urgente (briefing do negócio).
- **Motor SVG pronto sem retrabalho:** Onda 11 chama `exportSvgByMachine`
  com `textRouting` opcional do dialog de aprovação. API estável,
  testes 100%.
- **Core puro testável:** motores não dependem de Tauri/SQLite — testes
  rodam puros em Node + jsdom.
- **5 abas no painel direito** (Apliques + Gravações + **Marcações** +
  Materiais + Camadas) cobrem o fluxo completo de composição.

### Negativas / debt

- **Roboto Slab Variable não vetoriza** — texto com essa fonte vira
  placeholder XML. Solução real fica pra IDEA quando virar dor.
- **slot-manager.ts ganhou getter `getSlotText`** — quebra cirúrgica
  da regra "arquivos travados", autorizada explicitamente. Pure read,
  com 3 testes dedicados, baixo risco de regressão.
- **Sem testes UI do dialog** — Tauri plugins difíceis de mockar em
  React Testing Library. Cobertura via service unitário (13 testes) +
  integração e2e (1 teste de fluxo completo).

---

## Reuso futuro

- **Onda 10 (UI cadastro de bancos):** vai usar `exportPngMockup` pra
  preview de SVG individual no upload (rasterização rápida).
- **Onda 11 (histórico + aprovação):** vai usar `exportSvgByMachine` +
  `textRouting` Map do dialog de aprovação + `savePng` adaptado pra
  múltiplos arquivos por máquina.
- **`engine.getSlotText`:** Onda 11 vai chamar pra renderizar resumo
  do pedido na tela de histórico.
- **`settings.export.lastFolder`:** Onda 11 reusa a mesma pasta default;
  pode adicionar `settings.export.lastFolderProduction` se SVG separar
  semanticamente.
