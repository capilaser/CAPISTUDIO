import type {
  LayerMeta,
  OperationLayerMeta,
  PrincipalLayerMeta,
  VisualLayerMeta,
} from '@/data/schema';

// ─── Type guards ──────────────────────────────────────────────────────────────

/** Returns true when `m` is a PrincipalLayerMeta (kind = 'principal'). */
export function isPrincipalLayer(m: LayerMeta): m is PrincipalLayerMeta {
  return m.kind === 'principal';
}

/** Returns true when `m` is an OperationLayerMeta (kind = 'operation'). */
export function isOperationLayer(m: LayerMeta): m is OperationLayerMeta {
  return m.kind === 'operation';
}

/** Returns true when `m` is a VisualLayerMeta (kind = 'visual'). */
export function isVisualLayer(m: LayerMeta): m is VisualLayerMeta {
  return m.kind === 'visual';
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates a LayerMeta array against the 7 structural invariants of ADR 010 §1.
 *
 * Invariants:
 *   1. kind="principal"  → parentLayerId MUST be null
 *   2. kind="operation"  → parentLayerId MUST be a non-empty string
 *   3. kind="operation"  → `operation` field MUST be a non-empty string
 *   4. kind="operation"  → `machines` MUST have 1–3 entries
 *   5. kind="operation"  → parentLayerId MUST reference an id that EXISTS in
 *                          the array AND that referenced layer MUST be kind="principal"
 *                          (orphan parentLayerId is also invalid)
 *   6. kind="visual" with parentLayerId !== null → referenced parent MUST be
 *                          kind="principal". Visual layers cannot be children of
 *                          operation layers (that would create 3 levels).
 *   7. (implicit) Hierarchy is fixed at 2 levels — enforced by invariants 5 & 6.
 *
 * Returns `{ valid: true, errors: [] }` when all invariants pass, or
 * `{ valid: false, errors: [...] }` listing every violation found.
 *
 * Pure function — no side effects, safe to call on deserialized DB data.
 *
 * Note on internal casting: the function accepts `LayerMeta[]` for caller convenience,
 * but invariants check for states that TypeScript's type system would consider impossible
 * (e.g., a principal with non-null parentLayerId). Invalid JSON from the DB can produce
 * such states at runtime. We cast to a raw record type internally so that TypeScript
 * doesn't short-circuit the checks via control-flow narrowing.
 */
export function validateLayerMeta(layers: LayerMeta[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Cast to raw records: the validator is defensive — it must catch states that the
  // type system considers impossible but that malformed / legacy JSON can produce.
  type Raw = {
    id: string;
    kind: string;
    parentLayerId: unknown;
    operation?: unknown;
    machines?: unknown[];
  };
  const raw = layers as unknown as Raw[];

  // Build id-sets for O(1) lookups.
  const allIds = new Set(raw.map((l) => l.id));
  const principalIds = new Set(raw.filter((l) => l.kind === 'principal').map((l) => l.id));
  const operationIds = new Set(raw.filter((l) => l.kind === 'operation').map((l) => l.id));

  for (const layer of raw) {
    // ── Invariant 1 ───────────────────────────────────────────────────────────
    if (layer.kind === 'principal' && layer.parentLayerId !== null) {
      errors.push(
        `Invariant 1 — Layer "${layer.id}" (principal) must have parentLayerId=null, ` +
          `got "${String(layer.parentLayerId)}".`
      );
    }

    // ── Invariant 2 ───────────────────────────────────────────────────────────
    if (layer.kind === 'operation' && !layer.parentLayerId) {
      errors.push(
        `Invariant 2 — Layer "${layer.id}" (operation) must have a non-null parentLayerId.`
      );
    }

    // ── Invariant 3 ───────────────────────────────────────────────────────────
    if (layer.kind === 'operation' && !(layer.operation as string | undefined)?.trim()) {
      errors.push(
        `Invariant 3 — Layer "${layer.id}" (operation) must have a non-empty operation field.`
      );
    }

    // ── Invariant 4 ───────────────────────────────────────────────────────────
    if (layer.kind === 'operation') {
      const count = layer.machines?.length ?? 0;
      if (count < 1 || count > 3) {
        errors.push(
          `Invariant 4 — Layer "${layer.id}" (operation) must have 1–3 machines, got ${count}.`
        );
      }
    }

    // ── Invariant 5 ───────────────────────────────────────────────────────────
    if (layer.kind === 'operation' && layer.parentLayerId) {
      const parentId = String(layer.parentLayerId);
      if (!allIds.has(parentId)) {
        // parentLayerId points to a non-existent id → orphan layer.
        errors.push(
          `Invariant 5 — Layer "${layer.id}" (operation) has parentLayerId ` +
            `"${parentId}" which does not exist in the layer array (orphan).`
        );
      } else if (!principalIds.has(parentId)) {
        // parentLayerId exists but references a non-principal layer.
        errors.push(
          `Invariant 5 — Layer "${layer.id}" (operation) has parentLayerId ` +
            `"${parentId}" which is not a principal layer. ` +
            `Operations must be direct children of principal layers (2-level hierarchy max).`
        );
      }
    }

    // ── Invariant 6 ───────────────────────────────────────────────────────────
    if (
      layer.kind === 'visual' &&
      layer.parentLayerId !== null &&
      layer.parentLayerId !== undefined
    ) {
      const parentId = String(layer.parentLayerId);
      if (operationIds.has(parentId)) {
        // Visual child of an operation → would create 3 levels.
        errors.push(
          `Invariant 6 — Layer "${layer.id}" (visual) has parentLayerId ` +
            `"${parentId}" which is an operation layer. ` +
            `Visual layers cannot be children of operation layers (3-level nesting is forbidden).`
        );
      } else if (!allIds.has(parentId)) {
        // Visual orphan (parentLayerId set but id not found).
        errors.push(
          `Invariant 6 — Layer "${layer.id}" (visual) has parentLayerId ` +
            `"${parentId}" which does not exist in the layer array.`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
