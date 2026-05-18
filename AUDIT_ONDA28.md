# Auditoria Estática — Working Tree (Onda 27 final + Onda 28 em curso)

**Data:** 2026-05-18
**Branch:** onda-26 (working tree não-comitado)
**Escopo:** Apenas arquivos modificados/novos não-comitados. **Nenhuma alteração foi aplicada.**
**Modo:** Somente relatório (escolha do usuário).

---

## Resumo Executivo

| Severidade   | Quantidade | Comentário                                                                                              |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------- |
| 🔴 Crítico   | **1**      | Cobertura de teste faltando — não é bug em produção, mas é gap real                                     |
| 🟡 Médio     | **14**     | Quase todos são "comportamento intencional sem documentação clara" ou "ausência de validação defensiva" |
| 🟢 Cosmético | **9**      | Conformidade verificada (OK), inconsistências pequenas, naming                                          |

**Diagnóstico geral:** O working tree está **funcional e tecnicamente saudável**. Typecheck, lint e suite de testes passam. Não há bug certo de produção identificado — todos os achados 🔴/🟡 são **riscos latentes** ou **dívidas técnicas pequenas**, não falhas ativas.

**A maior preocupação não é nenhum item individual:** é a **mistura de Onda 27 final (canvas/exports) + Onda 28 (painel de camadas Pro)** no mesmo working tree não-comitado. Validar visualmente e commitar tem prioridade sobre qualquer fix abaixo.

---

## Tabela Consolidada de Achados

