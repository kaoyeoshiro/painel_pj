/**
 * Dialog para encaminhar um item de revisão a um assessor.
 * Carrega a lista de assessores ativos e permite selecionar o destinatário.
 */

import { useCallback, useEffect, useState } from 'react'
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
import { fetchAssessores } from '../../api'
import type { Assessor } from '../../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EncaminharDialogProps {
  open: boolean
  onClose: () => void
  onEncaminhar: (assessorId: number) => void
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Dialog de seleção de assessor para encaminhamento.
 * Busca a lista de assessores ativos ao abrir e permite confirmar o envio.
 */
export function EncaminharDialog({ open, onClose, onEncaminhar }: EncaminharDialogProps) {
  const [assessores, setAssessores] = useState<Assessor[]>([])
  const [assessorId, setAssessorId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Carrega assessores quando o dialog é aberto
  useEffect(() => {
    if (!open) return
    setAssessorId('')

    const loadAssessores = async () => {
      setLoading(true)
      try {
        const lista = await fetchAssessores()
        setAssessores(lista.filter((a) => a.ativo))
      } catch (err) {
        console.error('Erro ao carregar assessores:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadAssessores()
  }, [open])

  const handleConfirmar = useCallback(() => {
    const id = parseInt(assessorId, 10)
    if (isNaN(id)) return
    onEncaminhar(id)
    onClose()
  }, [assessorId, onEncaminhar, onClose])

  const assessorSelecionado = assessorId !== ''

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Encaminhar para Assessor</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-500">
            Selecione o assessor que ficará responsável pela revisão deste item.
          </p>

          <Select
            value={assessorId}
            onValueChange={setAssessorId}
            disabled={loading || assessores.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  loading
                    ? 'Carregando assessores...'
                    : assessores.length === 0
                      ? 'Nenhum assessor ativo'
                      : 'Selecione um assessor'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {assessores.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmar}
            disabled={!assessorSelecionado}
            style={
              assessorSelecionado
                ? { background: '#92400e', color: 'white' }
                : undefined
            }
          >
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
