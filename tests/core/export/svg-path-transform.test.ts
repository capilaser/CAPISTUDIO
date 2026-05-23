/**
 * Testes do transformer matemático de path SVG (Onda 37 export técnico).
 *
 * Foco em PRECISÃO. Tolerância para asserções numéricas: 1e-9 (matricial puro,
 * sem path), 1e-4 (após arredondamento de 4 casas decimais).
 */
import { describe, expect, it } from 'vitest';

import {
  IDENTITY,
  multiplyMatrix,
  scaleMatrix,
  transformPathD,
  transformPoint,
  translateMatrix,
  type AffineMatrix,
} from '@/core/export/svg-path-transform';

/** Helper: extrai pares de números de um path d, na ordem. */
function extractCoords(d: string): number[] {
  return Array.from(d.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => parseFloat(m[0]));
}

// ── Matriz pura ────────────────────────────────────────────────────────────

describe('multiplyMatrix', () => {
  it('IDENTITY × M = M', () => {
    const m: AffineMatrix = { a: 2, b: 3, c: 4, d: 5, e: 6, f: 7 };
    expect(multiplyMatrix(IDENTITY, m)).toEqual(m);
  });

  it('M × IDENTITY = M', () => {
    const m: AffineMatrix = { a: 2, b: 3, c: 4, d: 5, e: 6, f: 7 };
    expect(multiplyMatrix(m, IDENTITY)).toEqual(m);
  });

  it('translate × translate = soma das translações', () => {
    const result = multiplyMatrix(translateMatrix(5, 10), translateMatrix(3, 4));
    expect(result).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 8, f: 14 });
  });

  it('scale × scale = produto das escalas', () => {
    const result = multiplyMatrix(scaleMatrix(2), scaleMatrix(3));
    expect(result.a).toBeCloseTo(6, 10);
    expect(result.d).toBeCloseTo(6, 10);
  });

  it('translate × scale aplica scale primeiro (não comutativo)', () => {
    // (translate(10,0) × scale(2)) · (5, 0) = translate · (10, 0) = (20, 0)
    const m = multiplyMatrix(translateMatrix(10, 0), scaleMatrix(2));
    const p = transformPoint(m, 5, 0);
    expect(p.x).toBeCloseTo(20, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it('scale × translate aplica translate primeiro (resultado diferente)', () => {
    // (scale(2) × translate(10,0)) · (5, 0) = scale · (15, 0) = (30, 0)
    const m = multiplyMatrix(scaleMatrix(2), translateMatrix(10, 0));
    const p = transformPoint(m, 5, 0);
    expect(p.x).toBeCloseTo(30, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });
});

// ── transformPoint ─────────────────────────────────────────────────────────

describe('transformPoint', () => {
  it('IDENTITY preserva o ponto', () => {
    const p = transformPoint(IDENTITY, 3.14, -2.71);
    expect(p.x).toBe(3.14);
    expect(p.y).toBe(-2.71);
  });

  it('translate(5, 10) soma offsets', () => {
    const p = transformPoint(translateMatrix(5, 10), 1, 2);
    expect(p.x).toBe(6);
    expect(p.y).toBe(12);
  });

  it('scale(2, 3) multiplica', () => {
    const p = transformPoint(scaleMatrix(2, 3), 4, 5);
    expect(p.x).toBe(8);
    expect(p.y).toBe(15);
  });

  it('matriz composta: ((scale*translate)*p) = scale·(translate·p)', () => {
    const t = translateMatrix(10, 20);
    const s = scaleMatrix(2, 3);
    const m = multiplyMatrix(s, t);
    const p1 = transformPoint(t, 1, 1);
    const p2 = transformPoint(s, p1.x, p1.y);
    const pDirect = transformPoint(m, 1, 1);
    expect(pDirect.x).toBeCloseTo(p2.x, 12);
    expect(pDirect.y).toBeCloseTo(p2.y, 12);
  });
});

// ── transformPathD ─────────────────────────────────────────────────────────

describe('transformPathD', () => {
  it('identity preserva geometria (com arredondamento default 4 casas)', () => {
    const out = transformPathD('M 0 0 L 60 25', IDENTITY);
    expect(out).toBe('M0,0 L60,25');
  });

  it('translate (5, 8) desloca todos os pontos', () => {
    const out = transformPathD('M 0 0 L 10 0 L 10 5 L 0 5 Z', translateMatrix(5, 8));
    // M0+5, L10+5 0+8, L10+5 5+8, L0+5 5+8
    expect(out).toBe('M5,8 L15,8 L15,13 L5,13 Z');
  });

  it('scale(0.25) divide coords por 4 (caso real px→mm do exporter)', () => {
    const out = transformPathD('M 0 0 L 240 100', scaleMatrix(0.25));
    expect(out).toBe('M0,0 L60,25');
  });

  it('Bézier C: pontos de controle E endpoint transformados pela matriz', () => {
    const out = transformPathD('M 0 0 C 0 10 10 10 10 0', translateMatrix(5, 5));
    expect(out).toBe('M5,5 C5,15 15,15 15,5');
  });

  it('Bézier Q: ponto de controle E endpoint transformados', () => {
    const out = transformPathD('M 0 0 Q 5 10 10 0', scaleMatrix(2));
    expect(out).toBe('M0,0 Q10,20 20,0');
  });

  it('Composição típica do export (translate Y + scale 0.25): rect 60×25 em y=8 vira 60×25 em y=0', () => {
    // Path do canvas em px: rect 240×100 em (0, 32) — coord absoluta canvas (y=8mm × 4 = 32px).
    // Matriz: translate(0, -8) × scale(0.25)
    const m = multiplyMatrix(translateMatrix(0, -8), scaleMatrix(0.25));
    const out = transformPathD('M 0 32 L 240 32 L 240 132 L 0 132 Z', m);
    expect(out).toBe('M0,0 L60,0 L60,25 L0,25 Z');
  });

  it('arredondamento controlável via decimals', () => {
    const out = transformPathD('M 0.123456789 0', IDENTITY, 2);
    expect(out).toBe('M0.12,0');
  });

  it('strip de zeros à direita pra arquivos limpos', () => {
    // 60.5000 → 60.5, 25.0000 → 25
    const out = transformPathD('M 60.5 25.0', IDENTITY, 4);
    expect(out).toBe('M60.5,25');
  });

  it('d vazio retorna string vazia', () => {
    expect(transformPathD('', IDENTITY)).toBe('');
    expect(transformPathD('   ', IDENTITY)).toBe('');
  });

  it('Z preservado em subpaths múltiplos', () => {
    const out = transformPathD('M 0 0 L 10 0 Z M 20 20 L 30 20 Z', IDENTITY);
    expect(out).toContain('Z');
    expect((out.match(/Z/g) ?? []).length).toBe(2);
  });

  it('A (arc) é convertido em C pelo makePathSimpler e transformado corretamente', () => {
    // Arco simples: M0,0 A 10 10 0 0 0 20 0. Fabric vira C(s).
    const out = transformPathD('M 0 0 A 10 10 0 0 0 20 0', translateMatrix(5, 5));
    // Sem A no resultado — virou C.
    expect(out).not.toMatch(/[Aa]/);
    expect(out).toContain('C');
    // Primeiro ponto deslocado em (5, 5).
    expect(out.startsWith('M5,5')).toBe(true);
  });

  it('H/V (relativos) viram L absoluto e são transformados', () => {
    const out = transformPathD('M 0 0 H 10 V 5', translateMatrix(0, 0));
    // makePathSimpler transformou H/V em L.
    expect(out).toContain('L10,0');
    expect(out).toContain('L10,5');
    expect(out).not.toMatch(/[HhVv]/);
  });

  it('precisão: para um quadrado 60×25 transformado por matriz exata, coords são exatas', () => {
    // Caso real: rect criado em (0, 8mm), 60×25mm; canvas px (0, 32) tamanho (240, 100).
    // Pré-transform: M0,32 L240,32 L240,132 L0,132 Z.
    // Matriz: scale(0.25) + translate(0,-8).
    const m = multiplyMatrix(translateMatrix(0, -8), scaleMatrix(0.25));
    const out = transformPathD('M 0 32 L 240 32 L 240 132 L 0 132 Z', m);
    const coords = extractCoords(out);
    // Esperado: 0 0 60 0 60 25 0 25
    expect(coords).toEqual([0, 0, 60, 0, 60, 25, 0, 25]);
  });
});

// ── Bézier preservação ─────────────────────────────────────────────────────

describe('preservação de Bézier sob afim', () => {
  it('curva cubic Bézier transformada continua sendo cubic Bézier (4 pontos)', () => {
    // Bézier original: P0=(0,0), P1=(0,10), P2=(10,10), P3=(10,0)
    // Após translate(5,5): P0=(5,5), P1=(5,15), P2=(15,15), P3=(15,5)
    const out = transformPathD('M 0 0 C 0 10 10 10 10 0', translateMatrix(5, 5));
    // Output tem exatamente 1 M + 1 C com 6 coords.
    expect(out).toMatch(
      /^M\d+(?:\.\d+)?,\d+(?:\.\d+)? C\d+(?:\.\d+)?,\d+(?:\.\d+)? \d+(?:\.\d+)?,\d+(?:\.\d+)? \d+(?:\.\d+)?,\d+(?:\.\d+)?$/
    );
  });

  it('matrix afim arbitrária preserva propriedade Bézier (sem flatten/polyline)', () => {
    // Matriz não-trivial: scale(2,3) + translate(1, -2) + rotação 0°.
    const m: AffineMatrix = { a: 2, b: 0, c: 0, d: 3, e: 1, f: -2 };
    const out = transformPathD('M 0 0 C 1 1 2 2 3 3', m);
    // Output ainda tem 1 C (não foi flatten em N L).
    expect((out.match(/C/g) ?? []).length).toBe(1);
    expect((out.match(/L/g) ?? []).length).toBe(0);
  });
});