| #   | Sev | Tipo           | Arquivo:linha                                            | Resumo                                                                                |
| --- | --- | -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | 🔴  | COBERTURA      | `tests/core/export/board-exporter.test.ts`               | Falta teste pra chapa vazia em multi-chapa SVG                                        |
| 2   | 🟡  | LÓGICA         | `src/core/canvas/canvas-engine.ts:2422`                  | `margin` negativo/>0.5 não é clampado em `fitRegionToViewport`                        |
| 3   | 🟡  | LÓGICA         | `src/core/canvas/canvas-engine.ts:2414`                  | `bboxMm` não é validado se inválido (width/height ≤ 0)                                |
| 4   | 🟡  | LÓGICA         | `src/core/canvas/canvas-engine.ts:2422`                  | `viewportWidthPx/HeightPx == 0` produz NaN nos translates                             |
| 5   | 🟡  | LÓGICA         | `src/core/export/board-exporter.ts:314`                  | `extractInnerScaledGroup` retorna null → `continue` silencia falha                    |
| 6   | 🟡  | LÓGICA         | `src/core/export/board-exporter.ts:404`                  | Erro em uma chapa aborta processamento das próximas em DXF                            |
| 7   | 🟡  | TIPAGEM        | `src/core/export/dxf-exporter.ts:117`                    | `clipBoundsMm.leftMm/topMm` negativos não são validados                               |
| 8   | 🟡  | LÓGICA         | `src/core/export/dxf-exporter.ts:452`                    | `objectCenterInsideClip` inclui borda (>=) — semântica não documentada                |
| 9   | 🟡  | LÓGICA         | `src/ui/canvas/ExportSvgDialog.tsx:112`                  | Effect com `defaultStem` no dep array pode resetar input do usuário                   |
| 10  | 🟡  | ESTRUTURA      | `src/ui/canvas/ExportSvgDialog.tsx:190`                  | Export multi-chapa não é atômico — pasta meio-cheia em falha                          |
| 11  | 🟡  | LÓGICA         | `src/ui/canvas/ExportSvgDialog.tsx:200`                  | DXF falha aborta tudo (inclusive SVGs já gravados)                                    |
| 12  | 🟡  | DUPLICAÇÃO     | `src/ui/canvas/ExportSvgDialog.tsx:226`                  | Multi-chapa não respeita regra `openFolderAfter: !exportDxf`                          |
| 13  | 🟡  | ACOPLAMENTO    | `src/ui/canvas/ExportSvgDialog.tsx:29`                   | `setSetting` importado direto no Dialog (UI→data)                                     |
| 14  | 🟡  | PERFORMANCE    | `src/ui/pages/arte/NovoPedidoPage.tsx:225`               | Effect de fit roda 4 deps; pode disparar duplicado                                    |
| 15  | 🟡  | UX             | `src/ui/pages/arte/NovoPedidoPage.tsx:236`               | Single-chapa reenquadra prancha a cada troca de item                                  |
| 16  | 🟡  | PERFORMANCE    | `src/ui/canvas/LayerPanel.tsx:174-185`                   | `getObjects()` + `.indexOf()` O(N²) em cada refresh                                   |
| 17  | 🟡  | PERFORMANCE    | `src/ui/canvas/LayerPanel.tsx:705`                       | `flat.map(...id)` recalculado a cada render → re-mount SortableContext                |
| 18  | 🟡  | TIPAGEM        | `src/ui/canvas/layer-panel/LayerOpacitySlider.tsx:88,91` | Cast `e.target as HTMLInputElement` — usar `currentTarget` é mais seguro              |
| 19  | 🟡  | TESTE FRÁGIL   | `tests/core/export/dxf-exporter.test.ts:386`             | `collectXs()` depende de formato exato CRLF e group-codes                             |
| 20  | 🟢  | DOC            | `src/core/canvas/canvas-engine.ts:2407`                  | `fitRegionToViewport` sem JSDoc completo (vs `fitBoardToViewport`)                    |
| 21  | 🟢  | CONFORMIDADE   | `src/ui/canvas/layer-panel/*.tsx`                        | Todos < 300 linhas (CLAUDE.md ok)                                                     |
| 22  | 🟢  | CONFORMIDADE   | `src/ui/canvas/layer-panel/*.tsx`                        | Sem fontes proibidas                                                                  |
| 23  | 🟢  | CONFORMIDADE   | `src/ui/canvas/layer-panel/*.tsx`                        | Sem `alert()`/`prompt()`                                                              |
| 24  | 🟢  | A11Y           | `src/ui/canvas/layer-panel/*.tsx`                        | aria-labels presentes                                                                 |
| 25  | 🟢  | RESPONSIVIDADE | `src/ui/canvas/layer-panel/*.tsx`                        | Sem width/height fixos problemáticos                                                  |
| 26  | 🟢  | DEAD CODE      | layer-panel/ — 6 novos arquivos                          | Todos os 6 são importados — sem dead code                                             |
| 27  | 🟢  | INCONSISTÊNCIA | `tests/core/export/dxf-exporter.test.ts:432`             | `toBeCloseTo(_, 4)` vs `(_, 6)` — diferença não documentada                           |
| 28  | 🟢  | TIPAGEM        | `src/data/schema.ts:166-181`                             | Novos campos `opacity/colorLabel/blendMode` opcionais — retrocompat OK, sem migration |

---

## Detalhamento por Arquivo

### 1. `src/core/canvas/canvas-engine.ts` (+33 linhas)

Mudança da sessão atual: adicionou `fitRegionToViewport(bboxMm, margin=0.15)` espelhando `fitBoardToViewport`.

#### 🟡 Achado #2 — `margin` negativo ou > 0.5 produz comportamento errado

- **Linhas:** 2422–2426
- **Causa:** Se `margin = 0.6`, `(1 - 2 * margin) = -0.2` → `availableW` negativo → `scale` negativo → o `Math.min` com `ZOOM_MAX` retorna o valor negativo, depois `Math.max(ZOOM_MIN, _)` corrige pra `ZOOM_MIN` mas o resultado é um zoom 100% errado pro caso. Edge case, mas validação trivial.
- **Correção proposta (não aplicada):**
  ```ts
  const clampedMargin = Math.max(0, Math.min(0.49, margin));
  const availableW = this.config.viewportWidthPx * (1 - 2 * clampedMargin);
  const availableH = this.config.viewportHeightPx * (1 - 2 * clampedMargin);
  ```
