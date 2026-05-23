/**
 * svg-path-transform.ts — Onda 37 export técnico.
 *
 * Aplica transformação afim 2D a um SVG path `d`, PRESERVANDO curvas Bézier
 * matematicamente (sem flatten, sem amostragem). Propriedade da álgebra de
 * curvas: Bézier sob transformação afim é Bézier — a imagem dos pontos de
 * controle define a nova curva exata. Erro = float64 (≈ 1e-15).
 *
 * Subset suportado de comandos: M, L, C, Q, Z. É o que Fabric e opentype.js
 * emitem após `makePathSimpler` (H/V → L, A → C, S/T → C/Q, relativos →
 * absolutos). Não precisamos suportar arcos ou comandos relativos.
 *
 * API:
 *   - AffineMatrix: { a, b, c, d, e, f } no formato SVG (matrix(a b c d e f)).
 *   - multiplyMatrix(m1, m2): composição m1 × m2.
 *   - transformPoint(m, x, y): aplica matriz a ponto 2D.
 *   - transformPathD(d, m, decimals?): transforma path `d` retornando novo `d`.
 *
 * Precisão de saída: 4 casas decimais (0.0001mm) — decisão Gabriell.
 */
import * as fabric from 'fabric';

/**
 * Matriz afim 2D no formato SVG:
 *   | a c e |   | x |   | a·x + c·y + e |
 *   | b d f | × | y | = | b·x + d·y + f |
 *   | 0 0 1 |   | 1 |   |       1       |
 */
export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Matriz identidade — neutro da multiplicação. */
export const IDENTITY: AffineMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Matriz de translação puro. */
export function translateMatrix(tx: number, ty: number): AffineMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

/** Matriz de escala puro (uniforme ou anisotrópico). */
export function scaleMatrix(sx: number, sy: number = sx): AffineMatrix {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

/**
 * Composição matricial: m1 × m2. Aplica primeiro m2, depois m1.
 *
 * Equivale a: para todo ponto p, multiplyMatrix(m1, m2) · p = m1 · (m2 · p).
 */
export function multiplyMatrix(m1: AffineMatrix, m2: AffineMatrix): AffineMatrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

/** Aplica matriz afim a ponto 2D. */
export function transformPoint(m: AffineMatrix, x: number, y: number): { x: number; y: number } {
  return {
    x: m.a * x + m.c * y + m.e,
    y: m.b * x + m.d * y + m.f,
  };
}

/**
 * Converte array Fabric matrix `[a, b, c, d, e, f]` em AffineMatrix.
 * `calcTransformMatrix()` e `calcOwnMatrix()` retornam neste formato.
 */
export function fromFabricMatrix(arr: number[]): AffineMatrix {
  return { a: arr[0], b: arr[1], c: arr[2], d: arr[3], e: arr[4], f: arr[5] };
}

/**
 * Arredonda para `decimals` casas evitando notação científica (toFixed).
 * Strip de zeros à direita pra arquivos mais limpos: 60.0000 → 60, 60.5000 → 60.5.
 */
function fmt(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '0';
  // Evita -0 visual.
  const v = Object.is(n, -0) ? 0 : n;
  const fixed = v.toFixed(decimals);
  // Remove zeros à direita após o ponto. "60.5000" → "60.5", "60.0000" → "60".
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/**
 * Transforma uma string `d` SVG aplicando `m` em todas as coordenadas
 * absolutas. Bézier (C, Q) são preservados como Bézier — pontos de controle
 * transformados pela mesma matriz geram a curva imagem exata (matemática
 * de curvas paramétricas).
 *
 * Decisões:
 *   - parsePath + makePathSimpler do Fabric → garante subset M/L/C/Q/Z.
 *     Qualquer A vira C; qualquer h/v/etc vira M/L absoluto.
 *   - 4 casas decimais default (0.0001mm) — alinhado com decisão Gabriell.
 *   - Subpaths múltiplos (vários M/Z no mesmo d) são preservados.
 *
 * @returns string `d` transformada. Vazio se d for inválido/vazio.
 */
export function transformPathD(d: string, m: AffineMatrix, decimals: number = 4): string {
  if (!d || d.trim().length === 0) return '';

  const parsed = fabric.util.parsePath(d);
  if (!parsed || parsed.length === 0) return '';
  const simple = fabric.util.makePathSimpler(parsed);
  if (!simple) return '';

  const parts: string[] = [];

  for (const seg of simple) {
    const cmd = seg[0] as string;
    switch (cmd) {
      case 'M': {
        const p = transformPoint(m, seg[1] as number, seg[2] as number);
        parts.push(`M${fmt(p.x, decimals)},${fmt(p.y, decimals)}`);
        break;
      }
      case 'L': {
        const p = transformPoint(m, seg[1] as number, seg[2] as number);
        parts.push(`L${fmt(p.x, decimals)},${fmt(p.y, decimals)}`);
        break;
      }
      case 'C': {
        const p1 = transformPoint(m, seg[1] as number, seg[2] as number);
        const p2 = transformPoint(m, seg[3] as number, seg[4] as number);
        const p = transformPoint(m, seg[5] as number, seg[6] as number);
        parts.push(
          `C${fmt(p1.x, decimals)},${fmt(p1.y, decimals)} ${fmt(p2.x, decimals)},${fmt(p2.y, decimals)} ${fmt(p.x, decimals)},${fmt(p.y, decimals)}`
        );
        break;
      }
      case 'Q': {
        const p1 = transformPoint(m, seg[1] as number, seg[2] as number);
        const p = transformPoint(m, seg[3] as number, seg[4] as number);
        parts.push(
          `Q${fmt(p1.x, decimals)},${fmt(p1.y, decimals)} ${fmt(p.x, decimals)},${fmt(p.y, decimals)}`
        );
        break;
      }
      case 'Z':
      case 'z':
        parts.push('Z');
        break;
      // makePathSimpler garante que não chegamos aqui com H/V/A/etc.
      // Se chegar, ignoramos silenciosamente (path mantém-se válido sem o segmento).
    }
  }

  return parts.join(' ');
}
