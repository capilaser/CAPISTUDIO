/**
 * Tests for materialRepository — Onda 5, Checkpoint A
 *
 * resolveAssetUrl depends on Tauri runtime APIs (resolveResource, convertFileSrc).
 * We mock both via vi.mock so the test runs in Node/Vitest without a running app.
 */
import { describe, expect, it, vi } from 'vitest';

import type { Material } from '@/data/repositories/materialRepository';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/path', () => ({
  resolveResource: vi.fn(async (rel: string) => `C:/tauri-resources/${rel}`),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((abs: string) => `http://asset.localhost/${abs.replace(/\\/g, '/')}`),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const prata: Material = {
  id: 'abs-escovado-prata',
  familyId: 'abs-escovado',
  label: 'Prata',
  swatch: '#c9c9c3',
  pngPath: 'materials/abs-escovado-prata.png',
  fallbackStops: null,
};

const rose: Material = {
  id: 'abs-escovado-rose',
  familyId: 'abs-escovado',
  label: 'Rose Gold',
  swatch: '#d4848a',
  pngPath: 'materials/abs-escovado-rose.png',
  fallbackStops: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveAssetUrl', () => {
  it('prefixes pngPath with resources/ before calling resolveResource', async () => {
    const { resolveResource } = await import('@tauri-apps/api/path');
    const { resolveAssetUrl } = await import('@/data/repositories/materialRepository');

    await resolveAssetUrl(prata);

    expect(resolveResource).toHaveBeenCalledWith(`resources/${prata.pngPath}`);
  });

  it('passes the resolved absolute path to convertFileSrc', async () => {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    const { resolveAssetUrl } = await import('@/data/repositories/materialRepository');

    await resolveAssetUrl(prata);

    expect(convertFileSrc).toHaveBeenCalledWith(`C:/tauri-resources/resources/${prata.pngPath}`);
  });

  it('returns a URL in the http://asset.localhost/ format', async () => {
    const { resolveAssetUrl } = await import('@/data/repositories/materialRepository');

    const url = await resolveAssetUrl(prata);

    expect(url).toMatch(/^http:\/\/asset\.localhost\//);
  });

  it('includes the pngPath basename in the returned URL', async () => {
    const { resolveAssetUrl } = await import('@/data/repositories/materialRepository');

    const url = await resolveAssetUrl(prata);

    expect(url).toContain('abs-escovado-prata.png');
  });

  it('produces distinct URLs for different materials', async () => {
    const { resolveAssetUrl } = await import('@/data/repositories/materialRepository');

    const urlPrata = await resolveAssetUrl(prata);
    const urlRose = await resolveAssetUrl(rose);

    expect(urlPrata).not.toBe(urlRose);
    expect(urlPrata).toContain('prata');
    expect(urlRose).toContain('rose');
  });
});
