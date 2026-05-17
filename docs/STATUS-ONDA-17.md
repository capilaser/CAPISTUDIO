# Capi Studio — Status pós-Onda 17

> **Snapshot da sessão 2026-05-17.** Use junto com `AI-CONTEXT.md` pra entender estado real.
> Próxima onda planejada: **Onda 18 — DXF Export**.

---

## Estado real do código (baseline)

- **typecheck**: ✅ verde
- **lint**: ✅ 0 errors (5 warnings cosméticos — mesmo baseline da Onda 16)
- **testes**: ✅ 426/426 passando (+16 vs Onda 16)
- **dev server**: `npx tauri dev` na raiz do projeto

---

## Onda entregue nesta sessão

### Onda 17 — PNG Mockup profissional (entregue)

PNG export deixou de ser "dump técnico do canvas" e virou **mockup comercial** pronto pra enviar pro cliente:

- **Fundo cinza claro** `#F4F4F2` (substitui o transparente/preto do canvas)
- **Sombra difusa** abaixo de cada broche (`fabric.Shadow` aplicado só no export, restaurado no finally)
- **Recorte na bbox do(s) broche(s) + margem 3mm** — sem espaço morto em volta
- **Preview thumbnail no dialog** (debounce 200ms, blob URL com cleanup)
- **Nome de arquivo inteligente** com data ISO local (sv-SE) e prefixo `lote_Nx_` em multi-broche
- **Strip-restore simétrico**: viewportTransform, visibility de overlays/\_\_capiBase, stroke da forma de corte — tudo zerado pro export e restaurado no finally

**Arquivos-chave alterados:**

- `src/core/export/png-exporter.ts` — `computeMockupViewport`, `MOCKUP_SHADOW_CONFIG`, `CUT_STROKE_COLOR`, opções `shadow`/`marginPx`/`clientBounds`, strip-restore de visibility/shadow/stroke-corte/VPT
- `src/services/png-export-service.ts` — `isoDate` local (sv-SE), `buildPngFilename` com date + `boardItemCount` + prefixo `lote_Nx_`
- `src/ui/canvas/ExportPngDialog.tsx` — preview thumbnail debounce 200ms, blob URL com cleanup, `MOCKUP_MARGIN_MM = 3`
- `src/ui/pages/arte/NovoPedidoPage.tsx` — `boardBoundsPx` memoizado
- `src/ui/pages/arte/novo-pedido/PatternBar.tsx` — logs debug Onda 16 removidos (limpeza de débito)

---

## Hotfixes pós-print (resolvidos)

### Bug 1 — PNG branco (broche não aparecia)

- **Causa**: `clientBounds` em px de objeto, mas `toDataURL` espera coords em espaço CSS (após `viewportTransform`).
- **Fix**: strip-restore da VPT no export (normaliza pra identity, restaura no `finally`). Zoom/pan do operador preservados.

### Bug 2 — Overlays (azul/vermelho) iam pro PNG

- **Causa**: `fabric.Canvas.toDataURL` **ignora `excludeFromExport`** (esse flag só vale pra `toObject`/`toJSON`/`toSVG`). SVG exporter já filtrava manualmente em `svg-exporter.ts:181`, PNG não filtrava.
- **Fix**: ocultar `__capiOverlay` + `__capiBase` manualmente no loop de strip.

### Bug 3 — Traço cinza-escuro da forma de corte aparecia

- **Causa raiz** revelada por log de debug: broche recém-criado é um `Path` único (não `Group`) com `stroke #2a2c2e` direto. Flags `__capiBase`/`__capiMaterialRect` **NÃO ESTÃO em `CAPI_CUSTOM_PROPS`** — somem na serialize/deserialize do `canvasJson`.
- **Fix**: identificar pela **cor do stroke** (`#2a2c2e` = `SVG_BASE_STROKE` de `canvas-engine.ts:104`). Função `isCutStroke()` + varredura recursiva zera stroke em qualquer estrutura (Path, Group, filhos). Restore simétrico.

---

## Lições críticas desta sessão

1. **`fabric.Canvas.toDataURL` IGNORA `excludeFromExport`.** Esse flag só vale pra `toObject`/`toJSON`/`toSVG`. Pra PNG, filtrar manualmente no loop de strip-restore.

