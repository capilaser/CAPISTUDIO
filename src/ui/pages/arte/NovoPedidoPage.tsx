/**
 * NovoPedidoPage — editor de pedido (Onda 12 F4.1).
 *
 * Layout: AppLayout > Topbar editor + 3 colunas (Sidebar L / Canvas / LayerSidebar R)
 *
 * F4.1: shell visual completo, sem engine, sem dados conectados.
 * F4.2: sidebar esquerda conecta selects ao banco.
 * F4.3: engine conecta ao canvas quando produto é escolhido.
 */
import AppLayout from '@/ui/layout/AppLayout';

import { NovoPedidoCanvasArea } from './novo-pedido/NovoPedidoCanvasArea';
import { NovoPedidoLayerSidebar } from './novo-pedido/NovoPedidoLayerSidebar';
import { NovoPedidoSidebar } from './novo-pedido/NovoPedidoSidebar';
import { NovoPedidoTopbar } from './novo-pedido/NovoPedidoTopbar';

export default function NovoPedidoPage() {
  return (
    <AppLayout breadcrumb={[{ label: 'Arte', href: '/arte' }, { label: 'Novo Pedido' }]}>
      <div className="flex h-full flex-col">
        <NovoPedidoTopbar pedidoLabel={null} />
        <div className="flex flex-1 overflow-hidden">
          <NovoPedidoSidebar />
          <NovoPedidoCanvasArea />
          <NovoPedidoLayerSidebar />
        </div>
      </div>
    </AppLayout>
  );
}
