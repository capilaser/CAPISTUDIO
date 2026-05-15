/**
 * NovoPedidoTopbar — barra superior do editor (Onda 12 F4.1).
 *
 * Esquerda: rótulo do pedido (ou "Sem nome" placeholder)
 * Direita: 4 botões — Aprovar / SVG / PNG / Salvar
 *
 * Onda 12 F4: todos os botões abrem toast "Em breve — Fase 9".
 * Fase 9 vai conectar cada um ao orderRepository / png-export / svg-export.
 */
import { Check, Download, FileImage, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';

interface Props {
  pedidoLabel: string | null;
}

export function NovoPedidoTopbar({ pedidoLabel }: Props) {
  function notReady(label: string) {
    toast.info('Em breve', {
      description: `${label} — chega na Fase 9 (salvar + export).`,
    });
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Pedido
        </span>
        <span className="font-mono text-xs text-foreground">
          {pedidoLabel || <span className="text-muted-foreground">Sem nome</span>}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="approve" size="sm" className="gap-1.5" onClick={() => notReady('Aprovar')}>
          <Check className="h-3.5 w-3.5" />
          Aprovar
        </Button>
        <Button variant="svg" size="sm" className="gap-1.5" onClick={() => notReady('Gerar SVG')}>
          <Download className="h-3.5 w-3.5" />
          SVG
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => notReady('PNG')}>
          <FileImage className="h-3.5 w-3.5" />
          PNG
        </Button>
        <Button
          variant="default"
          size="sm"
          className="gap-1.5"
          onClick={() => notReady('Salvar Pedido')}
        >
          <Save className="h-3.5 w-3.5" />
          Salvar
        </Button>
      </div>
    </div>
  );
}
