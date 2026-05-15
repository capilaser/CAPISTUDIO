/**
 * InicialPage — tela inicial do app (Onda 12 Fase 2).
 *
 * Layout:
 *  - Topo: 2 botões grandes (Novo Pedido / Incluir Pedido em breve)
 *  - Meio: lista de Pedidos Recentes em grid de OrderCard
 *  - Empty state se sem pedidos
 *
 * Fase 9 vai adicionar: thumbnail PNG nos cards, reabertura funcional.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { listAll, type Order } from '@/data/repositories/orderRepository';
import AppLayout from '@/ui/layout/AppLayout';
import { Button } from '@/ui/components/button';

import { OrderCard } from './OrderCard';

export default function InicialPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await listAll();
        if (!cancelled) setOrders(list);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleNovoPedido() {
    navigate('/arte/novo');
  }

  function handleIncluirPedido() {
    toast.info('Em breve', {
      description: 'Incluir pedido no Olist diretamente — Fase 2 do produto.',
    });
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-8 p-8">
        {/* Ações principais */}
        <div className="flex flex-col gap-4 md:flex-row">
          <Button
            onClick={handleNovoPedido}
            className="h-16 flex-1 gap-3 text-base"
            variant="default"
          >
            <Plus className="h-5 w-5" />
            Novo Pedido
          </Button>
          <Button
            onClick={handleIncluirPedido}
            variant="outline"
            className="h-16 flex-1 gap-3 text-base"
          >
            <Sparkles className="h-5 w-5" />
            Incluir Pedido
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              em breve
            </span>
          </Button>
        </div>

        {/* Pedidos recentes */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Pedidos Recentes
            </h2>
            {orders && orders.length > 0 && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 font-mono text-xs text-destructive">
              Erro ao carregar pedidos: {error}
            </p>
          )}

          {!error && orders === null && (
            <p className="font-mono text-xs text-muted-foreground">Carregando…</p>
          )}

          {!error && orders !== null && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
              <p className="font-mono text-sm text-muted-foreground">Nenhum pedido ainda.</p>
              <p className="font-mono text-xs text-muted-foreground/70">
                Comece clicando em <span className="text-primary">Novo Pedido</span> acima.
              </p>
            </div>
          )}

          {!error && orders !== null && orders.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
