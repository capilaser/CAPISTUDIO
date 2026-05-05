import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast: 'bg-ink-800 border border-ink-700 text-ink-100 shadow-md font-body text-sm',
          title: 'text-ink-100 font-medium',
          description: 'text-ink-400 text-xs',
          actionButton: 'bg-laser text-white hover:bg-laser-hover',
          cancelButton: 'bg-ink-700 text-ink-300 hover:bg-ink-600',
          closeButton: 'border-ink-600 bg-ink-700 text-ink-400 hover:text-ink-100',
        },
      }}
    />
  );
}
