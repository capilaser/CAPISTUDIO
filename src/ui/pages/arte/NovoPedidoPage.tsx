/**
 * NovoPedidoPage — editor de pedido (Onda 12).
 *
 * Stub Fase 1: estrutura visual mínima.
 * Fase 4 vai construir o shell completo (topbar + faixa padrões + sidebars + canvas + FAB).
 */
import { Link } from 'react-router-dom';

import AppLayout from '@/ui/layout/AppLayout';

export default function NovoPedidoPage() {
  return (
    <AppLayout breadcrumb={[{ label: 'Arte', href: '/arte' }, { label: 'Novo Pedido' }]}>
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="font-display text-xl font-medium tracking-wider text-foreground">
          Novo Pedido
        </h1>
        <p className="font-mono text-xs text-muted-foreground">Editor — em breve (Fase 4)</p>
        <Link
          to="/arte"
          className="font-mono text-[11px] uppercase tracking-wider text-primary hover:underline"
        >
          ← voltar
        </Link>
      </div>
    </AppLayout>
  );
}
