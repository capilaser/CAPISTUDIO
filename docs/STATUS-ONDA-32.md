# Capi Studio — Status pós-Onda 32

> **Snapshot da sessão 2026-05-18 (Ondas 29–32).** Fecha o ciclo de higiene
> que precedeu o trabalho de evolução pra spec "templates inteligentes".
> Use junto com `AUDIT_TEMPLATES_SPEC.md` (raiz) pra ver o que falta.
> Próximo passo planejado: **Onda 33 — Engine de fit unificada** ou direto pra modelo de tipos da spec (Ondas 35 → 37).

---

## Resumo do ciclo de higiene

O ciclo Ondas 29–32 abriu o trabalho template-first com 4 commits limpos:
um por onda. **Zero feature nova** — só preparação. O canvas-engine saiu
de 3.412 linhas para 2.250 (-34%) sem mudar a API pública, o dual-path
de identidade que era origem de bugs latentes em material/STRIP-RESTORE
foi eliminado, e 6 zumbis com zero callers foram removidos.

Suite de testes: **565 → 566 verdes** (1 teste novo na Onda 31, prova
que slot tem `body.id === capiSlot.id`).

---

## Estado real do código (baseline final)

- **typecheck**: ✅ verde
- **lint**: ✅ 0 errors, 6 warnings (todos pré-existentes — `react-refresh/only-export-components` + 3 do `coverage/`)
- **testes**: ✅ 566/566 passando
- **branch**: `onda-29` (commits `8f6a57c` → `39a5742`, 7 commits no ciclo)
- **API pública da CanvasEngine**: inalterada — todos os métodos públicos preservados

---

## Commits do ciclo

| Commit    | Onda | Tema                                                                    |
| --------- | ---- | ----------------------------------------------------------------------- |
| `3453878` | WIP  | Checkpoint Onda 27+28 (working tree fechado em onda-26)                 |
| `8f6a57c` | 29   | Higiene + DEPENDENCY_MAP + correção factual do `mode: CanvasMode`       |
| `18aa3df` | 30.A | Extrai `engine-serialization.ts` (serialize/deserialize/applyPattern)   |
| `842ac93` | 30.B | Extrai `engine-layers.ts` (18 funções de LayerMeta + locks + hierarchy) |
| `04bdf76` | 30.C | Extrai `engine-material.ts` + `engine-objects.ts`                       |
| `61d3a86` | 30.D | Extrai `engine-board.ts` (viewport + multi-broche)                      |
| `0b418ef` | 31   | Formaliza identidade — elimina dual-path `obj.id`/`capiSlot.id`         |
| `39a5742` | 32   | Cleanup conservador + confirmação forte de "Atualizar padrão"           |

---

## Arquivos novos criados

```
src/core/canvas/
├── canvas-engine.ts          3.412 → 2.250 linhas (-34.0%)
├── engine-serialization.ts   619 linhas (Onda 30.A)
├── engine-layers.ts          670 linhas (Onda 30.B)
├── engine-material.ts        255 linhas (Onda 30.C)
├── engine-objects.ts         302 linhas (Onda 30.C)
└── engine-board.ts           241 linhas (Onda 30.D)

docs/
├── DEPENDENCY_MAP.md         (Onda 29) — quem consome quem
├── STATUS-ONDA-29.md         (Onda 29) — abertura do ciclo
└── STATUS-ONDA-32.md         (este arquivo) — fechamento
```

Pré-existentes atualizados:

- `AUDIT_TEMPLATES_SPEC.md` — correções factuais sobre `mode: CanvasMode`
- `docs/DEBT.md` — débito #7 (backup automático do SQLite, adiado)

---

## Arquivos removidos (Onda 32)

