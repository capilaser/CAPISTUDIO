/**
 * InicialPage — tela inicial do app.
 *
 * Layout:
 *  - Header editorial (Onda 25 Fase A)
 *  - Ações principais: Novo Pedido (ativo) + Incluir Pedido (disabled+tooltip)
 *  - Pedidos Recentes em grid (skeletons enquanto carrega)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Plus, Sparkles } from 'lucide-react';

import { listAll, type Order } from '@/data/repositories/orderRepository';
import AppLayout from '@/ui/layout/AppLayout';
import { Button } from '@/ui/components/button';
import { EmptyState } from '@/ui/components/empty-state';
import { Skeleton } from '@/ui/components/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/components/tooltip';

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

  return (
    <AppLayout>
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-8 p-8">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-display-lg text-foreground">Início</h1>
          <p className="text-xs text-muted-foreground">Pedidos recentes e ações rápidas.</p>
        </header>

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
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="flex-1">
                  <Button disabled variant="outline" className="h-16 w-full gap-3 text-base">
                    <Sparkles className="h-5 w-5" />
                    Incluir Pedido
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      em breve
                    </span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Integração com Olist — Fase 2 do produto</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Pedidos recentes */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Pedidos Recentes
            </h2>
            {orders && orders.length > 0 && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
              Erro ao carregar pedidos: {error}
            </p>
          )}

          {!error && orders === null && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-lg" />
              ))}
            </div>
          )}

          {!error && orders !== null && orders.length === 0 && (
            <EmptyState
              icon={Inbox}
              title="Nenhum pedido ainda"
              description="Comece criando seu primeiro pedido para gerar artes e exportar arquivos de produção."
              action={
                <Button onClick={handleNovoPedido} variant="default" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar primeiro pedido
                </Button>
              }
            />
          )}

          {!error && orders !== null && orders.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
