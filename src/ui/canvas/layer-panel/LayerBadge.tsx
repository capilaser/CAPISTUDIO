/**
 * LayerBadge — Onda 15.
 *
 * Pills compactos pro LayerRow:
 *   - Operação (corte/gravacao/marcacao/aplique...) com cor semântica
 *   - Máquinas (MB/FB/DL) em letras pequenas
 *   - Contagem de operations filhos pra principals
 *
 * Cores semânticas das operações:
 *   corte    = preto (linha de corte do contorno)
 *   gravacao = vermelho (laser de gravação)
 *   marcacao = azul (marcação leve / pré-furação)
 *
 * Fonte: ADR 016 (Onda 9, export por máquina+operação). Mapeamento é
 * hardcoded aqui pra evitar fetch a cada render do painel; se precisar
 * editar, faça-o no banco e atualize este mapa (defaultColor da tabela
 * operations).
 */

const OPERATION_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  corte: { bg: 'bg-neutral-900', text: 'text-neutral-100', label: 'COR' },
  gravacao: { bg: 'bg-red-700/80', text: 'text-red-50', label: 'GRV' },
  marcacao: { bg: 'bg-blue-700/80', text: 'text-blue-50', label: 'MRC' },
  aplique: { bg: 'bg-amber-700/70', text: 'text-amber-50', label: 'APL' },
};

const FALLBACK = { bg: 'bg-neutral-700/60', text: 'text-neutral-200', label: 'OP' };

interface OperationBadgeProps {
  operation: string;
  machines: string[];
}

export function OperationBadge({ operation, machines }: OperationBadgeProps) {
  const cfg = OPERATION_COLOR[operation.toLowerCase()] ?? FALLBACK;
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <span
        className={`rounded px-1 py-0 font-mono text-[8px] font-medium tracking-wider ${cfg.bg} ${cfg.text}`}
        title={operation}
      >
        {cfg.label}
      </span>
      {machines.length > 0 && (
        <span
          className="rounded border border-ink-700 px-1 py-0 font-mono text-[8px] tracking-wider text-ink-300"
          title={`Máquinas: ${machines.join(', ')}`}
        >
          {machines.map((m) => m.toUpperCase()).join('·')}
        </span>
      )}
    </span>
  );
}

interface ChildCountBadgeProps {
  operations: number;
}

export function ChildCountBadge({ operations }: ChildCountBadgeProps) {
  if (operations === 0) return null;
  return (
    <span
      className="rounded bg-ink-800 px-1 py-0 font-mono text-[8px] uppercase tracking-wider text-ink-400"
      title={`${operations} operação(ões)`}
    >
      {operations} op
    </span>
  );
}
