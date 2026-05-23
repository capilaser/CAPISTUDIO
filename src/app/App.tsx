/**
 * Tela transitória durante o reinício inteligente do V2.
 *
 * Onda 2A — Faxina cirúrgica: toda a UI antiga foi removida (padroes/,
 * novo-pedido/, dev/, banco/, banco-apliques/, inicial/, ArteHubPage).
 * O canvas-engine, exporters e snap/alignment ficam preservados em src/core/
 * para serem reaproveitados nas Ondas 2D, 3 e 4.
 *
 * Esta tela some quando a Onda 2C (tela inicial nova) for entregue.
 */
export default function App() {
  return (
    <main className="flex h-full min-h-screen flex-col items-center justify-center gap-3 bg-ink-950 px-6 text-center font-mono text-ink-300">
      <h1 className="text-lg font-semibold text-ink-100">Capi Studio</h1>
      <p className="text-sm text-ink-400">Em reconstrução — Onda 2A</p>
      <p className="max-w-md text-xs text-ink-500">
        Sistema sendo reescrito a partir do{' '}
        <code className="rounded bg-ink-900 px-1.5 py-0.5 text-laser">PROJECT_VISION.md</code>.
        Próxima entrega: tela inicial + editor de projeto (Onda 2C/2D).
      </p>
    </main>
  );
}
