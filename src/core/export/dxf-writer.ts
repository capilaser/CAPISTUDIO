/**
 * dxf-writer.ts — Gerador de DXF AutoCAD R12 (AC1009) puro (Onda 18).
 *
 * Por que R12: é o dialeto mais antigo e mais amplamente suportado. RDWorks/
 * LaserCAD (Ruida) come R12 sem problema, e qualquer software de laser
 * comercial dos últimos 30 anos abre R12. Versões mais novas (R2000+)
 * trazem SPLINE e LWPOLYLINE bulge, que não precisamos — flattenamos
 * curvas em polylines (path-flattener da Fase B).
 *
 * Formato DXF é texto ASCII no padrão GROUP-CODE/VALUE: linhas alternadas
 * onde a 1ª é o código numérico (ex: "0" = entity type, "8" = layer name,
 * "10" = X, "20" = Y) e a 2ª é o valor. CRLF (\r\n) entre tokens — alguns
 * parsers antigos quebram com LF puro.
 *
 * Sistema de coordenadas:
 *   - DXF é Y+ pra cima (cartesiano).
 *   - Fabric/canvas é Y+ pra baixo.
 *   - O caller é responsável por flipar Y antes de chamar este writer.
 *     Convenção: yDxf = productHeightMm - yCanvas.
 *
 * Cores via layer:
 *   - Cada operação vira uma layer DXF com colorIndex próprio.
 *   - colorIndex AutoCAD: 1=vermelho, 5=azul, 7=preto/branco.
 *   - RDWorks mapeia layer DXF → camada de trabalho (operação).
 *
 * Não-objetivos:
 *   - SPLINE: R12 não tem. Curvas vêm pré-flattened como polylines.
 *   - Texto vivo (TEXT/MTEXT): decisão Gabriell — texto é vetorizado em
 *     polilinhas via opentype.js (mesmo caminho do SVG).
 *   - HATCH/SOLID (preenchimento): laser ignora fill, só lê stroke.
 *   - Blocos (BLOCK/INSERT): cada peça é inline, sem dedupe.
 */

/** Cor AutoCAD por nome de layer/operação (palette ACI). */
export const DXF_COLOR_INDEX = {
  corte: 7, // preto/branco (default na palette ACI)
  gravacao: 1, // vermelho
  marcacao: 5, // azul
} as const;

export type DxfLayerName = keyof typeof DXF_COLOR_INDEX;

interface Point {
  x: number;
  y: number;
}

/**
 * Builder fluente pra DXF R12. Acumula entidades em buffer interno e
 * monta as 3 sections obrigatórias (HEADER, TABLES, ENTITIES) no build().
 *
 * Uso típico:
 *
 *   const dxf = new DxfBuilder()
 *     .useLayer('corte')
 *     .line(0, 0, 100, 0)
 *     .polyline([{x:0,y:0},{x:50,y:50},{x:100,y:0}], true)
 *     .useLayer('gravacao')
 *     .circle(50, 50, 10)
 *     .build();
 */
export class DxfBuilder {
  private entities: string[] = [];
  private layers = new Set<DxfLayerName>();
  private currentLayer: DxfLayerName = 'corte';

  /** Seleciona a layer ativa pras próximas entidades. Adiciona à TABLES section. */
  useLayer(layer: DxfLayerName): this {
    this.currentLayer = layer;
    this.layers.add(layer);
    return this;
  }

  /** Linha reta entre 2 pontos. */
  line(x1: number, y1: number, x2: number, y2: number): this {
    this.entities.push(
      group(0, 'LINE'),
      group(8, this.currentLayer),
      group(10, num(x1)),
      group(20, num(y1)),
      group(11, num(x2)),
      group(21, num(y2))
    );
    return this;
  }

