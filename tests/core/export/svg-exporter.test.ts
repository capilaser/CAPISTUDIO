/**
 * Testes do motor svg-exporter (Onda 9, Fase 9D).
 *
 * Cobertura mínima dos 8 cenários do briefing:
 *   1. 1 aplique corte/fiber → 1 SVG (fiber-laser) com stroke preto
 *   2. aplique corte/fiber + gravação gravacao/fiber → 1 SVG, 2 cores
 *   3. aplique marcacao/master-biro+fiber → 2 SVGs (azul nos 2)
 *   4. LayerMeta.visible=false → ignorada
 *   5. Z-order preservado
 *   6. Dimensões mm corretas (width/height/viewBox)
 *   7. Stroke aplicado, fill vazio
 *   8. Sem elementos → Map vazio
 *
 * Padrão herdado dos testes do canvas-engine: Fabric Canvas real em jsdom,
 * SVG fixtures lidos do disco via parseCorelSvg.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as fabric from 'fabric';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import {
  type AssetExportInfo,
  type AssetLookupFn,
  OPERATION_STROKE,
  exportSvgByMachine,
  recolorSvgFragment,
  wrapAsProductSvg,
} from '@/core/export/svg-exporter';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
  viewportWidthPx: 1600,
  viewportHeightPx: 600,
};

function makeLookup(map: Record<string, AssetExportInfo>): AssetLookupFn {
  return async (id: string) => map[id] ?? null;
}

async function loadFixture(rel: string): Promise<string> {
  return readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
}

describe('svg-exporter (Onda 9 Fase 9D)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  function layersSnapshot() {
    return Array.from(engine.getAllLayerMetas().values());
  }

  // ── 1. 1 aplique corte/fiber → 1 SVG fiber-laser, stroke preto ─────────────
  it('1 aplique corte/fiber → 1 SVG fiber-laser com stroke preto', async () => {
    const svg = await loadFixture('apliques/aplique-1-formato-d.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: layersSnapshot(),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
    });

    expect(Array.from(out.keys())).toEqual(['fiber-laser']);
    const fiberSvg = out.get('fiber-laser')!;
    expect(fiberSvg).toMatch(/stroke="#000000"|stroke:\s*#000000/i);
    // Não deve ter cor de gravação/marcação no único SVG de corte.
    expect(fiberSvg).not.toMatch(/#0000FF/i);
    expect(fiberSvg).not.toMatch(/#FF0000/i);
  });

  // ── 2. aplique corte/fiber + gravação gravacao/fiber → 1 SVG, 2 cores ─────
  it('aplique corte/fiber + gravação gravacao/fiber → 1 SVG fiber-laser com 2 cores', async () => {
    const apliqueSvg = await loadFixture('apliques/aplique-1-formato-d.svg');
    const apliqueMeta = parseCorelSvg(apliqueSvg);
    const apliqueLayerId = await engine.addAppliqueSvg(
      apliqueMeta,
      'Aplique 1',
      'aplique-1-formato-d'
    );

    const engSvg = await loadFixture('engravings/balanca-advogado.svg');
    const engMeta = parseCorelSvg(engSvg);
    await engine.addEngravingSvg(engMeta, 'Balança', 'balanca-advogado', apliqueLayerId);

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: layersSnapshot(),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        'balanca-advogado': { operation: 'gravacao', machines: ['fiber-laser'] },
      }),
    });

    expect(out.size).toBe(1);
    const fiberSvg = out.get('fiber-laser')!;
    // Tanto preto (corte) quanto vermelho (gravação) presentes.
    expect(fiberSvg).toMatch(/#000000/i);
    expect(fiberSvg).toMatch(/#FF0000/i);
    // Marcação ausente.
    expect(fiberSvg).not.toMatch(/#0000FF/i);
  });

  // ── 3. aplique marcacao/master-biro+fiber → 2 SVGs (azul nos 2) ───────────
  it('aplique marcacao/master-biro+fiber → 2 SVGs, ambos com stroke azul', async () => {
    const svg = await loadFixture('apliques/aplique-3-pill.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'Aplique 3', 'aplique-3-pill');

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: layersSnapshot(),
      assetLookup: makeLookup({
        'aplique-3-pill': { operation: 'marcacao', machines: ['master-biro', 'fiber-laser'] },
      }),
    });

    expect(out.size).toBe(2);
    expect(out.has('master-biro')).toBe(true);
    expect(out.has('fiber-laser')).toBe(true);
    for (const machine of ['master-biro', 'fiber-laser']) {
      const s = out.get(machine)!;
      expect(s).toMatch(/#0000FF/i);
      expect(s).not.toMatch(/#000000/i);
      expect(s).not.toMatch(/#FF0000/i);
    }
  });

  // ── 4. visible=false → camada não aparece no output ──────────────────────
  it('camada com visible=false é ignorada (não aparece em nenhum SVG)', async () => {
    const ap1 = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
    const ap2 = parseCorelSvg(await loadFixture('apliques/aplique-2-quadrado.svg'));

    const id1 = await engine.addAppliqueSvg(ap1, 'Ap1', 'aplique-1-formato-d');
    await engine.addAppliqueSvg(ap2, 'Ap2', 'aplique-2-quadrado');

    // Marca o primeiro como invisível.
    engine.setLayerVisibility(id1, false);

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: layersSnapshot(),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        'aplique-2-quadrado': { operation: 'corte', machines: ['due-laser'] },
      }),
    });

    // Aplique 1 (invisível, fiber-laser) NÃO deve produzir SVG fiber-laser.
    // Aplique 2 (visível, due-laser) DEVE produzir SVG due-laser.
    expect(out.has('due-laser')).toBe(true);
    expect(out.has('fiber-laser')).toBe(false);
  });

  // ── 5. Z-order preservado: ordem dos elementos no SVG = ordem do canvas ──
  it('z-order é preservado no output (último adicionado = último no SVG)', async () => {
    const ap1 = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
    const ap2 = parseCorelSvg(await loadFixture('apliques/aplique-2-quadrado.svg'));

    await engine.addAppliqueSvg(ap1, 'Ap1', 'aplique-1-formato-d'); // primeiro (fundo)
    await engine.addAppliqueSvg(ap2, 'Ap2', 'aplique-2-quadrado'); // segundo (topo)

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: layersSnapshot(),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        'aplique-2-quadrado': { operation: 'gravacao', machines: ['fiber-laser'] },
      }),
    });

    const fiberSvg = out.get('fiber-laser')!;
    // Stroke preto (corte = aplique 1) tem que aparecer ANTES do vermelho.
    const blackIdx = fiberSvg.search(/#000000/i);
    const redIdx = fiberSvg.search(/#FF0000/i);
    expect(blackIdx).toBeGreaterThanOrEqual(0);
    expect(redIdx).toBeGreaterThan(blackIdx);
  });

  // ── 6. Dimensões em mm corretas no SVG ────────────────────────────────────
  it('SVG tem width/height/viewBox em mm conforme productWidthMm/productHeightMm', async () => {
    const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
    await engine.addAppliqueSvg(ap, 'Ap1', 'aplique-1-formato-d');

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: 300,
      productHeightMm: 90,
      layers: layersSnapshot(),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
    });

    const svg = out.get('fiber-laser')!;
    expect(svg).toContain('width="300mm"');
    expect(svg).toContain('height="90mm"');
    expect(svg).toContain('viewBox="0 0 300 90"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  // ── 7. Stroke aplicado, fill vazio (stroke-only contract) ────────────────
  it('output é stroke-only — todo fill foi removido', async () => {
    const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
    await engine.addAppliqueSvg(ap, 'Ap1', 'aplique-1-formato-d');

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: layersSnapshot(),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
    });

    const svg = out.get('fiber-laser')!;
    // Extrai todos os valores de `fill: …` em styles e `fill="…"` em atributos.
    // Cada um deve ser `none`. Regex ancorada em `(?<![-\w])fill` evita `fill-rule:`/`fill-opacity:`.
    const styleFills = [...svg.matchAll(/(?<![-\w])fill\s*:\s*([^;"'}]+)/gi)].map((m) =>
      m[1].trim()
    );
    const attrFills = [...svg.matchAll(/(?<![-\w])fill\s*=\s*"([^"]*)"/gi)].map((m) => m[1].trim());
    for (const v of [...styleFills, ...attrFills]) {
      expect(v).toBe('none');
    }
    // Pelo menos um fill foi encontrado (sanity — Fabric sempre emite o style).
    expect(styleFills.length + attrFills.length).toBeGreaterThan(0);
    // Stroke da operação corte presente.
    expect(svg).toMatch(/stroke.*#000000/i);
  });

  // ── 8. Pedido vazio → Map vazio ──────────────────────────────────────────
  it('canvas sem elementos exportáveis → Map vazio (sem throws)', async () => {
    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: layersSnapshot(),
      assetLookup: makeLookup({}),
    });
    expect(out.size).toBe(0);
  });

  // ── Helpers exportados (testados pra cobertura) ──────────────────────────
  describe('helpers exportados', () => {
    it('recolorSvgFragment substitui fill e stroke (style + attribute)', () => {
      const input =
        '<rect style="fill: rgb(255,0,0); stroke: rgb(0,0,0); stroke-width: 1;" fill="red" stroke="black" x="0" y="0" width="10" height="10"/>';
      const out = recolorSvgFragment(input, '#0000FF');
      expect(out).toContain('fill: none');
      expect(out).toContain('stroke: #0000FF');
      expect(out).toContain('fill="none"');
      expect(out).toContain('stroke="#0000FF"');
    });

    it('wrapAsProductSvg emite header com width/height/viewBox em mm', () => {
      const out = wrapAsProductSvg('<g/>', 100, 50);
      expect(out).toContain('width="100mm"');
      expect(out).toContain('height="50mm"');
      expect(out).toContain('viewBox="0 0 100 50"');
      // Scale wrapper 1/4 (px→mm).
      expect(out).toMatch(/scale\(0\.25\)/);
    });

    it('OPERATION_STROKE expõe as 3 cores semânticas', () => {
      expect(OPERATION_STROKE.corte).toBe('#000000');
      expect(OPERATION_STROKE.marcacao).toBe('#0000FF');
      expect(OPERATION_STROKE.gravacao).toBe('#FF0000');
    });
  });

  // ── Erros: LayerMeta inconsistente ────────────────────────────────────────
  describe('estados de erro', () => {
    it('lança quando objeto canvas não tem LayerMeta correspondente', async () => {
      // Adiciona um Rect cru no canvas SEM passar pelo engine — sem LayerMeta.
      const rect = new fabric.Rect({ left: 0, top: 0, width: 10, height: 10 });
      (rect as unknown as { id: string }).id = 'orphan-id';
      engine.canvas.add(rect);

      await expect(
        exportSvgByMachine(engine.canvas, {
          productWidthMm: 300,
          productHeightMm: 90,
          layers: layersSnapshot(),
          assetLookup: makeLookup({}),
        })
      ).rejects.toThrow(/sem LayerMeta/);
    });

    it('lança quando assetLookup retorna null para id que está no LayerMeta', async () => {
      const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
      await engine.addAppliqueSvg(ap, 'Ap', 'aplique-fantasma');

      await expect(
        exportSvgByMachine(engine.canvas, {
          productWidthMm: 300,
          productHeightMm: 90,
          layers: layersSnapshot(),
          assetLookup: makeLookup({}), // não conhece nenhum id
        })
      ).rejects.toThrow(/assetLookup retornou null/);
    });

    it('Onda 18: VisualLayerMeta sem engravingId/markingId é ignorado (warn+skip, não throw)', async () => {
      // Mudança de comportamento Onda 18: antes lançava, agora skipa com warn.
      // Razão: em pedidos reais, operador tem slots de texto (Nome/Profissão)
      // sem asset cadastrado — o export inteiro travava por causa disso.
      // Agora: slot sem asset simplesmente não aparece no SVG/DXF.
      const apliqueSvg = await loadFixture('apliques/aplique-1-formato-d.svg');
      const apliqueMeta = parseCorelSvg(apliqueSvg);
      await engine.addAppliqueSvg(apliqueMeta, 'Aplique 1', 'aplique-1-formato-d');

      // Adiciona rect avulso SEM asset cadastrado (vira slot/visual sem rota)
      engine.addRectangle(10, 10, 20, 20);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const out = await exportSvgByMachine(engine.canvas, {
        productWidthMm: 300,
        productHeightMm: 90,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
      });

      // Aplique normal foi exportado; rect avulso foi ignorado.
      expect(out.size).toBe(1);
      expect(out.has('fiber-laser')).toBe(true);

      // Warning saiu pro console identificando o slot ignorado.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/camada visual.*sem engravingId nem markingId.*ignorada/)
      );

      warnSpy.mockRestore();
    });
  });

  // ── Integração com text-converter (Fase 9D-bis) ──────────────────────────
  describe('integração com opentype text-converter', () => {
    const FONTS_DIR = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../src-tauri/resources/fonts'
    );
    function diskFontLoader() {
      const map: Record<string, string> = {
        Montserrat: 'Montserrat-Variable.ttf',
        'Bebas Neue': 'BebasNeue-Regular.ttf',
        'Roboto Slab': 'RobotoSlab-Variable.ttf',
      };
      return async (family: string) => {
        const file = map[family];
        if (!file) return null;
        const buf = readFileSync(join(FONTS_DIR, file));
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      };
    }

    it('com fontBufferLoader: texto vira <path> real (não placeholder), cor=vermelho gravação', async () => {
      const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
      const apliqueId = await engine.addAppliqueSvg(ap, 'Ap1', 'aplique-1-formato-d');

      const text = new fabric.IText('Capi', {
        left: 100,
        top: 50,
        fontFamily: 'Montserrat',
        fontSize: 16,
      });
      (text as unknown as { id: string }).id = 'txt-1';
      engine.canvas.add(text);

      // LayerMeta visual filho do aplique (vai herdar machines).
      const layers = layersSnapshot();
      layers.push({
        id: 'txt-1',
        parentLayerId: apliqueId,
        name: 'Nome',
        zIndex: 99,
        visible: true,
        locked: false,
        kind: 'visual',
        materialId: null,
      });

      const out = await exportSvgByMachine(engine.canvas, {
        productWidthMm: 300,
        productHeightMm: 90,
        layers,
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
        fontBufferLoader: diskFontLoader(),
      });

      const fiberSvg = out.get('fiber-laser')!;
      // Path real, não placeholder.
      expect(fiberSvg).not.toContain('<!-- Texto pendente');
      expect(fiberSvg).toMatch(/<path d="M[^"]+"\s+fill="#FF0000"/);
    });

    it('com fonte unsupported (Roboto Slab): cai pro placeholder + onTextConversionError é chamado', async () => {
      const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
      const apliqueId = await engine.addAppliqueSvg(ap, 'Ap1', 'aplique-1-formato-d');

      const text = new fabric.IText('Teste', {
        left: 100,
        top: 50,
        fontFamily: 'Roboto Slab',
        fontSize: 16,
      });
      (text as unknown as { id: string }).id = 'txt-bad';
      engine.canvas.add(text);

      const layers = layersSnapshot();
      layers.push({
        id: 'txt-bad',
        parentLayerId: apliqueId,
        name: 'Nome',
        zIndex: 99,
        visible: true,
        locked: false,
        kind: 'visual',
        materialId: null,
      });

      const errors: Array<{ kind: string; family: string; text: string }> = [];
      const out = await exportSvgByMachine(engine.canvas, {
        productWidthMm: 300,
        productHeightMm: 90,
        layers,
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
        fontBufferLoader: diskFontLoader(),
        onTextConversionError: (err, text) =>
          errors.push({ kind: err.kind, family: err.fontFamily, text }),
      });

      const fiberSvg = out.get('fiber-laser')!;
      expect(fiberSvg).toContain('<!-- Texto pendente: Teste');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        kind: 'font-unsupported',
        family: 'Roboto Slab',
        text: 'Teste',
      });
    });

    it('textRouting override: muda operation do texto (gravação→marcação) reflete na cor', async () => {
      const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
      const apliqueId = await engine.addAppliqueSvg(ap, 'Ap1', 'aplique-1-formato-d');

      const text = new fabric.IText('Nome', {
        left: 100,
        top: 50,
        fontFamily: 'Montserrat',
        fontSize: 16,
      });
      (text as unknown as { id: string }).id = 'txt-override-op';
      engine.canvas.add(text);

      const layers = layersSnapshot();
      layers.push({
        id: 'txt-override-op',
        parentLayerId: apliqueId,
        name: 'Nome',
        zIndex: 99,
        visible: true,
        locked: false,
        kind: 'visual',
        materialId: null,
      });

      const overrides = new Map<string, { operation: 'corte' | 'marcacao' | 'gravacao' }>();
      overrides.set('txt-override-op', { operation: 'marcacao' });

      const out = await exportSvgByMachine(engine.canvas, {
        productWidthMm: 300,
        productHeightMm: 90,
        layers,
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
        fontBufferLoader: diskFontLoader(),
        textRouting: overrides,
      });

      const fiberSvg = out.get('fiber-laser')!;
      // Texto agora vai como marcacao (azul), não gravação (vermelho).
      expect(fiberSvg).toMatch(/<path d="M[^"]+"\s+fill="#0000FF"/);
      expect(fiberSvg).not.toMatch(/<path d="M[^"]+"\s+fill="#FF0000"/);
    });

    it('textRouting override: muda machines do texto manda texto pra máquina diferente do aplique', async () => {
      const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
      const apliqueId = await engine.addAppliqueSvg(ap, 'Ap1', 'aplique-1-formato-d');

      const text = new fabric.IText('X', {
        left: 100,
        top: 50,
        fontFamily: 'Bebas Neue',
        fontSize: 16,
      });
      (text as unknown as { id: string }).id = 'txt-override-mach';
      engine.canvas.add(text);

      const layers = layersSnapshot();
      layers.push({
        id: 'txt-override-mach',
        parentLayerId: apliqueId,
        name: 'Nome',
        zIndex: 99,
        visible: true,
        locked: false,
        kind: 'visual',
        materialId: null,
      });

      const overrides = new Map<
        string,
        { operation: 'corte' | 'marcacao' | 'gravacao'; machines?: string[] }
      >();
      // Aplique vai pra fiber-laser, texto vai pra master-biro.
      overrides.set('txt-override-mach', {
        operation: 'gravacao',
        machines: ['master-biro'],
      });

      const out = await exportSvgByMachine(engine.canvas, {
        productWidthMm: 300,
        productHeightMm: 90,
        layers,
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
        fontBufferLoader: diskFontLoader(),
        textRouting: overrides,
      });

      // Aplique no SVG do fiber-laser (sem o texto).
      const fiberSvg = out.get('fiber-laser')!;
      expect(fiberSvg).not.toMatch(/<path d="M[^"]+"\s+fill="#FF0000"/);
      // Texto no SVG do master-biro (sem o aplique).
      const masterSvg = out.get('master-biro')!;
      expect(masterSvg).toMatch(/<path d="M[^"]+"\s+fill="#FF0000"/);
    });

    it('texto sem parentLayerId lança erro de routing claro', async () => {
      const text = new fabric.IText('Solto', {
        left: 100,
        top: 50,
        fontFamily: 'Montserrat',
        fontSize: 16,
      });
      (text as unknown as { id: string }).id = 'txt-orphan';
      engine.canvas.add(text);

      const layers = layersSnapshot();
      layers.push({
        id: 'txt-orphan',
        parentLayerId: null,
        name: 'Solto',
        zIndex: 0,
        visible: true,
        locked: false,
        kind: 'visual',
        materialId: null,
      });

      await expect(
        exportSvgByMachine(engine.canvas, {
          productWidthMm: 300,
          productHeightMm: 90,
          layers,
          assetLookup: makeLookup({}),
          fontBufferLoader: diskFontLoader(),
        })
      ).rejects.toThrow(/sem parentLayerId/);
    });
  });

  // ── Texto: placeholder + escape de '--' em comentário XML ───────────────
  describe('texto pendente (Fase 9D-bis)', () => {
    it('emite comentário placeholder para fabric.Text e escapa "--" no conteúdo', async () => {
      const ap = parseCorelSvg(await loadFixture('apliques/aplique-1-formato-d.svg'));
      const apliqueId = await engine.addAppliqueSvg(ap, 'Ap1', 'aplique-1-formato-d');

      // Cria um IText com conteúdo que tem "--" (precisa ser escapado em comentário XML).
      const text = new fabric.IText('Nome -- Sobrenome', { left: 100, top: 50 });
      (text as unknown as { id: string }).id = 'txt-1';
      engine.canvas.add(text);
      // Registra LayerMeta visual para o texto — sem engravingId/markingId,
      // mas será interceptado como text antes da validação de asset.
      // Reusa a Map interna via reflection mínima: setLayerMeta não é exposto,
      // então construímos LayerMeta inline e injetamos pelo getAllLayerMetas snapshot.
      const layers = layersSnapshot();
      layers.push({
        id: 'txt-1',
        parentLayerId: apliqueId,
        name: 'Nome',
        zIndex: 99,
        visible: true,
        locked: false,
        kind: 'visual',
        materialId: null,
      });

      const out = await exportSvgByMachine(engine.canvas, {
        productWidthMm: 300,
        productHeightMm: 90,
        layers,
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
      });

      const svg = out.get('fiber-laser')!;
      expect(svg).toContain('<!-- Texto pendente:');
      expect(svg).toContain('Onda 9D-bis');
      // "--" do texto vira "__" pra não quebrar o comentário XML.
      expect(svg).toContain('Nome __ Sobrenome');
      expect(svg).not.toContain('Nome -- Sobrenome');
    });
  });
});
