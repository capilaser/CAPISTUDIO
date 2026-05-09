# ADR 014 — Sistema de snap (Onda 7a, Fases A+B)

**Data:** 2026-05-09
**Status:** Aceito
**Implementação:** Onda 7a (Fases A e B)

---

## Contexto

Onda 7a entrega snap (Fases A-F). Fases A e B implementadas:

- Fase A: motor matemático puro em `src/core/canvas/alignment/`
- Fase B: integração com Fabric via `attachSnapHandlers` no `CanvasEngine`

---

## Decisões

### 1. Motor matemático puro, sem Fabric

`snap-engine.ts` é função pura. Não importa Fabric, DOM, ou React. Recebe
`RectMm` em mm, retorna `SnapResult`. Caller é responsável por conversão
px↔mm e por aplicar resultado no Fabric.

Razão: testabilidade (23 testes em Node sem canvas), portabilidade,
separação de responsabilidades.

### 2. Snap registrado dentro do `CanvasEngine`, não em hook React

Versão inicial usava hook `useSnapToCanvas` que registrava `object:moving`
externamente. Quebrou por race condition: hook rodava antes de
`engineRef.current` existir (React `useEffect` com `[]` roda antes do boot
`useEffect` que cria o engine). Entrava em early-return, snap nunca
configurava.

**Solução adotada:** `attachSnapHandlers()` chamado no construtor do engine,
**antes** de `new SlotManager(...)`. Hook React reduzido a `useAltKey()`
(só rastreia Alt e expõe ref). `setSnapOptions({ isAltDown })` chamado
dentro do `useEffect` de boot do `CanvasTest`, **depois** de criar o engine.

Razão: garante ordem de execução determinística. SlotManager registra
`object:moving` depois do snap → snap aplica posição → SlotManager lê
posição já snapada → overlay sincroniza correto.

### 3. Tolerância de snap: 1mm

Default fixo. Combina com grade de 1mm. Tolerância maior puxava demais
(atrapalhava ajuste fino). Menor não dava sensação de grude.

### 4. Alt segurado durante drag desativa snap inteiro

Tecla `Alt` é gesto de drag. Não conflita com `Alt+Setas` futuro (RF-3.7),
que é evento de teclado sem drag.

`isAltDown` é callback em `setSnapOptions`, lido a cada `object:moving`.
Implementado via `useAltKey` hook que registra listeners em `window`
(captura Alt mesmo sem foco no canvas — Condição 4 aprovada pelo Gabriell).

### 5. Snap em grade ativo por default, grade visível opcional

Grade de 1mm sempre snapa (invariante do sistema). Botão da toolbar
(Fase F) só liga/desliga **visibilidade** dos pontinhos. Decisão consciente:
comportamento igual ao Figma — grade invisível ativa.

Tooltip do botão deve esclarecer: "Mostrar pontos da grade (snap 1mm sempre
ativo)". Sem isso, usuário pode achar bug.

### 6. Pai do objeto = imediato, nunca múltiplos níveis

`computeSnapCandidates` recebe `parentBounds: RectMm | null`:

- Slot dentro de aplique → `parentBounds` = bounds do aplique
- Slot direto na placa (sem aplique) → `parentBounds` = null → snap usa
  canvas inteiro como pai

Quando `parentBounds = null`, `parent-center` e `canvas-center` apontam
pro mesmo lugar — comportamento esperado, não bug.

Cruzamento `parentLayerId → bounds` feito por `getParentBoundsForObject`
no engine, não no snap-engine (que é função pura). Caller é responsável.

### 7. Múltipla seleção: snap pelo bounding box do grupo

Quando usuário seleciona N objetos e arrasta, snap usa bounding box do
`ActiveSelection` como `movingRect`. Delta calculado se aplica ao grupo,
Fabric propaga aos filhos.

Fabric 6 não tem `selection:moving` — `object:moving` é o único evento
para drag, tanto de objeto único quanto de ActiveSelection. Diferenciado
via `instanceof fabric.ActiveSelection`.

### 8. Filtro de candidatos a snap

Não passa todos os objetos do canvas. Filtra:

- Próprio objeto sendo arrastado (id match)
- `__capiBase === true` (base SVG do produto)
- Overlays de slot (sem capi id — `excludeFromExport=true` + sem `id`)
- `visible === false`

---

## Consequências

- Snap-engine isolado e portável (poderia rodar em web worker no futuro)
- Fases C-F (guias visuais, toolbar, modo medição, grade visível) tocam
  só na UI — motor matemático não muda
- ADR 005 (DPI=4 px/mm) continua sendo a fonte de verdade da conversão
  px↔mm em todos os cálculos do sistema

---

## Follow-up

- [ ] Fase C: linhas-guia visuais consumindo `guideStart`/`guideEnd` já
      presentes em `SnapTarget`
- [ ] Fase D: toolbar de alinhamento (centralizar H/V, alinhar bordas)
- [ ] Fase E: modo medição (distância V+H entre objetos selecionados)
- [ ] Fase F: pontinhos da grade com botão de toggle
- [ ] Validar 6 fluxos de regressão da Fase B — dívida técnica leve
      aceita pelo Gabriell em 2026-05-09
