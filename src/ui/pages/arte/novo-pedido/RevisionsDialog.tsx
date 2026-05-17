/**
 * RevisionsDialog — histórico de revisões do pedido (Onda 22).
 *
 * Read-only. Mostra as revisões salvas em `order_revisions` da mais nova
 * pra mais antiga. Cada linha: número, quando, quantos broches, se foi
 * aprovada, se gerou PNG. Sem botão de "restaurar" ainda — a Onda 22
 * decidiu enxugar pra só visualização (decisão validada com Gabriell).
 *
 * Quando `orderId` é null (pedido novo, ainda não salvo), o dialog mostra
 * estado vazio explicando que revisões aparecem após o primeiro Salvar.
 */
import { useEffect, useState } from 'react';

import { listByOrder, type OrderRevision } from '@/data/repositories/revisionRepository';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Badge } from '@/ui/components/badge';
import { Skeleton } from '@/ui/components/skeleton';

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}

export function RevisionsDialog({ open, orderId, onClose }: Props) {
  const [revisions, setRevisions] = useState<OrderRevision[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer todos os setStates pra escapar do react-hooks/set-state-in-effect.
    void (async () => {
      if (cancelled) return;
      if (!open) {
        setRevisions(null);
        setError(null);
        return;
      }
      if (!orderId) {
        setRevisions([]);
        return;
      }
      try {
        const list = await listByOrder(orderId);
        if (!cancelled) setRevisions(list);
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setRevisions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Histórico de revisões</DialogTitle>
        </DialogHeader>

        <div className="pt-2">
          <RevisionsBody orderId={orderId} revisions={revisions} error={error} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevisionsBody({
  orderId,
  revisions,
  error,
}: {
  orderId: string | null;
  revisions: OrderRevision[] | null;
  error: string | null;
}) {
  if (!orderId) {
    return (
      <p className="rounded-md border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
        Este pedido ainda não foi salvo. Revisões aparecem depois do primeiro Salvar.
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        Erro ao carregar revisões: {error}
      </p>
    );
  }

  if (revisions === null) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma revisão registrada — pode ser um pedido legado.
      </p>
    );
  }

  return (
    <ul className="flex max-h-[400px] flex-col gap-1.5 overflow-y-auto">
      {revisions.map((rev) => (
        <RevisionRow key={rev.id} revision={rev} />
      ))}
    </ul>
  );
}

function RevisionRow({ revision }: { revision: OrderRevision }) {
  const itemCount = revision.items.length;
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs tabular-nums font-medium text-foreground">
          #{revision.number}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatAbsoluteDate(revision.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {itemCount === 1 ? '1 broche' : `${itemCount} broches`}
        </span>
        {revision.exportedPngPath && <Badge variant="default">PNG</Badge>}
        {revision.isApproved && <Badge variant="success">Aprovada</Badge>}
      </div>
    </li>
  );
}

function formatAbsoluteDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
