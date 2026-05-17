/**
 * seedPatterns.ts — Onda 14
 *
 * Patterns Wave 1 (estruturais/posicionais — CLAUDE.md). Suporta múltiplos
 * produtos: cada fixture declara seu próprio productId, então o seed cobre
 * broche-60x25 e placa-300x90 num único array.
 *
 * Convenções:
 *   - MM_TO_PX = 4 (px = mm × 4)
 *   - Slot é um Rect com capiSlot meta. Fabric reconhece. slotManager
 *     chama loadSlotsFromCanvas após applyPatternObjects.
 *   - Borda e traços são Rects/Lines sem capiSlot — visuais decorativos
 *     stroke-only (corte). Operador pode editar.
 *   - Tags alimentam filtros da UI (com-logo, com-borda, etc).
 *
 * Strategy de re-seed: INSERT OR IGNORE. Pra atualizar layouts, mudar `id`
 * (versionar). IDs prefixados `wave1-<productId>-` pra identificar.
 */
import type Database from '@tauri-apps/plugin-sql';

const MM_TO_PX = 4;
const mm = (n: number) => n * MM_TO_PX;

/** Helper: cria um Rect-slot serializado no shape Fabric. */
function slot(
  id: string,
  type: 'nome' | 'profissao' | 'logo',
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  autoFit = true
) {
  return {
    type: 'rect',
    id,
    version: '6.0.0',
    originX: 'left',
    originY: 'top',
    left: mm(xMm),
    top: mm(yMm),
    width: mm(wMm),
    height: mm(hMm),
    fill: 'transparent',
    stroke: '',
    strokeWidth: 0,
    selectable: true,
    evented: true,
    capiSlot: {
      id,
      type,
      x: xMm,
      y: yMm,
      maxWidth: wMm,
      maxHeight: hMm,
      autoCenter: true,
      autoFit,
    },
  };
}

/** Helper: retângulo decorativo (borda do broche/placa) — stroke-only, sem fill. */
function decorRect(id: string, xMm: number, yMm: number, wMm: number, hMm: number) {
  return {
    type: 'rect',
    id,
    version: '6.0.0',
    originX: 'left',
    originY: 'top',
    left: mm(xMm),
    top: mm(yMm),
    width: mm(wMm),
    height: mm(hMm),
    fill: '',
    stroke: '#2a2c2e',
    strokeWidth: 1,
    strokeUniform: true,
    selectable: true,
    evented: true,
  };
}

/** Helper: traço (linha) decorativo. */
function decorLine(id: string, x1Mm: number, y1Mm: number, x2Mm: number, y2Mm: number) {
  return {
    type: 'line',
    id,
    version: '6.0.0',
    originX: 'left',
    originY: 'top',
    x1: mm(x1Mm),
    y1: mm(y1Mm),
    x2: mm(x2Mm),
    y2: mm(y2Mm),
    left: mm(Math.min(x1Mm, x2Mm)),
    top: mm(Math.min(y1Mm, y2Mm)),
    stroke: '#2a2c2e',
    strokeWidth: 1,
    strokeUniform: true,
    fill: '',
    selectable: true,
    evented: true,
  };
}

interface PatternFixture {
  id: string;
  productId: string;
  name: string;
  description: string;
  tags: string[];
  objects: Array<Record<string, unknown>>;
  layers: Array<Record<string, unknown>>;
}

function buildLayerMeta(objId: string, name: string, zIndex: number): Record<string, unknown> {
  return {
    id: objId,
    parentLayerId: null,
    name,
    zIndex,
    visible: true,
    locked: false,
    kind: 'visual',
    materialId: null,
  };
}

// ── Patterns broche-60x25 (60×25 mm) ─────────────────────────────────────────

