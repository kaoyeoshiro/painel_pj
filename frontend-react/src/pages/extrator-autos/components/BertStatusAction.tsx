/**
 * Botao de status BERT para a barra de breadcrumb do Extrator de Autos.
 *
 * Exibe indicador visual (verde/vermelho) e abre dialog com detalhes
 * de configuracao do classificador BERT.
 */

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { C } from '@/lib/designTokens'
import type { BertStatus } from '@/types/extrator-autos'

// ============================================================================
// Props
// ============================================================================

interface BertStatusActionProps {
  bertStatus: BertStatus | undefined
}

// ============================================================================
// Componente
// ============================================================================

export function BertStatusAction({ bertStatus }: BertStatusActionProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
          style={{ color: C.text500, fontSize: 13 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          data-testid="bert-status"
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: bertStatus?.available ? C.statusSuccess : C.statusError }}
          />
          BERT {bertStatus?.available ? 'Online' : 'Offline'}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status do BERT</DialogTitle>
          <DialogDescription>Configuracao do classificador BERT</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: C.text400 }}>Disponivel:</span>
            <Badge
              style={bertStatus?.available
                ? { background: C.successBgStrong, color: C.statusSuccess, border: 'none' }
                : { background: C.errorBg, color: C.statusError, border: 'none' }
              }
            >
              {bertStatus?.available ? 'Sim' : 'Nao'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span style={{ color: C.text400 }}>Modo:</span>
            <span style={{ color: C.text700 }}>{bertStatus?.mode ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: C.text400 }}>Endpoint:</span>
            <span className="max-w-[200px] truncate" style={{ color: C.text700 }}>
              {bertStatus?.endpoint ?? '-'}
            </span>
          </div>
          {bertStatus?.error && (
            <div
              className="mt-2 rounded p-2 text-xs"
              style={{ background: C.errorBg, color: C.statusError }}
            >
              {bertStatus.error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
