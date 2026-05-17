/**
 * LogoSlotItem — campo de upload de logo na sidebar (Onda 14).
 *
 * 2 estados:
 *  - Vazio: botão "Escolher logo" → file picker (.svg)
 *  - Preenchido: preview inline + nome + trocar/remover
 *
 * Fluxo de upload:
 *  1. file picker (input type=file accept=.svg)
 *  2. lê conteúdo como texto
 *  3. saveLogoFile(uuid, content) → grava em disco, retorna path
 *  4. logoRepository.create(...) → registra no banco
 *  5. engine.fillLogoSlot(content) → aplica no slot logo do canvas
 *  6. atualiza estado local pra mostrar preview
 *
 * Persistência: re-mount após reabertura é coberto pelo snapshot do canvas
 * (logo já está no canvasJson). O state local só serve pra mostrar preview
 * na sidebar — re-popular ao reabrir fica pra próxima iteração.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import {
  create as createLogo,
  getById as getLogoById,
  touch,
} from '@/data/repositories/logoRepository';
import { readLogoFile, saveLogoFile } from '@/services/logo-storage';
import { Button } from '@/ui/components/button';

interface Props {
  label: string;
  /** id do TextoItemData pra remover via callback do pai. */
  itemId: string;
  engineRef: RefObject<CanvasEngine | null>;
  onRemove: (id: string) => void;
  /**
   * Onda 14 — incrementa quando pattern é aplicado. O useEffect que aplica
   * o logo no slot novo depende disso, re-roda e preserva o logo.
   */
  slotVersion?: number;
}

export function LogoSlotItem({ label, itemId, engineRef, onRemove, slotVersion = 0 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Conteúdo SVG do logo em memória — usado pra preview e re-aplicar após troca de pattern. */
  const [logoSvg, setLogoSvg] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string>('');
  const [logoId, setLogoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Onda 14 — re-aplica logo ao trocar de pattern.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !logoSvg) return;
    void engine.fillLogoSlot(logoSvg, logoId ?? undefined);
  }, [logoSvg, logoId, engineRef, slotVersion]);

  // Onda 14b — re-popular logo ao reabrir: o slot do canvas pode ter logoId
  // herdado do snapshot. Se o LogoSlotItem ainda não tem logoSvg, busca o
  // arquivo no banco/disco e popula preview + state.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (logoSvg) return; // já tem logo carregado
    const logoSlots = engine.getSlotsByType('logo');
    const slotMeta = logoSlots[0];
    const slotLogoId = slotMeta?.logoId;
    if (!slotLogoId) return;
    let cancelled = false;
    void (async () => {
      try {
        const logo = await getLogoById(slotLogoId);
        if (!logo || cancelled) return;
        const content = await readLogoFile(logo.filePath);
        if (cancelled) return;
        setLogoSvg(content);
        setLogoName(logo.name);
        setLogoId(logo.id);
      } catch (err) {
        console.warn('[LogoSlotItem] falha re-popular logo do banco:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engineRef, slotVersion, logoSvg]);

  function handlePickFile() {
    inputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg')) {
      toast.error('Apenas arquivos SVG são aceitos.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const content = await file.text();
      const id = crypto.randomUUID();
      const filePath = await saveLogoFile(id, content);

      await createLogo({
        id,
        name: file.name.replace(/\.svg$/i, ''),
        filePath,
        format: 'SVG',
      });
      await touch(id);

      // Aplica no canvas via engine — passa logoId pro slot persistir.
      const engine = engineRef.current;
      if (engine) {
        await engine.fillLogoSlot(content, id);
      }

      setLogoSvg(content);
      setLogoName(file.name.replace(/\.svg$/i, ''));
      setLogoId(id);
      toast.success(`Logo "${file.name}" enviada`);
    } catch (err) {
      console.error('[LogoSlotItem] upload error:', err);
      toast.error(`Erro ao enviar logo: ${String(err)}`);
    } finally {
      setUploading(false);
      // Reset do input pra permitir escolher o mesmo arquivo de novo.
      e.target.value = '';
    }
  }

  function handleClearLogo() {
    const engine = engineRef.current;
    if (engine) {
      engine.clearSlotContent('logo');
    }
    setLogoSvg(null);
    setLogoName('');
    setLogoId(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => onRemove(itemId)}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          title="Remover campo"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {logoSvg ? (
        <div className="flex flex-col gap-1.5">
          <div
            className="flex h-16 w-full items-center justify-center rounded border border-border bg-card"
            dangerouslySetInnerHTML={{ __html: logoSvg }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="line-clamp-1 font-mono text-[10px] text-muted-foreground">
              {logoName}
            </span>
            <button
              type="button"
              onClick={handleClearLogo}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
            >
              trocar
            </button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handlePickFile}
          disabled={uploading}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {uploading ? 'Enviando...' : 'Escolher logo (SVG)'}
        </Button>
      )}

      <input ref={inputRef} type="file" accept=".svg" className="hidden" onChange={handleFile} />
    </div>
  );
}
