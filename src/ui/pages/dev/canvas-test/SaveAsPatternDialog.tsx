/**
 * SaveAsPatternDialog — Onda 8, Checkpoint C
 *
 * Modal shadcn para salvar o canvas atual como novo padrão com nome definido pelo usuário.
 * Insere registro novo (UUID gerado aqui) — não faz upsert do DEV_TEST_PATTERN_ID.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { insertPattern } from '@/data/repositories/patternRepository';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

interface SaveAsPatternDialogProps {
  open: boolean;
  productId: string;
  /** Called when user clicks Save — returns current canvas JSON string. */
  getCanvasJson: () => string;
  onClose: () => void;
  onSaved: (id: string, name: string) => void;
}

export function SaveAsPatternDialog({
  open,
  productId,
  getCanvasJson,
  onClose,
  onSaved,
}: SaveAsPatternDialogProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  function handleClose() {
    if (saving) return;
    setName('');
    onClose();
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      await insertPattern(id, productId, trimmed, getCanvasJson());
      toast.success(`Padrão "${trimmed}" salvo`);
      setName('');
      onSaved(id, trimmed);
    } catch (err) {
      console.error('[SaveAsPatternDialog] insertPattern error:', err);
      toast.error('Erro ao salvar padrão');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="border-ink-700 bg-ink-900 text-ink-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-medium text-ink-100">
            Salvar como novo padrão
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pattern-name" className="text-xs text-ink-400">
              Nome do padrão
            </Label>
            <Input
              id="pattern-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
              placeholder="Ex: Placa Advogado"
              className="border-ink-700 bg-ink-800 text-ink-100 focus-visible:ring-laser-muted"
              autoFocus
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={saving}
            className="text-ink-400 hover:text-ink-100"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={!name.trim() || saving}
            className="bg-ink-700 text-ink-100 hover:bg-ink-600"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
