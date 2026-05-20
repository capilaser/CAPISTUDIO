/**
 * Testes de regressão do fix `pathOffset` em shapeToFlatPathD (DXF alignment fix).
 *
 * Bug original: Fabric Path/Polygon/Polyline guarda comandos/pontos em coords
 * absolutas do SVG e translada por `-pathOffset` antes de renderizar. O
 * `shapeToLocalD` antigo emitia esses comandos diretamente — quando a matrix
 * de transform aplicava `translate(centerX, centerY)`, o resultado ficava
 * deslocado por `+pathOffset`.
 *
 * Sintoma observado: broche 60×25mm posicionado em (0, 0) saía com bbox
 * `X 30..90, Y 12.5..37.5` (deslocado por metade das extents = pathOffset).
 *
 * Fix: subtrair pathOffset dos comandos locais antes de aplicar matrix.
 * Estes testes travam o comportamento correto.
 */
import * as fabric from 'fabric';
import { describe, expect, it } from 'vitest';

import { shapeToFlatPathD } from '@/core/export/svg-shape-to-path';
import { IDENTITY, scaleMatrix } from '@/core/export/svg-path-transform';

/** Extrai bbox aproximado de um `d` SVG (parsing dos pares de números). */
function bboxOfD(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const tokens = d.match(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const x = parseFloat(tokens[i]!);
    const y = parseFloat(tokens[i + 1]!);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

describe('shapeToFlatPathD — Path pathOffset regression', () => {
  it('Path 60×25 em (0,0) NÃO sai deslocado por pathOffset (bug Onda 37)', () => {
    // Cria um Path Fabric com bbox 60×25 e left=top=0.
    const p = new fabric.Path('M 0 0 L 60 0 L 60 25 L 0 25 Z');
    // Após `new Path()`, Fabric ajusta left/top para -strokeWidth/2 = -0.5.
    // Forçamos posicionamento em (0, 0) sem stroke para teste limpo.
    p.set({ left: 0, top: 0, strokeWidth: 0 });
    p.setCoords();

    // Usa frame identity — o d resultante deve estar em coords absolutas
    // do canvas (no caso, igual ao bbox original do path: 0..60, 0..25).
    const d = shapeToFlatPathD(p, IDENTITY, 4);
    const bbox = bboxOfD(d);

    // SEM o fix, bbox seria 30..90 × 12.5..37.5 (deslocado por pathOffset).
    // COM o fix, bbox deve ser 0..60 × 0..25.
    expect(bbox.minX).toBeCloseTo(0, 3);
    expect(bbox.minY).toBeCloseTo(0, 3);
    expect(bbox.maxX).toBeCloseTo(60, 3);
    expect(bbox.maxY).toBeCloseTo(25, 3);
  });

  it('Path com frame de escala (px→mm) preserva bbox proporcional', () => {
    // 240×100 px → 60×25 mm (PX_PER_MM = 4).
    const p = new fabric.Path('M 0 0 L 240 0 L 240 100 L 0 100 Z');
    p.set({ left: 0, top: 0, strokeWidth: 0 });
    p.setCoords();

    const frame = scaleMatrix(0.25); // 1/4 = px → mm
    const d = shapeToFlatPathD(p, frame, 4);
    const bbox = bboxOfD(d);

    expect(bbox.minX).toBeCloseTo(0, 3);
    expect(bbox.minY).toBeCloseTo(0, 3);
    expect(bbox.maxX).toBeCloseTo(60, 3);
    expect(bbox.maxY).toBeCloseTo(25, 3);
  });

  it('Path em posição absoluta (left=10, top=20) reflete posição correta no d', () => {
    const p = new fabric.Path('M 0 0 L 60 0 L 60 25 L 0 25 Z');
    p.set({ left: 10, top: 20, strokeWidth: 0 });
    p.setCoords();

    const d = shapeToFlatPathD(p, IDENTITY, 4);
    const bbox = bboxOfD(d);

    expect(bbox.minX).toBeCloseTo(10, 3);
    expect(bbox.minY).toBeCloseTo(20, 3);
    expect(bbox.maxX).toBeCloseTo(70, 3);
    expect(bbox.maxY).toBeCloseTo(45, 3);
  });

  it('Path com Path data fora de origem 0,0 (SVG original começa em 50,100)', () => {
    // Simula um SVG carregado com viewBox cuja geometria não começa em (0,0).
    const p = new fabric.Path('M 50 100 L 110 100 L 110 125 L 50 125 Z');
    // Fabric calcula left/top para que o bbox visual fique posicionado.
    // Aqui colocamos o broche em (0,0) — Fabric absorve o offset interno
    // via pathOffset = (80, 112.5) (centro do bbox 50..110 × 100..125).
    p.set({ left: 0, top: 0, strokeWidth: 0 });
    p.setCoords();

    const d = shapeToFlatPathD(p, IDENTITY, 4);
    const bbox = bboxOfD(d);

    // O resultado deve ser 0..60 × 0..25 (mesmo broche, agora em (0,0)).
    expect(bbox.minX).toBeCloseTo(0, 3);
    expect(bbox.minY).toBeCloseTo(0, 3);
    expect(bbox.maxX).toBeCloseTo(60, 3);
    expect(bbox.maxY).toBeCloseTo(25, 3);
  });
});

describe('shapeToFlatPathD — Polygon pathOffset regression', () => {
  it('Polygon 10×10 em (0,0) NÃO sai deslocado por pathOffset', () => {
    const p = new fabric.Polygon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      {}
    );
    p.set({ left: 0, top: 0, strokeWidth: 0 });
    p.setCoords();

    const d = shapeToFlatPathD(p, IDENTITY, 4);
    const bbox = bboxOfD(d);

    expect(bbox.minX).toBeCloseTo(0, 3);
    expect(bbox.minY).toBeCloseTo(0, 3);
    expect(bbox.maxX).toBeCloseTo(10, 3);
    expect(bbox.maxY).toBeCloseTo(10, 3);
  });
});

describe('shapeToFlatPathD — Polyline pathOffset regression', () => {
  it('Polyline 20×0 em (0,0) NÃO sai deslocado por pathOffset', () => {
    const p = new fabric.Polyline(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      {}
    );
    p.set({ left: 0, top: 0, strokeWidth: 0 });
    p.setCoords();

    const d = shapeToFlatPathD(p, IDENTITY, 4);
    const bbox = bboxOfD(d);

    expect(bbox.minX).toBeCloseTo(0, 3);
    expect(bbox.minY).toBeCloseTo(0, 3);
    expect(bbox.maxX).toBeCloseTo(20, 3);
    // Polyline horizontal: minY == maxY (linha degenerada em Y).
    expect(bbox.minY).toBeCloseTo(bbox.maxY, 3);
  });
});

describe('shapeToFlatPathD — Rect/Circle/Ellipse intocados pelo fix', () => {
  it('Rect 60×25 em (0,0) → bbox 0..60, 0..25 (comportamento antigo correto preservado)', () => {
    const r = new fabric.Rect({ width: 60, height: 25, left: 0, top: 0, strokeWidth: 0 });
    r.setCoords();
    const d = shapeToFlatPathD(r, IDENTITY, 4);
    const bbox = bboxOfD(d);
    expect(bbox.minX).toBeCloseTo(0, 3);
    expect(bbox.minY).toBeCloseTo(0, 3);
    expect(bbox.maxX).toBeCloseTo(60, 3);
    expect(bbox.maxY).toBeCloseTo(25, 3);
  });

  it('Circle r=10 em (0,0) → bbox 0..20, 0..20', () => {
    const c = new fabric.Circle({ radius: 10, left: 0, top: 0, strokeWidth: 0 });
    c.setCoords();
    const d = shapeToFlatPathD(c, IDENTITY, 4);
    const bbox = bboxOfD(d);
    expect(bbox.minX).toBeCloseTo(0, 3);
    expect(bbox.minY).toBeCloseTo(0, 3);
    expect(bbox.maxX).toBeCloseTo(20, 3);
    expect(bbox.maxY).toBeCloseTo(20, 3);
  });
});
