/**
 * routing-resolver.ts — Resolução unificada de operation+machines por layer
 * (Onda 35).
 *
 * Centraliza a decisão "qual operation e quais machines aplicar a esta layer
 * no export". Antes da Onda 35, svg-exporter e dxf-exporter tinham essa
 * lógica duplicada e ela só consultava asset do banco. Agora a cascata é:
 *
 *   1. Metadata Onda 33 completa (patternRole + processType + machineTargets):
 *        → operation = processType
 *        → machines = machineTargets.map(machineCodeToId)
 *        Caminho NOVO. Vence sobre o asset do banco quando completo.
 *
 *   2. Asset id resolvível (PrincipalLayer.appliqueId, VisualLayer.engravingId,
 *      VisualLayer.markingId) → assetLookup do banco.
 *        Caminho LEGADO. Preserva 100% do export pré-Onda 33.
 *
 *   3. Nada resolvível → null + warn estruturado (caller faz skip).
 *
 * Função PURA: zero dependência de Fabric, DOM ou repositórios concretos.
 * `assetLookup` é injetado (mesmo padrão de svg-exporter).
 *
 * Precedência Onda33 > asset (decisão D do plano Onda 35): no fluxo novo, a
 * classificação manual do padrão é a fonte de verdade operacional. Asset do
 * banco vira fallback pra patterns pré-Onda 33.
 */
import type { LayerMeta, MachineCode, ProcessType } from '@/data/schema';
import { machineCodeToId } from '@/lib/machine-codes';
import { type AssetLookupFn, type AssetExportInfo } from './asset-routing-types';
import {
  type Operation,
  assertValidMachines,
  assertValidOperation,
} from '@/data/repositories/_export-validation';

/**
 * Resultado da resolução. Quando `routing` é null, caller deve fazer skip
 * com warn (mesma política da Onda 18 — não trava o export).
 */
export interface RoutingResolution {
  routing: AssetExportInfo | null;
  /**
   * Origem da resolução. Útil pra logs/telemetria e pra testes saberem
   * que caminho foi tomado.
   *   'pattern-role' — caminho Onda 33
   *   'asset'        — caminho legado (banco)
   *   'none'         — não resolvível
   */
  source: 'pattern-role' | 'asset' | 'none';
  /**
   * Quando source='none', motivo legível pra log. Vazio nos outros casos.
   */
  reason?: string;
}

/**
 * Onda 33 está completa quando patternRole, processType E machineTargets (≥1)
 * estão todos presentes. Roles operacionais são as 3 da spec: PRODUCT,
 * APPLIQUE, CONTOUR. AREAs (TEXT_AREA/LOGO_AREA) também usam este caminho
 * — elas têm o próprio processType/machineTargets atribuído no pattern.
 */
function hasCompletePatternRoleRouting(layer: LayerMeta): boolean {
  if (!layer.patternRole) return false;
  if (!layer.processType) return false;
  if (!layer.machineTargets || layer.machineTargets.length === 0) return false;
  return true;
}

/**
 * Traduz Onda 33 metadata → AssetExportInfo. Lança em caso de código de
 * máquina inválido (defesa contra dados corrompidos vindos de migration ou
 * edição manual).
 */
function fromPatternRole(
  processType: ProcessType,
  machineTargets: readonly MachineCode[],
  context: string
): AssetExportInfo {
  // ProcessType da Onda 33 é literalmente Operation. Cast verificado por
  // assertValidOperation pra pegar valores espúrios (banco com dado sujo).
  assertValidOperation(processType, context);
  const machines = machineTargets.map((code) => machineCodeToId(code));
  assertValidMachines(machines, context);
  return { operation: processType, machines };
}

/**
 * Resolve operation+machines para uma layer não-textual (shape: PRODUCT,
 * APPLIQUE, CONTOUR, TEXT_AREA placeholder, LOGO_AREA placeholder). Texto
 * em si (fabric.Text) usa `resolveTextLayerRouting` abaixo — semântica
 * diferente porque texto herda do pai quando não tem Onda 33 explícita.
 */
