/**
 * Testes do png-export-service (Onda 9.F).
 *
 * Cobre os 5 cenários do briefing + edge cases mais relevantes.
 *
 * settingsRepository é mockado via vi.mock pra evitar acesso ao SQLite real
 * (mesmo padrão usado em materialRepository.test.ts). TauriIO é mockado
 * por instância passada nas chamadas — design intencional pra isso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock do settingsRepository ANTES de importar o service.
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
  getDefaultExportFolder,
  isoDate,
  savePng,
  type TauriIO,
} from '@/services/png-export-service';

/** Data fixa pros testes determinísticos. Local time — vide isoDate. */
const FIXED_DATE = new Date(2026, 4, 17); // 2026-05-17 local
const FIXED_DATE_STR = '2026-05-17';

function makeMockIO(overrides: Partial<TauriIO> = {}): TauriIO {
  return {
    writeFile: vi.fn(async () => undefined),
    openFolder: vi.fn(async () => undefined),
    documentDir: vi.fn(async () => 'C:\\Users\\TestUser\\Documents'),
    joinPath: vi.fn(async (...segs: string[]) => segs.join('\\')),
    ...overrides,
  };
}

beforeEach(() => {
  settingsStore.clear();
  vi.clearAllMocks();
});

describe('buildPngFilename', () => {
  // ── 1. Nome do arquivo gerado corretamente com normalização ──────────────
  it('cliente + profissão + data → kebab-case + data ISO', () => {
    expect(
      buildPngFilename({ cliente: 'João Silva', profissao: 'Advogado', date: FIXED_DATE })
    ).toBe(`joao-silva-advogado_${FIXED_DATE_STR}.png`);
    // Acentos removidos, lowercase, espaços viram hífen.
    expect(
      buildPngFilename({ cliente: 'Maria Helena', profissao: 'Médica', date: FIXED_DATE })
    ).toBe(`maria-helena-medica_${FIXED_DATE_STR}.png`);
  });

  // ── 2. Cliente vazio → placeholder com data ──────────────────────────────
  it('cliente vazio (qualquer profissão) → mockup_<data>.png', () => {
    expect(buildPngFilename({ cliente: '', profissao: 'Advogado', date: FIXED_DATE })).toBe(
      `mockup_${FIXED_DATE_STR}.png`
    );
    expect(buildPngFilename({ cliente: '   ', profissao: '', date: FIXED_DATE })).toBe(
      `mockup_${FIXED_DATE_STR}.png`
    );
    expect(buildPngFilename({ cliente: '', profissao: '', date: FIXED_DATE })).toBe(
      `mockup_${FIXED_DATE_STR}.png`
    );
  });

  it('cliente preenchido + profissão vazia → só cliente_<data>.png', () => {
    expect(buildPngFilename({ cliente: 'João Silva', profissao: '', date: FIXED_DATE })).toBe(
      `joao-silva_${FIXED_DATE_STR}.png`
    );
    expect(buildPngFilename({ cliente: 'João', profissao: '   ', date: FIXED_DATE })).toBe(
      `joao_${FIXED_DATE_STR}.png`
    );
  });

  // ── 3. Onda 17 — Multi-broche (lote) ─────────────────────────────────────
  it('boardItemCount > 1 → prefixo lote_Nx_', () => {
    expect(
      buildPngFilename({
        cliente: 'João Silva',
        profissao: 'Advogado',
        date: FIXED_DATE,
        boardItemCount: 5,
      })
    ).toBe(`lote_5x_joao-silva-advogado_${FIXED_DATE_STR}.png`);
    expect(
      buildPngFilename({
        cliente: 'João',
        profissao: '',
        date: FIXED_DATE,
        boardItemCount: 100,
      })
    ).toBe(`lote_100x_joao_${FIXED_DATE_STR}.png`);
  });

  it('boardItemCount > 1 + cliente vazio → lote_Nx_mockup_<data>.png', () => {
    expect(
      buildPngFilename({
        cliente: '',
        profissao: '',
        date: FIXED_DATE,
        boardItemCount: 3,
      })
    ).toBe(`lote_3x_mockup_${FIXED_DATE_STR}.png`);
  });

  it('boardItemCount = 1 → SEM prefixo lote (default)', () => {
    expect(
      buildPngFilename({
        cliente: 'João',
        profissao: 'Advogado',
        date: FIXED_DATE,
        boardItemCount: 1,
      })
    ).toBe(`joao-advogado_${FIXED_DATE_STR}.png`);
  });

  // ── 4. Default date = now ────────────────────────────────────────────────
  it('sem date → usa now (formato YYYY-MM-DD)', () => {
    const name = buildPngFilename({ cliente: 'João', profissao: '' });
    expect(name).toMatch(/^joao_\d{4}-\d{2}-\d{2}\.png$/);
  });
});

