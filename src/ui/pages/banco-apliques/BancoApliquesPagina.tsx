import { useEffect, useState } from 'react';
import { Plus, Shapes } from 'lucide-react';

import { list, softDelete, update, type Applique } from '@/data/repositories/appliqueRepository';
import { deleteAppliqueFile } from '@/services/applique-storage';
import { Button } from '@/ui/components/button';
import { EmptyState } from '@/ui/components/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/ui/components/tabs';
import AppLayout from '@/ui/layout/AppLayout';

import { ApliqueCard } from './ApliqueCard';
import { DeleteApliqueDialog } from './DeleteApliqueDialog';
import { RenameApliqueDialog } from './RenameApliqueDialog';
import { UploadApliqueDialog } from './UploadApliqueDialog';

export default function BancoApliquesPagina() {
  const [apliques, setApliques] = useState<Applique[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Applique | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Applique | null>(null);

  async function reload() {
    const rows = await list();
    setApliques(rows);
  }

  useEffect(() => {
    list().then((rows) => setApliques(rows));
  }, []);

  async function handleRename(newName: string) {
    if (!renameTarget) return;
    await update(renameTarget.id, { name: newName });
    setRenameTarget(null);
    await reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.filePath && !deleteTarget.filePath.startsWith('resource://')) {
      await deleteAppliqueFile(deleteTarget.filePath).catch((e) =>
        console.warn('[BancoApliquesPagina] file delete failed (continuing):', e)
      );
    }
    await softDelete(deleteTarget.id);
    setDeleteTarget(null);
    await reload();
  }

  return (
    <AppLayout
      breadcrumb={[
        { label: 'Início', href: '/' },
        { label: 'Banco de Ativos' },
        { label: 'Apliques' },
      ]}
    >
      <div className="p-6">
        {/* Tab strip — Onda 25 Fase D: shadcn Tabs no lugar de buttons manuais. */}
        <div className="mb-6 flex items-center justify-between">
          <Tabs defaultValue="apliques">
            <TabsList>
              <TabsTrigger value="apliques">Apliques</TabsTrigger>
              <TabsTrigger value="gravacoes" disabled>
                Gravações
              </TabsTrigger>
              <TabsTrigger value="marcacoes" disabled>
                Marcações
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
            <Plus size={14} />
            Adicionar aplique
          </Button>
        </div>

        {/* Grid */}
        {apliques.length === 0 ? (
          <EmptyState
            icon={Shapes}
            title="Nenhum aplique cadastrado"
            description='Adicione apliques SVG pelo botão "Adicionar aplique" acima. Apliques ficam disponíveis em todos os pedidos.'
          />
        ) : (
          <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-3 max-lg:grid-cols-2">
            {apliques.map((ap) => (
              <ApliqueCard
                key={ap.id}
                applique={ap}
                onRename={() => setRenameTarget(ap)}
                onDelete={() => setDeleteTarget(ap)}
              />
            ))}
          </div>
        )}
      </div>

      <UploadApliqueDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSaved={async () => {
          setUploadOpen(false);
          await reload();
        }}
      />

      <RenameApliqueDialog
        key={renameTarget?.id ?? 'closed'}
        open={renameTarget !== null}
        currentName={renameTarget?.name ?? ''}
        onConfirm={handleRename}
        onClose={() => setRenameTarget(null)}
      />

      <DeleteApliqueDialog
        open={deleteTarget !== null}
        appliqueName={deleteTarget?.name ?? ''}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </AppLayout>
  );
}
