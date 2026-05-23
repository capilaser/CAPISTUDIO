/**
 * label-from-pattern-role.ts — Onda 37 Fix-1.
 *
 * Helper puro que mapeia patternRole pra label legível mostrado no
 * ObjectPropertiesPanel quando um placeholder de AREA é selecionado.
 *
 * Extraído de PadraoEditorPage pra satisfazer regra react-refresh
 * (componentes em arquivos próprios; helpers em arquivos próprios).
 */
import type { PatternRole } from '@/data/schema';

export function labelFromPatternRole(role: PatternRole | undefined): string {
  switch (role) {
    case 'PRODUCT':
      return 'Produto';
    case 'APPLIQUE':
      return 'Aplique';
    case 'CONTOUR':
      return 'Contorno';
    case 'TEXT_AREA':
      return 'Área · Texto';
    case 'LOGO_AREA':
      return 'Área · Logo';
    default:
      return 'Forma';
  }
}
