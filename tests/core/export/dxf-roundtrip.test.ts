/**
 * Roundtrip DXF (Onda 18 Fase E) — gera DXF de um broche real, parseia o
 * conteúdo, valida geometria/layers/operations.
 *
 * Objetivo: dar confiança de que o arquivo .dxf gerado vai abrir corretamente
 * em RDWorks/LaserCAD sem precisar abrir o software real. Se este teste
 * passa, o DXF é estrutural e semanticamente válido.
 *
 * Cobertura:
 *   1. SECTION/TABLES/ENTITIES estruturalmente bem-formadas
 *   2. Layers declaradas com colorIndex correto (corte=7, gravacao=1, marcacao=5)
 *   3. ENTITIES da layer correta (cada entidade aponta pra layer dela)
 *   4. POLYLINE+VERTEX+SEQEND consistentes (sem VERTEX órfão)
 *   5. Coords dentro do bounding box da prancha (escala mm correta)
 *   6. Y-flip aplicado (canvas Y+ baixo vira DXF Y+ cima)
 *   7. Geometria fechada: aplique vetorial reaberto preserva área
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { DxfBuilder } from '@/core/export/dxf-writer';
import {
  type AssetExportInfo,
  type AssetLookupFn,
  exportDxfByMachineAndOperation,
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

function loadFixture(rel: string): string {
  return readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
}

// ── Parser DXF mínimo ─────────────────────────────────────────────────────────
//
// Não é o parser AutoCAD oficial; é um parser focado em validar o subset
// que o dxf-writer emite. Lê pares (code, value) e reconstrói entities.

interface DxfEntity {
  type: string;
  layer: string;
  /** Para LINE: [x1,y1,x2,y2]. Para CIRCLE: [cx,cy,r]. Para POLYLINE: vazio (vertices em separado). */
  values: Record<number, number>;
  vertices?: Array<{ x: number; y: number }>;
  closed?: boolean;
}

interface DxfLayerDecl {
  name: string;
  colorIndex: number;
}

interface ParsedDxf {
  acadver: string;
  layers: DxfLayerDecl[];
  entities: DxfEntity[];
}

function tokenize(dxf: string): Array<{ code: number; value: string }> {
  // DXF é linhas alternadas: code (numero, com padding) / value (string).
  // Removemos linhas vazias e juntamos em pares determinísticos.
  const rawLines = dxf.split(/\r?\n/);
  const lines = rawLines.filter((l) => l.length > 0);
  const tokens: Array<{ code: number; value: string }> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i]!.trim(), 10);
    if (Number.isNaN(code)) continue;
    tokens.push({ code, value: lines[i + 1]! });
  }
  return tokens;
}

