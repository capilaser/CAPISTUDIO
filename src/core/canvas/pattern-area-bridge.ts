/**
 * pattern-area-bridge.ts — Onda 34 (Pattern Usage MVP).
 *
 * Patterns criados a partir da Onda 33 podem ter layers classificadas como
 * patternRole='TEXT_AREA' ou 'LOGO_AREA' (com boundsMm). Essas areas são uma
 * representação NOVA do mesmo conceito que o SlotManager (Onda 14+) já cobre
 * via capiSlot ('nome' | 'profissao' | 'logo' | 'custom').
 *
 * A bridge traduz AREA → capiSlot ANTES de applyPatternObjects criar os
 * objetos no canvas. Isso permite que:
 *  - fillTextSlot / fillLogoSlot continuem sendo a API única;
 *  - TextoItem / LogoSlotItem reaproveitem 100% da pipeline existente;
 *  - patterns antigos (com capiSlot direto) sigam funcionando intactos;
 *  - patterns híbridos (mistura) não dupliquem slots.
 *
 * É uma transformação PURA de JSON — não toca canvas, não toca DOM, não chama
 * Fabric. Vive nos tipos do schema (LayerMeta + PatternLayerExtras + SlotMeta).
 *
 * Heurística TEXT_AREA → SlotType (aprovado na Onda 34, item B):
 *   - 1º TEXT_AREA na ordem do array → 'nome'
 *   - 2º TEXT_AREA → 'profissao'
 *   - 3º+ TEXT_AREA → 'custom'
 *
 * Locks (Onda 34 item D): position / scale / rotation são propagados.
 * `rotation` é sempre forçado a true (escopo: "nunca girar"). `structure`
 * fica fora deste MVP.
 */
import type { LayerMeta, PatternRole } from '@/data/schema';
import type { SlotMeta, SlotType } from './types';

/**
 * Shape mínimo do que `applyPatternObjects` recebe — espelha
 * SerializedCanvas em engine-serialization.ts. Reproduzido localmente pra
 * manter a bridge desacoplada (e testável sem montar canvas).
 */
export interface PatternJsonForBridge {
  objects: Array<Record<string, unknown>>;
  capi?: {
    layers?: LayerMeta[];
    [extra: string]: unknown;
  };
}

/**
 * Resultado da bridge — útil pra telemetria/debug e pra testes saberem
 * exatamente quais layers viraram slot.
 */
export interface BridgeResult {
  /** Quantas areas foram convertidas em capiSlot neste pass. */
  converted: number;
  /** Quantas areas foram puladas porque já tinham capiSlot equivalente. */
  skippedExisting: number;
  /** Quantas areas foram ignoradas (sem boundsMm / dimensões inválidas). */
  ignored: number;
}

/**
 * Decide o SlotType para um TEXT_AREA com base na ordem em que apareceu
 * entre as TEXT_AREAs. 0=nome, 1=profissao, 2+=custom.
 */
export function pickTextSlotType(
  textAreaIndex: number
): Extract<SlotType, 'nome' | 'profissao' | 'custom'> {
  if (textAreaIndex === 0) return 'nome';
  if (textAreaIndex === 1) return 'profissao';
  return 'custom';
}

/**
 * Verifica se um objeto Fabric serializado já carrega capiSlot.
 * Patterns antigos (Onda 32) têm capiSlot; AREAs da Onda 33 não.
 */
function hasCapiSlot(obj: Record<string, unknown>): boolean {
  const slot = obj.capiSlot;
  return (
    slot !== null &&
    slot !== undefined &&
    typeof slot === 'object' &&
    typeof (slot as { id?: unknown }).id === 'string'
  );
}

/**
 * Acha o object serializado correspondente a uma layer pelo id.
 * Pattern: object.id === layer.id (invariante Onda 31).
 */
function findObjectById(
  objects: Array<Record<string, unknown>>,
  id: string
): Record<string, unknown> | undefined {
  return objects.find((o) => typeof o.id === 'string' && o.id === id);
}

/**
 * Bridge principal — muta `json.objects` injetando capiSlot nas AREAs e
 * ajustando dimensões do objeto Fabric para casar com boundsMm.
 *
 * IDEMPOTENTE: rodar 2x produz o mesmo resultado (segunda passada vê
 * capiSlot já presente e pula). Patterns antigos são no-op total.
 *
 * NÃO MUTA o array `capi.layers` em si — `patternRole` e `boundsMm`
 * permanecem na LayerMeta. A AREA continua existindo conceitualmente
 * (pra futuras ondas de export por processType etc.); só ganha um
 * espelho-slot operável.
 */
