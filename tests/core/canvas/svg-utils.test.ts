import { describe, expect, it } from 'vitest';

import {
  circleToPathD,
  ellipseToPathD,
  extractClipShapes,
  parseAndStripRootDimensions,
  parseViewBox,
  polygonToPathD,
  rectToPathD,
} from '@/core/canvas/svg-utils';

describe('parseAndStripRootDimensions', () => {
  it('removes width and height from the root <svg> element', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25" width="60mm" height="25mm"><rect/></svg>';
    const out = parseAndStripRootDimensions(input);
    expect(out).not.toMatch(/<svg[^>]*\swidth=/);
    expect(out).not.toMatch(/<svg[^>]*\sheight=/);
  });

  it('preserves the viewBox on the root', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25" width="60mm" height="25mm"></svg>';
    const out = parseAndStripRootDimensions(input);
    expect(out).toMatch(/viewBox="0 0 60 25"/);
  });

  it('does not strip width/height from child elements', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25" width="60mm" height="25mm">' +
      '<rect x="0" y="0" width="10" height="5" fill="red"/>' +
      '<image href="logo.png" width="20" height="8"/>' +
      '</svg>';
    const out = parseAndStripRootDimensions(input);
    expect(out).toMatch(/<rect[^>]*\swidth="10"/);
    expect(out).toMatch(/<rect[^>]*\sheight="5"/);
    expect(out).toMatch(/<image[^>]*\swidth="20"/);
    expect(out).toMatch(/<image[^>]*\sheight="8"/);
  });

  it('throws on non-SVG root', () => {
    expect(() => parseAndStripRootDimensions('<div></div>')).toThrow();
  });

  it('throws on malformed XML', () => {
    expect(() => parseAndStripRootDimensions('<svg><rect></svg>')).toThrow();
  });
});

describe('parseViewBox', () => {
  it('parses space-separated values', () => {
    expect(parseViewBox('0 0 60 25')).toEqual({ minX: 0, minY: 0, width: 60, height: 25 });
  });

  it('parses comma-separated values', () => {
    expect(parseViewBox('0,0,60,25')).toEqual({ minX: 0, minY: 0, width: 60, height: 25 });
  });

  it('parses mixed whitespace', () => {
    expect(parseViewBox(' -5  -2  100  50 ')).toEqual({
      minX: -5,
      minY: -2,
      width: 100,
      height: 50,
    });
  });

  it('throws on invalid input', () => {
    expect(() => parseViewBox('0 0 60')).toThrow();
    expect(() => parseViewBox('a b c d')).toThrow();
  });
});

// ─── rectToPathD ─────────────────────────────────────────────────────────────

describe('rectToPathD', () => {
  it('sharp-cornered rect (rx=ry=0) produces M/H/V/Z path', () => {
    const d = rectToPathD(0, 0, 60, 25, 0, 0);
    expect(d).toBe('M 0,0 H 60 V 25 H 0 Z');
  });

  it('rounded-corner rect starts at (x+r, y)', () => {
    const d = rectToPathD(0.25, 0.25, 59.5, 24.5, 2.5, 2.5);
    // First token: M 2.75,0.25
    expect(d).toMatch(/^M 2\.75,0\.25 /);
  });

  it('rounded-corner rect contains four arc commands', () => {
    const d = rectToPathD(0, 0, 60, 25, 2.5, 2.5);
    const arcCount = (d.match(/\bA\b/g) ?? []).length;
    expect(arcCount).toBe(4);
  });

  it('ends with Z', () => {
    expect(rectToPathD(0, 0, 10, 10, 1, 1)).toMatch(/ Z$/);
  });

  it('clamps rx to half the smaller dimension', () => {
    // rx=20 for a 10×10 rect → clamped to 5
    const d = rectToPathD(0, 0, 10, 10, 20, 20);
    expect(d).toMatch(/^M 5,0 /);
  });

  it('uses the larger of rx/ry as radius', () => {
    // rx=0, ry=3 → r=3
    const d = rectToPathD(0, 0, 10, 10, 0, 3);
    expect(d).toMatch(/^M 3,0 /);
  });
});

// ─── circleToPathD ────────────────────────────────────────────────────────────

