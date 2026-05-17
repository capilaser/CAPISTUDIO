/**
 * LogoBankDialog — escolher logo existente do banco (Onda 21).
 *
 * Substitui o "file picker direto" do LogoSlotItem por um dialog que
 * mostra logos cadastrados + atalho pra upload novo. Banco é
 * auto-alimentado: toda logo que entra fica disponível pra próximo pedido.
 *
 * UX:
 *  - Campo de busca por nome (debounce leve por tecla, sem onChange burst).
 *  - Filtro de recência: Tudo / 7 dias / 30 dias (last_used_at).
 *  - Lista mostra nome + data de último uso, hover revela preview SVG grande.
 *  - Botão "Enviar arquivo SVG…" no rodapé pra fluxo de upload (delega ao caller).
 *
 * Performance: query no banco roda a cada `search`/`recency` mudar — banco
 * costuma ser pequeno (dezenas/centenas de logos), suficiente. Quando passar
 * de ~500, vale debounce real ou virtualização.
 */
import { useEffect, useState } from 'react';
import { ImagePlus, Search } from 'lucide-react';

import { listFiltered, type Logo, type LogoRecency } from '@/data/repositories/logoRepository';
import { sanitizeSvg } from '@/lib/sanitize-svg';
import { readLogoFile } from '@/services/logo-storage';
import { Button } from '@/ui/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Skeleton } from '@/ui/components/skeleton';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Operador escolheu um logo existente. Caller recebe o conteúdo SVG carregado. */
  onPick: (logo: Logo, svgContent: string) => void;
  /** Operador quer fazer upload novo — caller dispara o file picker. */
  onUploadNew: () => void;
}

const RECENCY_OPTIONS: { value: LogoRecency; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: '30d', label: '30 dias' },
  { value: '7d', label: '7 dias' },
];

export function LogoBankDialog({ open, onClose, onPick, onUploadNew }: Props) {
  const [search, setSearch] = useState('');
  const [recency, setRecency] = useState<LogoRecency>('all');
  const [logos, setLogos] = useState<Logo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);

  // Reseta o estado quando o dialog fecha — próxima abertura começa limpa.
  // setStates dentro do effect ficam dentro da microtask pra evitar warning
  // react-hooks/set-state-in-effect (cascading renders sincronos).
  useEffect(() => {
    if (open) return;
    void Promise.resolve().then(() => {
      setSearch('');
      setRecency('all');
      setLogos(null);
      setError(null);
      setPickingId(null);
    });
  }, [open]);

  // Reload na abertura e a cada mudança de filtro.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      // setError dentro da microtask pra escapar do "setState sync no effect".
      if (!cancelled) setError(null);
      try {
        const result = await listFiltered({ search, recency });
        if (!cancelled) setLogos(result);
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setLogos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, search, recency]);

  async function handlePick(logo: Logo) {
    if (pickingId) return;
    setPickingId(logo.id);
    try {
      const content = await readLogoFile(logo.filePath);
      onPick(logo, content);
      onClose();
    } catch (err) {
      console.error('[LogoBankDialog] falha ao ler logo:', err);
      setError(`Não consegui carregar "${logo.name}". O arquivo pode ter sido apagado.`);
    } finally {
      setPickingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Banco de logos</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {/* Busca + filtros de recência */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome…"
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
              {RECENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecency(opt.value)}
                  className={
                    recency === opt.value
                      ? 'rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-primary/15 text-primary'
                      : 'rounded px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground'
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <LogoList
            logos={logos}
            error={error}
            pickingId={pickingId}
            onPick={handlePick}
            search={search}
            recency={recency}
          />
        </div>

        {/* Footer — fluxo upload */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground/70">
            Logos enviadas em pedidos ficam disponíveis aqui automaticamente.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              onClose();
              onUploadNew();
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Enviar arquivo novo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LogoListProps {
  logos: Logo[] | null;
  error: string | null;
  pickingId: string | null;
  onPick: (logo: Logo) => void;
  search: string;
  recency: LogoRecency;
}

function LogoList({ logos, error, pickingId, onPick, search, recency }: LogoListProps) {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        {error}
      </div>
    );
  }

  if (logos === null) {
    return (
      <div className="grid h-[260px] grid-cols-3 gap-2 p-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-full rounded-md" />
        ))}
      </div>
    );
  }

  if (logos.length === 0) {
    const message =
      search.trim().length > 0
        ? `Nenhum logo bate com "${search.trim()}".`
        : recency !== 'all'
          ? 'Nenhum logo usado nesse período.'
          : 'Banco de logos vazio. Envie a primeira logo pelo botão abaixo.';
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed border-border bg-card/40">
        <p className="px-6 text-center text-xs text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <ul className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
      {logos.map((logo) => (
        <LogoRow
          key={logo.id}
          logo={logo}
          disabled={pickingId !== null && pickingId !== logo.id}
          loading={pickingId === logo.id}
          onPick={() => onPick(logo)}
        />
      ))}
    </ul>
  );
}

function LogoRow({
  logo,
  disabled,
  loading,
  onPick,
}: {
  logo: Logo;
  disabled: boolean;
  loading: boolean;
  onPick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);

  // Carrega preview SVG ao primeiro hover. Cache local (state) evita
  // re-ler o arquivo a cada movimento do mouse.
  useEffect(() => {
    if (!hovered || previewSvg) return;
    let cancelled = false;
    void (async () => {
      try {
        const content = await readLogoFile(logo.filePath);
        if (!cancelled) setPreviewSvg(content);
      } catch {
        // Falha silenciosa — sem preview. O onPick mostra erro real.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hovered, previewSvg, logo.filePath]);

  return (
    <li
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={disabled || loading}
        className={
          'flex w-full items-center justify-between gap-3 rounded border border-transparent px-2 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-background/60 disabled:cursor-not-allowed disabled:opacity-40'
        }
      >
        <span className="line-clamp-1 flex-1 text-xs text-foreground">{logo.name}</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {formatRelativeUsed(logo.lastUsedAt, logo.createdAt)}
        </span>
        {loading && <span className="text-[10px] text-muted-foreground">…</span>}
      </button>

      {/* Preview no hover — flutua à direita da linha sem reflow do dialog. */}
      {hovered && previewSvg && (
        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden h-32 w-32 items-center justify-center rounded-md border border-ink-700 bg-surface-2 p-2 shadow-md lg:flex">
          <div
            className="flex h-full w-full items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeSvg(previewSvg) }}
          />
        </div>
      )}
    </li>
  );
}

function formatRelativeUsed(lastUsedAt: number | null, createdAt: number): string {
  const ts = lastUsedAt ?? createdAt;
  const now = Date.now() / 1000;
  const diffSec = Math.max(0, now - ts);
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays < 1) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `${diffDays}d atrás`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}mes atrás`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years}a atrás`;
}
