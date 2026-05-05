import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items?: BreadcrumbItem[];
}

export function AppBreadcrumb({ items }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-700">·</span>}
          {item.href ? (
            <Link to={item.href} className="transition-colors hover:text-ink-300">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
