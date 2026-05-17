# Capi Studio — Status pós-Onda 16

> **Snapshot da sessão 2026-05-17.** Use junto com `AI-CONTEXT.md` pra entender estado real.
> Próxima onda planejada: **Onda 17 — PNG Mockup profissional**.

---

## Estado real do código (baseline)

- **typecheck**: ✅ verde
- **lint**: ✅ 0 errors (5 warnings cosméticos)
- **testes**: ✅ 410/410 passando
- **dev server**: `npx tauri dev` na raiz do projeto

---

## Ondas entregues nesta sessão

### Onda 13 — Multi-broche empilhado (anterior)

- `order_items` por pedido, cada um é um broche
- Canvas único mostra prancha empilhada
- `useBoardEngine` orquestra montagem

### Onda 13.5 — Persistência (anterior)

- Salvar pedido → `createWithItems` / `saveRevision`
- Reabrir pedido por `?id=`

### Onda 13.6 — Canvas único da prancha (anterior)

- 1 engine, N broches via `addAppliqueSvg` posicionado

### Onda 14 — Padrões + Logo upload (anterior)

- `PatternBar` aplica patterns
- `applyPatternObjects` adiciona slots+decorativos em offset
- `LogoSlotItem` + banco de logos

### Onda 14b — Material + reabrir + 7 patterns (anterior)

- Trocar material via `MaterialChanger`
- Editor de padrões MVP (`/padroes`, `/padroes/novo`)
- 14b-schema (migration v12): `orders.board_canvas_json` + `order_revisions.board_canvas_json` — limpa gambiarra de Onda 13.7

### Onda 14c — CRUD/tags/painel propriedades/formas decorativas (entregue)

- `/padroes`: editar, duplicar, deletar, tags, thumbnail SVG no card
- Editor de padrões: painel X/Y/W/H em mm, formas decorativas (borda, traço H/V, retângulo)
- `getAllPatternsForListing()` para listagem com canvasJson

### Onda 15 — Sistema de Camadas (entregue)

- `LayerPanel` plugado em `/arte/novo` (sidebar direita) e `/padroes/editar/:id`
- `LayerNode` discriminado: principal / visual / operation com `operation` + `machines`
- Badges visuais: pill colorido (corte/gravação/marcação) + contador "N op" nos principais
- Tudo já tinha sido feito na Onda 7 — só plugou e refinou

### Onda 15.fix — Fundação estável (entregue)

**7 fixes críticos baseados em auditoria /hm-engineer:**

1. **N+1 no boot** → `Promise.all` paraleliza queries de products/materials/patterns
2. **`dispose()` completo** → limpa `materialImageCache`, callbacks, `SlotManager.dispose()` novo
3. **In-flight dedupe** → `materialImageCache` armazena Promise (não Image) para chamadas paralelas
4. **Filtro de órfãos** → `applyPatternObjects` cria `VisualLayerMeta` default para objetos sem LayerMeta
5. **`boardKey` sem material/pattern** → mudança de cor/padrão não reboota engine (sync incremental)
6. **Engine vazado no boot async** → variável local `currentEngine` + `disposeCurrent()` helper
7. **`LayerPanel` com `engineVersion`** → re-anexa listeners quando engine é trocado

### Onda 16 — Multi-broche usável (entregue)

**5 entregas + 3 bugfixes críticos:**

**Entregas:**

1. **Indicador visual no canvas** — outline tracejado laser-muted (`#7aa2f7`) ao redor do broche selecionado. `engine.setActiveBoardHighlight(region)` + `boardItemHighlight` rect com `excludeFromExport`.
2. **`duplicateBoardItem` no store** — duplica produto/material/pattern/fields com novo id e canvasJson `'{}'`
3. **`addBoardItemsBulk(template, count)`** — N broches iguais (modo lote)
4. **`BoardItemRow` enriquecida** — `01·Broche 1·⬛ Bronze·●` em uma linha: número tabular, swatch de cor 12×12px do material, nome, dot quando tem pattern; botões duplicar+remover no hover
5. **`BulkAddDialog`** — modal "Adicionar lote" com input numérico (1–100); botão "Lote" aparece quando broche ativo

