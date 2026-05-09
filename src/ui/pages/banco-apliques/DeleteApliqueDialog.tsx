import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';

interface Props {
  open: boolean;
  appliqueName: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteApliqueDialog({ open, appliqueName, onConfirm, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-ink-700 bg-ink-900 text-ink-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-medium text-ink-100">
            Remover aplique
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-ink-300">
          Remover <span className="font-medium text-ink-100">"{appliqueName}"</span> do banco?
          <br />
          <span className="text-xs text-ink-500">Esta ação não pode ser desfeita.</span>
        </p>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-100"
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm} className="bg-danger text-white hover:bg-danger/90">
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
