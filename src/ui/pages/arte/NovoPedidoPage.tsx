/**
 * NovoPedidoPage — editor de pedido (Onda 12 F4.2).
 *
 * Orquestra state da sidebar esquerda:
 *  - selection=null  → sidebar Estado A (escolher produto)
 *  - selection=obj   → sidebar Estado B (menu + Adicionar)
 *
 * F4.2: dropdown "+ Adicionar" mostra toast "Em breve" pra cada opção.
 * F4.3: ao confirmar produto, engine carrega base SVG + aplica material no canvas.
 */
import { useState } from 'react';
import { toast } from 'sonner';

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
  const [selection, setSelection] = useState<ProductSelection | null>(null);

  function handleConfirmProduct(data: ProductSelection) {
    setSelection(data);
    // F4.3 vai disparar engine.loadProductSvg + applyMaterial aqui.
  }

  function handleEditProduct() {
    // Camadas no canvas NÃO são apagadas (decisão Gabriell: troca livre).
    // F4.3 vai re-carregar base no engine quando novo produto confirmado.
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
        <NovoPedidoTopbar pedidoLabel={selection?.label ?? null} />
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
