/**
 * InicialPage — tela inicial do app (Onda 12).
 *
 * Stub Fase 1: layout vazio com placeholder de conteúdo.
 * Fase 2 vai povoar:
 *  - Lista de pedidos recentes (orderRepository.listAll)
 *  - Botão "Novo Pedido" → /arte/novo
 *  - Botão "Incluir Pedido" (em breve — vai criar pedido no Olist)
 */
import AppLayout from '@/ui/layout/AppLayout';

export default function InicialPage() {
  return (
    <AppLayout>
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <div className="text-center">
          <h1 className="font-display text-2xl font-medium tracking-wider text-foreground">
            Capi Studio
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Pedidos recentes — em breve (Fase 2)
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
