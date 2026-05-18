/**
 * layer-label-config.ts — Onda 26 Fase 5.
 *
 * Single source of truth pras cores e blend modes do painel de camadas.
 * UI components importam daqui pra garantir mapeamento consistente
 * (LayerColorLabelPicker, LayerRow stripe, LayerBlendModeSelect).
 */
import type { LayerBlendMode, LayerColorLabel } from '@/data/schema';

/**
 * Cor visível pra cada label. Tons médios pra contraste tanto em
 * superfícies dark (ink-900) quanto em hover (ink-800). 'none' vira null
 * (não desenha faixa).
 */
export const COLOR_LABEL_HEX: Record<LayerColorLabel, string | null> = {
  none: null,
  red: '#dc2626',
  orange: '#ea580c',
  yellow: '#ca8a04',
  green: '#16a34a',
  blue: '#2563eb',
  violet: '#7c3aed',
  gray: '#6b7280',
};

/** Ordem fixa pro picker — espelha ordem visual Photoshop. */
export const COLOR_LABEL_ORDER: LayerColorLabel[] = [
  'none',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
  'gray',
];

export const COLOR_LABEL_NAME: Record<LayerColorLabel, string> = {
  none: 'Sem cor',
  red: 'Vermelho',
  orange: 'Laranja',
  yellow: 'Amarelo',
  green: 'Verde',
  blue: 'Azul',
  violet: 'Violeta',
  gray: 'Cinza',
};

/** Modos de blend suportados + label PT-BR. */
export const BLEND_MODES: Array<{ value: LayerBlendMode; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiplicar' },
  { value: 'screen', label: 'Subexposição' },
  { value: 'overlay', label: 'Sobreposição' },
];
