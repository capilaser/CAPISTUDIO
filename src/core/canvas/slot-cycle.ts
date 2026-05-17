/**
 * slot-cycle — utilidade pura pra navegação cíclica entre slots de um
 * broche (Onda 20.C).
 *
 * Tab / Shift+Tab no canvas avança/retrocede entre os slots editáveis
 * (nome / profissão / logo / custom) do broche ativo. A função aqui só
 * decide o próximo índice — o caller resolve qual slot existe nesse
 * índice e o seleciona no canvas.
 *
 * Convenções:
 *   - `total === 0` → retorna -1 (sem slot pra focar).
 *   - `current === -1` (nada selecionado) + forward → começa em 0.
 *   - `current === -1` + backward → começa no último.
 *   - Wrap-around: depois do último, volta pro primeiro (e vice-versa).
 */

export type CycleDirection = 'forward' | 'backward';

export function cycleSlotIndex(current: number, total: number, direction: CycleDirection): number {
  if (total <= 0) return -1;

  if (current < 0 || current >= total) {
    return direction === 'forward' ? 0 : total - 1;
  }

  if (direction === 'forward') {
    return (current + 1) % total;
  }
  return (current - 1 + total) % total;
}
