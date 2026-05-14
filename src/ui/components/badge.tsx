/**
 * Badge component — Fase G1 (Onda 12 — front rework).
 *
 * Variantes alinhadas ao design system Stitch:
 *  - default: fundo neutro ink, texto claro. Usado em chips genéricos.
 *  - cut/grav/marc: badges de operação no painel de camadas (LayerPanel).
 *  - shopee/ml/whatsapp: badges de marketplace nos cards do Kanban.
 *  - machine: M1/M2/M3 toggles (ativo = fundo violeta, inativo = neutro).
 *  - status-*: status do pedido (verde aprovado, âmbar pendente, etc).
 *
 * Convenções:
 *  - Fonte mono (JetBrains Mono) — todas badges são técnicas, dados/sigla
 *  - 10-11px de fonte — denso, não decorativo
 *  - radius 4px — menor que cards (8px), maior que nada — Stitch
 *  - sem hover/active por default — badges são display-only. Se for
 *    clicável, usar Button no lugar.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide leading-none',
  {
    variants: {
      variant: {
        default: 'bg-ink-800 text-ink-200',
        // Operações (LayerPanel)
        cut: 'bg-op-cut-bg text-op-cut-text',
        grav: 'bg-op-grav-bg text-op-grav-text',
        marc: 'bg-op-marc-bg text-op-marc-text',
        // Marketplaces (Kanban — futuro)
        shopee: 'bg-mkt-shopee text-white',
        ml: 'bg-mkt-ml text-black',
        whatsapp: 'bg-mkt-whatsapp text-white',
        // Máquinas (M1/M2/M3 toggles no LayerPanel)
        'machine-active': 'bg-machine-active text-white',
        'machine-inactive': 'bg-ink-900 text-ink-600',
        // Status semânticos
        success: 'bg-success/15 text-success border border-success/30',
        warning: 'bg-warning/15 text-warning border border-warning/30',
        danger: 'bg-destructive/15 text-destructive border border-destructive/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <span ref={ref} className={cn(badgeVariants({ variant, className }))} {...props} />;
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
