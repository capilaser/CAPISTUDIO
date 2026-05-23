/**
 * validate-pattern.ts — Onda 36 (Pattern Validation + UX Guardrails).
 *
 * Valida estruturalmente um conjunto de LayerMeta. Função PURA — zero
 * dependência de Fabric, DOM, banco. Recebe layers + callback opcional pra
 * conferir existência de objeto Fabric (para os warnings de "vetor real").
 *
 * Política de severidade (decisões A/B/C da Onda 36):
 *  - ERROR (bloqueia save):
 *      patternRole inválido, AREA sem boundsMm/bounds inválidos,
 *      LOGO_AREA fitMode != 'contain', processType inválido,
 *      machineTargets ausente/vazio/inválido, > 3 máquinas.
 *  - WARNING (permite save com confirmação):
 *      machineTargets com duplicatas (engine dedup, mas dado externo
 *      pode trazer), PRODUCT/APPLIQUE/CONTOUR sem objeto Fabric vivo
 *      (raro — só aparece com callback `hasFabricObject` informado).
 *
 * Retrocompat: layers sem `patternRole` são consideradas legado e não
 * geram issue alguma. Só layers que JÁ tentaram classificar (têm
 * patternRole) são validadas.
 *
 * O resultado é uma lista de PatternIssue — cada um com layerId, name,
 * code e mensagem PT-BR pronta pra UI. Caller (UI) decide como apresentar.
 */
import type { LayerMeta, MachineCode, PatternRole, ProcessType } from '@/data/schema';

const VALID_PATTERN_ROLES: readonly PatternRole[] = [
  'PRODUCT',
  'APPLIQUE',
  'CONTOUR',
  'TEXT_AREA',
  'LOGO_AREA',
];
const VALID_PROCESS_TYPES: readonly ProcessType[] = ['corte', 'gravacao', 'marcacao'];
const VALID_MACHINE_CODES: readonly MachineCode[] = ['M1', 'M2', 'M3'];
const MAX_MACHINE_TARGETS = 3;

export type PatternIssueCode =
  | 'INVALID_PATTERN_ROLE'
  | 'AREA_MISSING_BOUNDS'
  | 'AREA_INVALID_BOUNDS'
  | 'LOGO_AREA_INVALID_FIT_MODE'
  | 'INVALID_PROCESS_TYPE'
  | 'MISSING_PROCESS_TYPE'
  | 'MISSING_MACHINE_TARGETS'
  | 'INVALID_MACHINE_CODE'
  | 'TOO_MANY_MACHINE_TARGETS'
  | 'DUPLICATE_MACHINE_TARGETS'
  | 'PRODUCT_NO_VECTOR';

export interface PatternIssue {
  layerId: string;
  layerName: string;
  code: PatternIssueCode;
  message: string;
  /** 'error' bloqueia salvamento; 'warning' permite com confirmação. */
  severity: 'error' | 'warning';
}

export interface ValidatePatternOptions {
  /**
   * Callback opcional — quando informado, é chamado para PRODUCT/APPLIQUE/
   * CONTOUR e gera warning se retornar false. Sem callback, não há check
   * de "vetor real" (validator continua puro e pode rodar a partir de JSON).
   */
  hasFabricObject?: (layerId: string) => boolean;
}

export interface PatternValidationResult {
  errors: PatternIssue[];
  warnings: PatternIssue[];
}

/**
 * Roles que representam geometria física real (precisam de vetor associado
 * quando o callback `hasFabricObject` está disponível).
 */
const PHYSICAL_ROLES: ReadonlySet<PatternRole> = new Set(['PRODUCT', 'APPLIQUE', 'CONTOUR']);

/** Roles de área (placeholders TEXT_AREA / LOGO_AREA) — precisam de boundsMm. */
const AREA_ROLES: ReadonlySet<PatternRole> = new Set(['TEXT_AREA', 'LOGO_AREA']);

/**
 * Onda 37 Fix-2 — resumo de validação de UMA layer pra UI mostrar status em
 * tempo real no painel de classificação. Reusa `validatePattern` (mesma fonte
 * de verdade do bloqueio de save da Onda 36). Custo trivial (1 layer).
 *
 * Retorna:
 *  - { kind: 'unclassified', message: 'Sem classificação' } → layer sem patternRole
 *  - { kind: 'incomplete',  message: '...' }                → há errors ou warnings
 *  - { kind: 'ok',          message: 'Pronta para produção' } → tudo certo
 */
