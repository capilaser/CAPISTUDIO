/**
 * dxf-process-color.ts — Mapeamento processo de produção → cor DXF.
 *
 * Baseado no DXF real de referência (`08-04 - BROCHE - natanepaes.dxf`):
 *   - cor 31  → corte (1 entidade no real: contorno externo do broche)
 *   - cor 250 → gravação (66 entidades no real: texto vetorizado + detalhes)
 *   - cor 5   → marcação (não existe no real; convenção industrial / CLAUDE.md)
 *
 * Cor é definida POR ENTIDADE (código 62 dentro do bloco SPLINE), não por
 * layer. Ver ADR 020 §4.
 */

export type DxfProcess = 'corte' | 'gravacao' | 'marcacao';

/**
 * Cor ACI por processo. Valores extraídos do DXF de referência (corte/gravacao)
 * e da convenção industrial CAM laser (marcacao).
 *
 * NOTA marcacao=5: TBD por teste de máquina. ADR 020 §4 prevê validar com
 * 1 broche de teste no RDWorks antes de declarar produção-ready.
 */
export const DXF_PROCESS_COLOR: Record<DxfProcess, number> = {
  corte: 31,
  gravacao: 250,
  marcacao: 5,
};

/** Retorna a cor ACI (código 62) para um processo. */
export function processColor(process: DxfProcess): number {
  return DXF_PROCESS_COLOR[process];
}