**Bugfixes críticos pós-screenshot do usuário (multi-broche bugado):**

a) **`applyPatternObjects` clamping** (16-clamp)

- Novo parâmetro `clampToRegion`: objetos com centro fora do retângulo do broche-alvo são **descartados** (não vão pro canvas, não criam LayerMeta)
- Anti-vazamento: garante que slots do pattern não cheguem ao broche vizinho por bug de coord

b) **`capiSlot.x/y` desatualizado** (16-fix — **causa raiz dos overlays no broche errado**)

- Quando `applyPatternObjects` deslocava o body, `capiSlot.x/y` ficava com coord LOCAL do pattern (sem offset)
- `loadSlotsFromCanvas` lia esse `capiSlot.x/y` pra criar overlay tracejado → ficava no broche errado
- Fix: após deslocar body, atualizar `capiSlot` com `id: newId`, `x/y` em mm absolutos (`pxToMm(finalLeft/Top)`)
- Exportado `getCapiSlot`/`setCapiSlot` do `slot-manager`

c) **Layer principal do pattern duplicava como órfão**

- Pattern salvo no editor de padrões inclui um "layer principal" (o broche do editor)
- `applyPatternObjects` antes adicionava esse principal como objeto Fabric ao canvas → forma órfã sem LayerMeta
- Fix: rastrear `patternPrincipalIds: Set<string>` e pular esses objetos no loop de enliven
- Fix: re-parent slots cujo `parentLayerId` original aponta pra um principal-pulado → vai pro `parentLayerId` externo (broche-alvo)

---

## Lições críticas desta sessão

1. **Fabric não dispõe handlers anônimos.** Pra cleanup correto, guardar refs e usar `canvas.off(event, handler)` por referência. `SlotManager` agora faz isso via `canvasHandlers: Array<{event, handler}>`.

2. **In-flight dedupe via Map<id, Promise>**, não `Map<id, Image>`. Race em chamadas paralelas: 3 layers com mesmo material disparam 3 `loadImage` desperdiçando IPC. Promise resolvida 1x, todos esperam o mesmo resultado.

3. **`boardKey` deve refletir só estrutura física**, não conteúdo. Tirar `materialId/patternId` evita reboot total a cada troca de cor. Sync incremental via segundo useEffect que detecta mudança.

4. **Engine async-safe**: variável local `currentEngine` no closure do `useEffect` + `disposeCurrent()` helper. Sem isso, boot em meio a re-render deixa engine órfão pendurado ao DOM canvas — causa de "camadas duplicadas no painel".

5. **`engineVersion: number` como sinal de re-anexação.** Não basta `engineReady: boolean` se o engine **é trocado** (não só "ficou pronto"). LayerPanel usa como dep do useEffect.

6. **Pattern salvo no editor de padrões traz um layer `principal` "fantasma"** — é o aplique base do canvas de edição. No destino (broche da prancha), já existe principal próprio. Pulando esse principal no enliven evita duplicação visual + órfão no painel.

7. **`capiSlot` é fonte de verdade pra overlay do slot.** Quando o body é deslocado, `capiSlot.x/y` precisa acompanhar — senão o overlay tracejado aparece no lugar errado. Esse foi o **bug visível** que o usuário reportou como "pattern vaza pra outro broche".

---

## Bugs conhecidos / Débito técnico

- **Logs de debug no `PatternBar.tsx`** — `console.log/group` foram adicionados pra investigar bugs de multi-broche. Remover na Onda 17 (limpa `console` em prod).
- **Outline azul pisca** quando boardKey muda — efeito de re-mount. Aceitável.
- **`useCanvasStore()` sem selector** em `useBoardEngine` (linha 138) — re-renderiza demais. Finding hm-engineer ALTO #5, não corrigido nesta sessão.
- **`getLayersHierarchy` roda O(N log N)** em cada evento do canvas — finding MEDIO. Throttle pra próxima.

