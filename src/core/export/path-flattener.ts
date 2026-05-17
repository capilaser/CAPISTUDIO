/**
 * path-flattener.ts — Converte SVG path `d` em polilinhas (Onda 18, Fase B).
 *
 * Por quê: DXF R12 não tem SPLINE/BÉZIER nativo. Pra exportar pra
 * RDWorks/LaserCAD com máxima compat, achatamos toda curva (C, Q, A,
 * arcs) em polilinhas de muitos segmentos retos. Tolerância default
 * 0.1mm — abaixo da precisão prática de qualquer laser pequeno.
 *
 * Algoritmo: para cada segmento curvo, amostramos N pontos onde
 *   N = max(2, ceil(segmentLength / step))
 *   step = tolerance × 2  (= 0.2mm pra tolerance 0.1)
 *
 * Não é o algoritmo de subdivisão ótimo (adaptive flatness check), mas
 * é determinístico, simples e gera resultados muito mais densos que o
 * mínimo necessário — perfeitamente seguro pra produção de broches em
 * escala 60×25mm. Segmentos retos (L) emitem só os 2 endpoints.
 *
 * Reusa fabric.util.parsePath/makePathSimpler/getPathSegmentsInfo/
 * getPointOnPath em vez de parser próprio — bibliotecas já testadas em
 * milhões de canvases.
 *
 * Subpaths: um único `d` pode ter vários "M ... Z M ..." (ex: aplique com
 * furo no meio). Retornamos array de polilinhas, uma por subpath.
 */
import * as fabric from 'fabric';

/** Ponto 2D em mm (ou no espaço de coords do caller). */
export interface FlatPoint {
  x: number;
  y: number;
}

/** Polilinha resultante de UM subpath (entre M..M ou M..Z). */
export interface FlatPolyline {
  points: FlatPoint[];
  /** True se o subpath termina em Z (fechado). */
  closed: boolean;
}

export interface FlattenOptions {
  /**
   * Tolerância em unidades do path (geralmente mm). Quanto menor, mais
   * pontos na polilinha. Default 0.1mm.
   */
  toleranceMm?: number;
}

/**
 * Achata um path SVG `d` em uma ou mais polilinhas.
 *
 * Garantias:
 *   - Cada polyline retornada tem ≥2 pontos. Subpaths degenerados (M
 *     isolado, M+Z) são descartados.
 *   - Pontos consecutivos duplicados (dentro de epsilon = 1e-9) são
 *     colapsados.
 *   - `closed=true` apenas se o subpath original tem Z.
 */
export function flattenSvgPath(d: string, opts: FlattenOptions = {}): FlatPolyline[] {
  const toleranceMm = opts.toleranceMm ?? 0.1;
  const step = toleranceMm * 2;

  // parsePath: parser de path SVG. makePathSimpler: normaliza H/V/S/T/etc
  // pra subset M/L/C/Q/Z. Sem isso teríamos que tratar 20+ comandos.
  const parsed = fabric.util.parsePath(d);
  if (!parsed || parsed.length === 0) return [];
  const simple = fabric.util.makePathSimpler(parsed);
  const segInfo = fabric.util.getPathSegmentsInfo(simple);

  const result: FlatPolyline[] = [];
  let current: FlatPoint[] = [];
  let subpathStart: FlatPoint | null = null;
  let closed = false;

  const flush = () => {
    // Polyline válida = ≥2 pontos distintos.
    if (current.length >= 2) {
      result.push({ points: current, closed });
    }
    current = [];
    closed = false;
  };

  for (let i = 0; i < simple.length; i++) {
    const cmd = simple[i]!;
    const op = cmd[0] as string;

    if (op === 'M') {
      // Novo subpath. Fecha o anterior se válido.
      flush();
      const x = cmd[1] as number;
      const y = cmd[2] as number;
      current.push({ x, y });
      subpathStart = { x, y };
      continue;
    }

    if (op === 'Z') {
      // Fecha subpath. Adiciona o ponto inicial como último (idiom DXF
      // pra polyline fechada — RDWorks aceita repetição final). Marca
      // closed=true.
      if (subpathStart && current.length > 0) {
        const last = current[current.length - 1]!;
        if (dist(last, subpathStart) > 1e-9) {
          current.push({ x: subpathStart.x, y: subpathStart.y });
        }
      }
      closed = true;
      flush();
      subpathStart = null;
      continue;
    }

    // Segmento curvo (L/C/Q após makePathSimpler). Sample N pontos.
    const length = segInfo[i]?.length ?? 0;
    if (length <= 0) continue; // degenerado

    if (op === 'L') {
      // Reto: só o endpoint (start já está em current).
      const x = cmd[1] as number;
      const y = cmd[2] as number;
      pushDistinct(current, { x, y });
      continue;
    }

    if (op === 'C' || op === 'Q') {
      // Curva: sample passos de `step` ao longo do comprimento do
      // segmento. getPointOnPath espera distância **acumulada desde o
      // início do path inteiro** — soma comprimentos dos segmentos
      // anteriores.
      const before = sumLengthsBefore(segInfo, i);
      const nSteps = Math.max(2, Math.ceil(length / step));
      // Pula a 1ª amostra (distance=0) — já está em `current` (endpoint
      // do segmento anterior).
      for (let s = 1; s <= nSteps; s++) {
        const dAlong = before + (length * s) / nSteps;
        const pt = fabric.util.getPointOnPath(simple, dAlong, segInfo);
        if (pt) pushDistinct(current, { x: pt.x, y: pt.y });
      }
      continue;
    }

    // Comando desconhecido — makePathSimpler nunca deve emitir, mas
    // log defensivo evita silencioso bug em path exótico.
    if (typeof console !== 'undefined') {
      console.warn(`[path-flattener] comando SVG inesperado pós-simplify: "${op}"`);
    }
  }

  // Path sem Z final no último subpath — flush mesmo assim.
  flush();
  return result;
}

// ── Helpers privados ─────────────────────────────────────────────────────────

function dist(a: FlatPoint, b: FlatPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pushDistinct(arr: FlatPoint[], p: FlatPoint): void {
  const last = arr[arr.length - 1];
  if (!last || dist(last, p) > 1e-9) arr.push(p);
}

function sumLengthsBefore(info: ReadonlyArray<{ length: number }>, upToIndex: number): number {
  let sum = 0;
  for (let i = 0; i < upToIndex; i++) sum += info[i]?.length ?? 0;
  return sum;
}
