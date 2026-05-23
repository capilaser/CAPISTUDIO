import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { createProject } from '@/data/repositories/projectFsRepository';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (folderPath: string) => void;
}

/**
 * MVP: só broche 60×25mm. Quando outros produtos chegarem (DXF upload),
 * o select cresce.
 */
const PRODUCT_BROCHE_60_25 = {
  id: 'broche-60x25',
  label: 'Broche 60 × 25 mm',
  widthMm: 60,
  heightMm: 25,
  viewBox: '0 0 60 25',
};

export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      // Reseta estado quando o diálogo abre.
      // setStates aqui são intencionais — disparados por transição de open
      // (não em todo render), análogo a um event handler.
      setName('');
      setCreating(false);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    if (!open) {
      wasOpenRef.current = false;
    }
    return undefined;
  }, [open]);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (creating) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Digite um nome para o projeto.');
      return;
    }
    setCreating(true);
    try {
      const { folderPath } = await createProject({
        name: trimmed,
        productId: PRODUCT_BROCHE_60_25.id,
        widthMm: PRODUCT_BROCHE_60_25.widthMm,
        heightMm: PRODUCT_BROCHE_60_25.heightMm,
        viewBox: PRODUCT_BROCHE_60_25.viewBox,
      });
      toast.success(`Projeto "${trimmed}" criado.`);
      onCreated(folderPath);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao criar projeto: ${msg}`);
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              O projeto vira uma pasta com a estrutura completa. O nome também é o nome da pasta.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Nome do projeto</Label>
              <Input
                id="project-name"
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: broche-natanepaes"
                maxLength={100}
                disabled={creating}
                autoComplete="off"
              />
              <p className="text-[11px] text-ink-500">
                Sem barras, dois-pontos, asteriscos ou aspas. Pode usar acentos e espaços.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Produto base</Label>
              <div className="rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-ink-200">
                {PRODUCT_BROCHE_60_25.label}
              </div>
              <p className="text-[11px] text-ink-500">
                MVP só com broche 60×25 mm. Outros produtos chegam no futuro via upload de DXF.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? 'Criando…' : 'Criar projeto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
