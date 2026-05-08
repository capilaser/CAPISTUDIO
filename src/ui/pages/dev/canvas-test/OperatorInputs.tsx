import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { useCanvasStore } from '@/stores/canvas-store';

interface OperatorInputsProps {
  engineRef: RefObject<CanvasEngine | null>;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsText(file);
  });
}

interface SlotField {
  type: 'nome' | 'profissao' | 'logo';
  label: string;
}

const FIELDS: SlotField[] = [
  { type: 'nome', label: 'Nome' },
  { type: 'profissao', label: 'Profissão' },
  { type: 'logo', label: 'Logo (SVG)' },
];

const FONT_FAMILIES = ['Montserrat', 'Playfair Display', 'Bebas Neue', 'Roboto Slab', 'Caveat'];

export function OperatorInputs({ engineRef }: OperatorInputsProps) {
  const selectedFontFamily = useCanvasStore((s) => s.selectedFontFamily);
  const setSelectedFontFamily = useCanvasStore((s) => s.setSelectedFontFamily);
  // selectedSlotId is used as a trigger to re-check which slot types exist
  // whenever a slot is created/selected (engine calls onSlotSelectionChange).
  const selectedSlotId = useCanvasStore((s) => s.selectedSlotId);

  const [nomeValue, setNomeValue] = useState('');
  const [profissaoValue, setProfissaoValue] = useState('');
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Track which slot types are currently present on the canvas as React state
  // so we avoid accessing the ref during render (react-hooks/refs).
  const [slotTypes, setSlotTypes] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const present = new Set<string>();
    for (const type of ['nome', 'profissao', 'logo'] as const) {
      if (engine.getSlotsByType(type).length > 0) present.add(type);
    }
    setSlotTypes(present);
  }, [selectedSlotId, engineRef]);

  function hasSlot(type: SlotField['type']): boolean {
    return slotTypes.has(type);
  }

  function handleFontChange(e: ChangeEvent<HTMLSelectElement>) {
    const family = e.target.value;
    setSelectedFontFamily(family);
    engineRef.current?.fillTextSlot('nome', nomeValue, family);
    engineRef.current?.fillTextSlot('profissao', profissaoValue, family);
  }

  function handleNomeChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setNomeValue(value);
    engineRef.current?.fillTextSlot('nome', value, selectedFontFamily);
  }

  function handleProfissaoChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setProfissaoValue(value);
    engineRef.current?.fillTextSlot('profissao', value, selectedFontFamily);
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.svg')) {
      toast.error('Apenas arquivos SVG são aceitos no momento.');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setLogoLoading(true);
    try {
      const svgString = await readFileAsText(file);
      await engineRef.current?.fillLogoSlot(svgString);
      toast.success('Logo carregada');
    } catch (err) {
      toast.error(`Arquivo SVG inválido: ${err instanceof Error ? err.message : String(err)}`);
      if (logoInputRef.current) logoInputRef.current.value = '';
    } finally {
      setLogoLoading(false);
    }
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-ink-700 bg-ink-900 p-4">
      <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-400">
        Modo Operador
      </p>

      {/* Nome */}
      <FieldBlock label="Nome" slotExists={hasSlot('nome')} slotType="nome">
        <input
          type="text"
          value={nomeValue}
          onChange={handleNomeChange}
          disabled={!hasSlot('nome')}
          placeholder="Nome do cliente"
          className={inputCls(!hasSlot('nome'))}
        />
      </FieldBlock>

      {/* Profissão */}
      <FieldBlock label="Profissão" slotExists={hasSlot('profissao')} slotType="profissao">
        <input
          type="text"
          value={profissaoValue}
          onChange={handleProfissaoChange}
          disabled={!hasSlot('profissao')}
          placeholder="Profissão"
          className={inputCls(!hasSlot('profissao'))}
        />
      </FieldBlock>

      {/* Fonte */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[11px] font-medium text-ink-300">Fonte</label>
        <select
          value={selectedFontFamily}
          onChange={handleFontChange}
          className="w-full rounded border border-ink-600 bg-ink-950 px-2 py-1.5 font-mono text-[11px] text-ink-200 outline-none transition-colors focus:border-laser focus:ring-1 focus:ring-laser/30"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Logo */}
      <FieldBlock label="Logo (SVG)" slotExists={hasSlot('logo')} slotType="logo">
        <label
          className={`flex cursor-pointer items-center justify-center rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            hasSlot('logo') && !logoLoading
              ? 'border-ink-600 text-ink-300 hover:border-laser hover:text-ink-100'
              : 'cursor-not-allowed border-ink-800 text-ink-600'
          }`}
        >
          <input
            ref={logoInputRef}
            type="file"
            accept=".svg"
            disabled={!hasSlot('logo') || logoLoading}
            onChange={(e) => void handleLogoChange(e)}
            className="sr-only"
          />
          {logoLoading ? 'Carregando…' : 'Escolher arquivo SVG'}
        </label>
      </FieldBlock>

      <div className="mt-auto border-t border-ink-800 pt-3 font-mono text-[10px] text-ink-600">
        fonte: {selectedFontFamily}
      </div>
    </aside>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldBlockProps {
  label: string;
  slotExists: boolean;
  slotType: SlotField['type'];
  children: React.ReactNode;
}

function FieldBlock({ label, slotExists, slotType, children }: FieldBlockProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] font-medium text-ink-300">{label}</label>
      {children}
      {!slotExists && (
        <p className="font-mono text-[10px] text-ink-500">
          Crie um slot de {FIELDS.find((f) => f.type === slotType)?.label.toLowerCase() ?? slotType}{' '}
          no Designer primeiro
        </p>
      )}
    </div>
  );
}

function inputCls(disabled: boolean): string {
  return [
    'w-full rounded border bg-ink-950 px-2 py-1.5 font-mono text-[11px] text-ink-200',
    'placeholder:text-ink-600 outline-none tabular-nums',
    'transition-colors',
    disabled
      ? 'cursor-not-allowed border-ink-800 text-ink-600'
      : 'border-ink-600 focus:border-laser focus:ring-1 focus:ring-laser/30',
  ]
    .filter(Boolean)
    .join(' ');
}
