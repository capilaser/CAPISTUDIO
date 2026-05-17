/**
 * NovoPedidoTopbar — barra superior do editor.
 *
 * Onda 25 Fase E: reorganizada em 3 zonas com hierarquia visual clara:
 *   Zona 1 (ghost):     Revisões (ícone só)
 *   Zona 2 (outline):   Exportar ▾ (split-button → SVG / PNG)
 *   Zona 3 (primária):  Aprovar (outline) + Salvar (default violeta)
 *
 * Botões sem handler ficam disabled + Tooltip explicando — substitui o
 * anti-pattern de toast.info("Em breve") on-click.
 */
import {
  Check,
  ChevronDown,
  Download,
  FileImage,
  History,
  Loader2,
  Save,
} from 'lucide-react';

import { Button } from '@/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/components/tooltip';

interface Props {
  pedidoLabel: string;
  onLabelChange: (next: string) => void;
  onSave?: () => void | Promise<void>;
  saving?: boolean;
  onSvg?: () => void;
  onPng?: () => void;
  onApprove?: () => void | Promise<void>;
  /** Onda 22 — abre dialog read-only com histórico de revisões. */
  onRevisions?: () => void;
}

export function NovoPedidoTopbar({
  pedidoLabel,
  onLabelChange,
  onSave,
  saving = false,
  onSvg,
  onPng,
  onApprove,
  onRevisions,
}: Props) {
  const hasExport = Boolean(onSvg || onPng);

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

      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-2">
          {/* Zona 1 — Revisões (ghost, ícone só) */}
          {onRevisions && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRevisions}
                  aria-label="Histórico de revisões"
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Histórico de revisões</TooltipContent>
            </Tooltip>
          )}

          <div className="h-4 w-px bg-border" />

          {/* Zona 2 — Exportar (split-button) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={hasExport ? -1 : 0}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!hasExport}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onSvg} disabled={!onSvg} className="gap-2">
                      <Download className="h-3.5 w-3.5" />
                      SVG (produção)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onPng} disabled={!onPng} className="gap-2">
                      <FileImage className="h-3.5 w-3.5" />
                      PNG (preview)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </TooltipTrigger>
            {!hasExport && <TooltipContent>Em breve — próxima onda</TooltipContent>}
          </Tooltip>

          <div className="h-4 w-px bg-border" />

          {/* Zona 3 — Aprovar + Salvar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={onApprove ? -1 : 0}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onApprove ? () => void onApprove() : undefined}
                  disabled={!onApprove}
                >
                  <Check className="h-3.5 w-3.5" />
                  Aprovar
                </Button>
              </span>
            </TooltipTrigger>
            {!onApprove && <TooltipContent>Em breve — próxima onda</TooltipContent>}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={onSave ? -1 : 0}>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={onSave ? () => void onSave() : undefined}
                  disabled={!onSave || saving}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Salvar
                </Button>
              </span>
            </TooltipTrigger>
            {!onSave && <TooltipContent>Em breve — próxima onda</TooltipContent>}
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
