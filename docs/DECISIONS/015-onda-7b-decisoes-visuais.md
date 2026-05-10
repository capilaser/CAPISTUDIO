# ADR 015 — Decisões Visuais da Onda 7b

**Data:** 2026-05-10
**Status:** Aceito
**Implementação:** Onda 7b (Fases C, D, E, E2, F)

---

## Contexto

A Onda 7b implementou em camadas o subsistema de **alinhamento visual + medição**:

- **Fase C** — guias visuais cyan durante snap drag
- **Fase D** — toolbar de alinhamento (6 botões)
- **Fase E** — modo medição V/H entre 2 objetos selecionados
- **Fase E2** — distâncias do objeto selecionado para o entorno (proximidade)
- **Fase F** — pontinhos da grade com toggle de visibilidade

Ao final, **4 sistemas visuais coexistem** durante interação (snap, medição, proximidade, grade) e várias decisões precisaram ser tomadas em conjunto pra preservar coerência, performance e legibilidade. Este ADR registra as decisões e o **porquê** de cada uma.

---

## Decisões

### 1. Hierarquia de cores entre os 4 sistemas

| Sistema                     | Cor        | Hex       | Sintaxe          |
| --------------------------- | ---------- | --------- | ---------------- |
| Snap (guias durante drag)   | cyan vivo  | `#00d4ff` | sólido (intenso) |
| Medição entre 2 objetos (E) | sky-300    | `#7dd3fc` | tracejado        |
| Proximidade 1 obj (E2)      | violet-400 | `#a78bfa` | tracejado        |
| Grade (F)                   | ink-600    | `#3a3d3f` | dots 1px         |

**Por quê:** quando 2+ sistemas disparam juntos (drag de 1 obj próximo a outro), o usuário precisa identificar qual sistema está falando o quê. A hierarquia "snap mais vivo > medição > proximidade > grade" segue a lei de **importância pragmática**: snap muda comportamento (gruda), medição/proximidade só informa, grade é referência passiva.

Cyan e sky-300 são quase parentes (azulados); a diferença foi mantida porque snap é sólido e medição é tracejada — sintaxe complementa cor pra distinção. Violeta foi escolhido pra proximidade porque rompe o eixo cyan-azul sem virar quente (manteria coerência da paleta fria do app industrial-utilitário).

### 2. Render híbrido — linhas no Fabric, caixinhas no DOM

Em todos os 3 overlays (medição, proximidade, alinhamento), as **linhas vivem no Fabric** e as **caixinhas com texto vivem no DOM** (`<div>` absolutos).

**Por quê:**

- **Linhas no Fabric:** acompanham `viewportTransform` automaticamente — zoom e pan funcionam de graça. Excluídas do export via `excludeFromExport: true`.
- **Caixinhas no DOM:** texto JetBrains Mono / `tabular-nums` renderiza nítido em CSS, qualidade que `fabric.Text` não atinge sem complicação. DOM aproveita rendering nativo do navegador (sub-pixel, kerning).

Tentativa inicial era "tudo DOM" — exigia recalcular posição das linhas em 4 fontes de eventos (zoom, pan, drag, resize) e ainda dessincronizava 1 frame em zoom rápido. O híbrido resolve com metade do código.

### 3. Render-on-change para guias de snap

Linhas de guia são criadas/atualizadas/removidas **só quando o snap muda de target** (não a cada `object:moving`). Decisão refletida em `guides-diff.ts` (função pura): decide entre `create | update | remove | noop` por eixo.

**Por quê:** drag dispara `object:moving` 60×/s. Recriar `fabric.Line` 60×/s gera GC pressure e flicker. Diff puro reduz para ~5 mudanças por drag típico.

### 4. Fade-out 200ms cancelável

Guias de snap fazem fade-out 1→0 em 200ms quando o drag termina (`mouse:up`). A animação é cancelável: se um novo drag começa antes do fim do fade, `cancelFadeAnimations` aborta e zera `currentGuides` antes do `onComplete`.

**Por quê:** sem fade, guias somem instantâneo e parece bug ("apareceu e sumiu"). Sem cancelamento, guias-fantasma de drag anterior se misturam com guias novas (linha-fantasma em opacity 0.3 conflitando com guia 1.0). Ambos verificados na Fase C.

### 5. Toolbar de alinhamento condicional

`AlignmentToolbar` aparece como segunda linha **apenas quando há ≥1 objeto selecionado**. Slide-down 150ms na entrada, saída instantânea (sem `AnimatePresence`).

**Por quê:** toolbar permanente competiria com headers/atalhos do app. Aparecer só quando há contexto reduz ruído visual e ensina o usuário "isto é sobre o que tá selecionado". Saída instantânea evita gasto de animação quando o usuário está fechando contexto rápido.

### 6. Pai imediato em alinhamento (não canvas)

Quando 1 objeto é alinhado, a referência é o **pai imediato via `parentLayerId`**, não o canvas inteiro. Slot dentro de aplique → centraliza dentro do aplique. Slot direto na placa → centraliza na placa.

Reforça §6 do ADR 014 no caminho de alinhamento.

**Por quê:** "Centralizar nome dentro do aplique" é o caso real. Centralizar em relação ao canvas só faz sentido pra topo-de-hierarquia. A regra "pai imediato" é a mais previsível e cobre 100% dos fluxos do MVP.

Multi-seleção (2+) muda regra: ignora pai e usa min/max dos próprios rects (Figma-style). Decisão tomada porque "centralizar 3 retângulos juntos" não tem pai natural.

### 7. `getCapiId` como abstração canônica de id

