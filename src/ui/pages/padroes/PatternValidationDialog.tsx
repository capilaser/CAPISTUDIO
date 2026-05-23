/**
 * PatternValidationDialog — Onda 36.
 *
 * Dialog reutilizado em 3 contextos:
 *   - mode='block'       : só Errors. Botão único "Voltar e corrigir". Usado
 *                          no save quando há errors do validatePattern.
 *   - mode='confirm-save': Warnings. "Cancelar" + "Salvar mesmo assim".
 *   - mode='confirm-export': Warnings/Skips. "Cancelar" + "Exportar mesmo assim".
 *
 * Componente puro de apresentação — caller controla state e callbacks.
 */
import { AlertTriangle, XCircle } from 'lucide-react';

import type { PatternIssue } from '@/core/patterns/validate-pattern';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';

export type PatternValidationDialogMode = 'block' | 'confirm-save' | 'confirm-export';

/**
 * Item adicional reportado pelo pre-check do export — layer que vai ser
 * skipada porque o routing-resolver retornou `routing: null`. Reusa o shape
 * "informal" de PatternIssue só para a UI; não estende o type porque o
 * `code` aqui é literal próprio (não-PatternIssueCode).
 */
export interface RoutingSkipIssue {
  layerId: string;
  layerName: string;
  code: 'ROUTING_SKIP';
  message: string;
  severity: 'warning';
}

/**
 * Bug-fix Onda 36+ (rodada 2) — texto que não pode ser vetorizado. O export
 * gravaria arquivo com `<!-- Texto pendente -->` em vez de path real,
 * deixando a máquina sem o texto. Item é EXIBIDO como erro (cor danger)
 * porque o impacto é o mesmo de não exportar.
 */
export interface FontIssue {
  text: string;
  fontFamily: string;
  /** Razão técnica curta: font-not-found, font-unsupported, parse-error. */
  reasonKind: string;
}

export interface PatternValidationDialogProps {
  open: boolean;
  mode: PatternValidationDialogMode;
  errors: PatternIssue[];
  warnings: PatternIssue[];
  /** Apenas no modo export — layers que serão skipadas no export. */
  routingSkips?: RoutingSkipIssue[];
  /** Bug-fix Onda 36+ rodada 2: textos cuja fonte não vetoriza. */
  fontIssues?: FontIssue[];
  onCancel: () => void;
  /** Confirmação só faz sentido em modos 'confirm-*'. */
  onConfirm?: () => void;
  /** Texto do botão de confirmação. Default por modo. */
  confirmLabel?: string;
  /** Desabilita o botão de confirm (ex: durante save async). */
  busy?: boolean;
}

const TITLES: Record<PatternValidationDialogMode, string> = {
  block: 'Padrão não pode ser salvo',
  'confirm-save': 'Padrão com avisos — salvar mesmo assim?',
  'confirm-export': 'Atenção antes de exportar',
};

const DESCRIPTIONS: Record<PatternValidationDialogMode, string> = {
  block:
    'Corrija os erros abaixo antes de salvar. O padrão precisa estar consistente para o export funcionar.',
  'confirm-save':
    'Os itens abaixo não bloqueiam o salvamento, mas vale conferir antes de continuar.',
  'confirm-export':
    'Algumas camadas têm problemas ou serão ignoradas no export. Confirme se isso é esperado.',
};

const DEFAULT_CONFIRM_LABEL: Record<PatternValidationDialogMode, string> = {
  block: '',
  'confirm-save': 'Salvar mesmo assim',
  'confirm-export': 'Exportar mesmo assim',
};

