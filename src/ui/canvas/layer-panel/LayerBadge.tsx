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

/**
 * Onda 37 Fix-3 — pill compacto pra mostrar patternRole no LayerRow.
 * Quando `hasIssue=true`, sobrescreve com vermelho danger pra sinalizar
 * problema (lido de validatePattern por layer). Paleta aprovada por
 * Gabriell: discreta, ind/industrial.
 */
const PATTERN_ROLE_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  PRODUCT: { bg: 'bg-ink-700', text: 'text-ink-100', label: 'PROD' },
  APPLIQUE: { bg: 'bg-amber-700/70', text: 'text-amber-50', label: 'APL' },
  CONTOUR: { bg: 'bg-ink-600', text: 'text-ink-100', label: 'CTR' },
  TEXT_AREA: { bg: 'bg-violet-700/70', text: 'text-violet-50', label: 'TXT' },
  LOGO_AREA: { bg: 'bg-fuchsia-700/70', text: 'text-fuchsia-50', label: 'LGO' },
};

const ISSUE_OVERRIDE = { bg: 'bg-danger/70', text: 'text-white' };

interface PatternRoleBadgeProps {
  role: string;
  /** true => override vermelho. Caller computa via validatePattern por layer. */
  hasIssue?: boolean;
  /** Tooltip — caller passa mensagem da issue quando hasIssue=true. */
  title?: string;
}

export function PatternRoleBadge({ role, hasIssue, title }: PatternRoleBadgeProps) {
  const cfg = PATTERN_ROLE_COLOR[role];
  if (!cfg) return null;
  const bg = hasIssue ? ISSUE_OVERRIDE.bg : cfg.bg;
  const text = hasIssue ? ISSUE_OVERRIDE.text : cfg.text;
  return (
    <span
      className={`rounded px-1 py-0 font-mono text-[8px] font-medium tracking-wider ${bg} ${text}`}
      title={title ?? role}
    >
      {cfg.label}
    </span>
  );
}
