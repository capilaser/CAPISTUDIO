/**
 * TextoItem — campo de texto inline na sidebar (Onda 14).
 *
 * Cada item representa um slot de texto no canvas. O slotType determina em
 * qual slot do canvas o texto será renderizado (nome/profissao/custom).
 * `fillTextSlot` do engine preenche o primeiro slot do tipo informado.
 *
 * Input ao vivo → fillTextSlot em tempo real (com guard contra texto vazio
 * pra evitar limpar slot de TextoItem irmão).
 */
import { useEffect, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { getAllFonts, type Font } from '@/data/repositories/fontRepository';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';

/** Passo do ajuste manual de fonte em pt. fitText usa 0.5, mantemos consistente. */
const FONT_DELTA_STEP_PT = 0.5;
/** Faixa do ajuste manual relativo ao fitText (pt). */
const FONT_DELTA_MIN_PT = -8;
const FONT_DELTA_MAX_PT = 24;

/**
 * Tipos de slot que podem aparecer na sidebar.
 * - nome/profissao/custom: texto → TextoItem
 * - logo: upload SVG → LogoSlotPlaceholder
 */
export type TextoItemSlotType = 'nome' | 'profissao' | 'custom' | 'logo';

export interface TextoItemData {
  id: string;
  slotId: string;
  /** Tipo do slot no canvas que este item representa. Default 'nome'. */
  slotType?: TextoItemSlotType;
  label: string;
}

interface Props {
  item: TextoItemData;
  engineRef: RefObject<CanvasEngine | null>;
  onRemove: (id: string) => void;
  /**
   * Onda 14 — incrementa quando um padrão novo é aplicado no broche ativo.
   * O useEffect que preenche o slot depende disso, então re-roda e
   * preserva o texto no slot do novo padrão (que está vazio).
   */
  slotVersion?: number;
  /** Se true, autoFocus no input — só o primeiro TextoItem foca. */
  autoFocus?: boolean;
}

export function TextoItem({
  item,
  engineRef,
  onRemove,
  slotVersion = 0,
  autoFocus = false,
}: Props) {
  // TextoItem só faz sentido pra texto. Slot logo é tratado fora (LogoSlotPlaceholder).
  // Se o caller mandou um item de logo, tratamos como 'custom' silenciosamente.
  const rawSlotType: TextoItemSlotType = item.slotType ?? 'nome';
  const slotType: 'nome' | 'profissao' = rawSlotType === 'profissao' ? 'profissao' : 'nome';
  const [text, setText] = useState('');
  const [fonts, setFonts] = useState<Font[]>([]);
  const [fontFamily, setFontFamily] = useState('');
  /** Delta manual aplicado sobre o fitText (pt). 0 = auto. */
  const [fontSizeDelta, setFontSizeDelta] = useState(0);

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
    // Texto vazio NÃO chama fillTextSlot — caso contrário um TextoItem vazio
    // limparia o slot de outro TextoItem do MESMO tipo com texto preenchido.
    if (text.length === 0) return;
    engine.fillTextSlot(slotType, text, fontFamily, fontSizeDelta);
    // slotVersion é dependência implícita: quando muda, re-roda mesmo se
    // text/fontFamily forem os mesmos (preserva texto após troca de padrão).
  }, [text, fontFamily, fontSizeDelta, engineRef, slotVersion, slotType]);

  function adjustFont(direction: -1 | 1) {
    setFontSizeDelta((prev) => {
      const next = prev + direction * FONT_DELTA_STEP_PT;
      return Math.max(FONT_DELTA_MIN_PT, Math.min(FONT_DELTA_MAX_PT, next));
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
        autoFocus={autoFocus}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Digite o texto..."
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
      />

      {fonts.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Select value={fontFamily} onValueChange={setFontFamily}>
            <SelectTrigger className="h-7 flex-1 text-[11px]">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((f) => (
                <SelectItem key={f.id} value={f.family} className="text-[11px]">
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded border border-border bg-background">
            <button
              type="button"
              onClick={() => adjustFont(-1)}
              disabled={fontSizeDelta <= FONT_DELTA_MIN_PT}
              className="flex h-7 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              title="Diminuir tamanho da fonte"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setFontSizeDelta(0)}
              className="min-w-[36px] font-mono text-[10px] tabular-nums text-muted-foreground hover:text-foreground"
              title={fontSizeDelta === 0 ? 'Tamanho automático (fitText)' : 'Clique para resetar'}
            >
              {fontSizeDelta === 0
                ? 'auto'
                : `${fontSizeDelta > 0 ? '+' : ''}${fontSizeDelta.toFixed(1)}`}
            </button>
            <button
              type="button"
              onClick={() => adjustFont(1)}
              disabled={fontSizeDelta >= FONT_DELTA_MAX_PT}
              className="flex h-7 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              title="Aumentar tamanho da fonte"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