- **Nota:** O mesmo problema existe em `fitBoardToViewport` (mesmo padrão copiado). Se for corrigir, corrigir ambos.

#### 🟡 Achado #3 — `bboxMm` não validado contra valores inválidos

- **Linha:** 2414
- **Causa:** Função aceita `{leftMm, topMm, widthMm, heightMm}` mas só valida `widthMm/heightMm` via guard implícito (`regionPxW <= 0 || regionPxH <= 0` retorna early). Se `bboxMm = undefined` for passado (callsite com `find().bboxMm` que retornou undefined), erro é `Cannot read property 'widthMm' of undefined`.
- **Caller real:** `NovoPedidoPage.tsx:234` faz `chapaInfos.find(...).bboxMm` — se `find` retornar undefined o `.bboxMm` lança. Guard `if (chapa)` na linha 234 protege, mas o engine não é defensivo por si.
- **Correção proposta:**
  ```ts
  fitRegionToViewport(bboxMm, margin = 0.15): void {
    if (!bboxMm) return;
    const regionPxW = mmToPx(bboxMm.widthMm);
    ...
  }
  ```

#### 🟡 Achado #4 — Viewport zero pode produzir NaN

- **Linhas:** 2422–2434
- **Causa:** Se `viewportWidthPx = 0` (canvas ainda não montou, primeiro render), `availableW = 0`, `scale = 0`, `zoom = ZOOM_MIN` (clampado). Depois `scaledW = regionPxW * zoom > 0`, então `tx = (0 - positive) / 2 - offsetPxX` = número grande negativo. Não é NaN propriamente, mas é zoom errado durante boot. Aceitável se o caller (`engineReady`) só chama quando pronto, mas defensivo seria bom.
- **Correção proposta:**
  ```ts
  if (this.config.viewportWidthPx <= 0 || this.config.viewportHeightPx <= 0) return;
  ```

#### 🟢 Achado #20 — JSDoc menor que `fitBoardToViewport`

- **Linha:** 2407
- **Causa:** Cosmético. JSDoc do método novo é mais curto que do método espelho. Sem impacto funcional.

---

### 2. `src/core/export/board-exporter.ts` (+220 linhas)

#### 🟡 Achado #5 — Silent failure em `extractInnerScaledGroup`

- **Linha:** 314 (dentro de `exportBoardSvgByChapa`)
- **Causa:**
  ```ts
  const inner = extractInnerScaledGroup(fullSvg);
  if (!inner) continue; // ← formato do svg-exporter mudou? regressão silenciosa
  ```
  Se `svg-exporter` mudar o formato de saída (deixar de envolver com `<g transform="scale(...)">`), a regex retorna null e o loop ignora a máquina **inteira**. Resultado: arquivo SVG dessa máquina simplesmente não é emitido, sem aviso.
- **Correção proposta:** Lançar erro estruturado com referência ao chapaId/machineId pra rastrear regressão.

#### 🟡 Achado #6 — Falha de uma chapa não propaga resto

- **Linhas:** 404–416 (dentro de `exportBoardDxfByChapa`)
- **Causa:** `try/catch` lança erro com prefixo `[board-exporter] DXF chapa "X"`. Mas o `for of` está dentro do try — quando falha, sai do loop e nem tenta as próximas chapas. Resultado é **falha total**, não parcial. Comportamento OK pra fail-fast, mas é diferente da expectativa do caller que recebe lista achatada.
- **Decisão a tomar:** ou (a) fail-fast (comportamento atual, documentar), ou (b) coleta de erros e exporta o que conseguir. Não há resposta certa — depende de UX desejada. Hoje é (a) silencioso.

---

### 3. `src/core/export/dxf-exporter.ts` (+141 linhas)

#### 🟡 Achado #7 — Validação de `clipBoundsMm` não cobre offsets negativos

