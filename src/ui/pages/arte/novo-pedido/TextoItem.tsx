/**
 * TextoItem — campo de texto inline na sidebar (F5).
 *
 * Cada item representa um slot de texto criado no canvas.
 * Input ao vivo → fillTextSlot em tempo real.
 */
import { useEffect, useState, type RefObject } from 'react';
import { Trash2 } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { getAllFonts, type Font } from '@/data/repositories/fontRepository';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';

export interface TextoItemData {
  id: string;
  slotId: string;
  label: string;
}

interface Props {
  item: TextoItemData;
  engineRef: RefObject<CanvasEngine | null>;
  onRemove: (id: string) => void;
}

export function TextoItem({ item, engineRef, onRemove }: Props) {
  const [text, setText] = useState('');
  const [fonts, setFonts] = useState<Font[]>([]);
  const [fontFamily, setFontFamily] = useState('');

  useEffect(() => {
    getAllFonts()
      .then((list) => {
        setFonts(list);
        if (list.length > 0) setFontFamily(list[0].family);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !fontFamily) return;
    engine.fillTextSlot('nome', text, fontFamily);
  }, [text, fontFamily, engineRef]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {item.label}
        </span>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <input
        autoFocus
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Digite o texto..."
        className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
      />

      {fonts.length > 0 && (
        <Select value={fontFamily} onValueChange={setFontFamily}>
          <SelectTrigger className="h-7 font-mono text-[11px]">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            {fonts.map((f) => (
              <SelectItem key={f.id} value={f.family} className="font-mono text-[11px]">
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
