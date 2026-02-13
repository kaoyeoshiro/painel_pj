import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { FeedbackStarsCard } from '@/components/shared/FeedbackStarsCard'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface FeedbackGateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFeedbackSubmit: (data: { nota: number; comentario: string | null }) => void
  isSubmitting: boolean
  pendingActionLabel?: string // e.g. "download" or "copiar"
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Modal que bloqueia uma acao (download, copiar) ate que o usuario avalie.
 *
 * - Nao ha botao de pular: a avaliacao e 100% obrigatoria.
 * - Apos envio bem-sucedido, exibe sucesso brevemente e fecha automaticamente,
 *   executando a acao pendente via callback onOpenChange(false).
 * - O modal nao pode ser fechado pelo overlay ou pelo botao X enquanto
 *   nao houver avaliacao — controlado via onInteractOutside/onEscapeKeyDown.
 */
export function FeedbackGateModal({
  open,
  onOpenChange,
  onFeedbackSubmit,
  isSubmitting,
  pendingActionLabel,
}: FeedbackGateModalProps) {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(data: { nota: number; comentario: string | null }) {
    onFeedbackSubmit(data)
    setSubmitted(true)

    // Fecha o modal apos breve exibicao do estado de sucesso
    setTimeout(() => {
      setSubmitted(false)
      onOpenChange(false)
    }, 1200)
  }

  const actionText = pendingActionLabel
    ? `Para ${pendingActionLabel}, avalie a geracao primeiro.`
    : 'Sua avaliacao ajuda a melhorar a qualidade do sistema.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Avalie antes de continuar</DialogTitle>
          <DialogDescription>{actionText}</DialogDescription>
        </DialogHeader>

        <FeedbackStarsCard
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isSubmitted={submitted}
          className="max-w-none border-0 bg-transparent px-0 py-0"
        />
      </DialogContent>
    </Dialog>
  )
}
