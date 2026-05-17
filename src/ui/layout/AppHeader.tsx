/**
 * AppHeader — header do shell único do app (Onda 12).
 *
 * Estrutura: [logo + version] [nav 3 links] [breadcrumb] [slot futuro]
 * Nav é a navegação primária do app: Início / Arte / Banco.
 * Link ativo recebe destaque violeta (primary do design system).
 */
import { NavLink } from 'react-router-dom';

import { AppBreadcrumb, type BreadcrumbItem } from './AppBreadcrumb';
import { cn } from '@/lib/cn';

interface Props {
  breadcrumb?: BreadcrumbItem[];
}

const NAV_LINKS = [
  { to: '/', label: 'Início', end: true },
  { to: '/arte', label: 'Arte', end: false },
  { to: '/padroes', label: 'Padrões', end: false },
  { to: '/banco', label: 'Banco', end: false },
] as const;

export function AppHeader({ breadcrumb }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-border bg-card px-4">
      <div className="flex items-baseline gap-2 font-display">
        <span className="text-sm font-medium tracking-wider text-foreground">CAPI STUDIO</span>
        <span className="tabular-nums text-[11px] text-muted-foreground">v2</span>
      </div>

      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1">
        <AppBreadcrumb items={breadcrumb} />
      </div>

      {/* future avatar / menu slot */}
      <div className="w-8" />
    </header>
  );
}
