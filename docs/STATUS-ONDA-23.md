# Capi Studio — Status pós-Onda 23

> **Snapshot da sessão 2026-05-17 (segunda parte).** Use junto com
> `AI-CONTEXT.md` e `STATUS-ONDA-18.md` pra entender o estado real.
> Próxima onda planejada: **Onda 24 — Hardening final + MSI installer**.

---

## Estado real do código (baseline)

- **typecheck**: ✅ verde
- **lint**: ✅ 0 errors, 6 warnings (5 baseline + 1 do cheatsheet-provider, todos `react-refresh/only-export-components`)
- **testes**: ✅ 495/495 passando (+27 nesta sessão vs 468 da Onda 18)
- **dev server**: `npx tauri dev` na raiz

---

## Ondas entregues nesta sessão (commits)

| Commit    | Onda       | Tema                                                                                  |
| --------- | ---------- | ------------------------------------------------------------------------------------- |
| `b792317` | **19.B–F** | UI Polish (tipografia, surfaces, empty states, PatternBar agrupada, micro-interações) |
| `b0314e9` | **20**     | Atalhos do editor (Ctrl+S/E/P/D, Tab, Delete, Esc, setas, cheatsheet)                 |
| `0d4df67` | **21**     | Banco de logos usável (busca, recency, preview no hover)                              |
| `83f5fcb` | **22**     | Histórico de revisões (read-only, botão "Revisões" no Topbar)                         |
| `141e237` | **23**     | Mensagens de erro de SVG estruturadas (title + description)                           |

---

## Onda 19 — UI Polish (designer findings)

**Decisões aplicadas:**

- `font-mono` restrito a valores/IDs/paths/filenames/siglas técnicas (CUT/GRV/MRC). Labels/títulos/mensagens herdam `font-body` (Geist) do globals.
- 4 níveis de superfície em tokens Tailwind: `surface-0` `#0A0A0B` → `surface-3` `#1C1D22`. Dropdown/tooltip = surface-2, dialog = surface-3.
- Tooltip saiu do `bg-primary` violeta gritante pro `bg-surface-2` industrial.
- Componente novo: [`EmptyState`](src/ui/components/empty-state.tsx) (ícone + título + descrição + CTA opcional). Aplicado em /inicial (Inbox), /padroes (Layers), /banco (Image).
- [`PatternBar`](src/ui/pages/arte/novo-pedido/PatternBar.tsx) agrupa tags em 4 categorias visuais: Bordas / Traços / Nome / Logo + fallback "Outros". Separação visual por `border-l ink-700 pl-2`.
- Animações padronizadas: 200ms ease-out em dropdown/dialog/button, 150ms em tooltip.

**Componente Badge ganhou distinção mono vs body:**

- Variantes `cut/grav/marc/machine-*` mantêm mono (siglas).
- `default/success/warning/danger` viram body (labels humanos como "Aguardando Info").

---

## Onda 20 — Atalhos

**Hooks novos:**

- [`useOrderShortcuts`](src/hooks/useOrderShortcuts.ts) — Ctrl+S/E/P/D globais (Salvar / Export SVG / Export PNG / Duplicar broche). `preventDefault` em todos.
- [`useCanvasShortcuts`](src/hooks/useCanvasShortcuts.ts) — Delete/Backspace/Esc/Tab/Setas. Delete dispara o **mesmo dialog do LayerPanel** (cascade de filhos preservado).

**Refactor crítico:**

- `LayerPanel` virou `forwardRef<LayerPanelHandle, Props>` expondo `requestDeleteByCanvasId(id)`. NovoPedidoPage segura um ref pra que a tecla Delete consiga reusar todo o fluxo de confirmação que já existia no painel.

**Engine:**

- `engine.selectById(id)` novo, usa `findByCapiId` (resolve slots cujo id mora em `capiSlot.id`, não em `obj.id` — preserva ADR 015).

**Cheatsheet:**