- **Linha:** 117–123
- **Causa:** Lança em `widthMm/heightMm <= 0`, mas `leftMm: -500, topMm: -500` passa silenciosamente. Propaga pra `pointsToMm` e gera coords DXF erradas sem aviso.
- **Correção proposta:** Adicionar `console.warn` se `leftMm < 0 || topMm < 0`. Não throw (pode haver caso legítimo futuro), só sinalizar.

#### 🟡 Achado #8 — `objectCenterInsideClip` inclui borda

- **Linhas:** 452–467
- **Causa:** Usa `>=` e `<=` em todos os limites. Centro exatamente em `leftMm + widthMm` é considerado dentro. Se duas chapas adjacentes têm `chapa1.right == chapa2.left`, objeto centrado nesse ponto entra em ambas → exportado em duplicata.
- **Probabilidade prática:** Baixíssima (centro exato é float, raramente == limite), mas determinístico. Decisão semântica: borda fechada (incluir) ou aberta (excluir)?
- **Correção proposta:** Documentar explicitamente OU usar `<` em vez de `<=` no limite direito/inferior pra fazer "half-open" e evitar duplicação.

#### 🟢 Achado #28 — Schema novo sem migration (analisado em conjunto)

- Confirmação: campos novos vivem em `canvasJson` serializado, não em coluna SQL. Retrocompat ok, sem migration necessária. **Sem ação.**

---

### 4. `src/ui/canvas/ExportSvgDialog.tsx` (+196 linhas)

#### 🟡 Achado #9 — Effect com `defaultStem` no dep array

- **Linhas:** 95–115
- **Causa:**
  ```ts
  useEffect(() => {
    if (!open) return;
    setNome(defaultStem ?? '');
    ...
  }, [open, defaultStem]);
  ```
  Se o pai mudar `defaultStem` enquanto o dialog está aberto (ex: pedido renumerado em background), o input que o usuário já digitou é **resetado**. Aceitável quando abre o dialog, problemático se já está aberto.
- **Correção proposta:** Trocar deps por `[open]` e ler `defaultStem` no momento da abertura via ref, OU adicionar guard `if (nome !== '')` antes do reset.

#### 🟡 Achado #10 — Multi-chapa não é atômico

- **Linhas:** 190–196
- **Causa:** Loop sequencial de `await io.writeFile`. Se falhar no item 3 de 5, os 2 primeiros já estão no disco. `saveSvgs` (single-chapa) tem a mesma semântica, então é consistência, não regressão. Mas o usuário recebe error toast sem saber que parte do export deu certo.
- **Correção proposta:** Toast deve mencionar "N de M arquivos salvos antes do erro" em caso de falha parcial.

#### 🟡 Achado #11 — DXF falha aborta tudo

- **Linhas:** 200–216
- **Causa:** Bloco DXF está dentro do `try` geral. Se SVGs já foram salvos com sucesso e DXF falha, o toast diz "erro ao exportar" mas os SVGs já estão no disco. Usuário pode achar que nada foi salvo.
- **Correção proposta:** try/catch isolado pro DXF; mostrar toast separado tipo "SVGs salvos, mas DXF falhou: ...".

#### 🟡 Achado #12 — Multi-chapa não respeita `openFolderAfter: !exportDxf`

- **Linhas:** 226 vs 261 (single-chapa)
- **Causa:** Single-chapa: se DXF está marcado, SVG não abre Explorer (espera o DXF terminar pra abrir uma vez). Multi-chapa: abre Explorer no fim do SVG independente do DXF. Pequena inconsistência de UX (multi-chapa pode abrir Explorer 2x em alguns cenários).
- **Correção proposta:** Mover `await io.openFolder(folder)` pra DEPOIS do bloco DXF em multi-chapa.

#### 🟡 Achado #13 — Acoplamento UI→data

- **Linha:** 29 + 220
- **Causa:** `setSetting` é importado de `@/data/repositories/settingsRepository` direto no dialog. Single-chapa usa `saveSvgs({rememberFolder: true})` que encapsula isso. Multi-chapa pulou esse encapsulamento e chamou direto.
- **Correção proposta:** Criar helper `rememberSvgFolder(folder)` em `svg-export-service.ts` e usar de ambos os caminhos.