const BROCHE_PATTERNS: PatternFixture[] = [
  {
    id: 'wave1-broche-60x25-nome-centro',
    productId: 'broche-60x25',
    name: 'Nome Centralizado',
    description: 'Apenas o nome, centralizado horizontalmente.',
    tags: ['sem-borda', 'sem-traco', 'sem-logo', 'nome-centro'],
    objects: [slot('slot-nome', 'nome', 5, 9.5, 50, 6)],
    layers: [buildLayerMeta('slot-nome', 'Nome', 0)],
  },
  {
    id: 'wave1-broche-60x25-logo-nome-prof',
    productId: 'broche-60x25',
    name: 'Logo + Nome + Profissão',
    description: 'Logo à esquerda, nome e profissão à direita.',
    tags: ['sem-borda', 'sem-traco', 'com-logo', 'nome-direita'],
    objects: [
      slot('slot-logo', 'logo', 3, 5, 15, 15, false),
      slot('slot-nome', 'nome', 22, 6.5, 35, 5),
      slot('slot-profissao', 'profissao', 22, 14, 35, 4),
    ],
    layers: [
      buildLayerMeta('slot-logo', 'Logo', 0),
      buildLayerMeta('slot-nome', 'Nome', 1),
      buildLayerMeta('slot-profissao', 'Profissão', 2),
    ],
  },
  {
    id: 'wave1-broche-60x25-borda-nome',
    productId: 'broche-60x25',
    name: 'Borda + Nome',
    description: 'Retângulo de borda completa + nome centralizado.',
    tags: ['com-borda', 'sem-traco', 'sem-logo', 'nome-centro'],
    objects: [decorRect('decor-borda', 0.5, 0.5, 59, 24), slot('slot-nome', 'nome', 5, 9.5, 50, 6)],
    layers: [buildLayerMeta('decor-borda', 'Borda', 0), buildLayerMeta('slot-nome', 'Nome', 1)],
  },
  {
    id: 'wave1-broche-60x25-traco-logo-nome',
    productId: 'broche-60x25',
    name: 'Logo + Traço + Nome',
    description: 'Logo à esquerda, traço vertical no meio, nome+profissão à direita.',
    tags: ['sem-borda', 'com-traco', 'com-logo', 'nome-direita'],
    objects: [
      decorLine('decor-traco', 20, 4, 20, 21),
      slot('slot-logo', 'logo', 3, 5, 15, 15, false),
      slot('slot-nome', 'nome', 23, 6.5, 34, 5),
      slot('slot-profissao', 'profissao', 23, 14, 34, 4),
    ],
    layers: [
      buildLayerMeta('decor-traco', 'Traço', 0),
      buildLayerMeta('slot-logo', 'Logo', 1),
      buildLayerMeta('slot-nome', 'Nome', 2),
      buildLayerMeta('slot-profissao', 'Profissão', 3),
    ],
  },
  // Adicionais (Onda 14b)
  {
    id: 'wave1-broche-60x25-borda-logo-nome-prof',
    productId: 'broche-60x25',
    name: 'Borda + Logo + Nome + Profissão',
    description: 'Layout completo: borda, logo à esquerda, nome e profissão à direita.',
    tags: ['com-borda', 'sem-traco', 'com-logo', 'nome-direita'],
    objects: [
      decorRect('decor-borda', 0.5, 0.5, 59, 24),
      slot('slot-logo', 'logo', 3.5, 5, 14, 15, false),
      slot('slot-nome', 'nome', 21, 6.5, 35, 5),
      slot('slot-profissao', 'profissao', 21, 14, 35, 4),
    ],
    layers: [
      buildLayerMeta('decor-borda', 'Borda', 0),
      buildLayerMeta('slot-logo', 'Logo', 1),
      buildLayerMeta('slot-nome', 'Nome', 2),
      buildLayerMeta('slot-profissao', 'Profissão', 3),
    ],
  },
  {
    id: 'wave1-broche-60x25-2-tracos',
    productId: 'broche-60x25',
    name: '2 Traços + Nome',
    description: 'Dois traços verticais nos cantos, nome centralizado entre eles.',
    tags: ['sem-borda', 'com-2-tracos', 'sem-logo', 'nome-centro'],
    objects: [
      decorLine('decor-traco-esq', 8, 4, 8, 21),
      decorLine('decor-traco-dir', 52, 4, 52, 21),
      slot('slot-nome', 'nome', 11, 9.5, 38, 6),
    ],
    layers: [
      buildLayerMeta('decor-traco-esq', 'Traço Esquerdo', 0),
      buildLayerMeta('decor-traco-dir', 'Traço Direito', 1),
      buildLayerMeta('slot-nome', 'Nome', 2),
    ],
  },
  {
    id: 'wave1-broche-60x25-logo-direita',
    productId: 'broche-60x25',
    name: 'Nome + Profissão + Logo (direita)',
    description: 'Nome e profissão à esquerda, logo à direita (espelho).',
    tags: ['sem-borda', 'sem-traco', 'com-logo', 'nome-esquerda'],
    objects: [
      slot('slot-nome', 'nome', 3, 6.5, 35, 5),
      slot('slot-profissao', 'profissao', 3, 14, 35, 4),
      slot('slot-logo', 'logo', 42, 5, 15, 15, false),
    ],
    layers: [
      buildLayerMeta('slot-nome', 'Nome', 0),
      buildLayerMeta('slot-profissao', 'Profissão', 1),
      buildLayerMeta('slot-logo', 'Logo', 2),
    ],
  },
];