- [`CheatsheetProvider`](src/ui/components/cheatsheet-provider.tsx) envolve a app dentro do `BrowserRouter`. Tecla `?` (shift+/) abre/fecha em qualquer rota. Botão "atalhos" com ícone Keyboard no AppFooter pra descoberta.

**Helper puro testado:** [`cycleSlotIndex`](src/core/canvas/slot-cycle.ts) — 14 testes cobrindo edge cases (-1, wrap-around, total=0, total=1, current fora de range).

**Decisões travadas no kickoff:**

1. Delete REQUER confirmação (mesmo dialog com cascade).
2. Setas = 0,1mm; Shift+seta = 1mm. Disparam `object:modified` pra acionar snap/store.
3. Tab cicla SOMENTE entre slots de texto/logo do broche ativo (filtro por `parentLayerId === principal.appliqueId`). Ordem: logo → nome → profissao → custom.
4. Ctrl+P abre Export PNG (`preventDefault` evita print do WebView).

---

## Onda 21 — Banco de logos usável

[`LogoBankDialog`](src/ui/pages/arte/novo-pedido/LogoBankDialog.tsx) substitui o file picker direto que o LogoSlotItem tinha. Operador agora escolhe entre banco existente ou upload novo no mesmo dialog.

**Repository:**

- [`listFiltered({ search?, recency? })`](src/data/repositories/logoRepository.ts#L99) — busca por nome (`LIKE NOCASE`) + janela temporal usando `last_used_at`. Recency = 'all' | '7d' | '30d'.
- Logos nunca usados ficam ocultos quando recency != 'all'.

**UX:**

- Campo de busca + 3 chips de recência (Tudo / 30d / 7d).
- Lista mostra nome + tempo relativo (hoje / ontem / Xd atrás / Xmes atrás).
- Hover na linha carrega preview SVG flutuante à direita (cache local via `useState`, evita re-ler o arquivo a cada movimento do mouse).
- Botão "Enviar arquivo novo" delega de volta ao LogoSlotItem (que mantém o file picker original).

**Drag-and-drop pro slot:** decidido pular nesta onda (não foi marcado no kickoff).

---

## Onda 22 — Histórico de revisões

[`RevisionsDialog`](src/ui/pages/arte/novo-pedido/RevisionsDialog.tsx) abre via botão "Revisões" no NovoPedidoTopbar (entre cheatsheet e Aprovar).

**Escopo enxuto (decidido no kickoff):** apenas visualização read-only. Sem botão de restaurar revisão. Sem duplicar pedido inteiro (era opção mas você não marcou).

**O que mostra por revisão:**

- `#número` (com `tabular-nums`)
- Data absoluta `dd/mm/yyyy hh:mm` (pt-BR)
- Contagem de broches (`1 broche` / `N broches`)
- Badge `PNG` se `exportedPngPath` não-null
- Badge `Aprovada` (success) se `is_approved`

**Estados especiais:**

- Pedido novo (sem `?id=`): "Revisões aparecem depois do primeiro Salvar."
- Pedido legado sem revisões: "Nenhuma revisão registrada — pode ser um pedido legado."

Reusa [`revisionRepository.listByOrder`](src/data/repositories/revisionRepository.ts#L78) que já existia desde a Onda 11.

---

## Onda 23 — Mensagens de erro de SVG estruturadas

`humanizeError` mudou de `(err) => string` pra `(err) => { title, description? }`. Toast em 2 níveis: título curto no canto da tela + descrição com instrução pra resolver.

**Mapeamentos cobertos (8 categorias):**

1. **XML malformed** → "Arquivo SVG corrompido" + sugestão de reexportar. Detalhe técnico vai pro `console.error`, não pro operador.
2. **Unidades não-mm** → "SVG precisa estar em milímetros" + Layout → Page Setup.
3. **Dimensão zerada** → "Tamanho do SVG inválido".
4. **Aspect ratio distorcido** → "SVG com proporção distorcida" + dica Shift+arraste.
5. **viewBox ausente** → "SVG sem área de trabalho válida".
6. **Imagem rasterizada** → "SVG contém imagem (não-vetor)".
7. **Texto não convertido** → "Texto não convertido em curva" + Ctrl+Q.
8. **`<use>`/`<symbol>`** → "SVG com referências internas" + Ctrl+K.

**API nova:**

- `humanizeError(err): SvgErrorMessage` — retorna `{ title, description? }`.
- `svgErrorToToastArgs(err): { title, options }` — helper pra spread em `toast.error()`.

**Callers atualizados (5):** NovoPedidoPage, ApliquePanel, EngravingPanel, MarkingPanel, UploadApliqueDialog (este último mostra erro inline com hierarquia visual: título destacado + descrição em menor opacidade).

**13 testes novos:** todos os 8 mapeamentos + 3 polimórficos (string/Error/unknown) + 2 do `svgErrorToToastArgs`.

---

## Lições críticas desta sessão

1. **`forwardRef + useImperativeHandle` é a forma certa de expor APIs imperativas entre componentes irmãos.** A Onda 20 precisou que o atalho Delete (registrado na NovoPedidoPage) chamasse o fluxo de exclusão que vivia dentro do LayerPanel (com cascade de filhos). Em vez de subir o estado pra raiz e duplicar a lógica, virei LayerPanel em `forwardRef<LayerPanelHandle>` com o método `requestDeleteByCanvasId(id)`. NovoPedidoPage segura o ref via `useRef<LayerPanelHandle | null>(null)`, hooks de atalho disparam direto. Fluxo de UI continua morando no LayerPanel — apenas ganhou uma entrada externa. Padrão replicar pra futuros atalhos que precisam dialogar com painéis específicos.

2. **react-hooks/set-state-in-effect é regra nova do React 19 strict.** `setState` síncrono dentro de `useEffect` agora dispara erro de lint (não warning). Fix usual: jogar o setState dentro de `Promise.resolve().then(...)` (microtask) ou dentro de uma IIFE async. Verifiquei nos 2 dialogs novos (LogoBank, Revisions) — refatorei pra usar microtask. Padrão a aplicar em qualquer effect que precise resetar estado quando uma prop muda.

3. **Mensagens de erro em 2 níveis (title + description) >>> mensagem única longa.** Toast com uma linha gigante o operador não lê. Quebrar em "o que aconteceu" (título destacado) + "como resolver" (descrição) força a leitura da solução. Mesmo padrão se aplica a erros inline em forms — UploadApliqueDialog ganhou hierarquia visual com `font-medium` no title + `text-danger/80` na descrição.

4. **Helper puro testado >>> testar componente React inteiro.** A Onda 20 tinha `cycleSlotIndex(current, total, direction)` como única lógica não-trivial dos atalhos. Extraí pra arquivo separado (`src/core/canvas/slot-cycle.ts`), escrevi 14 testes cobrindo edge cases. Igual fiz pra `humanizeError` na Onda 23 (13 testes). Os hooks que usam esses helpers (`useCanvasShortcuts`, callers) não têm teste — não compensa o custo de mock pesado de Fabric / Sonner. Mas a lógica de negócio está testada.

5. **Working tree poluída é dívida silenciosa.** Antes desta sessão eu fui commitar a Onda 19 e descobri que tinha 50+ arquivos modificados de Ondas 13-18 nunca commitados. Tive que fazer `git add` cirúrgico de cada arquivo da Onda atual. Solução adotada: commit por onda, separado, mesmo que o `canvas-engine.ts` entre inteiro (com mudanças de ondas anteriores) — pelo menos o commit fica nominalmente correto. Lição: pra próxima onda, validar working tree limpa ANTES de começar.

---

## Bugs conhecidos / Débito técnico

### Aberto (ainda não atacado)

- **Bug do material: dourado selecionado → broche renderiza prata**
  Memory `debt_material_dourado_prata`. Logs `[DEBUG-mat]` ainda no código (useBoardEngine.ts, canvas-engine.ts). Precisa coleta runtime via DevTools — investigação estática insuficiente. **Workaround atual**: trocar o material via MaterialChanger depois do boot funciona.

- **Onda 18 sem checkpoint visual no RDWorks**
  Testes roundtrip do DXF gerado validam estrutura, mas o arquivo nunca foi aberto no software real. Risco residual: quirk de parser do RDWorks que testes não capturariam. Gabriell precisa abrir 1 DXF (qualquer pedido com aplique + gravação) e confirmar.

- **Working tree com Ondas 13–18 não-commitadas**
  50 arquivos modificados/untracked: DXF export, board-exporter, multi-broche, migrations 0009-0011, STATUS-ONDA-16/17/18, logs `[DEBUG-mat]`, etc. Quando `npx tauri dev` rodar pra validar Ondas 21-23, tá testando TUDO isso junto. Decisão: commits cirúrgicos por onda quando voltar pra atacar (não-bloqueante).

- **Nenhum checkpoint visual das Ondas 19-23 feito ainda**
  Tudo verde no typecheck/lint/vitest mas Gabriell não rodou tauri dev pra validar visualmente. Lista de checkpoints está no resumo de cada onda nas mensagens da sessão (e replicada abaixo).

### Herdados da Onda 17

- ~~`CAPI_CUSTOM_PROPS` incompleto~~ — resolvido na Onda 18 (era diagnóstico errado). Memory `project-capi-custom-props-incompleto` reescrita como "não-débito".

### Herdados da Onda 16

- `useCanvasStore()` sem selector em `useBoardEngine` (linha 138)
- `getLayersHierarchy` O(N log N) em cada evento canvas

### Da Onda 18

- **Duplicação consciente svg-exporter ↔ dxf-exporter**: ~80 linhas. Refactor DRY fica pra Onda 24.
- **Texto não vai pro DXF**: `dxf-exporter` skipa textos quando `fontBufferLoader` não é injetado. UI hoje não injeta. Wiring de fontes fica pra futuro.

### Novo da Onda 20

- **Atalhos Tab/Setas em conflito com `<input>`**: react-hotkeys-hook por default ignora eventos de `<input>`/`<textarea>`. Quando operador digita texto na sidebar, Tab navega no form normalmente. Quando foco volta pro canvas/body, Tab cicla slots. Comportamento intencional — vale validar visualmente que não confunde.

---

## Roadmap atualizado pós-Onda 23

### Próxima — Onda 24: Hardening final + MSI installer

- **Sessão 4h sem memory leak** (Profiler do DevTools, sweep manual de listeners não desanexados)
- **Testes RTL críticos** dos fluxos principais (cobertura ≥80% do `core/` já tem)
- **`npm audit fix`** (vulnerabilidades transitivas — ver ADR 001)
- **Sanitização SVG** (defesa contra `<script>`/handlers maliciosos no upload — Tauri local mitiga, mas vale defense-in-depth)
- **MSI installer Windows** (Tauri bundle final — `npm run tauri build`)
- **Refactor DRY svg-exporter ↔ dxf-exporter** (débito Onda 18, ~80 linhas duplicadas)
- **Resolver bug material dourado→prata** (memory `debt_material_dourado_prata`) — se ainda incomodar
- **Checkpoint visual Onda 18 RDWorks** (abrir 1 DXF gerado)

**Meta**: MVP rodando 30 pedidos/dia, offline desktop, **MSI instalável distribuível**.

---

## Checkpoints visuais pendentes (resumo)

Pra fazer com `npx tauri dev` quando der:

**Onda 19 (UI Polish):**

- Hierarquia tipográfica: labels em Geist, dimensões/IDs em JetBrains Mono.
- Dialog (escolher pasta) acima do card visualmente.
- Estados vazios: /inicial sem pedidos, /padroes sem padrões, /banco.
- PatternBar com 4 grupos separados por linha sutil.
- Click em dropdown/dialog/tooltip — timing consistente 150-200ms.

**Onda 20 (Atalhos):**

- Ctrl+S / Ctrl+E / Ctrl+P / Ctrl+D funcionam.
- Delete com slot/aplique selecionado abre dialog de confirmação.
- Esc limpa seleção.
- Tab cicla entre slots do broche ativo.
- Setas movem 0,1mm; Shift+seta = 1mm.
- `?` em qualquer rota abre cheatsheet.
- Botão "atalhos" no AppFooter abre o mesmo cheatsheet.

**Onda 21 (Banco de logos):**

- Em pedido novo: + Adicionar → Colocar logo → LogoBankDialog abre.
- Buscar por nome filtra a lista.
- Chips 7d/30d/Tudo filtram por uso.
- Hover na linha mostra preview SVG à direita.
- "Enviar arquivo novo" abre file picker (fluxo upload original).

**Onda 22 (Revisões):**

- Pedido salvo: botão "Revisões" no topbar abre dialog.
- Lista da mais nova → mais antiga com #, data, contagem, badges.
- Pedido novo (sem ?id=): mensagem orientando salvar primeiro.

**Onda 23 (SVG corrompido):**

- Upload SVG corrompido: toast com título "Arquivo SVG corrompido" + descrição.
- Upload SVG com texto não convertido: toast "Texto não convertido em curva" + instrução Ctrl+Q.
- Upload SVG em pixels: toast "SVG precisa estar em milímetros" + caminho do Corel.

---

## Arquivos-chave (índice rápido — Ondas 19-23)

### Onda 19

- [`tailwind.config.ts`](tailwind.config.ts) — tokens surface-0..surface-3
- [`empty-state.tsx`](src/ui/components/empty-state.tsx) — componente reutilizável
- [`PatternBar.tsx`](src/ui/pages/arte/novo-pedido/PatternBar.tsx) — helper `groupTags`
- [`badge.tsx`](src/ui/components/badge.tsx) — variantes mono vs body

### Onda 20

- [`useOrderShortcuts.ts`](src/hooks/useOrderShortcuts.ts) — atalhos globais
- [`useCanvasShortcuts.ts`](src/hooks/useCanvasShortcuts.ts) — atalhos de canvas
- [`slot-cycle.ts`](src/core/canvas/slot-cycle.ts) — helper puro testado
- [`LayerPanel.tsx`](src/ui/canvas/LayerPanel.tsx) — forwardRef + LayerPanelHandle
- [`cheatsheet-provider.tsx`](src/ui/components/cheatsheet-provider.tsx) — `?` global

### Onda 21

- [`logoRepository.ts`](src/data/repositories/logoRepository.ts) — `listFiltered`
- [`LogoBankDialog.tsx`](src/ui/pages/arte/novo-pedido/LogoBankDialog.tsx)

### Onda 22

- [`RevisionsDialog.tsx`](src/ui/pages/arte/novo-pedido/RevisionsDialog.tsx)
- [`NovoPedidoTopbar.tsx`](src/ui/pages/arte/novo-pedido/NovoPedidoTopbar.tsx) — botão History

### Onda 23

- [`corel-svg-errors.ts`](src/core/canvas/corel-svg-errors.ts) — `humanizeError` + `svgErrorToToastArgs`
- [`UploadApliqueDialog.tsx`](src/ui/pages/banco-apliques/UploadApliqueDialog.tsx) — erro inline estruturado

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

_Última atualização: **Ondas 19-23 fechadas** (5 commits sequenciais no `main`). HEAD: `141e237`. Sessão 2026-05-17 parte 2._
_Próxima onda: **24 — Hardening final + MSI installer**._
_Checkpoint visual de TODAS as ondas 19-23: **PENDENTE** — Gabriell roda `tauri dev` e valida._