describe('isoDate', () => {
  it('formata data como YYYY-MM-DD em horário local', () => {
    expect(isoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(isoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(isoDate(FIXED_DATE)).toBe(FIXED_DATE_STR);
  });

  it('usa horário LOCAL (não UTC) — operador noturno BRT não vai pular o dia', () => {
    // 2026-05-17 23:30 local — em UTC já é 18 ou 17 dependendo de fuso.
    // isoDate deve devolver 17 (data local).
    const lateNight = new Date(2026, 4, 17, 23, 30, 0);
    expect(isoDate(lateNight)).toBe('2026-05-17');
  });
});

describe('savePng', () => {
  // ── 3. writeFile recebe path completo + bytes corretos ──────────────────
  it('escreve bytes no path resultado de joinPath(folder, filename)', async () => {
    const io = makeMockIO();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    const result = await savePng(io, {
      bytes,
      folder: 'C:\\Users\\Gabriell\\Documents\\Capi',
      filename: 'joao-silva-advogado_mockup.png',
    });

    expect(io.joinPath).toHaveBeenCalledWith(
      'C:\\Users\\Gabriell\\Documents\\Capi',
      'joao-silva-advogado_mockup.png'
    );
    expect(io.writeFile).toHaveBeenCalledWith(
      'C:\\Users\\Gabriell\\Documents\\Capi\\joao-silva-advogado_mockup.png',
      bytes
    );
    expect(result.path).toBe(
      'C:\\Users\\Gabriell\\Documents\\Capi\\joao-silva-advogado_mockup.png'
    );
  });

  // ── 4. Última pasta persiste em settings após export ─────────────────────
  it('persiste folder em settings.export.lastFolder por default', async () => {
    const io = makeMockIO();
    await savePng(io, {
      bytes: new Uint8Array([0x89]),
      folder: 'C:\\NovaPasta',
      filename: 'mockup.png',
    });
    expect(settingsStore.get(EXPORT_LAST_FOLDER_KEY)).toBe('C:\\NovaPasta');
  });

  it('rememberFolder=false não persiste em settings', async () => {
    const io = makeMockIO();
    await savePng(io, {
      bytes: new Uint8Array([0x89]),
      folder: 'C:\\NaoSalvar',
      filename: 'mockup.png',
      rememberFolder: false,
    });
    expect(settingsStore.has(EXPORT_LAST_FOLDER_KEY)).toBe(false);
  });

  // ── 5. Bytes mínimos (canvas vazio) ainda exporta sem throw ──────────────
  it('bytes mínimos (1 byte) exportam sem erro — equivalente a canvas vazio', async () => {
    const io = makeMockIO();
    const result = await savePng(io, {
      bytes: new Uint8Array([0x00]),
      folder: 'C:\\Out',
      filename: 'empty_mockup.png',
    });
    expect(result.path).toBe('C:\\Out\\empty_mockup.png');
    expect(io.writeFile).toHaveBeenCalledTimes(1);
  });

  // ── Edge cases adicionais ────────────────────────────────────────────────
  it('openFolderAfter=true (default) chama io.openFolder com a pasta', async () => {
    const io = makeMockIO();
    await savePng(io, {
      bytes: new Uint8Array([0x89]),
      folder: 'C:\\Out',
      filename: 'a.png',
    });
    expect(io.openFolder).toHaveBeenCalledWith('C:\\Out');
  });

  it('openFolderAfter=false não chama io.openFolder', async () => {
    const io = makeMockIO();
    await savePng(io, {
      bytes: new Uint8Array([0x89]),
      folder: 'C:\\Out',
      filename: 'a.png',
      openFolderAfter: false,
    });
    expect(io.openFolder).not.toHaveBeenCalled();
  });

  it('falha em openFolder não bloqueia (arquivo já foi salvo) — engole erro', async () => {
    const io = makeMockIO({
      openFolder: vi.fn(async () => {
        throw new Error('Explorer indisponível');
      }),
    });
    // Não deve lançar — write foi sucesso, abrir Explorer é best-effort.
    const result = await savePng(io, {
      bytes: new Uint8Array([0x89]),
      folder: 'C:\\Out',
      filename: 'a.png',
    });
    expect(result.path).toBe('C:\\Out\\a.png');
  });

  it('falha em writeFile propaga (caller mostra toast de erro)', async () => {
    const io = makeMockIO({
      writeFile: vi.fn(async () => {
        throw new Error('Disco cheio');
      }),
    });
    await expect(
      savePng(io, {
        bytes: new Uint8Array([0x89]),
        folder: 'C:\\Out',
        filename: 'a.png',
      })
    ).rejects.toThrow('Disco cheio');
    // Settings NÃO foi gravado (write falhou antes).
    expect(settingsStore.has(EXPORT_LAST_FOLDER_KEY)).toBe(false);
  });
});

describe('getDefaultExportFolder', () => {
  it('retorna documentDir() quando settings vazio', async () => {
    const io = makeMockIO();
    const folder = await getDefaultExportFolder(io);
    expect(folder).toBe('C:\\Users\\TestUser\\Documents');
    expect(io.documentDir).toHaveBeenCalled();
  });

  it('retorna settings.export.lastFolder quando definido', async () => {
    settingsStore.set(EXPORT_LAST_FOLDER_KEY, 'D:\\PastaPersonalizada');
    const io = makeMockIO();
    const folder = await getDefaultExportFolder(io);
    expect(folder).toBe('D:\\PastaPersonalizada');
    expect(io.documentDir).not.toHaveBeenCalled();
  });
});
