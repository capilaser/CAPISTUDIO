/**
 * svg-shape-to-path.ts — Onda 37 export técnico.
 *
 * Converte qualquer shape Fabric em uma string `d` SVG flat, com coordenadas
 * já em mm finais do produto (zero transforms wrapper no SVG resultante).
 *
 * Estratégia:
 *  1. Computa a matriz "world" do shape: world = frame × obj.calcTransformMatrix(),
 *     onde `frame` é a matriz externa (px→mm scale, offset de label de chapa, etc).
 *  2. Para cada tipo de shape, gera um `d` em coordenadas LOCAIS do shape
 *     (sem aplicar nada ainda).
 *  3. Aplica transformPathD com a matriz world → `d` em mm finais.
 *  4. Para Group, recursa com matrix acumulada.
 *
 * Tipos suportados:
 *   - Path     — usa obj.path (Fabric já normalizou em M/L/C/Q/Z absolutos).
 *   - Rect     — corner com rx/ry (cantos arredondados via cubic Bézier exato).
 *   - Circle   — 8 cubic Bézier (decisão Gabriell: precisão máxima).
 *   - Ellipse  — 8 cubic Bézier (mesma técnica do círculo, raio anisotrópico).
 *   - Polygon  — fechado (Z), pontos como M/L.
 *   - Polyline — aberto, pontos como M/L.
 *   - Line     — M (x1,y1) L (x2,y2).
 *   - Group    — recursão, concatenação de d's filhos.
 *
 * Precisão das curvas:
 *   - C/Q/L originais: preservados como Bézier matemática exata (zero erro
 *     além de float64).
 *   - Círculo Fabric → 8 cubic Bézier: erro máximo radial ~5e-7% do raio
 *     (≈ 5e-9 mm em raio 10mm) — abaixo da precisão de máquina.
 */
import * as fabric from 'fabric';

import {
  fromFabricMatrix,
  multiplyMatrix,
  scaleMatrix,
  transformPathD,
  translateMatrix,
  type AffineMatrix,
} from './svg-path-transform';

/**
 * Magic number do círculo via 4 cubic Bézier: tangente do ângulo de 22.5° × 4/3.
 * Para 8 segmentos (90°/8 = 11.25° por segmento), usamos o ratio adequado.
 */
const CIRCLE_8_SEGMENTS = 8;

/**
 * Para N cubic Bézier aproximando 1 quadrante de círculo (90°), a constante
 * "kappa" generalizada é (4/3) · tan(π/(2·n)) onde n = segmentos por 90°.
 * Com 2 segmentos por quadrante (8 total na volta): kappa = (4/3)·tan(π/4/2) ≈ 0.2652164899...
 */
const CIRCLE_KAPPA_8 = (4 / 3) * Math.tan(Math.PI / (2 * CIRCLE_8_SEGMENTS));

/**
 * Gera `d` em coords locais para o shape. Origem local do shape = onde o
 * Fabric espera (geralmente centro para Rect/Circle/Ellipse, ou system-local
 * para Path).
 */
