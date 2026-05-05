import { AppBreadcrumb, type BreadcrumbItem } from './AppBreadcrumb';

interface Props {
  breadcrumb?: BreadcrumbItem[];
}

export function AppHeader({ breadcrumb }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900 px-4">
      <div className="flex items-baseline gap-2 font-display">
        <span className="text-sm font-medium tracking-wider text-ink-100">CAPI STUDIO</span>
        <span className="tabular-nums text-[11px] text-laser-muted">v2</span>
      </div>

      <AppBreadcrumb items={breadcrumb} />

      {/* future avatar / menu slot */}
      <div className="w-20" />
    </header>
  );
}