export function bridgePatternAreasToSlots(json: PatternJsonForBridge): BridgeResult {
  const result: BridgeResult = { converted: 0, skippedExisting: 0, ignored: 0 };

  const layers = json.capi?.layers;
  if (!layers || layers.length === 0) return result;
  if (!json.objects || json.objects.length === 0) return result;

  let textAreaCount = 0;

  for (const layer of layers) {
    const role = layer.patternRole as PatternRole | undefined;
    if (role !== 'TEXT_AREA' && role !== 'LOGO_AREA') continue;

    const bounds = layer.boundsMm;
    if (
      !bounds ||
      typeof bounds.width !== 'number' ||
      typeof bounds.height !== 'number' ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      result.ignored++;
      continue;
    }

    const obj = findObjectById(json.objects, layer.id);
    if (!obj) {
      result.ignored++;
      continue;
    }

    if (hasCapiSlot(obj)) {
      // Pattern híbrido: a AREA já foi convertida (ou herdou capiSlot por
      // outro caminho). Não duplica. Mantém o slot existente.
      if (role === 'TEXT_AREA') textAreaCount++;
      result.skippedExisting++;
      continue;
    }

    const slotType: SlotType = role === 'LOGO_AREA' ? 'logo' : pickTextSlotType(textAreaCount);

    if (role === 'TEXT_AREA') textAreaCount++;

    // Aplica locks (item D do plano Onda 34). Rotation sempre travada
    // para AREAs por escopo ("nunca girar"). Position/scale seguem o
    // lockGranular da layer; structure fica fora desta onda.
    const locks = layer.lockGranular;
    const lockMovementX = locks?.position === true;
    const lockMovementY = locks?.position === true;
    const lockScalingX = locks?.scale === true;
    const lockScalingY = locks?.scale === true;

    const slotMeta: SlotMeta = {
      id: layer.id,
      type: slotType,
      x: bounds.x,
      y: bounds.y,
      maxWidth: bounds.width,
      maxHeight: bounds.height,
      autoCenter: true,
      autoFit: slotType !== 'logo',
    };

    // Injeta capiSlot no object serializado. `setCapiSlot` (slot-manager.ts)
    // faria o mesmo em runtime; aqui mexemos no JSON cru, antes do enliven,
    // para o slotManager.loadSlotsFromCanvas reconhecer naturalmente.
    obj.capiSlot = slotMeta;

    // Sincroniza geometria do objeto Fabric com boundsMm.
    // applyPatternObjects (engine-serialization.ts) já reposiciona com
    // offsetMm + atualiza capiSlot.x/y/width/height a partir da geometria
    // do objeto. Para isso o objeto precisa REFLETIR boundsMm como sua
    // geometria nativa (scale=1). Caso o object tenha vindo de convertToArea
    // já está alinhado, mas garantimos aqui pra qualquer caminho de salvar
    // pattern (incluindo testes/fixtures sintéticos).
    obj.left = bounds.x * 4; // mmToPx — MM_TO_PX=4 (units.ts)
    obj.top = bounds.y * 4;
    obj.width = bounds.width * 4;
    obj.height = bounds.height * 4;
    obj.scaleX = 1;
    obj.scaleY = 1;

    // Locks no Fabric (sobrevivem ao enliven). Rotation sempre.
    obj.lockMovementX = lockMovementX;
    obj.lockMovementY = lockMovementY;
    obj.lockScalingX = lockScalingX;
    obj.lockScalingY = lockScalingY;
    obj.lockRotation = true;

    // Bug-fix Onda 36+: placeholder de AREA é guia visual do editor — nunca
    // pode sair em PNG/SVG/DXF. NÃO usar `excludeFromExport: true` (quebra
    // o roundtrip do pattern: `canvas.toObject()` filtra antes do CAPI_CUSTOM_PROPS).
    // Usamos flag dedicada checada por svg/dxf/png-exporter. Patterns Onda 33/34
    // pré-fix recebem a flag aqui na hora de aplicar no pedido; patterns novos
    // já vêm com ela direto do convertToArea.
    obj.__capiAreaPlaceholder = true;

    result.converted++;
  }

  return result;
}
