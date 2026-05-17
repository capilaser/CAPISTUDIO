/**
 * Testes do dxf-exporter (Onda 18, Fase C).
 *
 * Cobre os cenários críticos:
 *   - 1 aplique corte/fiber → 1 DXF bucket "fiber-laser|corte"
 *   - aplique corte + gravação → 2 buckets (corte e gravacao separados)
 *   - aplique multi-máquina → N buckets (1 por máquina)
 *   - LayerMeta.visible=false → ignorada
 *   - excludeFromExport → ignorado
 *   - Cut stroke (#2a2c2e) → ignorado
 *   - Sem elementos → Map vazio
 *   - DXF gerado contém HEADER+TABLES+ENTITIES+EOF (smoke)
 *   - Y é flipado (canvas Y+ baixo → DXF Y+ cima)
 *   - Bucket key helpers (make/parse) round-trip
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as fabric from 'fabric';
import { beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import {
  type AssetExportInfo,
  type AssetLookupFn,
  exportDxfByMachineAndOperation,
  makeDxfBucketKey,
  parseDxfBucketKey,
} from '@/core/export/dxf-exporter';

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

describe('dxf-exporter (Onda 18 Fase C)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  function layersSnapshot() {
    return Array.from(engine.getAllLayerMetas().values());
  }

  describe('bucket key helpers', () => {
    it('make e parse são inversos', () => {
      const key = makeDxfBucketKey('fiber-laser', 'corte');
      expect(key).toBe('fiber-laser|corte');
      const parsed = parseDxfBucketKey(key);
      expect(parsed).toEqual({ machineId: 'fiber-laser', operation: 'corte' });
    });
  });

  describe('cenários básicos de routing', () => {
    it('1 aplique corte/fiber → 1 DXF no bucket "fiber-laser|corte"', async () => {
      const svg = await loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
      });

      expect(Array.from(out.keys())).toEqual(['fiber-laser|corte']);
      const dxf = out.get('fiber-laser|corte')!;
      // Smoke: estrutura mínima DXF presente
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('HEADER');
      expect(dxf).toContain('ENTITIES');
      expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
      // Layer "corte" declarada
      expect(dxf).toMatch(/LAYER\r\n\s*2\r\ncorte/);
    });

    it('aplique corte/fiber + gravação gravacao/fiber → 2 buckets separados', async () => {
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

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
          'balanca-advogado': { operation: 'gravacao', machines: ['fiber-laser'] },
        }),
      });

      // 2 buckets: corte e gravacao na mesma máquina, arquivos separados.
      expect(out.size).toBe(2);
      expect(out.has('fiber-laser|corte')).toBe(true);
      expect(out.has('fiber-laser|gravacao')).toBe(true);

      // Cada arquivo declara só sua layer
      const corte = out.get('fiber-laser|corte')!;
      const grav = out.get('fiber-laser|gravacao')!;
      expect(corte).toMatch(/LAYER\r\n\s*2\r\ncorte/);
      expect(corte).not.toMatch(/LAYER\r\n\s*2\r\ngravacao/);
      expect(grav).toMatch(/LAYER\r\n\s*2\r\ngravacao/);
      expect(grav).not.toMatch(/LAYER\r\n\s*2\r\ncorte/);
    });

    it('aplique multi-máquina (master-biro + fiber) → 2 buckets de mesma op', async () => {
      const svg = await loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': {
            operation: 'marcacao',
            machines: ['master-biro', 'fiber-laser'],
          },
        }),
      });

      expect(out.size).toBe(2);
      expect(out.has('master-biro|marcacao')).toBe(true);
      expect(out.has('fiber-laser|marcacao')).toBe(true);
    });
  });

  describe('filtros', () => {
    it('LayerMeta.visible=false → não vai pro DXF', async () => {
      const svg = await loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      const layerId = await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      engine.setLayerVisibility(layerId, false);

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
      });

      expect(out.size).toBe(0);
    });

    it('objeto com excludeFromExport não vai pro DXF', async () => {
      const svg = await loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      // Adiciona um Rect overlay com excludeFromExport
      const overlay = new fabric.Rect({
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        excludeFromExport: true,
      });
      // Damos um id capi falso pra simular overlay com routing — mas
      // como excludeFromExport=true ele deve ser pulado ANTES do lookup.
      (overlay as unknown as { id: string }).id = 'overlay-fake-id';
      engine.canvas.add(overlay);

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
          // Lookup do overlay-fake-id NÃO existe — se fosse processado, daria
          // null e seria ignorado. Mas excludeFromExport deve curto-circuitar antes.
        }),
      });

      // Aplique normal exportado, overlay ignorado.
      expect(out.size).toBe(1);
    });

    it('objeto sem id capi (ex: forma de corte do produto) é ignorado', async () => {
      const svg = await loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      // Forma de corte do produto: adicionada por canvas-engine SEM id capi
      // (não passa por addAppliqueSvg). Simulamos aqui adicionando um Path
      // sem id capi nenhum — o filtro getCapiId() deve descartá-lo.
      const cutShape = new fabric.Path('M 0 0 L 10 0 L 10 10 L 0 10 Z', {
        stroke: '#2a2c2e',
        fill: '',
      });
      engine.canvas.add(cutShape);

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
      });

      // Saída tem só o aplique (a forma de corte foi descartada pela
      // ausência de id capi).
      expect(out.size).toBe(1);
      expect(out.get('fiber-laser|corte')).toBeDefined();
    });

    it('canvas vazio (sem objetos) → Map vazio', async () => {
      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: [],
        assetLookup: makeLookup({}),
      });
      expect(out.size).toBe(0);
    });
  });

  describe('validação defensiva', () => {
    it('lança em productWidthMm/Height inválidos', async () => {
      await expect(
        exportDxfByMachineAndOperation(engine.canvas, {
          productWidthMm: 0,
          productHeightMm: 25,
          layers: [],
          assetLookup: makeLookup({}),
        })
      ).rejects.toThrow(/inválidos/);
    });
  });

  describe('Y-flip (canvas → DXF cartesiano)', () => {
    it('coordenadas Y das entidades respeitam productHeightMm', async () => {
      const svg = await loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
      });

      const dxf = out.get('fiber-laser|corte')!;
      // Pega todos os group-20 (Y) das entidades VERTEX
      const yValues: number[] = [];
      const lines = dxf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i]?.trim() === '20') {
          const v = parseFloat(lines[i + 1]!);
          if (!Number.isNaN(v)) yValues.push(v);
        }
      }
      // Todos Y devem estar entre 0 e productHeightMm (90) — ou bem próximos.
      // Pequena tolerância pra margem (stroke width, posicionamento do aplique
      // que pode estourar borda em px de overlap).
      for (const y of yValues) {
        expect(y).toBeGreaterThan(-5);
        expect(y).toBeLessThan(baseConfig.productHeightMm + 5);
      }
    });
  });
});
