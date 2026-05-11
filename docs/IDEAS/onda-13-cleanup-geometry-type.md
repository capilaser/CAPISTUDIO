# IDEIA — Mover tipo `RectMm` pra `src/lib/geometry.ts` neutro

**Origem:** 2026-05-10, durante Mini-Onda 8.6 (decisão da Pergunta 1)
**Status:** Proposta, sem data — bom candidato pra Onda 13 (polimento final)

## Resumo

Mover o tipo `RectMm` (geometria 2D: `{ left, top, width, height }` em mm) de `src/core/canvas/alignment/snap-targets.ts` para um arquivo neutro `src/lib/geometry.ts`. Atualizar todos os consumidores pra importar do lugar novo.

## Problema que resolve

Hoje `RectMm` mora em `core/canvas/alignment/`, mas é usado fora de canvas/alignment — qualquer código que trabalhe com bounds em mm pode precisar dele. Na Mini-Onda 8.6, ao adicionar `originalBounds?: RectMm` em `PrincipalLayerMeta` (que vive em `src/data/schema.ts`), criamos uma situação ruim:

- `data/schema.ts` é a camada de dados (independente de UI, canvas, alignment).
- Importar `RectMm` de `core/canvas/alignment/` em `data/` cria dependência cruzada **errada semanticamente**.

**Solução adotada na Mini-Onda 8.6:** redeclarei o tipo inline (`originalBounds?: { left: number; top: number; width: number; height: number }`) pra evitar a dependência cruzada. Custo: 4 campos duplicados de definição.

**Solução definitiva (esta IDEA):** mover `RectMm` pra um lugar neutro, ambos camadas podem importar dele sem violar nada.

## Contexto técnico

Consumidores atuais de `RectMm` (via grep):

- `src/core/canvas/alignment/snap-targets.ts` (define o tipo)
- `src/core/canvas/alignment/snap-engine.ts`
- `src/core/canvas/alignment/alignment-commands.ts`
- `src/core/canvas/alignment/distance-calculator.ts`
- `src/core/canvas/alignment/proximity-calculator.ts`
- `src/core/canvas/canvas-engine.ts`
- `src/ui/canvas/AlignmentToolbar.tsx`
- `src/ui/canvas/MeasurementOverlay.tsx`
- `src/ui/canvas/ProximityOverlay.tsx`
- `src/data/schema.ts` (Mini-Onda 8.6 — redeclarou inline em vez de importar)

Tests também importam: `alignment-commands.test.ts`, `distance-calculator.test.ts`, `proximity-calculator.test.ts`.

## Esboço de implementação

1. Criar `src/lib/geometry.ts`:
   ```ts
   /** Retângulo em milímetros (left/top = canto superior-esquerdo). */
   export interface RectMm {
     left: number;
     top: number;
     width: number;
     height: number;
   }
   ```
2. Em `snap-targets.ts`: remover a definição de `RectMm`, re-exportar do novo local:
   ```ts
   export type { RectMm } from '@/lib/geometry';
   ```
   (Manter o re-export por enquanto evita breakage dos imports existentes — fica deprecated.)
3. Atualizar imports diretos: TODOS os arquivos da lista acima trocam `from '@/core/canvas/alignment/snap-targets'` por `from '@/lib/geometry'`.
4. Em `schema.ts`: trocar a redeclaração inline por `import type { RectMm } from '@/lib/geometry'` + `originalBounds?: RectMm`.
5. Após confirmar tudo verde, remover o re-export de `snap-targets.ts` (cleanup final).

## Quando faz sentido

**Onda 13** (polimento final) — bom candidato porque:

- Não bloqueia nenhuma feature do MVP
- É refactor de baixo risco (mover tipo + atualizar imports)
- Boa "limpeza arquitetural" pré-launch

Pode também ser feito em **qualquer onda menor** que mexa em outros arquivos da lista, como onda de costura. Não é urgente.

## Notas

- Custo estimado: ~15 min de edição + rodar testes/lint. Trivial mecanicamente.
- Risco: zero se feito com cuidado. Tipo é estrutural (`{ left, top, width, height }`) — TypeScript valida que tudo bate na refatoração.
- Sem mudança de comportamento em runtime — só de import paths.
