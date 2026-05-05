import type { ReactNode } from 'react';

import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import type { BreadcrumbItem } from './AppBreadcrumb';

interface Props {
  children: ReactNode;
  breadcrumb?: BreadcrumbItem[];
}

export default function AppLayout({ children, breadcrumb }: Props) {
  return (
    <div className="flex h-full flex-col bg-ink-950 text-ink-100">
      <AppHeader breadcrumb={breadcrumb} />
      <main className="flex-1 overflow-auto">{children}</main>
      <AppFooter />
    </div>
  );
}
