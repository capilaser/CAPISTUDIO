import { useRef, useState } from 'react';

import { humanizeError, type SvgErrorMessage } from '@/core/canvas/corel-svg-errors';
import { parseCorelSvg, type CorelSvgMeta } from '@/core/canvas/corel-svg-parser';
import { create as createApplique } from '@/data/repositories/appliqueRepository';
import { saveAppliqueFile } from '@/services/applique-storage';
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

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'pick' | 'name';

export function UploadApliqueDialog({ open, onClose, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState<SvgErrorMessage | null>(null);
  const [meta, setMeta] = useState<CorelSvgMeta | null>(null);
  const [rawSvg, setRawSvg] = useState<string>('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setStep('pick');
    setError(null);
    setMeta(null);
    setRawSvg('');
    setName('');
    setSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const content = await file.text();

    try {
      const parsed = parseCorelSvg(content);
      setMeta(parsed);
      setRawSvg(content);
      setName(file.name.replace(/\.svg$/i, ''));
      setStep('name');
    } catch (err) {
      setError(humanizeError(err));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!meta || !name.trim()) return;

    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const absolutePath = await saveAppliqueFile(id, rawSvg);
      // Onda 9: operation/machines obrigatórios no contrato do repository.
      // UI de escolha será adicionada na Onda 10 (cadastro com formulário
      // completo). Por ora aplicamos o default consistente com o backfill
      // (corte + fiber-laser) — o usuário poderá editar depois.
      await createApplique({
        id,
        name: name.trim(),
        filePath: absolutePath,
        widthMm: meta.widthMm,
        heightMm: meta.heightMm,
        operation: 'corte',
        machines: ['fiber-laser'],
      });
      reset();
      onSaved();
    } catch (err) {
      setError({ title: 'Erro ao salvar aplique', description: String(err) });
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar aplique</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker — always visible */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Arquivo SVG</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              onChange={handleFileChange}
              className="block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:text-foreground hover:border-primary/40"
            />
          </div>

          {/* Error message — Onda 23: título destacado + descrição opcional. */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-medium text-destructive">{error.title}</p>
              {error.description && (
                <p className="mt-1 text-[11px] text-destructive/80">{error.description}</p>
              )}
            </div>
          )}

          {/* Step 2: dimensions preview + name input */}
          {step === 'name' && meta && (
            <>
              <div className="rounded-md border border-border bg-background px-3 py-2">
                <span className="text-xs text-muted-foreground">Dimensões detectadas: </span>
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {meta.widthMm.toFixed(1)} × {meta.heightMm.toFixed(1)} mm
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="applique-name" className="text-xs text-muted-foreground">
                  Nome
                </Label>
                <Input
                  id="applique-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Aplique Formato D"
                  autoFocus
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          {step === 'name' && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
