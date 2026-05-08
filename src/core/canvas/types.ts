export type SlotType = 'logo' | 'nome' | 'profissao' | 'custom';

export interface SlotMeta {
  id: string;
  type: SlotType;
  /** mm — top-left corner of the slot area */
  x: number;
  /** mm — top-left corner of the slot area */
  y: number;
  /** mm — maximum slot width */
  maxWidth: number;
  /** mm — maximum slot height */
  maxHeight: number;
  /** when true, content is centered inside the slot area */
  autoCenter: boolean;
  /** when true, text content uses fitText to shrink font until it fits */
  autoFit: boolean;
  fontFamily?: string;
  /** text content (nome / profissao / custom slots) */
  content?: string;
  /** dataURL or path (logo slot) */
  logoSrc?: string;
}

export interface FitTextOptions {
  text: string;
  /** mm — maximum allowed rendered width */
  maxWidth: number;
  /** mm — maximum allowed rendered height (currently unused by Opção A, reserved) */
  maxHeight: number;
  fontFamily: string;
  /** pt — largest font size to try (default 24) */
  maxFontSize?: number;
  /** pt — smallest font size allowed (default 6) */
  minFontSize?: number;
  /** pt — decrement step per iteration (default 0.5) */
  step?: number;
  /**
   * Injected measurement function. Must return rendered dimensions in mm for
   * the given text/font/size. Keeping this injectable makes fitText DOM-free
   * and 100% testable with deterministic mocks.
   */
  measureFn: (
    text: string,
    fontFamily: string,
    fontSize: number
  ) => { width: number; height: number };
}

export interface FitTextResult {
  /** pt — chosen font size */
  fontSize: number;
  /** false when text still overflows at minFontSize */
  fits: boolean;
  /** mm — measured width at the chosen fontSize */
  measuredWidth: number;
  /** mm — measured height at the chosen fontSize */
  measuredHeight: number;
}