2. **`toDataURL({left,top,width,height})` interpreta coords em ESPAÇO CSS** (após viewportTransform). Pra recorte determinístico, normalizar VPT pra identity durante export, restaurar no `finally`.

3. **`CUT_STROKE_COLOR = '#2a2c2e'`** funciona como discriminador determinístico da forma de corte em PNG/SVG mockup. Conteúdo do usuário (texto, logos) nunca usa essa cor exata.

4. **Quando flags Capi custom (`__capiBase` etc) somem da serialize, identificar por características visuais (stroke, fill) é mais robusto que por flag.**

5. **Logs de debug com `JSON.stringify` (não objeto cru) são essenciais** — o DevTools colapsa Object e ofusca campos.

---

## Bugs conhecidos / Débito técnico

- ~~**`CAPI_CUSTOM_PROPS` incompleto**~~ — **CORRIGIDO NA ONDA 18**: era diagnóstico errado. Os 3 flags (`__capiBase`/`__capiMaterialRect`/`__capiOverlay`) vivem em objetos com `excludeFromExport: true`. Fabric filtra o objeto inteiro antes de aplicar a lista de custom-props — adicionar à lista seria no-op. Objeto inteiro nunca é serializado (intencional); recriado no boot. Ver comentário expandido em [canvas-engine.ts:24-56](src/core/canvas/canvas-engine.ts#L24) e STATUS-ONDA-18.
- **`useCanvasStore()` sem selector** em `useBoardEngine` (linha 138) — re-renderiza demais. Finding hm-engineer ALTO #5, herdado da Onda 16.
- **`getLayersHierarchy` roda O(N log N)** em cada evento do canvas — finding MÉDIO, herdado da Onda 16. Throttle pra próxima.
- **Outline azul pisca** quando boardKey muda — efeito de re-mount. Aceitável.

---

## Roadmap atualizado pós-Onda 17

### Próxima — Onda 18: DXF Export

- `dxf-exporter` espelhando `svg-exporter` por máquina/operação
- Usuário cuida do formato/máquina, eu implemento conversor
- Checkbox "Também exportar DXF" no `ExportSvgDialog`
- **Pré-requisito de informação**: Gabriell precisa passar o tipo de máquina/dialeto DXF esperado (versão R12/R14/2000, AutoCAD vs LightBurn etc).

### Onda 19: UI Polish (designer findings)

- Hierarquia tipográfica (mono só pra valores, body em labels)
- 4 níveis de superfície (`#0A0A0B` → `#1C1D22`)
- Botão Aprovar translúcido (não verde gritante)
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
- **Resolver `CAPI_CUSTOM_PROPS` incompleto** (débito Onda 17)

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

- **Canvas engine**: `src/core/canvas/canvas-engine.ts` (`CAPI_CUSTOM_PROPS` linha 35 — débito conhecido)
- **PNG exporter**: `src/core/export/png-exporter.ts` (mockup viewport, shadow, strip-restore VPT/overlay/cut-stroke)
- **PNG export service**: `src/services/png-export-service.ts` (filename builder com date + lote prefix)
- **Export PNG dialog**: `src/ui/canvas/ExportPngDialog.tsx` (preview thumbnail debounce 200ms)
- **Slot manager**: `src/core/canvas/slot-manager.ts`
- **Multi-broche hook**: `src/hooks/useBoardEngine.ts`
- **Layer panel**: `src/ui/canvas/LayerPanel.tsx` + `layer-panel/`
- **Pattern bar**: `src/ui/pages/arte/novo-pedido/PatternBar.tsx` (logs debug removidos nesta onda)
- **Sidebar editor**: `src/ui/pages/arte/novo-pedido/NovoPedidoSidebar.tsx`
- **Page**: `src/ui/pages/arte/NovoPedidoPage.tsx` (`boardBoundsPx` memoizado)
- **Store**: `src/stores/canvas-store.ts`
- **Migrations**: `src-tauri/migrations/0000–0011_board_canvas_json.sql`

---

_Última atualização: **Onda 17 fechada — PNG mockup profissional**. Sessão 2026-05-17._
_Próxima onda: 18 — DXF Export._
