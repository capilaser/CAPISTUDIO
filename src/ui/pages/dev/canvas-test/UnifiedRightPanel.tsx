/**
 * UnifiedRightPanel.tsx — Onda 6.5 Fase B + Onda 7 + Onda 8.5
 *
 * Always-visible right panel (w-[280px] shrink-0) with 4 tabs:
 *   - Apliques  : ApliquePanel (Onda 6.5 Fase C)
 *   - Gravações : EngravingPanel (Onda 8.5)
 *   - Materiais : MaterialPanel (migrated from RightPanel)
 *   - Camadas   : LayerPanel (Onda 7)
 *
 * Ordem semântica: o que adicionar (SVG → Apliques, Gravações) vem antes
 * do como pintar (PNG → Materiais) e do que tá no canvas (Camadas).
 *
 * DEV-only component rendered from CanvasTest.
 */
import { type RefObject } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { LayerPanel } from '@/ui/canvas/LayerPanel';
import { ApliquePanel } from './ApliquePanel';
import { EngravingPanel } from './EngravingPanel';
import { MaterialPanel } from './MaterialPanel';

interface UnifiedRightPanelProps {
  engineRef: RefObject<CanvasEngine | null>;
}

export function UnifiedRightPanel({ engineRef }: UnifiedRightPanelProps) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-ink-700 bg-ink-900">
      <Tabs defaultValue="materiais" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 rounded-none border-b border-ink-700 bg-ink-900 px-2 pt-2">
          <TabsTrigger value="apliques" className="font-mono text-[11px]">
            Apliques
          </TabsTrigger>
          <TabsTrigger value="gravacoes" className="font-mono text-[11px]">
            Gravações
          </TabsTrigger>
          <TabsTrigger value="materiais" className="font-mono text-[11px]">
            Materiais
          </TabsTrigger>
          <TabsTrigger value="camadas" className="font-mono text-[11px]">
            Camadas
          </TabsTrigger>
        </TabsList>

        {/* Apliques — ApliquePanel (Fase C) */}
        <TabsContent value="apliques" className="min-h-0 flex-1 overflow-y-auto">
          <ApliquePanel engineRef={engineRef} />
        </TabsContent>

        {/* Gravações — Onda 8.5 */}
        <TabsContent value="gravacoes" className="min-h-0 flex-1 overflow-y-auto">
          <EngravingPanel engineRef={engineRef} />
        </TabsContent>

        {/* Materiais — conteúdo migrado do RightPanel */}
        <TabsContent value="materiais" className="min-h-0 flex-1 overflow-y-auto">
          <MaterialPanel engineRef={engineRef} />
        </TabsContent>

        {/* Camadas — Onda 7 */}
        <TabsContent value="camadas" className="min-h-0 flex-1 overflow-y-auto">
          <LayerPanel engineRef={engineRef} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
