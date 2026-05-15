/**
 * BancoPage — Banco de Dados (Onda 12).
 *
 * Stub Fase 1: estrutura vazia.
 * Fase 10 vai construir 4 abas: Produtos / Apliques / Gravações / Logos
 * com 1 nível de subpasta + cadastro manual.
 */
import AppLayout from '@/ui/layout/AppLayout';

export default function BancoPage() {
  return (
    <AppLayout breadcrumb={[{ label: 'Banco de Dados' }]}>
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="font-display text-xl font-medium tracking-wider text-foreground">
          Banco de Dados
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          Produtos · Apliques · Gravações · Logos — em breve (Fase 10)
        </p>
      </div>
    </AppLayout>
  );
}
