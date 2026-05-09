import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

import { list, softDelete, update, type Applique } from '@/data/repositories/appliqueRepository';
import { deleteAppliqueFile } from '@/services/applique-storage';
import { Button } from '@/ui/components/button';
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
    // Remove file from disk if it's a user-uploaded absolute path (not a bundled resource)
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
        {/* Tab strip — extensible for Onda 6.6 (Gravações, Marcações) */}
        <div className="mb-6 flex items-center justify-between border-b border-ink-800 pb-4">
          <div className="flex gap-1">
            <button className="rounded-sm px-3 py-1.5 font-display text-xs font-medium text-ink-100 underline underline-offset-4 decoration-laser">
              Apliques
            </button>
            <button
              disabled
              className="rounded-sm px-3 py-1.5 font-display text-xs text-ink-600 cursor-not-allowed"
              title="Disponível na Onda 6.6"
            >
              Gravações
            </button>
            <button
              disabled
              className="rounded-sm px-3 py-1.5 font-display text-xs text-ink-600 cursor-not-allowed"
              title="Disponível na Onda 6.6"
            >
              Marcações
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5 bg-ink-700 text-ink-100 hover:bg-ink-600"
          >
            <Plus size={14} />
            Adicionar aplique
          </Button>
        </div>

        {/* Grid */}
        {apliques.length === 0 ? (
          <p className="text-center font-body text-sm text-ink-500">Nenhum aplique cadastrado.</p>
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