Função pura em `capi-id.ts` resolve o id capi de qualquer objeto Fabric:

1. `obj.id` (string) — caminho normal (rect, aplique)
2. `obj.capiSlot.id` (string) — caminho slot (slot-manager nunca seta `body.id`)

**Por quê:** antes desta abstração, `AlignmentToolbar` lia `obj.id` direto e recebia `undefined` para slots, fazendo silently fallback pra canvas em vez de pai imediato. Bug grave da Fase D (Fix #1) — slot dentro de aplique alinhava com o canvas, não com o aplique.

A abstração unifica ambos os caminhos num lugar só. Caller nunca mais precisa decidir "é slot ou rect?". Reaproveitada na Fase E2 (`engine.getMeasurableObjects`) com o mesmo princípio.

### 8. `createSlot(type, parentLayerId?)` aceita pai opcional

`engine.createSlot` aceita um `parentLayerId` opcional na criação. `SlotCreatorButtons.resolveParentAppliqueId(engine)` percorre a seleção atual e retorna o primeiro objeto com `kind === 'principal'` (aplique).

**Por quê:** Fix #2 da Fase D. Antes, slot criado dentro de aplique nascia sem `parentLayerId` (default null) — `getParentBoundsForObject` retornava null, snap caía pra canvas, alignment idem. O sintoma era "slot criado dentro do aplique se comporta como se estivesse na placa direto".

Critério unificado via `kind === 'principal'` evita heurística geométrica (que seria frágil quando aplique e slot quase coincidem).

### 9. Pontinhos da grade via `fabric.Pattern`, não objetos individuais

A grade de 1mm cobre 27.000 pontos numa placa-300x90. **Não criamos 27.000 `fabric.Circle`.**

Implementação: 1 `fabric.Rect` cobrindo a área útil do produto, preenchido com `fabric.Pattern` cujo `source` é um `<canvas>` 4×4px (= 1mm × 1mm em DPI=4) com 1 dot 1×1px no canto. `repeat: 'repeat'` cobre toda a área via tiling nativo do canvas DOM.

**Por quê:**

- 1 objeto Fabric vs 27.000 — ordem de grandeza em performance.
- Pattern é GPU-accelerated por padrão (canvas DOM faz tiling em hardware).
- Não polui `getObjects()` — listagem de objetos do canvas continua razoável.

**Comportamento em zoom:** Pattern fixo no espaço de coordenadas. Em zoom alto, dots crescem visualmente mas **não ficam mais densos** (continua 1mm de espaçamento físico). Comportamento CAD desejado — alternativa "pattern invariável a zoom" daria malha sempre densa, virando ruído visual em zoom alto.

**Cor `ink-600` (#3a3d3f), não `ink-700`:** o stroke da base do produto é `ink-700` (#2a2c2e). Pontinhos `ink-700` se fundiriam com a borda da peça. `ink-600` distingue sem virar ruído. Hierarquia: borda (ink-700) < pontinhos (ink-600) < conteúdo do canvas.

**`imageSmoothingEnabled = false`** no canvas-source do Pattern: mantém o dot como pixel cru, sem antialias borrar a borda quando o tile repete em zoom > 1.

**Default desligado:** ao abrir o app, grade é invisível. Snap continua sempre ativo (invariante do sistema, ADR 014). Tooltip do botão esclarece: _"Mostrar pontos da grade (snap 1mm sempre ativo)"_.

### 10. Sobreposição em proximidade → fallback pra borda da placa

Se o target da proximidade sobrepõe outro objeto, **nenhum dos 4 lados captura esse vizinho** (porque a definição de "estritamente acima/abaixo/lado" exige separação por eixo). Fallback pra bordas da placa.

**Por quê:** alternativa seria mostrar "0mm" sinalizando sobreposição. Cria ambiguidade ("zero em qual lado?") e poluição visual. Ignorar e cair pra borda mantém as 4 caixinhas sempre informativas.

### 11. ProximityOverlay e MeasurementOverlay são independentes

Em vez de 1 overlay roteador que decide "1 obj → mostra A, 2 objs → mostra B", são **2 componentes irmãos** sem coordenação. Cada um decide sozinho via `getActiveObject()` e retorna `null` quando não é seu caso.

**Por quê:** sem state compartilhado, sem race entre os 2. Cada um cuida do próprio cleanup (`clearMeasurementLines` / `clearProximityLines`). Quando seleção transita 1→2, ProximityOverlay limpa as próprias linhas e MeasurementOverlay cria as próprias. Robusto a HMR e remontes.

---

## Consequências

- **Coerência visual:** 4 sistemas convivem com hierarquia de cor + sintaxe (sólido vs tracejado) que distingue uns dos outros.
- **Performance preservada:** Pattern para grade, render-on-change para guias, render via `style.transform` direto no DOM durante drag (zero re-render React).
- **Bugs estruturais resolvidos:** mismatch de IDs (Fix #1) e parentLayerId null (Fix #2) ficam atrás. `getCapiId` cria abstração reusável pra próximas ondas.
- **Dívidas registradas:** `docs/DEBT.md` lista o que ficou aberto (Alt+Tab com mouse pressionado, overlay tracejado do slot, etc).

---

## Refs

- ADR 014 (snap-system, base sobre a qual a 7b se construiu)
- ADR 011 (Fabric 6 fill empty string — pattern de `obj.set({...})` usado em todas as fases)
- Commits da Onda 7b: `0ccd989` (C), `06d7442` (D), `9713f3b` (Fix#1), `db84315` (Fix#2), `ad65cfe` (E), `4e8f072` (E2), `0557cc3` (F), `aeae83a` (cleanup)