---

### 5. `src/ui/pages/arte/NovoPedidoPage.tsx` (+15 linhas)

#### 🟡 Achado #14 — Effect de fit dispara em 4 deps

- **Linhas:** 225–238
- **Causa:** `[activeItem, engineReady, engineVersion, chapaInfos]`. Cada mudança em `boardItems` ou `productDims` recalcula `chapaInfos` (useMemo) → dispara o effect → re-fit. Se o usuário arrastar um item, várias chamadas a `fitBoardToViewport`/`fitRegionToViewport` podem acontecer em sequência.
- **Correção proposta:** Separar em 2 effects: um pra `clearSelection` (deps atuais), outro pra `fit*` (só `[activeItem?.productId, engineReady]`).

#### 🟡 Achado #15 — Single-chapa reenquadra a cada troca

- **Linhas:** 235–237
- **Causa:** Em pedido single-chapa (só broches do mesmo produto), trocar broche ativo chama `fitBoardToViewport()` sempre. Resultado visual: a vista "salta" ao trocar item — mesmo que o usuário tenha dado zoom/pan manual antes. Pode ser intencional (manter overview), pode ser bug.
- **Decisão a tomar:** É comportamento desejado? Se sim, documentar. Se não, fazer fit só na primeira vez (boot).

#### 🟡 Achado relacionado — Race com `chapaInfos` async

- **Linhas:** 199–213 + 225–238
- **Causa:** `chapaInfos` requer `productDims[productId]` resolvido pra cada item. Se os dims chegam após o effect rodar, primeiro fit usa `chapaInfos = []` (cai no else, fitBoardToViewport), depois dims chegam, `chapaInfos` popula, effect roda de novo, faz fit certo. Resulta em flicker visual.
- **Correção proposta:** Effect retorna early se `chapaInfos.length === 0 && boardItems.length > 0` (dims ainda carregando).

---

### 6. `src/ui/canvas/LayerPanel.tsx` (modificado, ~792 linhas)

#### 🟡 Achado #16 — `getObjects() + .indexOf()` O(N²)

- **Linhas:** 174–185 (função `refresh`)
- **Causa:** `refresh()` é chamado em 6 eventos do canvas (`object:added/removed/modified`, `selection:*`, `layer-meta-changed`). Cada chamada faz `canvas.getObjects()` + `.map(o => objs.indexOf(o))` que é O(N²). Para 50+ camadas e arraste rápido, é caro.
- **Correção proposta:**
  ```ts
  const objs = canvas.getObjects();
  const idxById = new Map(objs.map((o, i) => [getCapiId(o), i]));
  ```

#### 🟡 Achado #17 — `flat` não memoizado

- **Linha:** 705 (uso) + 250–273 (cálculo)
- **Causa:** Array `flat` é recalculado no corpo do componente sem `useMemo`. `flat.map(f => f.node.id)` passado ao `SortableContext` é nova referência a cada render → @dnd-kit re-mount os itens internos.
- **Correção proposta:** `useMemo(() => buildFlat(...), [hierarchy, searchQuery, collapsedIds])` + memo do array de IDs separadamente.

---

### 7. `src/ui/canvas/layer-panel/*` (6 arquivos novos)

#### 🟡 Achado #18 — Cast `e.target` em vez de `e.currentTarget`

- **Arquivo:** `LayerOpacitySlider.tsx:88, 91`
- **Causa:** `(e.target as HTMLInputElement)` funciona, mas `e.currentTarget` tem tipo mais estreito automaticamente (é o elemento onde o handler está ligado), elimina o cast.
- **Correção proposta:** Trocar pra `e.currentTarget` (sem cast).

#### Achados de conformidade (🟢 — TODOS OK)

