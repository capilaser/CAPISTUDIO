/**
 * BancoDrawer — painel grande que abre sobre o canvas (F5).
 *
 * 4 abas: Apliques / Gravações / Marcações / Fontes.
 * Reutiliza os painéis já existentes em canvas-test/.
 *
 * Padrões NÃO ficam aqui — viraram secção dedicada na sidebar (Onda 13.9),
 * porque são pilar central do sistema (CLAUDE.md) e merecem destaque
 * próprio, não estar misturados com assets de banco.
 */
import { type RefObject } from 'react';
import { X } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { ApliquePanel } from '@/ui/pages/dev/canvas-test/ApliquePanel';
import { EngravingPanel } from '@/ui/pages/dev/canvas-test/EngravingPanel';
import { MarkingPanel } from '@/ui/pages/dev/canvas-test/MarkingPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  onClose: () => void;
}

export function BancoDrawer({ engineRef, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-stretch">
      {/* Overlay clicável para fechar */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Painel */}
      <div className="relative z-10 ml-auto flex w-[520px] flex-col border-l border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Banco de Dados
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Abas */}
        <Tabs defaultValue="apliques" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid h-auto shrink-0 grid-cols-4 gap-0.5 rounded-none border-b border-border bg-card p-1">
            <TabsTrigger value="apliques" className="text-[11px]">
              Apliques
            </TabsTrigger>
            <TabsTrigger value="gravacoes" className="text-[11px]">
              Gravações
            </TabsTrigger>
            <TabsTrigger value="marcacoes" className="text-[11px]">
              Marcações
            </TabsTrigger>
            <TabsTrigger value="fontes" className="text-[11px]">
              Fontes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apliques" className="min-h-0 flex-1 overflow-y-auto">
            <ApliquePanel engineRef={engineRef} />
          </TabsContent>
          <TabsContent value="gravacoes" className="min-h-0 flex-1 overflow-y-auto">
            <EngravingPanel engineRef={engineRef} />
          </TabsContent>
          <TabsContent value="marcacoes" className="min-h-0 flex-1 overflow-y-auto">
            <MarkingPanel engineRef={engineRef} />
          </TabsContent>
          <TabsContent value="fontes" className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-xs text-muted-foreground">Gerenciamento de fontes em breve.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
