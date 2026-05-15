/**
 * ArteHubPage — hub da seção Arte (Onda 12).
 *
 * 3 cartões grandes:
 *  - Novo Pedido (ativo) → /arte/novo
 *  - Abrir Pedido (em breve)
 *  - Criar Padrão (em breve)
 *
 * Stub Fase 1: estrutura visual. Fase 3 popula com conteúdo final.
 */
import AppLayout from '@/ui/layout/AppLayout';

export default function ArteHubPage() {
  return (
    <AppLayout breadcrumb={[{ label: 'Arte' }]}>
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="font-display text-xl font-medium tracking-wider text-foreground">Arte</h1>
        <p className="font-mono text-xs text-muted-foreground">
          Hub com 3 ações — em breve (Fase 3)
        </p>
      </div>
    </AppLayout>
  );
}