export function summarizeLayerValidation(
  layer: LayerMeta | null,
  options: ValidatePatternOptions = {}
): {
  kind: 'unclassified' | 'ok' | 'incomplete';
  message: string;
} {
  if (!layer || layer.patternRole === undefined) {
    return { kind: 'unclassified', message: 'Sem classificação' };
  }
  const { errors, warnings } = validatePattern([layer], options);
  if (errors.length === 0 && warnings.length === 0) {
    return { kind: 'ok', message: 'Pronta para produção' };
  }
  // Prioriza erro sobre warning; mostra a primeira mensagem (curta).
  const first = errors[0] ?? warnings[0];
  return { kind: 'incomplete', message: first.message };
}

/**
 * Onda 37 Fix-3 — variante pra LayerRow consumir direto do LayerNode
 * (que carrega só os campos opcionais de PatternLayerExtras). Reaproveita
 * a lógica de validatePattern montando um LayerMeta sintético mínimo.
 * Não checa "vetor real" (PRODUCT_NO_VECTOR warning) — caller que quiser
 * essa checagem deve usar summarizeLayerValidation passando hasFabricObject.
 */
export function summarizeNodeValidation(node: {
  id: string;
  name: string;
  patternRole?: import('@/data/schema').PatternRole;
  processType?: import('@/data/schema').ProcessType;
  machineTargets?: import('@/data/schema').MachineCode[];
  boundsMm?: import('@/data/schema').LayerBoundsMm;
  lockGranular?: import('@/data/schema').LayerLocks;
  fitMode?: import('@/data/schema').FitMode;
}): {
  kind: 'unclassified' | 'ok' | 'incomplete';
  message: string;
} {
  if (node.patternRole === undefined) {
    return { kind: 'unclassified', message: 'Sem classificação' };
  }
  // LayerMeta sintético mínimo (kind=visual é seguro pra validação Onda 33
  // pois validatePattern não distingue principal/visual aqui).
  const synthetic = {
    kind: 'visual' as const,
    id: node.id,
    parentLayerId: null,
    name: node.name,
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    patternRole: node.patternRole,
    processType: node.processType,
    machineTargets: node.machineTargets,
    boundsMm: node.boundsMm,
    fitMode: node.fitMode,
    lockGranular: node.lockGranular,
  };
  const { errors, warnings } = validatePattern([synthetic]);
  if (errors.length === 0 && warnings.length === 0) {
    return { kind: 'ok', message: 'Pronta para produção' };
  }
  const first = errors[0] ?? warnings[0];
  return { kind: 'incomplete', message: first.message };
}

