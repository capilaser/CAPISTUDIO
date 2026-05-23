/**
 * dxf-coordinate-normalize.ts — Flip Y do sistema SVG/canvas para o sistema DXF.
 *
 * Onda DXF-2.5 (correção de coordenadas).
 *
 * Por quê:
 *   - SVG, Canvas, Fabric.js usam Y POSITIVO PARA BAIXO (origem no canto
 *     superior-esquerdo, Y cresce descendo).
 *   - DXF spec, AutoCAD, RDWorks/LaserCAD usam Y POSITIVO PARA CIMA (origem
 *     no canto inferior-esquerdo, Y cresce subindo — convenção cartesiana CAD).
 *   - Sem flip, todo conteúdo carregado no RDWorks aparece espelhado
 *     verticalmente: texto de cabeça para baixo, layout invertido.
 *
 * O flip é uma transformação simples (`y' = bounds.maxY - y`) que preserva
 * o bbox: depois do flip, X continua em [0, maxX] e Y continua em [0, maxY],
 * mas a geometria foi espelhada verticalmente.
 *
 * Esta função é o ÚNICO ponto onde acontece a conversão entre sistemas. O
 * conversor `svgPathToSplines` continua agnóstico (geometria SVG pura) e o
 * `buildDxfDocument` continua agnóstico (formato DXF puro). O caller compõe:
 *
 *   const raw = svgPathToSplines(d, { process });
 *   const dxfReady = normalizeForDxf(raw, bounds);
 *   const lines = dxfReady.map(encodeSpline);
 *   const dxf = buildDxfDocument({ bounds, splineEntities: lines });
 *
 * Esta ordem importa: o flip é aplicado APÓS a conversão de path SVG para
 * SPLINEs, ANTES de codificar como linhas DXF.
 */

import type { DxfBounds } from './dxf-document';
import type { Point2D, SplineInput } from './dxf-spline-encoder';

/**
 * Aplica flip Y a uma SPLINE para converter coordenadas SVG (Y para baixo)
 * em coordenadas DXF (Y para cima), preservando o bbox.
 *
 * Fórmula: y' = bounds.maxY - y
 *
 * Nota: a ordem dos control points é PRESERVADA. Apenas Y é transformado.
 * Direção (clockwise vs anti-clockwise) inverte visualmente, mas isso é o
 * efeito desejado — o flip é uma reflexão vertical da geometria.
 */
export function flipYInSpline(spline: SplineInput, bounds: DxfBounds): SplineInput {
  return {
    ...spline,
    controlPoints: spline.controlPoints.map(
      (p): Point2D => ({
        x: p.x,
        y: bounds.maxY - p.y,
      })
    ),
  };
}

/**
 * Aplica flip Y a uma lista de SPLINEs. Conveniente para o pipeline:
 *   svgPathToSplines → normalizeForDxf → encodeSpline.
 *
 * `bounds.minY` é ignorado pela fórmula (o flip é em torno de maxY/2 quando
 * minY=0; em geral é uma reflexão em torno da linha y = bounds.maxY/2).
 *
 * Para um caller que tem bbox da arte em (0, 0) → (W, H), o resultado tem
 * bbox em (0, 0) → (W, H) também (preservado). Pontos que estavam em y=0
 * vão para y=H; pontos em y=H vão para y=0; meio fica no meio.
 */
export function normalizeForDxf(splines: SplineInput[], bounds: DxfBounds): SplineInput[] {
  return splines.map((s) => flipYInSpline(s, bounds));
}
