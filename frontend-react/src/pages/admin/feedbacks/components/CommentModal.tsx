import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CommentModalProps {
  open: boolean
  onClose: () => void
  usuario: string
  comentario: string
}

export function CommentModal({ open, onClose, usuario, comentario }: CommentModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comentário do Feedback</DialogTitle>
          <DialogDescription>{usuario}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          <p className="text-gray-700 whitespace-pre-wrap">{comentario}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
