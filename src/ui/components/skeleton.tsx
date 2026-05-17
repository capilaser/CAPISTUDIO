import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Skeleton — placeholder shimmer enquanto dados carregam.
 *
 * Use com o mesmo footprint visual do conteúdo final pra evitar layout shift.
 * Cores derivam do token `secondary` pra herdar tema dark/light sem custom.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('animate-pulse rounded-md bg-secondary/60', className)} {...props} />
  );
}
