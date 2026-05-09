import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  wave: string;
  href?: string;
}

export function HomeCard({ icon: Icon, title, description, wave, href }: Props) {
  const navigate = useNavigate();

  function handleClick() {
    if (href) {
      navigate(href);
    } else {
      toast.info('Em desenvolvimento', {
        description: 'Esta funcionalidade chega na ' + wave,
      });
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex cursor-pointer flex-col rounded-md border border-ink-700 bg-ink-900 p-6 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-ink-600 hover:shadow-sm"
    >
      <Icon size={28} className="text-ink-500" />
      <span className="mt-3 font-display text-sm font-medium text-ink-100">{title}</span>
      <span className="mt-1 font-body text-xs text-ink-400">{description}</span>
    </button>
  );
}
