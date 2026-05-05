import AppLayout from '@/ui/layout/AppLayout';

export default function Home() {
  return (
    <AppLayout>
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-8 text-center">
          <div className="flex items-baseline gap-3 font-display">
            <span className="text-5xl font-medium tracking-tight">CAPI STUDIO</span>
            <span className="tabular-nums text-xl text-laser-muted">v2</span>
          </div>
          <p className="max-w-md font-body text-sm text-ink-400">
            Production system for laser engraving and cutting.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
