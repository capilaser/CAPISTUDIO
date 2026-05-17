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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remover aplique</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">
          Remover <span className="font-medium">"{appliqueName}"</span> do banco?
          <br />
          <span className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</span>
        </p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
