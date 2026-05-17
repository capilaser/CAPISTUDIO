/**
 * OrderCard — card de pedido na lista (Onda 12 Fase 2).
 *
 * Visual:
 *  - Top: nome do cliente (bold) + badge de status (cor por estado)
 *  - Middle: nome do pedido / produto (se preenchidos)
 *  - Bottom: data de atualização + #id curto
 *  - Hover: borda violeta + leve elevação
 *  - Click: navega pra /arte/novo?id=<orderId> (reabertura — Fase 9)
 *
 * Onda 12: thumbnail (exported_png_path) fica pra Fase 9 quando export PNG
 * for conectado ao pedido. Por enquanto card é só metadado.
 */
import { useNavigate } from 'react-router-dom';

import type { Order, OrderStatus } from '@/data/repositories/orderRepository';
import { Badge } from '@/ui/components/badge';

const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Novo',
  aguardando_info: 'Aguardando Info',
  arte_enviada: 'Arte Enviada',
  aprovado: 'Aprovado',
  em_producao: 'Em Produção',
  enviado: 'Enviado',
};

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'success' | 'warning'> = {
  novo: 'default',
  aguardando_info: 'warning',
  arte_enviada: 'default',
  aprovado: 'success',
  em_producao: 'default',
  enviado: 'default',
};

function formatRelativeDate(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface Props {
  order: Order;
}

export function OrderCard({ order }: Props) {
  const navigate = useNavigate();

  function handleClick() {
    // Reabertura entra na Fase 9. Por agora o click só leva pro editor.
    navigate(`/arte/novo?id=${order.id}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-medium text-foreground">
          {order.customerName || order.label || 'Sem nome'}
        </span>
        <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
      </div>

      <div className="text-[11px] text-muted-foreground">
        {order.items.length === 0
          ? 'Sem broches'
          : order.items.length === 1
            ? order.items[0].productId
              ? `Produto: ${order.items[0].productId}`
              : 'Sem produto'
            : `${order.items.length} broches`}
      </div>

      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/70">
        <span>#{order.id.slice(0, 8)}</span>
        <span className="tabular-nums">{formatRelativeDate(order.updatedAt)}</span>
      </div>
    </button>
  );
}
