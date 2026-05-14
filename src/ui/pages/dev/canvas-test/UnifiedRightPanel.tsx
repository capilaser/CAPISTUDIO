/**
 * UnifiedRightPanel.tsx — Onda 6.5 Fase B + Onda 7 + Onda 8.5 + Onda 9
 *
 * Always-visible right panel (w-[280px] shrink-0) with 5 tabs:
 *   - Apliques  : ApliquePanel (Onda 6.5 Fase C)
 *   - Gravações : EngravingPanel (Onda 8.5)
 *   - Marcações : MarkingPanel (Onda 9)
 *   - Materiais : MaterialPanel (migrated from RightPanel)
 *   - Camadas   : LayerPanel (Onda 7)
 *
 * Ordem semântica: o que adicionar (SVG → Apliques, Gravações, Marcações)
 * vem antes do como pintar (PNG → Materiais) e do que tá no canvas (Camadas).
 *
 * DEV-only component rendered from CanvasTest.
 */
import { type RefObject } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { LayerPanel } from '@/ui/canvas/LayerPanel';
import { ApliquePanel } from './ApliquePanel';
import { EngravingPanel } from './EngravingPanel';
import { MarkingPanel } from './MarkingPanel';
import { MaterialPanel } from './MaterialPanel';

interface UnifiedRightPanelProps {
  engineRef: RefObject<CanvasEngine | null>;
}

export function UnifiedRightPanel({ engineRef }: UnifiedRightPanelProps) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-ink-700 bg-ink-900">
      <Tabs defaultValue="materiais" className="flex min-h-0 flex-1 flex-col">
        {/* G1.2 fix: 5 abas em 280px estourava (texto + px-3 padrão = ~460px).
         * Solução: grid de 5 colunas iguais + texto compacto. Cada aba 56px
         * de largura útil — cabe "Apliq.", "Gravaç.", etc. sem cortar bordas.
         * px-0 derruba padding herdado, text-[10px] uppercase mantém DAW look.
         */}
        <TabsList className="grid h-auto shrink-0 grid-cols-5 gap-0.5 rounded-none border-b border-ink-700 bg-ink-900 p-1">
          <TabsTrigger
            value="apliques"
            className="rounded-sm px-0 py-1.5 font-mono text-[10px] uppercase tracking-tight"
          >
            Apliques
          </TabsTrigger>
          <TabsTrigger
            value="gravacoes"
            className="rounded-sm px-0 py-1.5 font-mono text-[10px] uppercase tracking-tight"
          >
            Gravaç.
          </TabsTrigger>
          <TabsTrigger
            value="marcacoes"
            className="rounded-sm px-0 py-1.5 font-mono text-[10px] uppercase tracking-tight"
          >
            Marcaç.
          </TabsTrigger>
          <TabsTrigger
            value="materiais"
            className="rounded-sm px-0 py-1.5 font-mono text-[10px] uppercase tracking-tight"
          >
            Material
          </TabsTrigger>
          <TabsTrigger
            value="camadas"
            className="rounded-sm px-0 py-1.5 font-mono text-[10px] uppercase tracking-tight"
          >
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

        {/* Marcações — Onda 9 */}
        <TabsContent value="marcacoes" className="min-h-0 flex-1 overflow-y-auto">
          <MarkingPanel engineRef={engineRef} />
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