  /**
   * Polilinha (POLYLINE + VERTEX + SEQEND — formato R12 clássico).
   * Em R12 não temos LWPOLYLINE; cada vértice é uma sub-entidade VERTEX
   * separada. Funciona em qualquer parser.
   *
   * Se `closed=true`, define flag 70=1 no POLYLINE — RDWorks corta de
   * volta pro 1º ponto sem repetir o ponto explicitamente.
   */
  polyline(points: Point[], closed: boolean): this {
    if (points.length < 2) {
      // Polyline com 0-1 pontos é inválida; silenciosamente ignora.
      // Path-flattener pode emitir subpaths degenerados pra "M x y Z" — não fatal.
      return this;
    }

    this.entities.push(
      group(0, 'POLYLINE'),
      group(8, this.currentLayer),
      group(66, '1'), // "vertices follow"
      group(10, '0'),
      group(20, '0'),
      group(30, '0'),
      group(70, closed ? '1' : '0')
    );

    for (const p of points) {
      this.entities.push(
        group(0, 'VERTEX'),
        group(8, this.currentLayer),
        group(10, num(p.x)),
        group(20, num(p.y)),
        group(30, '0')
      );
    }

    this.entities.push(group(0, 'SEQEND'), group(8, this.currentLayer));
    return this;
  }

  /** Círculo (CIRCLE entity). Útil pra furos circulares. */
  circle(cx: number, cy: number, r: number): this {
    this.entities.push(
      group(0, 'CIRCLE'),
      group(8, this.currentLayer),
      group(10, num(cx)),
      group(20, num(cy)),
      group(40, num(r))
    );
    return this;
  }

  /** Monta o documento DXF completo como string ASCII. */
  build(): string {
    const parts: string[] = [];

    // HEADER section: $ACADVER = "AC1009" (R12). $INSUNITS = 4 (millimeters).
    parts.push(
      group(0, 'SECTION'),
      group(2, 'HEADER'),
      group(9, '$ACADVER'),
      group(1, 'AC1009'),
      group(9, '$INSUNITS'),
      group(70, '4'),
      group(0, 'ENDSEC')
    );

    // TABLES section: declara cada LAYER usada com seu colorIndex.
    parts.push(group(0, 'SECTION'), group(2, 'TABLES'));
    parts.push(group(0, 'TABLE'), group(2, 'LAYER'), group(70, String(this.layers.size)));
    for (const layerName of this.layers) {
      parts.push(
        group(0, 'LAYER'),
        group(2, layerName),
        group(70, '0'), // flags: standard
        group(62, String(DXF_COLOR_INDEX[layerName])),
        group(6, 'CONTINUOUS') // line type
      );
    }
    parts.push(group(0, 'ENDTAB'), group(0, 'ENDSEC'));

    // ENTITIES section: tudo que useLayer/line/polyline/circle empilhou.
    // Não usar spread (...this.entities) — em V8 tem limite de ~125k args
    // por apply; broches com curvas geram dezenas de milhares de VERTEX.
    parts.push(group(0, 'SECTION'), group(2, 'ENTITIES'));
    for (const e of this.entities) parts.push(e);
    parts.push(group(0, 'ENDSEC'));

    // EOF é entidade especial — sem section wrapper.
    parts.push(group(0, 'EOF'));

    // CRLF entre tokens — alguns parsers antigos quebram com LF puro.
    return parts.join('\r\n') + '\r\n';
  }
}

/**
 * Inverte Y de canvas (Y+ baixo) pra DXF (Y+ cima). Aplicar no caller
 * antes de passar pontos pro builder.
 */
export function flipY(yCanvas: number, productHeightMm: number): number {
  return productHeightMm - yCanvas;
}

// ── Helpers privados ─────────────────────────────────────────────────────────

/** Formata par (code, value) como 2 linhas DXF. */
function group(code: number, value: string): string {
  // Code padrão é left-padded em 3 chars (estilo AutoCAD canônico), mas
  // qualquer largura serve — parsers ignoram whitespace leading.
  return `${String(code).padStart(3, ' ')}\r\n${value}`;
}

/**
 * Formata número pra DXF: 6 casas decimais, sem expoente, sem locale.
 * 6 casas = sub-micron em mm, mais que suficiente pra laser.
 * `Number.toFixed` em JS sempre usa "." como separador (independe de locale),
 * então é seguro pra DXF que espera ponto decimal.
 */
function num(n: number): string {
  return n.toFixed(6);
}
