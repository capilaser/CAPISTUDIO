import { describe, expect, it } from 'vitest';

import { parseAndStripRootDimensions, parseViewBox } from '@/core/canvas/svg-utils';

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
