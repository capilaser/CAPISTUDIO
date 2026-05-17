/**
 * ArteHubPage — hub da seção Arte (Onda 12 Fase 3).
 *
 * 3 cartões grandes em grid:
 *  - Novo Pedido (ativo) → /arte/novo
 *  - Abrir Pedido (em breve — Fase 9 vai habilitar)
 *  - Criar Padrão (em breve — futuro)
 */
import { useNavigate } from 'react-router-dom';
import { FilePlus2, FolderOpen, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import AppLayout from '@/ui/layout/AppLayout';
import { cn } from '@/lib/cn';

interface HubCard {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  comingSoon?: string;
}

const CARDS: HubCard[] = [
  {
    icon: FilePlus2,
    title: 'Novo Pedido',
    description: 'Criar arte rápida para um pedido — escolhe produto, cor e padrão.',
    href: '/arte/novo',
  },
  {
    icon: FolderOpen,
    title: 'Abrir Pedido',
    description: 'Reabrir pedido existente e continuar de onde parou.',
    comingSoon: 'Fase 9',
  },
  {
    icon: Sparkles,
    title: 'Criar Padrão',
    description: 'Salvar layout validado como padrão reutilizável.',
    comingSoon: 'Fase 11',
  },
];

export default function ArteHubPage() {
  const navigate = useNavigate();

  function handleClick(card: HubCard) {
    if (card.href) {
      navigate(card.href);
    } else {
      toast.info('Em breve', {
        description: `${card.title} — chega na ${card.comingSoon}.`,
      });
    }
  }

  return (
    <AppLayout breadcrumb={[{ label: 'Arte' }]}>
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-8 p-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-lg font-medium tracking-wider text-foreground">Arte</h1>
          <p className="text-xs text-muted-foreground">Editor de pedidos e padrões.</p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const disabled = !card.href;
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => handleClick(card)}
                className={cn(
                  'group flex flex-col gap-3 rounded-lg border border-border bg-card p-6 text-left transition-all',
                  disabled
                    ? 'cursor-not-allowed opacity-60'
                    : 'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md'
                )}
              >
                <Icon
                  className={cn(
                    'h-7 w-7 transition-colors',
                    disabled
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-medium text-foreground">{card.title}</h3>
                  {disabled && (
                    <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                      em breve
                    </span>
                  )}
                </div>
                <p className="font-body text-xs text-muted-foreground">{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