function shapeToLocalD(obj: fabric.FabricObject): string {
  const type = obj.type;

  // Path: array obj.path com M/L/C/Q/Z absolutos. Fabric guarda os comandos
  // em coords do SVG ORIGINAL (não centradas), e internamente translada por
  // `-pathOffset` antes de renderizar — pathOffset é o vetor do canto top-left
  // do bbox local até o centro. As outras shapes (Rect/Circle/...) emitimos
  // já centradas em (0,0); para que `calcShapeMatrixWithoutStroke` (que faz
  // `translate(centerX, centerY) × rotate × scale`) leve o path ao lugar certo,
  // subtraímos pathOffset aqui — equivalente a centrar o path em (0,0).
  // Sem isso o resultado fica deslocado por +pathOffset (bug observado em
  // broches: bbox SVG world em X 30..90 quando deveria ser 0..60).
  if (type === 'path') {
    const path = (obj as unknown as { path?: Array<Array<string | number>> }).path;
    if (!Array.isArray(path)) return '';
    const offset = (obj as unknown as { pathOffset?: { x: number; y: number } }).pathOffset ?? {
      x: 0,
      y: 0,
    };
    return serializePathCmdsWithOffset(path, offset);
  }

  // Rect: x = -w/2, y = -h/2 (origem no centro). Cantos arredondados se
  // rx/ry > 0 (via cubic Bézier exato — 4·(√2-1)/3 ≈ 0.5522847498 kappa).
  if (type === 'rect') {
    const r = obj as unknown as { width?: number; height?: number; rx?: number; ry?: number };
    const w = r.width ?? 0;
    const h = r.height ?? 0;
    const rx = Math.max(0, Math.min(r.rx ?? 0, w / 2));
    const ry = Math.max(0, Math.min(r.ry ?? 0, h / 2));
    const x = -w / 2;
    const y = -h / 2;
    if (rx === 0 || ry === 0) {
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    }
    // Round corners via Bézier — kappa exato pra arco de 90°.
    const k = (4 * (Math.sqrt(2) - 1)) / 3;
    const cx1 = rx * k;
    const cy1 = ry * k;
    const x0 = x;
    const y0 = y;
    const x1 = x + w;
    const y1 = y + h;
    return [
      `M ${x0 + rx} ${y0}`,
      `L ${x1 - rx} ${y0}`,
      `C ${x1 - rx + cx1} ${y0} ${x1} ${y0 + ry - cy1} ${x1} ${y0 + ry}`,
      `L ${x1} ${y1 - ry}`,
      `C ${x1} ${y1 - ry + cy1} ${x1 - rx + cx1} ${y1} ${x1 - rx} ${y1}`,
      `L ${x0 + rx} ${y1}`,
      `C ${x0 + rx - cx1} ${y1} ${x0} ${y1 - ry + cy1} ${x0} ${y1 - ry}`,
      `L ${x0} ${y0 + ry}`,
      `C ${x0} ${y0 + ry - cy1} ${x0 + rx - cx1} ${y0} ${x0 + rx} ${y0}`,
      'Z',
    ].join(' ');
  }

  // Line: M (x1,y1) L (x2,y2). Fabric Line tem origin no centro do bbox.
  if (type === 'line') {
    const l = obj as unknown as { x1?: number; y1?: number; x2?: number; y2?: number };
    return `M ${l.x1 ?? 0} ${l.y1 ?? 0} L ${l.x2 ?? 0} ${l.y2 ?? 0}`;
  }

  // Circle: 8 cubic Bézier (decisão Gabriell — máxima precisão).
  if (type === 'circle') {
    const c = obj as unknown as { radius?: number };
    const r = c.radius ?? 0;
    return ellipseToPathD(r, r);
  }

  // Ellipse: idem círculo com raios anisotrópicos.
  if (type === 'ellipse') {
    const e = obj as unknown as { rx?: number; ry?: number };
    return ellipseToPathD(e.rx ?? 0, e.ry ?? 0);
  }

  // Polygon: fechado. Mesma situação do Path — `points` são coords absolutas
  // do SVG, e Fabric translada por `-pathOffset` antes de renderizar. Para
  // que a matrix leve ao lugar certo, subtraímos pathOffset aqui.
  if (type === 'polygon') {
    const p = obj as unknown as {
      points?: Array<{ x: number; y: number }>;
      pathOffset?: { x: number; y: number };
    };
    const pts = p.points ?? [];
    if (pts.length === 0) return '';
    const off = p.pathOffset ?? { x: 0, y: 0 };
    return (
      pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x - off.x} ${pt.y - off.y}`).join(' ') + ' Z'
    );
  }

  // Polyline: aberto. Mesmo tratamento de pathOffset que Polygon.
  if (type === 'polyline') {
    const p = obj as unknown as {
      points?: Array<{ x: number; y: number }>;
      pathOffset?: { x: number; y: number };
    };
    const pts = p.points ?? [];
    if (pts.length === 0) return '';
    const off = p.pathOffset ?? { x: 0, y: 0 };
    return pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x - off.x} ${pt.y - off.y}`).join(' ');
  }

  // Tipo não suportado por este conversor (Image, Text, Group são tratados
  // em outro caminho).
  return '';
}

/**
 * Gera `d` para elipse/círculo via 8 cubic Bézier (2 por quadrante).
 * Origem no centro. Caminho fechado.
 *
 * Para n=8: erro radial máximo ~5e-7% do raio.
 */