describe('circleToPathD', () => {
  it('starts at the left-most point of the circle', () => {
    const d = circleToPathD(30, 20, 10);
    expect(d).toMatch(/^M 20,20 /);
  });

  it('contains two arc commands', () => {
    const d = circleToPathD(0, 0, 5);
    const arcCount = (d.match(/\bA\b/g) ?? []).length;
    expect(arcCount).toBe(2);
  });

  it('ends with Z', () => {
    expect(circleToPathD(0, 0, 5)).toMatch(/ Z$/);
  });
});

// ─── ellipseToPathD ───────────────────────────────────────────────────────────

describe('ellipseToPathD', () => {
  it('starts at (cx-rx, cy)', () => {
    const d = ellipseToPathD(50, 25, 30, 10);
    expect(d).toMatch(/^M 20,25 /);
  });

  it('contains two arc commands with rx and ry', () => {
    const d = ellipseToPathD(0, 0, 30, 10);
    expect(d).toContain('A 30,10');
  });

  it('ends with Z', () => {
    expect(ellipseToPathD(0, 0, 10, 5)).toMatch(/ Z$/);
  });
});

// ─── polygonToPathD ───────────────────────────────────────────────────────────

describe('polygonToPathD', () => {
  it('converts comma-space separated points', () => {
    const d = polygonToPathD('0,0 10,0 10,10 0,10');
    expect(d).toBe('M 0,0 L 10,0 L 10,10 L 0,10 Z');
  });

  it('converts space-only separated points', () => {
    const d = polygonToPathD('0 0 10 0 10 10');
    expect(d).toBe('M 0,0 L 10,0 L 10,10 Z');
  });

  it('returns empty string for fewer than 2 points', () => {
    expect(polygonToPathD('5,5')).toBe('');
    expect(polygonToPathD('')).toBe('');
  });

  it('ends with Z', () => {
    expect(polygonToPathD('0,0 10,0 10,10')).toMatch(/ Z$/);
  });
});

// ─── extractClipShapes ────────────────────────────────────────────────────────

describe('extractClipShapes', () => {
  it('extracts <path d> from SVG', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25"><path d="M 0,0 H 60 V 25 Z"/></svg>';
    const shapes = extractClipShapes(svg);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toBe('M 0,0 H 60 V 25 Z');
  });

  it('converts <rect> to path d', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25"><rect x="0" y="0" width="60" height="25"/></svg>';
    const shapes = extractClipShapes(svg);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toBe('M 0,0 H 60 V 25 H 0 Z'); // no rounding → M/H/V/Z form
  });

  it('converts <rect rx ry> to rounded-corner path d', () => {
    // broche-60x25 actual SVG values
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25"><rect x="0.25" y="0.25" width="59.5" height="24.5" rx="2.5" ry="2.5"/></svg>';
    const shapes = extractClipShapes(svg);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toMatch(/^M 2\.75,0\.25 /); // rounded corner
    expect(shapes[0]).toContain('A 2.5,2.5');
  });

  it('converts <circle> to path d', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="20"/></svg>';
    const shapes = extractClipShapes(svg);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toMatch(/^M 10,30 /);
  });

  it('converts <ellipse> to path d', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="30" cy="15" rx="25" ry="10"/></svg>';
    const shapes = extractClipShapes(svg);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toMatch(/^M 5,15 /);
  });

  it('converts <polygon> to path d', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 10,0 10,10 0,10"/></svg>';
    const shapes = extractClipShapes(svg);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toBe('M 0,0 L 10,0 L 10,10 L 0,10 Z');
  });

  it('collects multiple shapes', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M 0,0 Z"/>' +
      '<rect x="0" y="0" width="10" height="5"/>' +
      '<circle cx="5" cy="5" r="3"/>' +
      '</svg>';
    expect(extractClipShapes(svg)).toHaveLength(3);
  });

  it('returns empty array for SVG with parse error', () => {
    expect(extractClipShapes('<svg><rect></svg>')).toEqual([]);
  });

  it('skips <rect> with zero width or height', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="0" height="25"/></svg>';
    expect(extractClipShapes(svg)).toHaveLength(0);
  });

  it('skips <circle> with r=0', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="0"/></svg>';
    expect(extractClipShapes(svg)).toHaveLength(0);
  });
});