export function validatePattern(
  layers: readonly LayerMeta[],
  options: ValidatePatternOptions = {}
): PatternValidationResult {
  const errors: PatternIssue[] = [];
  const warnings: PatternIssue[] = [];

  for (const layer of layers) {
    // Retrocompat: layer sem patternRole = legado, não validamos nada nova.
    if (layer.patternRole === undefined) continue;

    const ctx = { id: layer.id, name: layer.name || '(sem nome)' };

    // ── patternRole válido ────────────────────────────────────────────────
    if (!isValidPatternRole(layer.patternRole)) {
      errors.push(
        issue(
          ctx,
          'INVALID_PATTERN_ROLE',
          'error',
          `patternRole inválido: "${String(layer.patternRole)}". Esperado: ${VALID_PATTERN_ROLES.join(', ')}.`
        )
      );
      continue; // sem patternRole válido, demais regras não fazem sentido
    }

    const role = layer.patternRole;

    // ── AREA (TEXT_AREA / LOGO_AREA): boundsMm obrigatório e válido ───────
    if (AREA_ROLES.has(role)) {
      const bounds = layer.boundsMm;
      if (!bounds) {
        errors.push(
          issue(
            ctx,
            'AREA_MISSING_BOUNDS',
            'error',
            `${role} sem boundsMm. Áreas inteligentes precisam de bounds (x/y/width/height em mm).`
          )
        );
      } else if (
        typeof bounds.width !== 'number' ||
        typeof bounds.height !== 'number' ||
        bounds.width <= 0 ||
        bounds.height <= 0
      ) {
        errors.push(
          issue(
            ctx,
            'AREA_INVALID_BOUNDS',
            'error',
            `${role} com boundsMm inválido (width=${bounds.width}, height=${bounds.height}). Ambos precisam ser > 0.`
          )
        );
      }
    }

    // ── LOGO_AREA: fitMode obrigatório 'contain' quando definido ──────────
    if (role === 'LOGO_AREA' && layer.fitMode !== undefined && layer.fitMode !== 'contain') {
      errors.push(
        issue(
          ctx,
          'LOGO_AREA_INVALID_FIT_MODE',
          'error',
          `LOGO_AREA com fitMode="${layer.fitMode}". Apenas "contain" é suportado nesta versão.`
        )
      );
    }

    // ── processType obrigatório para TODAS as roles classificadas ─────────
    if (layer.processType === undefined) {
      errors.push(
        issue(
          ctx,
          'MISSING_PROCESS_TYPE',
          'error',
          `${role} sem processType. Defina corte/gravacao/marcacao.`
        )
      );
    } else if (!isValidProcessType(layer.processType)) {
      errors.push(
        issue(
          ctx,
          'INVALID_PROCESS_TYPE',
          'error',
          `processType inválido: "${String(layer.processType)}". Esperado: ${VALID_PROCESS_TYPES.join(', ')}.`
        )
      );
    }

    // ── machineTargets obrigatório para TODAS as roles classificadas ─────
    const targets = layer.machineTargets;
    if (!targets || targets.length === 0) {
      errors.push(
        issue(
          ctx,
          'MISSING_MACHINE_TARGETS',
          'error',
          `${role} sem máquinas (machineTargets). Defina pelo menos 1: ${VALID_MACHINE_CODES.join('/')}.`
        )
      );
    } else {
      // cardinalidade
      if (targets.length > MAX_MACHINE_TARGETS) {
        errors.push(
          issue(
            ctx,
            'TOO_MANY_MACHINE_TARGETS',
            'error',
            `${role} com ${targets.length} máquinas. Máximo permitido: ${MAX_MACHINE_TARGETS}.`
          )
        );
      }
      // códigos válidos
      const invalidCodes = targets.filter((c) => !isValidMachineCode(c));
      if (invalidCodes.length > 0) {
        errors.push(
          issue(
            ctx,
            'INVALID_MACHINE_CODE',
            'error',
            `machineTargets com código(s) inválido(s): ${invalidCodes.join(', ')}. Esperado: ${VALID_MACHINE_CODES.join('/')}.`
          )
        );
      }
      // duplicatas — warning (engine dedup, mas dado externo pode trazer)
      if (hasDuplicates(targets)) {
        warnings.push(
          issue(
            ctx,
            'DUPLICATE_MACHINE_TARGETS',
            'warning',
            `machineTargets com duplicatas (${targets.join(', ')}). Será deduplicado automaticamente.`
          )
        );
      }
    }

    // ── PRODUCT/APPLIQUE/CONTOUR: vetor real (warning) ────────────────────
    if (PHYSICAL_ROLES.has(role) && options.hasFabricObject) {
      if (!options.hasFabricObject(layer.id)) {
        warnings.push(
          issue(
            ctx,
            'PRODUCT_NO_VECTOR',
            'warning',
            `${role} sem objeto Fabric correspondente no canvas. Verifique se o vetor está presente.`
          )
        );
      }
    }
  }

  return { errors, warnings };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function issue(
  ctx: { id: string; name: string },
  code: PatternIssueCode,
  severity: 'error' | 'warning',
  message: string
): PatternIssue {
  return { layerId: ctx.id, layerName: ctx.name, code, severity, message };
}

function isValidPatternRole(v: unknown): v is PatternRole {
  return typeof v === 'string' && (VALID_PATTERN_ROLES as readonly string[]).includes(v);
}

function isValidProcessType(v: unknown): v is ProcessType {
  return typeof v === 'string' && (VALID_PROCESS_TYPES as readonly string[]).includes(v);
}

function isValidMachineCode(v: unknown): v is MachineCode {
  return typeof v === 'string' && (VALID_MACHINE_CODES as readonly string[]).includes(v);
}

function hasDuplicates<T>(arr: readonly T[]): boolean {
  return new Set(arr).size !== arr.length;
}
