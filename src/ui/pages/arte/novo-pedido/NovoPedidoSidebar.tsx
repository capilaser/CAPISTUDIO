/**
 * NovoPedidoSidebar — sidebar esquerda do editor (Onda 12 F4.1).
 *
 * Estrutura: seções colapsáveis (<details>/<summary> nativo, sem libs novas).
 *  - Pedido (aberta por default)
 *  - Produto (aberta por default)
 *  - Cor / Material (aberta por default; selects vazios até F4.2)
 *  - Campos (fechada; Fase 5 vai povoar com Nome/Profissão/Logo)
 *
 * F4.1: estrutura visual só. Selects ficam vazios.
 * F4.2: liga selects ao banco (productRepository + materialRepository).
 * F4.3: emite eventos pra página orquestrar engine.
 */
import { ChevronRight } from 'lucide-react';

import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  return (
    <details open={defaultOpen} className="group border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground">
        <span>{title}</span>
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}

export function NovoPedidoSidebar() {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      <Section title="Pedido" defaultOpen>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="pedido-nome"
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            Nome do pedido
          </Label>
          <Input
            id="pedido-nome"
            type="text"
            placeholder="Ex: João Silva"
            disabled
            className="h-8 text-xs"
          />
          <p className="font-mono text-[10px] text-muted-foreground/70">F4.2 conecta o input.</p>
        </div>
      </Section>

      <Section title="Produto" defaultOpen>
        <p className="font-mono text-[11px] text-muted-foreground">
          Select com produtos — F4.2 conecta.
        </p>
      </Section>

      <Section title="Cor / Material" defaultOpen>
        <p className="font-mono text-[11px] text-muted-foreground">
          Select com cores compatíveis — F4.2 conecta.
        </p>
      </Section>

      <Section title="Campos do cliente" defaultOpen={false}>
        <p className="font-mono text-[11px] text-muted-foreground">
          Nome / Profissão / Logo — Fase 5 vai povoar.
        </p>
      </Section>
    </aside>
  );
}
