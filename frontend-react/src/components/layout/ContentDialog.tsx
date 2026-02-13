import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { C } from '@/lib/designTokens'

interface ContentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  icon: React.ReactNode
  headerActions?: React.ReactNode
  documentContent: React.ReactNode
  chatPanel?: React.ReactNode
  feedbackSection?: React.ReactNode
}

/**
 * Dialog fullscreen split-view do PGE Design System.
 * Padrao obrigatorio para exibir conteudo gerado por IA.
 * Header navy, painel documento (esquerda) + chat (direita, opcional).
 */
export function ContentDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  headerActions,
  documentContent,
  chatPanel,
  feedbackSection,
}: ContentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="flex h-[90vh] max-w-7xl flex-col gap-0 p-0">
        {/* Header Navy */}
        <div
          className="flex items-center justify-between rounded-t-lg px-6 py-4"
          style={{ background: C.navy950 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: C.orange500 }}
            >
              {icon}
            </div>
            <DialogHeader className="space-y-0 p-0 text-left">
              <DialogTitle
                className="text-[17px] font-bold leading-tight text-white/95"
              >
                {title}
              </DialogTitle>
              {subtitle && (
                <DialogDescription className="text-[13px] text-white/50">
                  {subtitle}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              className="text-white/70 hover:bg-white/10 hover:text-white"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Conteudo Principal */}
        <div className="flex flex-1 overflow-hidden">
          {/* Painel de Visualizacao */}
          <div className="flex flex-1 flex-col border-r" style={{ background: C.gray50, borderColor: C.gray200 }}>
            <div
              className="flex items-center justify-between border-b bg-white px-4 py-2"
              style={{ borderColor: C.gray200 }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: C.text400 }}
              >
                Visualizacao
              </span>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div
                className="min-h-full rounded-xl border bg-white p-8 shadow-sm"
                style={{ borderColor: C.gray200 }}
              >
                {documentContent}
              </div>
              {feedbackSection && <div className="mt-6">{feedbackSection}</div>}
            </ScrollArea>
          </div>

          {/* Painel de Chat (opcional) */}
          {chatPanel}
        </div>
      </DialogContent>
    </Dialog>
  )
}
