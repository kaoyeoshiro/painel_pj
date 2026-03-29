/**
 * Dialog de formulário para rejeição de um item de revisão.
 * Permite selecionar a ação correta e informar o motivo da rejeição.
 */

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { C } from '@/lib/designTokens'
import { ACOES_REJEICAO } from '../../constants'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RejeicaoFormProps {
  open: boolean
  onClose: () => void
  onRejeitar: (motivo: string, acao: string) => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Dialog com formulário de rejeição.
 * Requer que o usuário selecione a ação correta e informe um motivo.
 */
export function RejeicaoForm({ open, onClose, onRejeitar }: RejeicaoFormProps) {
  const [acao, setAcao] = useState('')
  const [motivo, setMotivo] = useState('')

  const podeSalvar = acao !== '' && motivo.trim().length > 0

  const handleConfirmar = useCallback(() => {
    if (!podeSalvar) return
    onRejeitar(motivo.trim(), acao)
    // Limpa o formulário após confirmar
    setAcao('')
    setMotivo('')
    onClose()
  }, [acao, motivo, onRejeitar, onClose, podeSalvar])

  const handleClose = useCallback(() => {
    setAcao('')
    setMotivo('')
    onClose()
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeitar Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500">
            Informe o motivo da rejeição e a ação correta para este processo.
          </p>

          {/* Seleção de ação correta */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Ação correta <span style={{ color: C.statusError }}>*</span>
            </label>
            <Select value={acao} onValueChange={setAcao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a ação correta" />
              </SelectTrigger>
              <SelectContent>
                {ACOES_REJEICAO.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo / observação */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Motivo / Observação <span style={{ color: C.statusError }}>*</span>
            </label>
            <Textarea
              placeholder="Descreva o motivo da rejeição..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmar}
            disabled={!podeSalvar}
            style={
              podeSalvar
                ? { background: C.statusError, color: 'white' }
                : undefined
            }
          >
            Rejeitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