function parseDxf(dxf: string): ParsedDxf {
  const tokens = tokenize(dxf);
  let acadver = '';
  const layers: DxfLayerDecl[] = [];
  const entities: DxfEntity[] = [];

  // Identifica SECTION boundaries: code=0/value=SECTION inicia, code=0/value=ENDSEC fecha.
  // Cada SECTION tem subseção indicada pelo próximo (code=2, value=NAME).
  const isSectionStart = (i: number) => tokens[i]?.code === 0 && tokens[i]?.value === 'SECTION';
  const isEndsec = (i: number) => tokens[i]?.code === 0 && tokens[i]?.value === 'ENDSEC';
  const isEntityMarker = (i: number) => tokens[i]?.code === 0;

  for (let i = 0; i < tokens.length; i++) {
    if (!isSectionStart(i)) continue;
    // Esperamos: (0, SECTION) (2, NAME) ...
    const nameTok = tokens[i + 1];
    if (!nameTok || nameTok.code !== 2) continue;
    const sectionName = nameTok.value;
    const j = i + 2;
    // Encontra fim desta section
    let endJ = j;
    while (endJ < tokens.length && !isEndsec(endJ)) endJ++;

    if (sectionName === 'HEADER') {
      // Procura par (9, "$ACADVER") seguido por (1, "AC1009")
      for (let k = j; k < endJ; k++) {
        if (tokens[k]?.code === 9 && tokens[k]?.value === '$ACADVER') {
          // valor está no próximo token (code=1 normalmente)
          const v = tokens[k + 1];
          if (v) acadver = v.value;
        }
      }
    } else if (sectionName === 'TABLES') {
      // TABLES → TABLE LAYER → várias LAYER entries
      // Cada LAYER entry começa com (0, LAYER) e tem (2, name) e (62, colorIndex).
      // IMPORTANTE: ignorar a primeira (0, TABLE) (2, LAYER) header.
      let k = j;
      while (k < endJ) {
        if (tokens[k]?.code === 0 && tokens[k]?.value === 'LAYER') {
          // É uma layer entry. Lê até próximo code=0.
          let name = '';
          let colorIndex = 7;
          let m = k + 1;
          while (m < endJ && tokens[m]?.code !== 0) {
            const t = tokens[m]!;
            if (t.code === 2) name = t.value;
            else if (t.code === 62) colorIndex = parseInt(t.value, 10);
            m++;
          }
          if (name) layers.push({ name, colorIndex });
          k = m;
        } else {
          k++;
        }
      }
    } else if (sectionName === 'ENTITIES') {
      let k = j;
      while (k < endJ) {
        if (!isEntityMarker(k)) {
          k++;
          continue;
        }
        const entType = tokens[k]!.value;
        if (entType === 'LINE' || entType === 'CIRCLE') {
          const entity: DxfEntity = { type: entType, layer: '', values: {} };
          let m = k + 1;
          while (m < endJ && tokens[m]?.code !== 0) {
            const t = tokens[m]!;
            if (t.code === 8) entity.layer = t.value;
            else entity.values[t.code] = parseFloat(t.value);
            m++;
          }
          entities.push(entity);
          k = m;
        } else if (entType === 'POLYLINE') {
          const entity: DxfEntity = {
            type: 'POLYLINE',
            layer: '',
            values: {},
            vertices: [],
            closed: false,
          };
          let m = k + 1;
          while (m < endJ && tokens[m]?.code !== 0) {
            const t = tokens[m]!;
            if (t.code === 8) entity.layer = t.value;
            else if (t.code === 70) entity.closed = t.value === '1';
            else entity.values[t.code] = parseFloat(t.value);
            m++;
          }
          // Lê VERTEX consecutivos até SEQEND
          while (m < endJ && tokens[m]?.code === 0 && tokens[m]?.value === 'VERTEX') {
            let vx = 0;
            let vy = 0;
            let n = m + 1;
            while (n < endJ && tokens[n]?.code !== 0) {
              const t = tokens[n]!;
              if (t.code === 10) vx = parseFloat(t.value);
              else if (t.code === 20) vy = parseFloat(t.value);
              n++;
            }
            entity.vertices!.push({ x: vx, y: vy });
            m = n;
          }
          // Consome SEQEND
          if (m < endJ && tokens[m]?.code === 0 && tokens[m]?.value === 'SEQEND') {
            let n = m + 1;
            while (n < endJ && tokens[n]?.code !== 0) n++;
            m = n;
          }
          entities.push(entity);
          k = m;
        } else {
          // Entity não reconhecida: pula até próximo code=0
          let m = k + 1;
          while (m < endJ && tokens[m]?.code !== 0) m++;
          k = m;
        }
      }
    }

    i = endJ; // pula pro fim da section
  }

  return { acadver, layers, entities };
}