// ── Patterns placa-300x90 (300×90 mm) ────────────────────────────────────────
// Layouts proporcionais aos da broche, ajustados pra placa industrial.

const PLACA_PATTERNS: PatternFixture[] = [
  {
    id: 'wave1-placa-300x90-nome-centro',
    productId: 'placa-300x90',
    name: 'Nome Centralizado',
    description: 'Nome grande centralizado na placa.',
    tags: ['sem-borda', 'sem-traco', 'sem-logo', 'nome-centro'],
    objects: [slot('slot-nome', 'nome', 30, 35, 240, 20)],
    layers: [buildLayerMeta('slot-nome', 'Nome', 0)],
  },
  {
    id: 'wave1-placa-300x90-logo-nome-prof',
    productId: 'placa-300x90',
    name: 'Logo + Nome + Profissão',
    description: 'Logo à esquerda, nome e profissão à direita.',
    tags: ['sem-borda', 'sem-traco', 'com-logo', 'nome-direita'],
    objects: [
      slot('slot-logo', 'logo', 15, 15, 60, 60, false),
      slot('slot-nome', 'nome', 90, 25, 195, 20),
      slot('slot-profissao', 'profissao', 90, 55, 195, 15),
    ],
    layers: [
      buildLayerMeta('slot-logo', 'Logo', 0),
      buildLayerMeta('slot-nome', 'Nome', 1),
      buildLayerMeta('slot-profissao', 'Profissão', 2),
    ],
  },
  {
    id: 'wave1-placa-300x90-borda-nome',
    productId: 'placa-300x90',
    name: 'Borda + Nome',
    description: 'Retângulo de borda completa + nome centralizado.',
    tags: ['com-borda', 'sem-traco', 'sem-logo', 'nome-centro'],
    objects: [decorRect('decor-borda', 2, 2, 296, 86), slot('slot-nome', 'nome', 30, 35, 240, 20)],
    layers: [buildLayerMeta('decor-borda', 'Borda', 0), buildLayerMeta('slot-nome', 'Nome', 1)],
  },
  {
    id: 'wave1-placa-300x90-traco-logo-nome',
    productId: 'placa-300x90',
    name: 'Logo + Traço + Nome',
    description: 'Logo à esquerda, traço vertical no meio, nome+profissão à direita.',
    tags: ['sem-borda', 'com-traco', 'com-logo', 'nome-direita'],
    objects: [
      decorLine('decor-traco', 85, 15, 85, 75),
      slot('slot-logo', 'logo', 15, 15, 60, 60, false),
      slot('slot-nome', 'nome', 95, 25, 190, 20),
      slot('slot-profissao', 'profissao', 95, 55, 190, 15),
    ],
    layers: [
      buildLayerMeta('decor-traco', 'Traço', 0),
      buildLayerMeta('slot-logo', 'Logo', 1),
      buildLayerMeta('slot-nome', 'Nome', 2),
      buildLayerMeta('slot-profissao', 'Profissão', 3),
    ],
  },
];

const PATTERNS: PatternFixture[] = [...BROCHE_PATTERNS, ...PLACA_PATTERNS];

function buildCanvasJson(p: PatternFixture): string {
  return JSON.stringify({
    version: '6.0.0',
    objects: p.objects,
    capi: {
      items: [{ productId: p.productId, offsetX: 0, offsetY: 0 }],
      units: 'mm',
      schemaVersion: 3,
      layers: p.layers,
    },
  });
}

export async function seedPatterns(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const p of PATTERNS) {
    const canvasJson = buildCanvasJson(p);
    const result = await db.execute(
      `INSERT OR IGNORE INTO patterns
         (id, product_id, name, description, wave, tags, canvas_json,
          is_favorite, is_validated)
       VALUES (?, ?, ?, ?, 14, ?, ?, 0, 1)`,
      [p.id, p.productId, p.name, p.description, JSON.stringify(p.tags), canvasJson]
    );
    if (result.rowsAffected === 1) {
      inserted++;
      if (import.meta.env.DEV) console.info(`[seedPatterns] inserted: ${p.id}`);
    } else {
      skipped++;
      if (import.meta.env.DEV) console.info(`[seedPatterns] skipped (already exists): ${p.id}`);
    }
  }

  return { inserted, skipped };
}
