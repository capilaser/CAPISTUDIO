/**
 * Testes do dxf-export-service-v2 (Sub-onda DXF-4).
 *
 * Cobre:
 *   - Naming: `${stem}_${machineId}_${operation}_v2.dxf` (sufixo _v2)
 *   - 1 bucket → 1 arquivo, ordem preservada
 *   - Persiste pasta em `export.dxf-v2.lastFolder` (não sobrescreve v1)
 *   - openFolderAfter respeitado
 *   - rememberFolder=false não persiste
 *   - getDefaultDxfV2Folder usa setting ou documentDir como fallback
 *   - Falha de openFolder é não-fatal (apenas warn)
 *   - Conteúdo UTF-8 do DXF é encodado como Uint8Array
 *
 * settingsRepository é mockado para isolar do SQLite.
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

import { makeDxfV2BucketKey, type DxfV2BucketKey } from '@/core/export/dxf-exporter-v2';
import {
  DXF_V2_EXPORT_LAST_FOLDER_KEY,
  getDefaultDxfV2Folder,
  saveDxfsV2,
} from '@/services/dxf-export-service-v2';
import type { TauriIO } from '@/services/png-export-service';

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

describe('saveDxfsV2 — naming e estrutura', () => {
  it('gera filename com sufixo `_v2.dxf`', async () => {
    const io = makeMockIO();
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'DXF CONTENT A'],
    ]);
    const result = await saveDxfsV2(io, {
      byBucket,
      folder: 'C:\\out',
      filenameStem: 'pedido123',
      openFolderAfter: false,
    });
    expect(result.paths).toEqual(['C:\\out\\pedido123_fiber-laser_corte_v2.dxf']);
    expect(io.writeFile).toHaveBeenCalledOnce();
  });

  it('1 bucket por arquivo, ordem do Map preservada', async () => {
    const io = makeMockIO();
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'A'],
      [makeDxfV2BucketKey('fiber-laser', 'gravacao'), 'B'],
      [makeDxfV2BucketKey('master-biro', 'corte'), 'C'],
    ]);
    const result = await saveDxfsV2(io, {
      byBucket,
      folder: 'C:\\out',
      filenameStem: 'p',
      openFolderAfter: false,
    });
    expect(result.paths).toEqual([
      'C:\\out\\p_fiber-laser_corte_v2.dxf',
      'C:\\out\\p_fiber-laser_gravacao_v2.dxf',
      'C:\\out\\p_master-biro_corte_v2.dxf',
    ]);
  });

  it('writeFile recebe bytes UTF-8 do conteúdo DXF', async () => {
    const io = makeMockIO();
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'ÄÉÍÓÚ test'],
    ]);
    await saveDxfsV2(io, {
      byBucket,
      folder: 'C:\\out',
      filenameStem: 'p',
      openFolderAfter: false,
    });
    const writeMock = io.writeFile as ReturnType<typeof vi.fn>;
    const [, bytes] = writeMock.mock.calls[0]!;
    // jsdom usa Uint8Array de outro realm — comparar pelo nome do constructor
    // em vez de instanceof.
    expect((bytes as { constructor: { name: string } }).constructor.name).toBe('Uint8Array');
    expect(new TextDecoder('utf-8').decode(bytes as Uint8Array)).toBe('ÄÉÍÓÚ test');
  });

  it('Map vazio → nenhum writeFile, paths = []', async () => {
    const io = makeMockIO();
    const result = await saveDxfsV2(io, {
      byBucket: new Map(),
      folder: 'C:\\out',
      filenameStem: 'p',
    });
    expect(result.paths).toEqual([]);
    expect(io.writeFile).not.toHaveBeenCalled();
  });
});

describe('saveDxfsV2 — settings (folder isolada do v1)', () => {
  it('persiste pasta em "export.dxf-v2.lastFolder" (chave separada do v1)', async () => {
    expect(DXF_V2_EXPORT_LAST_FOLDER_KEY).toBe('export.dxf-v2.lastFolder');
    const io = makeMockIO();
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'A'],
    ]);
    await saveDxfsV2(io, {
      byBucket,
      folder: 'C:\\my\\dxf-v2',
      filenameStem: 'p',
      openFolderAfter: false,
    });
    expect(settingsStore.get('export.dxf-v2.lastFolder')).toBe('C:\\my\\dxf-v2');
    // NÃO toca na key do v1.
    expect(settingsStore.has('export.dxf.lastFolder')).toBe(false);
  });

  it('rememberFolder=false não persiste', async () => {
    const io = makeMockIO();
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'A'],
    ]);
    await saveDxfsV2(io, {
      byBucket,
      folder: 'C:\\out',
      filenameStem: 'p',
      openFolderAfter: false,
      rememberFolder: false,
    });
    expect(settingsStore.has('export.dxf-v2.lastFolder')).toBe(false);
  });
});

describe('saveDxfsV2 — openFolder', () => {
  it('openFolderAfter=true (default) abre Explorer após salvar', async () => {
    const io = makeMockIO();
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'A'],
    ]);
    await saveDxfsV2(io, { byBucket, folder: 'C:\\out', filenameStem: 'p' });
    expect(io.openFolder).toHaveBeenCalledWith('C:\\out');
  });

  it('openFolderAfter=false não abre Explorer', async () => {
    const io = makeMockIO();
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'A'],
    ]);
    await saveDxfsV2(io, {
      byBucket,
      folder: 'C:\\out',
      filenameStem: 'p',
      openFolderAfter: false,
    });
    expect(io.openFolder).not.toHaveBeenCalled();
  });

  it('Map vazio + openFolderAfter=true → não abre (nada salvo)', async () => {
    const io = makeMockIO();
    await saveDxfsV2(io, {
      byBucket: new Map(),
      folder: 'C:\\out',
      filenameStem: 'p',
      openFolderAfter: true,
    });
    expect(io.openFolder).not.toHaveBeenCalled();
  });

  it('falha de openFolder é não-fatal (não interrompe retorno)', async () => {
    const io = makeMockIO({
      openFolder: vi.fn(async () => {
        throw new Error('shell falhou');
      }),
    });
    const byBucket = new Map<DxfV2BucketKey, string>([
      [makeDxfV2BucketKey('fiber-laser', 'corte'), 'A'],
    ]);
    const result = await saveDxfsV2(io, {
      byBucket,
      folder: 'C:\\out',
      filenameStem: 'p',
    });
    expect(result.paths.length).toBe(1);
  });
});

describe('getDefaultDxfV2Folder', () => {
  it('retorna setting "export.dxf-v2.lastFolder" quando preenchida', async () => {
    settingsStore.set('export.dxf-v2.lastFolder', 'C:\\saved-v2');
    const io = makeMockIO();
    expect(await getDefaultDxfV2Folder(io)).toBe('C:\\saved-v2');
    expect(io.documentDir).not.toHaveBeenCalled();
  });

  it('cai em documentDir quando setting vazia', async () => {
    const io = makeMockIO();
    expect(await getDefaultDxfV2Folder(io)).toBe('C:\\Users\\TestUser\\Documents');
    expect(io.documentDir).toHaveBeenCalledOnce();
  });

  it('cai em documentDir quando setting é string vazia', async () => {
    settingsStore.set('export.dxf-v2.lastFolder', '');
    const io = makeMockIO();
    expect(await getDefaultDxfV2Folder(io)).toBe('C:\\Users\\TestUser\\Documents');
  });
});