- **#21:** Todos os 7 novos arquivos têm <130 linhas (limite CLAUDE.md: 300). ✓
- **#22:** Nenhum usa Inter/Roboto/system-ui. ✓
- **#23:** Nenhum usa `alert()`/`prompt()`. ✓
- **#24:** aria-labels presentes em botões e sliders. ✓
- **#25:** Nenhum `w-[XXXpx]` / `h-[XXXpx]` problemático — tudo via Tailwind utilities flex/gap. ✓
- **#26:** Todos os 6 arquivos novos são importados (LayerPanel/LayerRow/SortableLayerRow os consomem). Sem dead code. ✓

---

### 8. `src/data/schema.ts` (modificado)

#### 🟢 Achado #28 — Campos opcionais novos sem migration

- **Linhas:** 166–181 (PrincipalLayerMeta, OperationLayerMeta, VisualLayerMeta)
- **Causa:** `opacity?`, `colorLabel?`, `blendMode?` foram adicionados como **opcionais**. Esses campos vivem em `canvasJson` (JSON serializado no banco), não em colunas SQL. Retrocompat preservada: registros antigos carregam com esses campos `undefined`, código trata como defaults.
- **Status:** **OK by design.** Sem ação necessária.

---

### 9. Testes (`tests/core/export/*.test.ts`)

#### 🔴 Achado #1 — Falta cobertura pra chapa vazia em SVG multi-chapa

- **Arquivo:** `tests/core/export/board-exporter.test.ts`
- **Causa:** Existe teste pra "canvas inteiro vazio" (mock retorna Map vazio), mas não pra "2 chapas, conteúdo só na primeira". A heurística "chapa vazia simplesmente não contribui — sem erro" foi declarada na docstring mas não verificada por teste.
- **Por que 🔴:** É o único cenário onde o caller (dialog) pode ter expectativa errada. Se quebrar no futuro, ninguém pega.
- **Teste sugerido:**
  ```ts
  it('2 chapas, conteúdo só na primeira → apenas 1 resultado', async () => {
    mockExportSvgByMachine.mockResolvedValueOnce(
      new Map([['fiber-laser', fakeItemSvg('<rect/>', 200, 100)]])
    );
    const out = await exportBoardSvgByChapa({
      // chapa 2 está em (300mm, 0) — fora do conteúdo da prancha,
      // mas o motor ainda exporta tudo no canvas inteiro
      ...
    });
    // assertions sobre o que esperar
  });
  ```
  Nota: a implementação atual sempre vai emitir resultado pra ambas as chapas porque o exportSvgByMachine não conhece chapa (chamado 1x). O conteúdo vai aparecer em ambas as chapas via translate negativo, **mas em uma delas estará fora do viewBox**. Esse teste documentaria o comportamento esperado (1 com viewBox válido, 1 com viewBox vazio mas existente).

#### 🟡 Achado #19 — `collectXs()` frágil ao formato do DXF

- **Arquivo:** `tests/core/export/dxf-exporter.test.ts:386–396`
- **Causa:** Parser ad-hoc procura linhas com exato `'10'` (com trim). Depende de:
  - Delimitador `\r\n` (Windows CRLF) — se mudar pra LF, quebra
  - Ordem dos group codes
  - Header não-emitir um group-10 extra
- **Correção proposta:** Adicionar assert de sanidade: `expect(xsNoClip.length).toBeGreaterThan(2)` antes de comparar. Sinaliza se parser quebrou.

#### 🟢 Achado #27 — Tolerância de `toBeCloseTo` inconsistente

- **Arquivo:** `tests/core/export/dxf-exporter.test.ts:432` (4 decimais) vs linhas 311/323/335 (6 decimais)
- **Causa:** Razão legítima — float drift acumulado em transformações encadeadas pede tolerância menor. Mas o leitor pode pensar que é descuido.
- **Correção proposta:** Comentário explicativo na linha 432.

---

## Achados Adicionais (cross-cutting)

### Working tree misto (Onda 27 final + Onda 28)

