import { Database, FolderOpen, History, Layers } from 'lucide-react';

import AppLayout from '@/ui/layout/AppLayout';

import { HomeCard } from './HomeCard';

const CARDS = [
  {
    icon: Layers,
    title: 'Novo Padrão',
    description: 'Criar layout a partir do canvas',
    wave: 'Onda 3 (Canvas)',
  },
  {
    icon: FolderOpen,
    title: 'Abrir Padrão',
    description: 'Carregar e editar padrão existente',
    wave: 'Onda 10 (Telas restantes)',
  },
  {
    icon: History,
    title: 'Histórico de Artes',
    description: 'Acessar pedidos e artes anteriores',
    wave: 'Onda 10',
  },
  {
    icon: Database,
    title: 'Banco de Ativos',
    description: 'Gerenciar fontes, materiais e SVGs',
    wave: 'Onda 10',
  },
] as const;

export default function Home() {
  return (
    <AppLayout>
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          {CARDS.map((card) => (
            <HomeCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
