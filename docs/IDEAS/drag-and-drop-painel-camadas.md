# IDEIA — Drag and drop no painel de camadas

**Origem:** 2026-05-10, durante calibração da Onda 7
**Status:** Proposta, sem data

## Resumo

Permitir que o usuário **arraste** camadas no painel direito pra:

1. **Reordenar** z-index (mudar qual camada fica em cima de outra)
2. **Mover slot entre apliques** (arrastar slot do aplique A pra B, reaponta `parentLayerId`)

## Problema que resolve

Na Onda 7, essas duas operações foram implementadas via **botões explícitos** (↑↓ pra reordenar, dropdown "Mover pra..." pra mudar parent). Funciona, mas exige cliques.

Drag-and-drop seria mais natural e visualmente fluido pra usuários acostumados com Photoshop/Figma/Illustrator.

## Contexto técnico

- O painel de camadas da Onda 7 vive em `src/ui/canvas/LayerPanel.tsx` + subcomponentes em `src/ui/canvas/layer-panel/`.
- A hierarquia já tem `parentLayerId` setado corretamente (Fix #2 da Onda 7b Fase D).
- Mover slot entre apliques precisa apenas trocar `parentLayerId` no `LayerMeta` + revalidar `getParentBoundsForObject` — já implementado via `engine.reparentLayer` na Onda 7.
- Reordenar z-index: já existe `engine.moveLayer('up' | 'down')` via `canvas.bringObjectForward` / `sendObjectBackwards` na Onda 7. Drag substituiria os botões ↑↓.

## Esboço de implementação

1. Biblioteca: `@dnd-kit/core` ou `react-beautiful-dnd` (preferir `@dnd-kit` por ser mais leve e moderno).
2. Wrappear a lista do painel em `DndContext`.
3. Cada item da lista vira `SortableItem`.
4. Em `onDragEnd`:
   - Se destino é outra posição na mesma camada principal → reordenar z-index via `engine.moveLayer`.
   - Se destino é dentro de outra camada principal → trocar `parentLayerId` via `engine.reparentLayer`.
5. Manter botões ↑↓ e dropdown "Mover pra..." como fallback acessível.

## Quando faz sentido

- **Não antes da Onda 9** (exportação SVG) — Onda 9 é mais crítica pra entrega ao cliente.
- **Bom candidato pra Onda 10-11** (telas restantes) — quando o app já estiver mais maduro.
- **Ou Onda 13** (polimento final) — se for considerado polish.

## Notas

- Dependência adicional no `package.json` — avaliar tamanho do bundle.
- Acessibilidade: garantir que botões continuem funcionando (já estarão lá da Onda 7).
- Teste E2E desejável (drag and drop é difícil de testar unitariamente).