- **Risco:** 7 arquivos modificados + 6 novos não-comitados. Onda 28 está mid-flight, sem commit, sem testes próprios pros novos componentes de layer-panel/.
- **Recomendação:** Commitar Onda 27 final (canvas + exports) separado da Onda 28 (UI) tão logo quanto possível. Working tree gigante aumenta risco de conflito mental e perda em caso de problema.

### Cobertura de testes da Onda 28

- **Status:** Nenhum arquivo novo em `tests/` pros novos componentes layer-panel. Esses componentes são apresentação (não core/), então não é violação do CLAUDE.md, mas é regressão silenciosa potencial.
- **Recomendação:** Pelo menos 1 teste de "render sem crash" pra cada subcomponente novo.

### `vi.mock` ordem em board-exporter.test.ts

- **Status:** OK (Vitest faz hoisting). Mas adicionar mock de `dxf-exporter` ao lado do mock de `svg-exporter` torna a ordem importante se algum import for movido. Defensivo: comentário explícito.

---

## Recomendações Priorizadas (sem aplicar nada)

### Quick wins (≤30 min cada, baixo risco)

1. **Achado #18:** trocar `e.target` por `e.currentTarget` em `LayerOpacitySlider.tsx`. Remove cast.
2. **Achado #20:** completar JSDoc de `fitRegionToViewport` no nível de `fitBoardToViewport`.
3. **Achado #1:** adicionar 1 teste de chapa vazia em multi-chapa SVG.
4. **Achado #19:** adicionar assert `expect(xsNoClip.length).toBeGreaterThan(2)` em `collectXs`.

### Curto prazo (≤2h cada, risco baixo-médio)

5. **Achado #3:** adicionar guard `if (!bboxMm) return;` em `fitRegionToViewport`.
6. **Achado #2 + #4:** clampar `margin` e validar viewport zero em ambos `fitBoardToViewport` e `fitRegionToViewport`.
7. **Achado #16:** trocar `.indexOf()` por `Map<id, idx>` em `refresh()` do LayerPanel.
8. **Achado #17:** memoizar `flat` e `flat.map(id)` no LayerPanel.

### Decisões de design (precisam de você antes de fix)

9. **Achado #5:** silenciar ou lançar quando `extractInnerScaledGroup` falha?
10. **Achado #6:** fail-fast ou fail-tolerant em `exportBoardDxfByChapa`?
11. **Achado #8:** borda fechada ou aberta em `objectCenterInsideClip`?
12. **Achado #15:** single-chapa deve reenquadrar a cada troca, ou só na primeira?

### Médio prazo (precisa de cuidado, validar visualmente)

13. **Achado #9:** mudar dep array do effect do dialog.
14. **Achado #10–13:** revisar consistência single↔multi chapa no fluxo de save+open+remember.
15. **Achado #14:** separar effects no NovoPedidoPage.

### Adiar

- **#21–26:** conformidade já está OK. Sem ação.
- **#27:** tolerância inconsistente nos testes — só adicionar comentário.
- **#28:** schema sem migration — by design.

---

## Conclusão

O working tree está **funcionalmente correto e tecnicamente saudável**. Não há bug certo em produção. Os 14 achados 🟡 são divididos em:

- **4 sobre validação defensiva** (não acontecem em uso normal, mas seriam diagnóstico melhor).
- **4 sobre consistência entre paths single-chapa e multi-chapa** (UX, não bug).
- **2 sobre performance em casos extremos** (50+ camadas, drags rápidos).
- **2 sobre comportamento sutil de effects React** (race + dispatch duplicado).
- **2 sobre semântica de borda/edge case não documentada**.

O único 🔴 é gap de cobertura de teste — não é bug.

**Recomendação operacional:** antes de qualquer fix dos achados acima, **commitar a Onda 27 final (canvas + exports) separado da Onda 28 (UI)**. Working tree misto é o maior risco real hoje. Depois, atacar os quick wins (#1, #18, #19, #20) e tomar as decisões de design (#5, #6, #8, #15) antes dos fixes médios.
