/**
 * NovoPedidoPage — editor de pedido (Onda 12 F4.3).
 *
 * Orquestra:
 *  - label do pedido (vive na topbar, auto-incrementado via countAll no mount)
 *  - selection de produto (Estado A/B da sidebar)
 *
 * F4.3: dropdown "+ Adicionar" mostra toast "Em breve" pra cada opção.
 * Engine (carregar produto + material no canvas) entra na próxima sub-fase.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { countAll } from '@/data/repositories/orderRepository';
import AppLayout from '@/ui/layout/AppLayout';

import { NovoPedidoCanvasArea } from './novo-pedido/NovoPedidoCanvasArea';
import { NovoPedidoLayerSidebar } from './novo-pedido/NovoPedidoLayerSidebar';
import { NovoPedidoSidebar, type ProductSelection } from './novo-pedido/NovoPedidoSidebar';
import { NovoPedidoTopbar } from './novo-pedido/NovoPedidoTopbar';

const ADD_TYPE_LABEL: Record<'svg' | 'texto' | 'banco', string> = {
  svg: 'Upar SVG',
  texto: 'Colocar texto',
  banco: 'Usar banco de dados',
};

export default function NovoPedidoPage() {
  const [pedidoLabel, setPedidoLabel] = useState('');
  const [selection, setSelection] = useState<ProductSelection | null>(null);

  // Gera nome auto-incrementado no mount. Usuário pode editar na topbar.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const n = await countAll();
        if (cancelled) return;
        const next = n + 1;
        const padded = next < 100 ? String(next).padStart(2, '0') : String(next);
        setPedidoLabel(`Novo Pedido ${padded}`);
      } catch {
        // Fallback se countAll falhar (banco fora): mantém vazio, usuário digita.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleConfirmProduct(data: ProductSelection) {
    setSelection(data);
  }

  function handleEditProduct() {
    // Camadas no canvas NÃO são apagadas (decisão Gabriell: troca livre).
    setSelection(null);
  }

  function handleAddItem(type: 'svg' | 'texto' | 'banco') {
    toast.info('Em breve', {
      description: `${ADD_TYPE_LABEL[type]} — Fase 5 do plano.`,
    });
  }

  return (
    <AppLayout breadcrumb={[{ label: 'Arte', href: '/arte' }, { label: 'Novo Pedido' }]}>
      <div className="flex h-full flex-col">
        <NovoPedidoTopbar pedidoLabel={pedidoLabel} onLabelChange={setPedidoLabel} />
        <div className="flex flex-1 overflow-hidden">
          <NovoPedidoSidebar
            selection={selection}
            onConfirmProduct={handleConfirmProduct}
            onAddItem={handleAddItem}
            onEditProduct={handleEditProduct}
          />
          <NovoPedidoCanvasArea />
          <NovoPedidoLayerSidebar />
        </div>
      </div>
    </AppLayout>
  );
}
