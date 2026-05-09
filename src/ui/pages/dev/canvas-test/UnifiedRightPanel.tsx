/**
 * UnifiedRightPanel.tsx — Onda 6.5 Fase B
 *
 * Always-visible right panel (w-[280px] shrink-0) with 3 tabs:
 *   - Apliques  : placeholder (content delivered in Fase C)
 *   - Materiais : MaterialPanel (migrated from RightPanel)
 *   - Camadas   : disabled skeleton ("Em breve — Onda 7")
 *
 * DEV-only component rendered from CanvasTest.
 */
import { type RefObject } from 'react';
import { Layers } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
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
          <TabsTrigger
            value="camadas"
            aria-disabled="true"
            tabIndex={-1}
            className="pointer-events-none font-mono text-[11px] opacity-40"
          >
            Camadas
            <span className="ml-1.5 text-[9px] text-ink-400">Onda 7</span>
          </TabsTrigger>
        </TabsList>

        {/* Apliques — placeholder para Fase C */}
        <TabsContent value="apliques" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-ink-400">
            <Layers className="h-8 w-8 opacity-50" />
            <p>Banco de Apliques</p>
            <p className="text-xs text-ink-500">Em breve (Fase C)</p>
          </div>
        </TabsContent>

        {/* Materiais — conteúdo migrado do RightPanel */}
        <TabsContent value="materiais" className="min-h-0 flex-1 overflow-y-auto">
          <MaterialPanel engineRef={engineRef} />
        </TabsContent>

        {/* Camadas — skeleton desabilitado */}
        <TabsContent value="camadas" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-ink-400">
            <Layers className="h-8 w-8 opacity-50" />
            <p>Painel de Camadas</p>
            <p className="text-xs text-ink-500">Em breve (Onda 7)</p>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
