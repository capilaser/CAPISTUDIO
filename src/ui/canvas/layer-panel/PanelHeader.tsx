/**
 * PanelHeader — Onda 26.
 *
 * Cabeçalho do painel de camadas: label "CAMADAS" + contadores.
 * Formato: "CAMADAS · 3 itens · 1 sel" — densidade Photoshop/DAW.
 */
interface Props {
  total: number;
  selected: number;
}

export function PanelHeader({ total, selected }: Props): React.ReactElement {
  return (
    <header className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-ink-400">Camadas</span>
      <span className="font-mono text-[10px] tabular-nums text-ink-500">
        {total}
        {selected > 0 && (
          <>
            <span className="mx-1 text-ink-700">·</span>
            <span className="text-ink-300">{selected} sel</span>
          </>
        )}
      </span>
    </header>
  );
}