| Arquivo                                          | Tamanho    | Razão                                                 |
| ------------------------------------------------ | ---------- | ----------------------------------------------------- |
| `src/ui/pages/arte/novo-pedido/PatternPanel.tsx` | 197 linhas | Órfão (sem callers em produção)                       |
| `useBoardEngine.computeItemPositions`            | -37 linhas | @DEPRECATED Onda 26e, substituída por `computeChapas` |
| `src/core/orders/.gitkeep` + pasta               | —          | Pasta vazia (planejamento nunca consumado)            |
| `src/core/patterns/.gitkeep` + pasta             | —          | Idem                                                  |
| `src/core/products/.gitkeep` + pasta             | —          | Idem                                                  |
| `src/core/validation/.gitkeep` + pasta           | —          | Idem                                                  |

---

## Conquistas da Onda 30 (refactor canvas-engine)

| Módulo                    | Função                | O que extraiu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine-serialization.ts` | Persistência          | `serialize`, `deserialize`, `applyPatternObjects`, `removeItemContents`, STRIP-RESTORE de pattern+clipPath, `generateObjectId`, `findById`, `CAPI_CUSTOM_PROPS`, `SerializedCanvas`                                                                                                                                                                                                                                                                                                                                    |
| `engine-layers.ts`        | Camadas               | 18 funções: `getLayerMeta`, `findPrincipalByAppliqueId`, `setLayerVisibility` (single + multiple + solo), `setLayerLocked` (single + multiple), `setLayerOpacity` (single + multiple), `setLayerColorLabel`, `setLayerBlendMode`, `renameLayer`, `deleteLayer` (single + multiple), `duplicateLayer`, `moveLayer`, `moveLayerToIndex`, `reparentLayer`, `getLayersHierarchy`, `registerLayerMeta`. Tipo `LayerNode` migrado pra cá. Helper `fireLayerMetaChanged` consolidou 9 casts `(canvas as { fire })` espalhados |
| `engine-material.ts`      | Material/textura      | `applyMaterialToLayer`, `applyMaterialToBase`, `buildProductClipPath`, `preloadMaterials`, `removeMaterialFromLayer`. `makeCachedLoader` interno consolida dedupe in-flight da Onda 15.fix                                                                                                                                                                                                                                                                                                                             |
| `engine-objects.ts`       | Criação de SVG        | `addAppliqueSvg`, `addEngravingSvg`, `addMarkingSvg`, `addRectangle`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `engine-board.ts`         | Viewport multi-broche | `centerProductInViewport`, `zoomBy`, `fitBoardToViewport`, `fitRegionToViewport`, `resizeViewport`, `renderChapaLabels`, `setActiveBoardHighlight`                                                                                                                                                                                                                                                                                                                                                                     |

**Não extraídos** (acoplados a state mutable da classe):

- Pan handlers, wheel zoom, selection handlers (dependem de `isPanModeActive`, `isDragging`)
- `clearUserObjects` (depende de `currentGuides`, `lastSnapResult`, `measurementLines`, `proximityLines`, `gridDotsRect`)
- Snap engine integration (sistema de listeners + state guides)
- Slot adapters delgados (`createSlot`, `fillTextSlot`, etc — só repassam pro `slotManager`)
- Constructor + private helpers (`attachPanHandlers`, `attachSelectionHandlers`, `attachPrincipalBoundsUpdater`, `attachSnapHandlers`)

Estes 5 grupos somam ~2.250 linhas que ficaram em `canvas-engine.ts`. Reduzi-los exigirá Onda 30.E ou Ondas 33+ onde mudanças no modelo de slots/snap forem necessárias de qualquer jeito.

---

## Conquistas da Onda 31 (identidade)

**Problema**: slot manager nunca setou `body.id` — o capi id morava só em `capiSlot.id`. Forçava dual-path `findById` vs `findByCapiId` em N callsites, com risco de slots não receberem material via `applyMaterialToLayer` (que usa `findById`).

**Solução cirúrgica (3 linhas no slot-manager)**:

1. `createSlot` agora seta `body.id = meta.id` na criação.
2. `loadSlotsFromCanvas` normaliza `body.id` para `capiSlot.id` ao carregar slots de canvasJson legado.
3. `capi-id.ts` docstring atualizada documentando que dual-path foi resolvido. Função mantida como caminho canônico — fallback pra `capiSlot.id` por retrocompat.

**Teste novo (#5b em `slot-manager.test.ts`)**: prova `body.id === capiSlot.id` pós-`createSlot` + verifica que `canvas.getObjects().find(o.id)` bate com `getFabricObject(meta.id)`.

**Bug latente fechado**: aplicação de material em slot via `applyMaterialToLayer` (linha 1454 da engine pré-refactor; agora em `engine-material.ts`) usa `findById`. A partir desta onda, funciona corretamente para slots.

---

## Conquistas da Onda 32 (cleanup + UX)

**Removidos** (zero callers verificados):

- `PatternPanel.tsx`, `computeItemPositions`, 4 pastas vazias de `src/core/`.

**UX corrigida**:

- `ArteHubPage` — card "Criar Padrão (em breve — Fase 11)" agora ativo, leva pra `/padroes` (a rota já existia desde Onda 12; o disabled era inconsistente).
- `PadraoEditorPage` — botão "Atualizar padrão" agora abre `Dialog` de confirmação forte. CLAUDE.md exige isso ("padrão mestre IMUTÁVEL no fluxo normal; só Atualizar com confirmação forte"). O dialog explica que pedidos antigos NÃO são afetados (snapshot por revisão isola). Modo CRIAR continua salvando direto.

**Não removidos** (preservados intencionalmente):

- `BancoPage` (stub) — manter rota, substituir conteúdo na Onda 36 (Asset Library).
- `mode: CanvasMode` — vivo; 18 testes confirmam.
- `BoardItemDraft.canvasJson` cache dormente — decisão pra Onda 38 (IDs formais).
- Tabelas zumbi `pattern_layers` e `order_overrides` — exigem migration, atacar na Onda 36.

---

## Próximo passo

A spec de templates inteligentes está documentada em `AUDIT_TEMPLATES_SPEC.md`
com 25 gaps prioritizados. O ciclo de higiene preparou terreno para:

- **Onda 33 — Engine de fit unificada** (consolida `addLogo` math + `fit-text` em API única com flags `contain/preserveAspect/centered/noRotate/noStretch`). Pré-requisito da Onda 37.
- **Onda 34 — Locks granulares** (`{position, scale, rotation, structure}` substituindo `LayerMeta.locked: boolean`).
- **Onda 35 — Modelo de tipos parte 1** (PRODUCT, CONTOUR, ENGRAVING_PATTERN, MARKING_GUIDE como tipos formais da spec).
- **Onda 36 — Asset Library unificada** (`/banco` com 7 tabs).
- **Onda 37 — AREA vs ASSET** (separação spec de TEXT_AREA/TEXT_PRESET, LOGO_AREA/LOGO_ASSET).

A ordem de prioridade depende de qual gap dói mais primeiro pro fluxo
template-first do operador. Decidir antes de começar.

---

## Métricas finais do ciclo

| Métrica                                       | Antes Onda 29            | Depois Onda 32                             | Δ                          |
| --------------------------------------------- | ------------------------ | ------------------------------------------ | -------------------------- |
| `canvas-engine.ts` (linhas)                   | 3.412                    | 2.250                                      | -34.0%                     |
| Arquivos em `core/canvas/engine-*`            | 0                        | 5                                          | +5 (2.087 linhas)          |
| Total `core/canvas/` ts                       | 23                       | 24                                         | +1 (engine-board separado) |
| Pastas vazias em `core/`                      | 4                        | 0                                          | -4                         |
| Páginas órfãs                                 | 1 (PatternPanel)         | 0                                          | -1                         |
| Funções `@DEPRECATED` exportadas              | 1 (computeItemPositions) | 0                                          | -1                         |
| Casts `(canvas as { fire })` em canvas-engine | 9                        | 0 (consolidados em `fireLayerMetaChanged`) | -9                         |
| Tests verdes                                  | 565                      | 566                                        | +1                         |
| Typecheck                                     | ✅                       | ✅                                         | OK                         |
| Lint errors                                   | 0                        | 0                                          | OK                         |
| Commits no ciclo                              | —                        | 7                                          | OK                         |
| API pública alterada                          | —                        | nenhuma                                    | OK                         |