export async function resolveLayerRouting(
  layer: LayerMeta,
  assetLookup: AssetLookupFn,
  context: string
): Promise<RoutingResolution> {
  // 1. Caminho NOVO: Onda 33 completa.
  if (hasCompletePatternRoleRouting(layer)) {
    const routing = fromPatternRole(
      layer.processType!,
      layer.machineTargets!,
      `${context}:layer(${layer.id}):pattern-role`
    );
    return { routing, source: 'pattern-role' };
  }

  // 2. Caminho LEGADO: asset do banco.
  let assetId: string | null = null;
  if (layer.kind === 'principal') {
    assetId = layer.appliqueId ?? null;
  } else if (layer.kind === 'visual') {
    assetId = layer.engravingId ?? layer.markingId ?? null;
  } else {
    // OperationLayerMeta é sub-camada conceitual — nunca tem objeto Fabric
    // próprio, então nunca chega ao routing-resolver via iteração de canvas.
    // Defensivo: trata como 'none'.
    return {
      routing: null,
      source: 'none',
      reason: `layer.kind="${(layer as { kind: string }).kind}" não tem routing`,
    };
  }

  if (!assetId) {
    return {
      routing: null,
      source: 'none',
      reason:
        layer.kind === 'principal'
          ? 'principal sem appliqueId e sem patternRole completo'
          : 'visual sem engravingId/markingId e sem patternRole completo',
    };
  }

  const asset = await assetLookup(assetId);
  if (!asset) {
    // Banco inconsistente: layer aponta para um asset id que não existe.
    // Mantemos como erro estruturado (NÃO warn+skip) — é dado corrompido,
    // não slot vazio. Preserva contrato Onda 9 / teste pré-Onda 35.
    throw new Error(
      `[${context}] assetLookup retornou null para id="${assetId}" (layer id="${layer.id}"). ` +
        `Banco inconsistente — FK no LayerMeta aponta pra registro inexistente.`
    );
  }

  // Defesa contra banco com dados inválidos (mesma política dos exporters
  // legados — `_export-validation` lança com contexto claro).
  assertValidOperation(asset.operation, `${context}:layer(${layer.id}):asset(${assetId})`);
  assertValidMachines(asset.machines, `${context}:layer(${layer.id}):asset(${assetId})`);
  return { routing: asset, source: 'asset' };
}

/**
 * Resolve routing para uma layer de TEXTO (visual com fabric.Text).
 *
 * Cascata específica de texto:
 *  1. Override do dialog 9F (operation+machines explícitos) — venda direta.
 *  2. Onda 33 completa NA LAYER do texto — caminho novo (raro, mas válido:
 *     designer pode classificar um TEXT_AREA com processType próprio).
 *  3. Onda 33 completa NO PAI (TEXT_AREA convertido virou pai do fabric.Text? não.
 *     Hoje fabric.Text criado por addText é filho lógico do slot, mas no canvas
 *     ele tem `parentLayerId` do principal pai do slot — mantemos compat).
 *     → herda processType+machineTargets do PrincipalLayer pai se ele tiver
 *       Onda 33 completa. Operation continua sendo 'gravacao' default
 *       (briefing original: texto é gravação) a menos que override.
 *  4. Asset do PrincipalLayer pai (caminho legado original).
 *  5. Nada → null + reason.
 *
 * Operação default = 'gravacao' (briefing Gabriell, preservado).
 */
export async function resolveTextLayerRouting(
  textLayer: LayerMeta,
  layerById: Map<string, LayerMeta>,
  assetLookup: AssetLookupFn,
  override: { operation: Operation; machines?: string[] } | undefined,
  context: string
): Promise<RoutingResolution> {
  // 1. Override completo do dialog 9F.
  if (override?.machines) {
    assertValidOperation(override.operation, `${context}:textOverride(${textLayer.id})`);
    assertValidMachines(override.machines, `${context}:textOverride(${textLayer.id})`);
    return {
      routing: { operation: override.operation, machines: override.machines },
      source: 'asset', // override é manual — equivale ao asset path semanticamente
    };
  }

  // 2. Onda 33 completa na própria layer do texto.
  if (hasCompletePatternRoleRouting(textLayer)) {
    const routing = fromPatternRole(
      textLayer.processType!,
      textLayer.machineTargets!,
      `${context}:textLayer(${textLayer.id}):pattern-role`
    );
    return { routing, source: 'pattern-role' };
  }

  // 3 e 4 dependem do pai.
  if (textLayer.kind !== 'visual' || !textLayer.parentLayerId) {
    return {
      routing: null,
      source: 'none',
      reason: 'texto sem parentLayerId — não há rota herdável',
    };
  }
  const parent = layerById.get(textLayer.parentLayerId);
  if (!parent) {
    return {
      routing: null,
      source: 'none',
      reason: `parentLayerId="${textLayer.parentLayerId}" não existe em layerById`,
    };
  }

  // 3. Onda 33 completa no pai → herda machines, operation continua default
  //    'gravacao' (texto é gravação) a menos que override tenha trocado.
  if (hasCompletePatternRoleRouting(parent)) {
    const operation = override?.operation ?? 'gravacao';
    assertValidOperation(operation, `${context}:textLayer(${textLayer.id}):op`);
    const machines = parent.machineTargets!.map((code) => machineCodeToId(code));
    assertValidMachines(machines, `${context}:textLayer(${textLayer.id}):parent-machines`);
    return { routing: { operation, machines }, source: 'pattern-role' };
  }

  // 4. Asset legado do pai.
  if (parent.kind !== 'principal' || !parent.appliqueId) {
    return {
      routing: null,
      source: 'none',
      reason: 'pai não-principal ou sem appliqueId, e sem patternRole completo',
    };
  }
  const parentAsset = await assetLookup(parent.appliqueId);
  if (!parentAsset) {
    return {
      routing: null,
      source: 'none',
      reason: `aplique pai id="${parent.appliqueId}" não encontrado no banco`,
    };
  }
  const operation = override?.operation ?? 'gravacao';
  assertValidOperation(operation, `${context}:textLayer(${textLayer.id}):op`);
  return {
    routing: { operation, machines: parentAsset.machines },
    source: 'asset',
  };
}
