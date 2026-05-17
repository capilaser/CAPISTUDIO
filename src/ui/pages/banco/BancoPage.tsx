/**
 * BancoPage — Banco de Dados (Onda 12).
 *
 * Stub Fase 1: estrutura vazia.
 * Fase 10 vai construir 4 abas: Produtos / Apliques / Gravações / Logos
 * com 1 nível de subpasta + cadastro manual.
 *
 * Onda 19.D — empty state desenhado enquanto a UI completa não chega.
 */
import { Image } from 'lucide-react';

import AppLayout from '@/ui/layout/AppLayout';
import { EmptyState } from '@/ui/components/empty-state';

export default function BancoPage() {
  return (
    <AppLayout breadcrumb={[{ label: 'Banco de Dados' }]}>
      <div className="flex h-full flex-col items-center justify-center p-8">
        <EmptyState
          icon={Image}
          title="Banco de logos vazio"
          description="Logos enviadas em pedidos aparecem aqui automaticamente. Apliques, gravações e marcações ganham UI dedicada em breve."
        />
      </div>
    </AppLayout>
  );
}
