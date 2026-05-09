/**
 * Tipos puros do sistema de snap — sem dependência de Fabric, DOM ou React.
 *
 * Todos os valores numéricos estão em milímetros.
 *
 * guideStart / guideEnd: coordenadas para renderizar a linha-guia visual (Fase C).
 * Incluídas aqui para evitar refatoração dos tipos quando a Fase C precisar saber
 * onde desenhar a linha — não apenas o eixo e valor.
 *
 * sourceObjectId: opcional, usado para debug e para guias entre objetos.
 */
export type SnapSource =
  | 'canvas-center'
  | 'parent-center'
  | 'object-edge'
  | 'object-center'
  | 'grid';

export interface SnapTarget {
  /** Eixo em que o snap ocorre. */
  axis: 'x' | 'y';
  /** Valor em mm para onde o objeto deve ser movido (borda ou centro, dependendo da source). */
  value: number;
  /** Distância em mm entre o objeto em movimento e este alvo (sempre positiva). */
  distance: number;
  /** Origem do snap — usado para colorir/estilizar a linha-guia e para debug. */
  source: SnapSource;
  /** Ponto inicial da linha-guia visual, em mm (Fase C). */
  guideStart: { x: number; y: number };
  /** Ponto final da linha-guia visual, em mm (Fase C). */
  guideEnd: { x: number; y: number };
  /** id capi do objeto que gerou este alvo (undefined para canvas-center e grid). */
  sourceObjectId?: string;
}

/**
 * Resultado de computeSnapCandidates.
 * Cada eixo tem no máximo 1 snap ativo (o mais próximo dentro da tolerância).
 * null em um eixo = nenhum snap naquele eixo.
 */
export interface SnapResult {
  x: SnapTarget | null;
  y: SnapTarget | null;
}

/** Retângulo em milímetros — representa bounding box de um objeto ou seleção. */
export interface RectMm {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Limites calculados de um RectMm (bordas e centros). */
export interface RectBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

/** Informação de um objeto candidato a snap (não é o objeto em movimento). */
export interface SnapCandidate {
  /** id capi do objeto. */
  id: string;
  /** Bounding box em mm. */
  rect: RectMm;
}

export interface SnapOptions {
  /** Tolerância em mm — objetos dentro desta distância grudam. Default: 1mm. */
  toleranceMm: number;
  /** Tamanho da grade em mm. Default: 1mm. */
  gridMm: number;
  /** Se true, snap é desativado inteiramente (Alt pressionado). */
  altKeyDown: boolean;
  /**
   * Bounds do pai do objeto em movimento (em mm).
   * Null quando o pai é o próprio canvas (parentLayerId === null).
   * Quando null, o snap de 'parent-center' usa canvasBounds.
   */
  parentBounds: RectMm | null;
}

/** Dimensões do canvas em milímetros (produto). */
export interface CanvasDimsMm {
  width: number;
  height: number;
}