export function PatternValidationDialog({
  open,
  mode,
  errors,
  warnings,
  routingSkips = [],
  fontIssues = [],
  onCancel,
  onConfirm,
  confirmLabel,
  busy = false,
}: PatternValidationDialogProps) {
  const showConfirm = mode !== 'block';
  const finalConfirmLabel = confirmLabel ?? DEFAULT_CONFIRM_LABEL[mode];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription className="pt-1 text-xs text-muted-foreground">
            {DESCRIPTIONS[mode]}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {errors.length > 0 && (
            <IssueSection
              title="Erros"
              icon="error"
              items={errors}
              tone="border-danger/30 bg-danger/5"
            />
          )}
          {fontIssues.length > 0 && <FontIssuesSection items={fontIssues} />}
          {warnings.length > 0 && (
            <IssueSection
              title="Avisos"
              icon="warning"
              items={warnings}
              tone="border-warn/30 bg-warn/5"
            />
          )}
          {routingSkips.length > 0 && (
            <IssueSection
              title="Camadas que serão ignoradas no export"
              icon="warning"
              items={routingSkips}
              tone="border-warn/30 bg-warn/5"
            />
          )}
          {errors.length === 0 &&
            warnings.length === 0 &&
            routingSkips.length === 0 &&
            fontIssues.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum item.</p>
            )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            {mode === 'block' ? 'Voltar e corrigir' : 'Cancelar'}
          </Button>
          {showConfirm && onConfirm && (
            <Button variant="default" size="sm" onClick={onConfirm} disabled={busy}>
              {busy ? 'Processando…' : finalConfirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface IssueLike {
  layerId: string;
  layerName: string;
  message: string;
}

interface IssueSectionProps {
  title: string;
  icon: 'error' | 'warning';
  items: readonly IssueLike[];
  tone: string;
}

function IssueSection({ title, icon, items, tone }: IssueSectionProps) {
  const Icon = icon === 'error' ? XCircle : AlertTriangle;
  const iconColor = icon === 'error' ? 'text-danger' : 'text-warn';
  return (
    <section className={`rounded-md border px-3 py-2 ${tone}`}>
      <header className="mb-2 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <h3 className="text-[11px] font-medium uppercase tracking-wider">
          {title} ({items.length})
        </h3>
      </header>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={`${item.layerId}-${i}`} className="text-[11px] leading-relaxed">
            <span className="font-mono text-muted-foreground">{item.layerName}</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Bug-fix Onda 36+ (rodada 2) — seção dedicada a fontes que não vetorizam.
 * Mensagem aprovada por Gabriell. Texto adaptado dinamicamente para mostrar
 * família real e textos reais afetados.
 */
function FontIssuesSection({ items }: { items: readonly FontIssue[] }) {
  const families = Array.from(new Set(items.map((i) => i.fontFamily)));
  const texts = items.map((i) => i.text).slice(0, 4);
  const more = items.length - texts.length;
  return (
    <section className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
      <header className="mb-2 flex items-center gap-1.5">
        <XCircle className="h-3.5 w-3.5 text-danger" />
        <h3 className="text-[11px] font-medium uppercase tracking-wider">
          Fontes que não vetorizam ({items.length})
        </h3>
      </header>
      <p className="mb-2 text-[11px] leading-relaxed">
        {families.length === 1 ? (
          <>
            A fonte <b>{families[0]}</b> não pode ser vetorizada para produção (limitação da
            biblioteca de fontes variable).
          </>
        ) : (
          <>
            As fontes <b>{families.join(', ')}</b> não podem ser vetorizadas para produção.
          </>
        )}
      </p>
      <p className="mb-2 text-[11px] leading-relaxed">
        Texto(s) {texts.map((t) => `"${t}"`).join(', ')}
        {more > 0 ? ` (+${more} mais)` : ''} ficará(ão) como comentário no SVG e <b>NÃO</b> será(ão)
        cortado(s)/gravado(s) pela máquina.
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Soluções:
        <br />
        1. Trocar a fonte para Montserrat, Bebas Neue, Caveat ou Playfair Display.
        <br />
        2. Vetorizar o texto manualmente em outro software após exportar.
      </p>
    </section>
  );
}
