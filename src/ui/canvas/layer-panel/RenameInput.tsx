/**
 * RenameInput.tsx — input inline pra renomear camada (Onda 7).
 *
 * Aparece em modo de edição quando o usuário clica no ícone ✏️ ou
 * dá duplo-clique no nome. Enter salva, Esc cancela, blur salva.
 * String vazia é tratada como cancel (não chama onSave).
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface Props {
  initialValue: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

export function RenameInput({ initialValue, onSave, onCancel }: Props): React.ReactElement {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Foca + seleciona o texto inteiro no mount — UX padrão pra rename.
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  function commit(): void {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKey}
      onBlur={commit}
      className="min-w-0 flex-1 rounded-sm border border-ink-600 bg-ink-950 px-1 py-0.5 font-mono text-[11px] text-ink-100 outline-none focus:border-laser"
    />
  );
}
