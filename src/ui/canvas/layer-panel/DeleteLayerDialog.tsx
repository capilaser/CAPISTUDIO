/**
 * DeleteLayerDialog.tsx — confirmação de delete (Onda 7).
 *
 * Usa shadcn Dialog (não AlertDialog — esse não foi adicionado ao projeto
 * ainda; Dialog tradicional cumpre o papel com o mesmo padrão usado em
 * SaveAsPatternDialog).
 *
 * Modo cascade: quando a camada deletada é um aplique principal, listamos
 * os filhos que vão junto na cascata pro usuário ter ciência clara.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Button } from '@/ui/components/button';

interface Props {
  open: boolean;
  layerName: string;
  cascadeChildren: string[]; // nomes dos filhos que vão junto
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteLayerDialog({
  open,
  layerName,
  cascadeChildren,
  onConfirm,
  onCancel,
}: Props): React.ReactElement {
  const hasCascade = cascadeChildren.length > 0;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Excluir &ldquo;{layerName}&rdquo;?</DialogTitle>
          <DialogDescription className="text-[11px]">
            {hasCascade ? (
              <>
                Esta ação também vai excluir <strong>{cascadeChildren.length}</strong>{' '}
                {cascadeChildren.length === 1 ? 'slot filho' : 'slots filhos'}:
              </>
            ) : (
              'Esta ação não pode ser desfeita.'
            )}
          </DialogDescription>
        </DialogHeader>

        {hasCascade && (
          <ul className="my-2 max-h-32 overflow-y-auto rounded border border-ink-700 bg-ink-950 px-3 py-2 text-[11px] text-ink-300">
            {cascadeChildren.map((name, i) => (
              <li key={`${name}-${i}`} className="py-0.5">
                • {name}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-[11px]">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            className="text-[11px]"
            data-testid="confirm-delete-layer"
          >
            {hasCascade ? 'Excluir tudo' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
