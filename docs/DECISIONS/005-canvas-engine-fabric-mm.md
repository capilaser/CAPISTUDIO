# ADR 005 — Canvas engine: Fabric.js 6 com unidades em mm (DPI fixo 4 px/mm)

**Data:** 2026-05-05
**Status:** Aceito
**Onda:** 3

## Contexto

Onda 3 entregou o canvas operacional do Capi Studio. As próximas 10 ondas (slots,
texturas, camadas, alinhamento, exportação) constroem em cima da forma como a
Onda 3 modelou a unidade de coordenadas, o ciclo de vida do canvas no React,
e a serialização para o banco. Fixar essas escolhas em ADR evita re-discussão
e dá ponto de referência para futuras ondas.

## Decisão

1. **Engine:** Fabric.js 6.x (`fabric ^6.9.1`) como canvas engine. Não trocar
   sem ADR explícito de substituição.
2. **Unidade de domínio:** **milímetros**. DPI fixo `MM_TO_PX = 4` (4 px por mm).
   Toda coordenada que cruza a fronteira do engine (UI, banco, exportação) é em mm.
   Conversão acontece **só na borda** via `mmToPx` / `pxToMm` em
   [src/core/canvas/units.ts](../../src/core/canvas/units.ts).
3. **Fonte autoritativa de dimensões do produto:** o `viewBox` e o `canvasMm`
   do registro do produto no banco — **nunca** `group.width` / `group.height`
   do que o Fabric retorna ao parsear SVG.
4. **SVG da base:** antes de passar pra `fabric.loadSVGFromString`, o SVG passa
   por `parseAndStripRootDimensions` (DOMParser, só raiz) em
   [src/core/canvas/svg-utils.ts](../../src/core/canvas/svg-utils.ts).
   Atributos `width`/`height` da raiz são removidos; o `viewBox` permanece.
   Width/height de elementos filhos (`<rect>`, `<image>`, etc) são preservados.
5. **Custom properties Capi na serialização:** lista única e explícita
   `CAPI_CUSTOM_PROPS = ['id', 'capiSlot']` em
   [src/core/canvas/canvas-engine.ts](../../src/core/canvas/canvas-engine.ts).
   Toda nova prop Capi entra nessa lista (ou some no round-trip).
6. **Ciclo de vida no React:** `engine.dispose()` no return do `useEffect` é
   obrigatório. Ref `<canvas>` checada antes de criar engine.
7. **Pan mode:** ao entrar, `canvas.selection = false` e
   `selectable = false`/`evented = false` em todos os user objects (base
   permanece intocada via flag `__capiBase`). Ao sair, restaura.

## Justificativa

1. **Por que mm e DPI=4?** Lightburn (o software de operação a laser que o
   Gabriell usa diariamente) trabalha nesse modelo. Mantém a operação mental
   alinhada e evita layer de tradução. DPI=4 é resolução suficiente para
   precisão visual em produtos de até ~1m sem arquivos pesados demais.

2. **Por que viewBox do banco como fonte autoritativa?** Aprendido na hora.
   Checkpoint A da Onda 3 falhou exatamente por usar `group.width` como base
   de escala — Fabric internaliza atributos `width="60mm"` em css-px (~3.78×)
   de forma assimétrica entre eixos, gerando aspect ratio errado (2:1 em vez
   de 2.4:1 esperado para o broche 60×25). O viewBox no banco é estável e
   independente de quirks do parser. Risco 2 do kickoff Onda 3.

3. **Por que strip de width/height da raiz?** Remove a única ambiguidade que
   o Fabric introduz ao parsear SVG. Com viewBox isolado, 1 user unit = 1 mm,
   e o scale aplicado pelo engine (mmToPx / viewBoxUnits) é direto.

4. **Por que CAPI_CUSTOM_PROPS explícito?** Risco 3 do kickoff. Fabric só
   serializa props que ele conhece — props custom somem em `toObject()` se
   não forem listadas. Fica melhor uma lista visível que cresce ao longo das
   ondas do que um adapter mágico que esconde o problema.

5. **Por que cleanup obrigatório?** Risco 1 do kickoff. Fabric mexe DOM
   diretamente; sem `dispose()`, hot reload do Vite vaza canvas e listeners.

6. **Por que pan via flag de modo?** Risco 4 do kickoff. Sem o gate
   `isPanModeActive`, drag de objeto e drag de pan competem pelo mesmo evento
   de mouse e o usuário move sem querer um retângulo enquanto tenta panar.

## Consequências

- **Onda 4+ (slots):** novos atributos do tipo `capiSlot` precisam ser
  adicionados em `CAPI_CUSTOM_PROPS` para sobreviver ao round-trip.
- **Onda 5 (texturas):** PNG de material deve ser escalado por
  `mmToPx(productMm)` aplicado ao bbox em mm. Não usar tamanho do PNG bruto.
- **Onda 7 (alinhamento):** régua e snap também em mm. Suportar precisão
  0.1mm = 0.4 px (aprox 1 px), ou aumentar DPI por viewport (zoom) sem mexer
  no DPI base.
- **Onda 9 (exportação SVG):** ao exportar, gerar SVG com `viewBox` em mm
  (não em px). Coordenadas de objetos: `pxToMm(obj.left)` etc.
- **Onda 10+ (UI principal):** o engine é instanciado por componente de
  canvas; cada componente garante seu próprio `dispose()`. Nunca compartilhar
  engine entre componentes via context — cada canvas tem seu engine.
- **Onda 11 (undo/redo):** a serialização via `serialize()` é o snapshot.
  Histórico é uma pilha de `SerializedCanvas`. Não tentar diff incremental
  do estado do Fabric diretamente.

## Follow-up

- [ ] Onda 4 — adicionar `capiSlot` à `SlotMeta` real e validar persistência.
- [ ] Onda 7 — confirmar que zoom não estraga a precisão de alinhamento mm.
- [ ] Onda 9 — verificar que SVG exportado abre corretamente em Lightburn
      em mm (sem reinterpretação por DPI).