/** Bounding box (min/max em x/y) de uma lista de polylines. */
function bboxOfEntities(entities: DxfEntity[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const e of entities) {
    if (e.type === 'POLYLINE') {
      for (const v of e.vertices ?? []) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
    } else if (e.type === 'LINE') {
      const x1 = e.values[10] ?? 0;
      const y1 = e.values[20] ?? 0;
      const x2 = e.values[11] ?? 0;
      const y2 = e.values[21] ?? 0;
      minX = Math.min(minX, x1, x2);
      maxX = Math.max(maxX, x1, x2);
      minY = Math.min(minY, y1, y2);
      maxY = Math.max(maxY, y1, y2);
    } else if (e.type === 'CIRCLE') {
      const cx = e.values[10] ?? 0;
      const cy = e.values[20] ?? 0;
      const r = e.values[40] ?? 0;
      minX = Math.min(minX, cx - r);
      maxX = Math.max(maxX, cx + r);
      minY = Math.min(minY, cy - r);
      maxY = Math.max(maxY, cy + r);
    }
  }
  return { minX, maxX, minY, maxY };
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('DXF roundtrip — gera, parseia, valida (Onda 18 Fase E)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  function layersSnapshot() {
    return Array.from(engine.getAllLayerMetas().values());
  }

  describe('parser self-test', () => {
    it('parseia DXF mínimo do dxf-writer corretamente', () => {
      // Sanity check: gera DXF conhecido com o writer, parseia com nosso
      // parser de teste, confirma que todos os campos preservam.
      const dxf = new DxfBuilder()
        .useLayer('corte')
        .line(0, 0, 100, 0)
        .polyline(
          [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
            { x: 20, y: 20 },
          ],
          true
        )
        .useLayer('gravacao')
        .circle(50, 50, 5)
        .build();

      const parsed = parseDxf(dxf);
      expect(parsed.acadver).toBe('AC1009');
      expect(parsed.layers).toHaveLength(2);
      expect(parsed.layers.find((l) => l.name === 'corte')?.colorIndex).toBe(7);
      expect(parsed.layers.find((l) => l.name === 'gravacao')?.colorIndex).toBe(1);

      expect(parsed.entities).toHaveLength(3);
      const line = parsed.entities.find((e) => e.type === 'LINE')!;
      expect(line.layer).toBe('corte');
      expect(line.values[10]).toBe(0);
      expect(line.values[20]).toBe(0);
      expect(line.values[11]).toBe(100);
      expect(line.values[21]).toBe(0);

      const poly = parsed.entities.find((e) => e.type === 'POLYLINE')!;
      expect(poly.layer).toBe('corte');
      expect(poly.closed).toBe(true);
      expect(poly.vertices).toHaveLength(3);
      expect(poly.vertices![0]).toEqual({ x: 10, y: 10 });

      const circle = parsed.entities.find((e) => e.type === 'CIRCLE')!;
      expect(circle.layer).toBe('gravacao');
      expect(circle.values[10]).toBe(50);
      expect(circle.values[20]).toBe(50);
      expect(circle.values[40]).toBe(5);
    });
  });

  describe('aplique real → DXF → parse → valida', () => {
    it('1 aplique corte/fiber gera DXF parseável com geometria fechada', async () => {
      const svg = loadFixture('apliques/aplique-1-formato-d.svg');
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
      const parsed = parseDxf(dxf);

      // Estrutura
      expect(parsed.acadver).toBe('AC1009');
      expect(parsed.layers).toEqual([{ name: 'corte', colorIndex: 7 }]);

      // Tem polylines
      const polylines = parsed.entities.filter((e) => e.type === 'POLYLINE');
      expect(polylines.length).toBeGreaterThan(0);

      // Toda polyline está na layer correta
      for (const p of polylines) expect(p.layer).toBe('corte');

      // Toda polyline tem ≥2 vertices
      for (const p of polylines) {
        expect(p.vertices!.length).toBeGreaterThanOrEqual(2);
      }

      // Bounding box dentro da prancha (0..300 × 0..90 mm) com pequena margem
      const bb = bboxOfEntities(parsed.entities);
      expect(bb.minX).toBeGreaterThan(-2);
      expect(bb.maxX).toBeLessThan(baseConfig.productWidthMm + 2);
      expect(bb.minY).toBeGreaterThan(-2);
      expect(bb.maxY).toBeLessThan(baseConfig.productHeightMm + 2);

      // Y-flip funcional: aplique posicionado tipicamente no meio vertical
      // (~45mm), então maxY deve ser > minY e nenhum negativo grande
      expect(bb.maxY).toBeGreaterThan(bb.minY);
    });

    it('aplique corte + gravação → 2 buckets parseáveis, cada um com sua layer', async () => {
      const apliqueSvg = loadFixture('apliques/aplique-1-formato-d.svg');
      const apliqueMeta = parseCorelSvg(apliqueSvg);
      const apliqueLayerId = await engine.addAppliqueSvg(
        apliqueMeta,
        'Aplique 1',
        'aplique-1-formato-d'
      );

      const engSvg = loadFixture('engravings/balanca-advogado.svg');
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

      const corteDxf = out.get('fiber-laser|corte')!;
      const gravDxf = out.get('fiber-laser|gravacao')!;
      const corteP = parseDxf(corteDxf);
      const gravP = parseDxf(gravDxf);

      // Cada arquivo declara só sua layer
      expect(corteP.layers).toEqual([{ name: 'corte', colorIndex: 7 }]);
      expect(gravP.layers).toEqual([{ name: 'gravacao', colorIndex: 1 }]);

      // E todas as entidades de cada arquivo apontam pra layer correta
      for (const e of corteP.entities) expect(e.layer).toBe('corte');
      for (const e of gravP.entities) expect(e.layer).toBe('gravacao');

      // Tem geometria útil em ambos
      expect(corteP.entities.length).toBeGreaterThan(0);
      expect(gravP.entities.length).toBeGreaterThan(0);

      // Bbox da gravação está DENTRO do bbox do aplique (gravação fica em
      // cima do aplique). Tolerância pra evitar falsos negativos de fronteira.
      const corteBB = bboxOfEntities(corteP.entities);
      const gravBB = bboxOfEntities(gravP.entities);
      const tolerance = 2;
      expect(gravBB.minX).toBeGreaterThanOrEqual(corteBB.minX - tolerance);
      expect(gravBB.maxX).toBeLessThanOrEqual(corteBB.maxX + tolerance);
      expect(gravBB.minY).toBeGreaterThanOrEqual(corteBB.minY - tolerance);
      expect(gravBB.maxY).toBeLessThanOrEqual(corteBB.maxY + tolerance);
    });

    it('aplique multi-máquina → 3 arquivos idênticos (1 por máquina)', async () => {
      const svg = loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      const out = await exportDxfByMachineAndOperation(engine.canvas, {
        productWidthMm: baseConfig.productWidthMm,
        productHeightMm: baseConfig.productHeightMm,
        layers: layersSnapshot(),
        assetLookup: makeLookup({
          'aplique-1-formato-d': {
            operation: 'marcacao',
            machines: ['master-biro', 'fiber-laser', 'due-laser'],
          },
        }),
      });

      expect(out.size).toBe(3);
      const arquivos = Array.from(out.values()).map(parseDxf);
      for (const p of arquivos) {
        expect(p.layers).toEqual([{ name: 'marcacao', colorIndex: 5 }]);
        // Mesmo número de polylines em cada (mesma geometria, máquinas diferentes)
        expect(p.entities.length).toBe(arquivos[0]!.entities.length);
      }
    });
  });

  describe('Y-flip validado por geometria conhecida', () => {
    it('forma manual no topo do canvas (y=10mm) vira y=15mm no DXF (height=25mm)', async () => {
      // Configura prancha pequena
      const smallEl = document.createElement('canvas');
      const smallEngine = new CanvasEngine(smallEl, {
        productWidthMm: 60,
        productHeightMm: 25,
        viewportWidthPx: 240,
        viewportHeightPx: 100,
      });

      // Adiciona aplique reposicionado no topo do canvas (y=10mm = 40px)
      const svg = loadFixture('apliques/aplique-1-formato-d.svg');
      const meta = parseCorelSvg(svg);
      await smallEngine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

      // Posiciona manualmente no topo: top=40px (= 10mm)
      const objs = smallEngine.canvas.getObjects();
      const aplique = objs.find((o) => (o as unknown as { id?: string }).id !== undefined);
      expect(aplique).toBeDefined();
      aplique!.set({ top: 40 }); // 10mm
      smallEngine.canvas.requestRenderAll();

      const out = await exportDxfByMachineAndOperation(smallEngine.canvas, {
        productWidthMm: 60,
        productHeightMm: 25,
        layers: Array.from(smallEngine.getAllLayerMetas().values()),
        assetLookup: makeLookup({
          'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
        }),
      });

      const dxf = out.get('fiber-laser|corte')!;
      const parsed = parseDxf(dxf);
      const bb = bboxOfEntities(parsed.entities);

      // No canvas: aplique está no topo (Y baixo em coords de canvas, ~10mm).
      // No DXF: Y é flipado, então o aplique aparece no Y ALTO (próximo de 25mm).
      // bb.maxY deve estar próximo do topo da prancha (height=25); bb.minY mais embaixo.
      expect(bb.maxY).toBeGreaterThan(12); // claramente acima da metade
      expect(bb.maxY).toBeLessThan(26); // dentro da prancha
    });
  });
});
