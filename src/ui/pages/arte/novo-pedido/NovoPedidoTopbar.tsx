/**
 * NovoPedidoTopbar — barra superior do editor (Onda 13.5).
 *
 * Esquerda: rótulo "PEDIDO" + input editável inline com nome auto-incrementado.
 * Direita: 4 botões — Aprovar / SVG / PNG / Salvar.
 *
 * F4.3: input controlado externamente (state vive na NovoPedidoPage).
 * Onda 13.5: Salvar agora chama callback real (createWithItems / saveRevision).
 * Aprovar / SVG / PNG continuam mostrando "Em breve" — não foram conectados.
 */
import { Check, Download, FileImage, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';

interface Props {
  pedidoLabel: string;
  onLabelChange: (next: string) => void;
  onSave?: () => void | Promise<void>;
  saving?: boolean;
  onSvg?: () => void;
  onPng?: () => void;
  onApprove?: () => void | Promise<void>;
}

export function NovoPedidoTopbar({
  pedidoLabel,
  onLabelChange,
  onSave,
  saving = false,
  onSvg,
  onPng,
  onApprove,
}: Props) {
  function notReady(label: string) {
    toast.info('Em breve', {
      description: `${label} — chega numa próxima onda.`,
    });
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pedido</span>
        <input
          type="text"
          value={pedidoLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Sem nome"
          className="h-7 min-w-[240px] rounded-md border border-transparent bg-transparent px-2 text-xs text-foreground transition-colors placeholder:text-muted-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="approveSubtle"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            if (onApprove) void onApprove();
            else notReady('Aprovar');
          }}
        >
          <Check className="h-3.5 w-3.5 text-success" />
          Aprovar
        </Button>
        <Button
          variant="svg"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            if (onSvg) onSvg();
            else notReady('Gerar SVG');
          }}
        >
          <Download className="h-3.5 w-3.5" />
          SVG
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            if (onPng) onPng();
            else notReady('PNG');
          }}
        >
          <FileImage className="h-3.5 w-3.5" />
          PNG
        </Button>
        <Button
          variant="default"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            if (onSave) void onSave();
            else notReady('Salvar Pedido');
          }}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