---

## Roadmap atualizado pós-Onda 16

(Recortado da auditoria hm-qa + hm-designer + hm-engineer)

### Próxima — Onda 17: PNG Mockup profissional

- Background neutro (gradient claro ou #F4F4F2)
- Sombra suave abaixo de cada broche
- Margens 40px em 300 DPI
- Preview antes de salvar
- Nome de arquivo inteligente `{cliente}_{profissao}_{data}.png`

### Onda 18: DXF Export

- Usuário cuida do formato/máquina, eu implemento conversor
- `dxf-exporter` espelhando `svg-exporter` por máquina/operação
- Checkbox "Também exportar DXF" no `ExportSvgDialog`

### Onda 19: UI Polish (designer findings)

- Hierarquia tipográfica (mono só pra valores, body em labels)
- 4 níveis de superfície (#0A0A0B → #1C1D22)
- Botão Aprovar translucid (não verde gritante)
- Micro-interações 200ms ease-out
- Estados vazios desenhados
- PatternBar com filtros agrupados

### Onda 20: Atalhos

- Ctrl+S, Ctrl+E (export SVG), Ctrl+P (PNG), Ctrl+D (duplicar)
- Tab/Shift+Tab navega entre slots
- Delete remove camada
- `?` mostra cheatsheet

### Onda 21: Banco de logos usável

- Busca por nome + tag
- Filtro "usado nos últimos N dias"
- Preview SVG no hover
- Drag-and-drop pro slot

### Onda 22: Copiar pedido + Revisões

- Botão "Copiar pedido" na listagem
- Painel de revisões dentro do editor
- Dialog "Nova revisão ou sobrescrever?" ao salvar

### Onda 23: Validações + estados de erro

- Bloqueio Salvar/Export sem broche
- Warning slot vazio
- Mensagens de erro acionáveis

### Onda 24: Hardening final

- Sessão 4h sem memory leak
- Testes RTL críticos
- `npm audit fix`
- Sanitização SVG (script/foreignObject/event handlers)
- MSI installer
- Backup automático do banco SQLite

**Meta**: MVP rodando 30 pedidos/dia, offline desktop.

---

## Comandos essenciais

```bash
# Rodar
npx tauri dev

# Resetar banco em dev (forçar re-seed)
del "%APPDATA%\com.capi-studio.app\capi-studio.db"

# Validações
npm run typecheck
npm run lint
npx vitest run
```

---

## Arquivos-chave (índice rápido)

- **Canvas engine**: `src/core/canvas/canvas-engine.ts` (~2700 linhas)
- **Slot manager**: `src/core/canvas/slot-manager.ts` (com `dispose()` + handlers refs)
- **Multi-broche hook**: `src/hooks/useBoardEngine.ts` (boot paralelo, `engineVersion`, `currentEngine`)
- **Layer panel**: `src/ui/canvas/LayerPanel.tsx` + `layer-panel/` (LayerRow, LayerBadge, etc)
- **Pattern bar**: `src/ui/pages/arte/novo-pedido/PatternBar.tsx` (com debug logs — remover na Onda 17)
- **Sidebar editor**: `src/ui/pages/arte/novo-pedido/NovoPedidoSidebar.tsx` (ItemsList + BoardItemRow rica + BulkAddDialog)
- **Page**: `src/ui/pages/arte/NovoPedidoPage.tsx` (orquestra tudo)
- **Store**: `src/stores/canvas-store.ts` (boardItems, duplicateBoardItem, addBoardItemsBulk)
- **Pattern repo**: `src/data/repositories/patternRepository.ts` (CRUD + tags + getAllPatternsForListing)
- **Order repo**: `src/data/repositories/orderRepository.ts` (createWithItems, saveRevision, boardCanvasJson)
- **Migrations**: `src-tauri/migrations/0000–0011_board_canvas_json.sql`

---

_Última atualização: **Onda 16 fechada — multi-broche estável**. Sessão 2026-05-17._
_Próxima onda: 17 — PNG Mockup profissional._
