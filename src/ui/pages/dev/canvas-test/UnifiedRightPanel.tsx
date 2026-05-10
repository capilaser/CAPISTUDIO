/**
 * UnifiedRightPanel.tsx — Onda 6.5 Fase B + Onda 7
 *
 * Always-visible right panel (w-[280px] shrink-0) with 3 tabs:
 *   - Apliques  : ApliquePanel (Onda 6.5 Fase C)
 *   - Materiais : MaterialPanel (migrated from RightPanel)
 *   - Camadas   : LayerPanel (Onda 7 — preenche o slot antes desabilitado)
 *
 * DEV-only component rendered from CanvasTest.
 */
import { type RefObject } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { LayerPanel } from '@/ui/canvas/LayerPanel';
import { ApliquePanel } from './ApliquePanel';
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
