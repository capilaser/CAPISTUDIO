/**
 * asset-routing-types.ts — Tipos compartilhados de routing (Onda 35).
 *
 * Extraído de svg-exporter.ts para quebrar o ciclo de imports entre o
 * resolver (Onda 35) e os exporters (SVG/DXF). Sem regra de negócio aqui —
 * apenas o shape do que assetLookup retorna e a assinatura da função.
 */
import type { Operation } from '@/data/repositories/_export-validation';

/** Info mínima que o exporter precisa de cada asset pra roteamento. */
export interface AssetExportInfo {
  operation: Operation;
  /** 1-3 machine ids — já validado pelo repository no create. */
  machines: string[];
}

/**
 * Função de lookup injetada — resolve um asset id (de qualquer banco) pra
 * info de roteamento. Em runtime, UI passa um compositor que tenta os
 * 3 repos (applique → engraving → marking) ou usa cache pré-carregado.
 * Retorna null se id não existe em nenhum banco.
 */
export type AssetLookupFn = (id: string) => Promise<AssetExportInfo | null>;
