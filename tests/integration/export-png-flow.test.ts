/**
 * Teste integração end-to-end do fluxo de export PNG (Onda 9.F).
 *
 * Cobre o caminho completo do botão "Exportar PNG" até o PNG salvo:
 *   1. Canvas com aplique + slot Nome preenchido
 *   2. engine.getSlotText('nome') → string usada no nome do arquivo
 *   3. exportPngMockup → bytes PNG válidos
 *   4. savePng (com TauriIO mock) → escrita + persistência de settings
 *
 * Não testa a UI do dialog (renderização React) — tests dedicados ao
 * service (png-export-service.test.ts) já cobrem branches do orquestrador.
 * Este teste garante que as 4 camadas (engine → exporter → service → IO)
 * conversam corretamente sem regressão.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { exportPngMockup } from '@/core/export/png-exporter';

// Mock settingsRepository ANTES do service ser importado.
const settingsStore = new Map<string, string>();
vi.mock('@/data/repositories/settingsRepository', () => ({
  getSetting: vi.fn(async (key: string) => settingsStore.get(key) ?? null),
  setSetting: vi.fn(async (key: string, value: string) => {
    settingsStore.set(key, value);
  }),
}));

import {
  EXPORT_LAST_FOLDER_KEY,
  buildPngFilename,
  savePng,
  type TauriIO,
} from '@/services/png-export-service';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
  viewportWidthPx: 1600,
  viewportHeightPx: 600,
};

/** Header bytes que todo PNG válido começa com. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

beforeEach(() => {
  settingsStore.clear();
  vi.clearAllMocks();
});

describe('Onda 9 — fluxo end-to-end de export PNG', () => {
  it('canvas com aplique + slot Nome → PNG válido salvo no path correto', async () => {
    // ── 1. Setup do canvas: aplique + slot Nome preenchido ──────────────────
    const canvasEl = document.createElement('canvas');
    const engine = new CanvasEngine(canvasEl, baseConfig);

    const apliqueSvg = readFileSync(
      join(FIXTURES_DIR, 'apliques/aplique-1-formato-d.svg'),
      'utf-8'
    );
    const meta = parseCorelSvg(apliqueSvg);
    await engine.addAppliqueSvg(meta, 'Aplique 1', 'aplique-1-formato-d');

    const nomeMeta = engine.createSlot('nome');
    engine.fillTextSlot('nome', 'João Silva', 'Montserrat');

    // Sanity: getSlotText devolve o que foi escrito.
    expect(engine.getSlotText(nomeMeta.id)).toBe('João Silva');

    // ── 2. Compõe o filename do dialog em tempo real ────────────────────────
    const filename = buildPngFilename({
      cliente: engine.getSlotText(nomeMeta.id) ?? '',
      profissao: 'Advogado',
    });
    expect(filename).toBe('joao-silva-advogado_mockup.png');

    // ── 3. Roda o exporter ──────────────────────────────────────────────────
    const layers = Array.from(engine.getAllLayerMetas().values());
    const bytes = await exportPngMockup(engine.canvas, {
      layers,
      backgroundColor: '#ffffff',
    });

    // PNG válido? Header magic.
    for (let i = 0; i < PNG_MAGIC.length; i++) {
      expect(bytes[i]).toBe(PNG_MAGIC[i]);
    }
    expect(bytes.length).toBeGreaterThan(100); // sanity: não é PNG vazio

    // ── 4. Salva via service com TauriIO mockado ────────────────────────────
    const writeFile = vi.fn(async () => undefined);
    const openFolder = vi.fn(async () => undefined);
    const io: TauriIO = {
      writeFile,
      openFolder,
      documentDir: vi.fn(async () => 'C:\\Users\\Gabriell\\Documents'),
      joinPath: vi.fn(async (...segs: string[]) => segs.join('\\')),
    };

    const folder = 'C:\\Users\\Gabriell\\Documents\\Capi';
    const result = await savePng(io, { bytes, folder, filename });

    // 4.1 path = folder + filename (Windows separator).
    expect(result.path).toBe(`${folder}\\${filename}`);

    // 4.2 writeFile foi chamado com path completo + os bytes corretos.
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(`${folder}\\${filename}`, bytes);

    // 4.3 openFolder foi chamado com a pasta (default openFolderAfter=true).
    expect(openFolder).toHaveBeenCalledWith(folder);

    // 4.4 settings.export.lastFolder foi persistido.
    expect(settingsStore.get(EXPORT_LAST_FOLDER_KEY)).toBe(folder);
  });
});
