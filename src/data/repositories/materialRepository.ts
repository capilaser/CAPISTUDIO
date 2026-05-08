import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

import { getDb } from '../client';

export interface FallbackStop {
  offset: string;
  color: string;
}

export interface Material {
  id: string;
  familyId: string;
  label: string;
  swatch: string;
  pngPath: string;
  fallbackStops: FallbackStop[] | null;
}

interface MaterialRow {
  id: string;
  familyId: string;
  label: string;
  swatch: string;
  pngPath: string;
  fallbackStops: string | null; // JSON string
}

function toMaterial(row: MaterialRow): Material {
  return {
    ...row,
    fallbackStops: row.fallbackStops ? (JSON.parse(row.fallbackStops) as FallbackStop[]) : null,
  };
}

export async function getAllMaterials(): Promise<Material[]> {
  const db = await getDb();
  const rows = await db.select<MaterialRow[]>(
    `SELECT id, family_id as familyId, label, swatch, png_path as pngPath,
            fallback_stops as fallbackStops
     FROM materials ORDER BY family_id, label`
  );
  return rows.map(toMaterial);
}

/** Returns all materials for a given family, ordered by label. */
export async function listByFamily(familyId: string): Promise<Material[]> {
  const db = await getDb();
  const rows = await db.select<MaterialRow[]>(
    `SELECT id, family_id as familyId, label, swatch, png_path as pngPath,
            fallback_stops as fallbackStops
     FROM materials WHERE family_id = ? ORDER BY label`,
    [familyId]
  );
  return rows.map(toMaterial);
}

/** Returns a single material by id, or null if not found. */
export async function getById(id: string): Promise<Material | null> {
  const db = await getDb();
  const rows = await db.select<MaterialRow[]>(
    `SELECT id, family_id as familyId, label, swatch, png_path as pngPath,
            fallback_stops as fallbackStops
     FROM materials WHERE id = ?`,
    [id]
  );
  return rows[0] ? toMaterial(rows[0]) : null;
}

/**
 * Resolves a Material's pngPath to a WebView-accessible URL via Tauri asset protocol.
 *
 * pngPath in the DB is relative to the resources dir (e.g. "materials/abs-escovado-prata.png").
 * resolveResource prefixes it with "resources/" to get the absolute path in the bundle.
 * convertFileSrc converts that to http://asset.localhost/... which the WebView can load.
 *
 * Requires: assetProtocol enabled in tauri.conf.json (see ADR 007).
 */
export async function resolveAssetUrl(material: Material): Promise<string> {
  const absPath = await resolveResource(`resources/${material.pngPath}`);
  return convertFileSrc(absPath);
}
