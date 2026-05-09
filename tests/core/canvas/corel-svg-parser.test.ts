import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { cleanCorelSvg, parseCorelSvg } from '@/core/canvas/corel-svg-parser';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

function svg(sub: string, name: string): string {
  return readFileSync(join(FIXTURES_DIR, sub, name), 'utf-8');
}

// Minimal valid SVG template used by error-scenario tests.
// width=60mm height=25mm viewBox gives factorW=factorH=85.75 (uniform).
function validShell(body = '<path d="M0 0 L60 0"/>'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="25mm" viewBox="0 0 5145 2143.75">${body}</svg>`;
}

// ─── Valid fixtures ───────────────────────────────────────────────────────────

describe('parseCorelSvg — valid fixtures', () => {
  it('aplique-1-formato-d', () => {
    const result = parseCorelSvg(svg('apliques', 'aplique-1-formato-d.svg'));

    expect(result.widthMm).toBeCloseTo(100.2, 2);
    expect(result.heightMm).toBeCloseTo(90.2, 2);
    expect(result.viewBoxW).toBeCloseTo(2035.14, 2);
    expect(result.viewBoxH).toBeCloseTo(1832.03, 2);
    // scaleFactor = (4 × 100.2) / 2035.14 ≈ 0.1969
    expect(result.scaleFactor).toBeCloseTo(0.1969, 3);
    expect(result.pathCount).toBeGreaterThanOrEqual(1);
    expect(result.svgStripped).toContain('<svg');
  });

  it('aplique-3-pill', () => {
    const result = parseCorelSvg(svg('apliques', 'aplique-3-pill.svg'));

    expect(result.widthMm).toBeCloseTo(95.2, 2);
    expect(result.heightMm).toBeCloseTo(15.2, 2);
    expect(result.viewBoxW).toBeCloseTo(2123.09, 2);
    expect(result.viewBoxH).toBeCloseTo(338.98, 2);
    // scaleFactor = (4 × 95.2) / 2123.09 ≈ 0.1794
    expect(result.scaleFactor).toBeCloseTo(0.1794, 3);
    expect(result.pathCount).toBeGreaterThanOrEqual(1);
    expect(result.svgStripped).toContain('<svg');
  });

  it('broche-simples', () => {
    const result = parseCorelSvg(svg('camadas-base', 'broche-simples.svg'));

    expect(result.widthMm).toBeCloseTo(60.076, 2);
    expect(result.heightMm).toBeCloseTo(25.076, 2);
    expect(result.viewBoxW).toBeCloseTo(5144.73, 2);
    expect(result.viewBoxH).toBeCloseTo(2147.44, 2);
    // scaleFactor = (4 × 60.076) / 5144.73 ≈ 0.04671
    expect(result.scaleFactor).toBeCloseTo(0.04671, 4);
    expect(result.pathCount).toBe(1);
    expect(result.svgStripped).toContain('<svg');
  });

  it('placa-base', () => {
    const result = parseCorelSvg(svg('camadas-base', 'placa-base.svg'));

    expect(result.widthMm).toBeCloseTo(300.2, 2);
    expect(result.heightMm).toBeCloseTo(90.2, 2);
    expect(result.viewBoxW).toBeCloseTo(24333.28, 2);
    expect(result.viewBoxH).toBeCloseTo(7311.33, 2);
    // scaleFactor = (4 × 300.2) / 24333.28 ≈ 0.04935
    expect(result.scaleFactor).toBeCloseTo(0.04935, 4);
    expect(result.pathCount).toBe(1);
    expect(result.svgStripped).toContain('<svg');
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe('parseCorelSvg — validation errors', () => {
  it('rejeita dimensões em px', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" width="240px" height="100px" viewBox="0 0 1000 400"><path d="M0 0"/></svg>`;
    expect(() => parseCorelSvg(input)).toThrow(
      'SVG precisa estar em milímetros (recebemos pixels).'
    );
  });

  it('rejeita dimensões sem unidade', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100" viewBox="0 0 1000 400"><path d="M0 0"/></svg>`;
    expect(() => parseCorelSvg(input)).toThrow(
      'SVG precisa estar em milímetros (recebemos sem unidade).'
    );
  });

  it('rejeita aspect ratio distorcido', () => {
    // factorW = 5145/60 = 85.75 | factorH = 2200/25 = 88.00 → 2.6% > 0.1%
    const input = `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="25mm" viewBox="0 0 5145 2200"><path d="M0 0"/></svg>`;
    expect(() => parseCorelSvg(input)).toThrow(
      'Esse SVG está esticado — largura e altura foram redimensionadas em escalas diferentes.'
    );
  });

  it('rejeita imagem rasterizada', () => {
    const input = validShell(
      '<image href="data:image/png;base64,iVBORw0KGgo=" width="60" height="25"/>'
    );
    expect(() => parseCorelSvg(input)).toThrow(
      'SVG contém imagem rasterizada. Capi só aceita vetores. Vetorize antes de importar.'
    );
  });

  it('rejeita texto não convertido — fixture broche-completo.svg real', () => {
    expect(() => parseCorelSvg(svg('camadas-base', 'broche-completo.svg'))).toThrow(
      'SVG tem texto não convertido em curva. No Corel: selecione texto, Ctrl+Q, reexporte.'
    );
  });

  it('rejeita <use> e <symbol>', () => {
    const input = validShell('<path d="M0 0 L60 0"/><use href="#x"/>');
    expect(() => parseCorelSvg(input)).toThrow(
      'SVG tem referências internas não suportadas. No Corel: Ctrl+K para quebrar vínculos, reexporte.'
    );
  });

  it('rejeita SVG vazio (sem shapes)', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="25mm" viewBox="0 0 5145 2143.75"><metadata/></svg>`;
    expect(() => parseCorelSvg(input)).toThrow(
      'SVG está vazio. Corel exportou apenas elementos não-suportados.'
    );
  });
});

// ─── cleanCorelSvg — artifact removal ────────────────────────────────────────

// Helper: minimal Corel-like SVG wrapper for cleanup tests.
// Has the same root style string as a real Corel export so fill-rule tests work.
function corelShell(defs = '', body = '<path d="M10 20 L30 40"/>'): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" ` +
    `width="60mm" height="25mm" version="1.1" ` +
    `style="shape-rendering:geometricPrecision; fill-rule:evenodd; clip-rule:evenodd" ` +
    `viewBox="0 0 5145 2143.75" xmlns:xodm="http://www.corel.com/coreldraw/odm/2003">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    `<g id="Layer_1">${body}</g>` +
    `</svg>`
  );
}

describe('cleanCorelSvg — artifact removal', () => {
  // ── Removals ───────────────────────────────────────────────────────────────

  it('remove <style> com CDATA', () => {
    const input = corelShell(
      '<style type="text/css"><![CDATA[.fil0 {fill:none} .str0 {stroke:#373435}]]></style>'
    );
    const result = cleanCorelSvg(input);
    expect(result).not.toContain('<style');
    expect(result).not.toContain('.fil0');
    expect(result).not.toContain('CDATA');
  });

  it('remove atributo fill="#xxx" inline', () => {
    const input = corelShell('', '<path fill="#ff0000" d="M0 0 L10 10"/>');
    const result = cleanCorelSvg(input);
    expect(result).not.toMatch(/\bfill="#/);
  });

  it('remove atributo stroke="#xxx" inline', () => {
    const input = corelShell('', '<path stroke="#373435" stroke-width="6.53" d="M0 0 L10 10"/>');
    const result = cleanCorelSvg(input);
    expect(result).not.toMatch(/\bstroke="#/);
    expect(result).not.toContain('stroke-width');
  });

  it('remove atributo class="fil0 str0"', () => {
    const input = corelShell('', '<path class="fil0 str0" d="M0 0 L10 10"/>');
    const result = cleanCorelSvg(input);
    expect(result).not.toContain('class=');
    expect(result).not.toContain('fil0');
    expect(result).not.toContain('str0');
  });

  it('remove <font> com glyphs embutidos', () => {
    const fontBlock =
      '<font id="FontID0" horiz-adv-x="650">' +
      '<font-face font-family="Test Font"><font-face-src><font-face-name name="TestFont"/></font-face-src></font-face>' +
      '<missing-glyph><path d="M0 0z"/></missing-glyph>' +
      '<glyph unicode="A" d="M0 0 L100 0z"/>' +
      '</font>';
    const input = corelShell(fontBlock);
    const result = cleanCorelSvg(input);
    expect(result).not.toContain('<font');
    expect(result).not.toContain('<glyph');
    expect(result).not.toContain('font-face');
    expect(result).not.toContain('FontID0');
  });

  it('remove <metadata id="CorelCorpID...">', () => {
    const input = corelShell(
      '',
      '<metadata id="CorelCorpID_0Corel-Layer"/><path d="M0 0 L10 10"/>'
    );
    const result = cleanCorelSvg(input);
    expect(result).not.toContain('CorelCorpID');
    expect(result).not.toMatch(/<metadata\b/);
  });

  // ── Preservations ──────────────────────────────────────────────────────────

  it('preserva fill-rule="evenodd" promovido do style do root', () => {
    // Input has fill-rule in the style attribute (as Corel exports it).
    const input = corelShell();
    const result = cleanCorelSvg(input);
    // Promoted to a presentation attribute — style must be gone.
    expect(result).not.toContain('style=');
    // fill-rule must survive as an SVG attribute.
    expect(result).toMatch(/fill-rule=["']evenodd["']/);
    expect(result).toMatch(/clip-rule=["']evenodd["']/);
  });

  it('preserva viewBox', () => {
    const input = corelShell();
    const result = cleanCorelSvg(input);
    expect(result).toContain('viewBox="0 0 5145 2143.75"');
  });

  it('preserva atributo d dos paths', () => {
    const input = corelShell('', '<path class="fil0 str0" fill="#ff0000" d="M10 20 L30 40"/>');
    const result = cleanCorelSvg(input);
    // Geometry is intact.
    expect(result).toContain('d="M10 20 L30 40"');
    // Corel class and colour fills are gone.
    expect(result).not.toContain('class=');
    expect(result).not.toMatch(/fill="#/); // no hex colour fill
    // Step 9 injects fill="none" (Capi default) — so fill= IS present, but only as "none".
    expect(result).toContain('fill="none"');
  });

  // ── Checkpoint — fixture real ──────────────────────────────────────────────

  it('injeta fill="none" em todos os shape elements (path, rect, etc.)', () => {
    // Regression guard: cleanCorelSvg step 9 must inject fill="none" on every
    // shape so Fabric 6 doesn't default to black when parsing the SVG source.
    const input = corelShell(
      '',
      '<path d="M0 0 L10 10"/><rect x="0" y="0" width="10" height="10"/>'
    );
    const result = cleanCorelSvg(input);

    // Each shape tag in the output must carry fill="none".
    const pathTags = [...result.matchAll(/<path\b[^>]*>/g)].map(([tag]) => tag);
    const rectTags = [...result.matchAll(/<rect\b[^>]*>/g)].map(([tag]) => tag);
    expect(pathTags.length).toBeGreaterThan(0);
    expect(rectTags.length).toBeGreaterThan(0);
    for (const tag of [...pathTags, ...rectTags]) {
      expect(tag).toContain('fill="none"');
    }
  });

  it('checkpoint: aplique-1-formato-d.svg — redução de tamanho e elementos removidos', () => {
    const raw = svg('apliques', 'aplique-1-formato-d.svg');
    const cleaned = cleanCorelSvg(raw);

    const beforeChars = raw.length;
    const afterChars = cleaned.length;

    // Report in the format requested by the checkpoint spec.
    console.log(`\nFase B — Checkpoint cleanCorelSvg`);
    console.log(`ANTES: aplique-1-formato-d.svg → ${beforeChars} chars`);
    console.log(`DEPOIS: ${afterChars} chars`);
    console.log(
      `Removidos: <style> (CDATA), <metadata id=CorelCorpID>, ` +
        `class=fil0 str0, attr xml:space, attr xmlns:xodm, attr version, attr style`
    );
    console.log(`Preservados: viewBox, fill-rule=evenodd, clip-rule=evenodd, atributo d do path`);

    // Structural assertions.
    expect(afterChars).toBeLessThan(beforeChars);
    expect(cleaned).not.toContain('<style');
    expect(cleaned).not.toContain('CorelCorpID');
    expect(cleaned).not.toContain('class=');
    expect(cleaned).not.toContain('xml:space');
    expect(cleaned).not.toContain('xmlns:xodm');
    expect(cleaned).toContain('viewBox=');
    expect(cleaned).toMatch(/fill-rule=["']evenodd["']/);
    // The path's d attribute (geometry) must be intact.
    expect(cleaned).toContain('d="');
  });
});