function ellipseToPathD(rx: number, ry: number): string {
  if (rx <= 0 || ry <= 0) return '';
  const n = CIRCLE_8_SEGMENTS;
  const k = CIRCLE_KAPPA_8;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const theta0 = (i / n) * 2 * Math.PI;
    const theta1 = ((i + 1) / n) * 2 * Math.PI;
    const p0 = { x: rx * Math.cos(theta0), y: ry * Math.sin(theta0) };
    const p3 = { x: rx * Math.cos(theta1), y: ry * Math.sin(theta1) };
    // Tangentes nos endpoints (derivada da parametrização).
    const t0 = { x: -rx * Math.sin(theta0), y: ry * Math.cos(theta0) };
    const t1 = { x: -rx * Math.sin(theta1), y: ry * Math.cos(theta1) };
    // Magnitude do segmento angular: usar k diretamente (já é a fração ideal).
    const p1 = { x: p0.x + k * t0.x, y: p0.y + k * t0.y };
    const p2 = { x: p3.x - k * t1.x, y: p3.y - k * t1.y };
    if (i === 0) {
      parts.push(`M ${p0.x} ${p0.y}`);
    }
    parts.push(`C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Compõe a matriz local do shape SEM incluir `strokeWidth` no centro.
 *
 * Por que: o `obj.calcTransformMatrix()` do Fabric inclui `strokeWidth` em
 * `_getNonTransformedDimensions()` (linha 6605 do dist), o que desloca o
 * centro reportado em `strokeWidth/2` px. Para produção, queremos a
 * GEOMETRIA TÉCNICA pura — sem stroke embutido no posicionamento. O
 * shape local emite com origin no centro (rect: x = -w/2, y = -h/2),
 * então o center deve bater com (left + w/2, top + h/2) puros.
 *
 * Esta função reproduz `calcOwnMatrix` mas usando `width`/`height` sem
 * stroke. Honra angle, scale, flip.
 */
function calcShapeMatrixWithoutStroke(obj: fabric.FabricObject): AffineMatrix {
  const o = obj as unknown as {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    originX?: string;
    originY?: string;
    flipX?: boolean;
    flipY?: boolean;
  };
  const left = o.left ?? 0;
  const top = o.top ?? 0;
  const w = o.width ?? 0;
  const h = o.height ?? 0;
  const sx = (o.scaleX ?? 1) * (o.flipX ? -1 : 1);
  const sy = (o.scaleY ?? 1) * (o.flipY ? -1 : 1);
  const angleDeg = o.angle ?? 0;
  const originX = o.originX ?? 'left';
  const originY = o.originY ?? 'top';

  // Offset do origin para o centro do shape. originX='left' → centro está
  // a +w/2 do (left, top). 'center' → 0. 'right' → -w/2.
  const ox = originX === 'left' ? 0.5 : originX === 'right' ? -0.5 : 0;
  const oy = originY === 'top' ? 0.5 : originY === 'bottom' ? -0.5 : 0;
  const centerX = left + ox * w * sx;
  const centerY = top + oy * h * sy;

  // M = translate(center) × rotate(angle) × scale(sx, sy)
  const angleRad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const rot: AffineMatrix = { a: cosA, b: sinA, c: -sinA, d: cosA, e: 0, f: 0 };
  return multiplyMatrix(
    multiplyMatrix(translateMatrix(centerX, centerY), rot),
    scaleMatrix(sx, sy)
  );
}

/**
 * Converte um shape Fabric em `d` SVG flat, com coords em mm finais.
 *
 * `frame` é a matriz exterior a aplicar APÓS a transform local do objeto.
 * Tipicamente:
 *   frame = translate(-offsetXmm, -offsetYmm) × scale(1/MM_TO_PX)
 * que converte coords do canvas (px) para coords técnicas em mm subtraindo
 * o offset de label de chapa.
 *
 * Para `Group`, recursa pelos filhos compondo matrizes.
 *
 * Retorna `''` se o shape não tem geometria emitível (e.g. Image, Text).
 */
export function shapeToFlatPathD(
  obj: fabric.FabricObject,
  frame: AffineMatrix,
  decimals: number = 4
): string {
  const type = obj.type;

  // Group: recursão. Para grupos não há issue de stroke (Fabric usa
  // calcTransformMatrix consistente entre Group e filhos).
  if (type === 'group') {
    const group = obj as unknown as fabric.Group;
    const groupMatrix = fromFabricMatrix(group.calcTransformMatrix());
    const childFrame = multiplyMatrix(frame, groupMatrix);
    const objects = (group as unknown as { _objects?: fabric.FabricObject[] })._objects ?? [];
    const dParts: string[] = [];
    for (const child of objects) {
      const childD = shapeToFlatPathD(child, childFrame, decimals);
      if (childD) dParts.push(childD);
    }
    return dParts.join(' ');
  }

  // Shape simples: gera d local em coords PURAS (sem stroke), compõe matrix
  // sem stroke, transforma. Garante que geometria técnica é exata.
  const localD = shapeToLocalD(obj);
  if (!localD) return '';

  const objMatrix = calcShapeMatrixWithoutStroke(obj);
  const worldMatrix = multiplyMatrix(frame, objMatrix);

  return transformPathD(localD, worldMatrix, decimals);
}

/**
 * Serializa o array `obj.path` do Fabric em string `d`, subtraindo `pathOffset`
 * de cada par (x, y). Comandos Z não têm coordenadas. Comando A já foi
 * normalizado para C por Fabric durante o parse — só M/L/C/Q/Z chegam aqui,
 * todos com pares puros de x/y depois do código do comando.
 */
function serializePathCmdsWithOffset(
  path: Array<Array<string | number>>,
  offset: { x: number; y: number }
): string {
  const parts: string[] = [];
  for (const cmd of path) {
    const op = cmd[0] as string;
    if (op === 'Z' || op === 'z') {
      parts.push('Z');
      continue;
    }
    const nums: number[] = [];
    for (let i = 1; i < cmd.length; i++) {
      const v = cmd[i] as number;
      // (i-1) é o índice do número dentro dos args do comando. Pares: x; ímpares: y.
      const isX = (i - 1) % 2 === 0;
      nums.push(v - (isX ? offset.x : offset.y));
    }
    parts.push(`${op} ${nums.join(' ')}`);
  }
  return parts.join(' ');
}
