/**
 * Dialog de distribuição em lote de itens da fila de revisão.
 * Permite selecionar assessores e modo de distribuição (balanceado ou todos).
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { C } from '@/lib/designTokens'
import { Users, Shuffle, AlignJustify } from 'lucide-react'

import { fetchAssessores, encaminharLote } from '../../api'
import type { Assessor } from '../../types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface DistribuirDialogProps {
  open: boolean
  onClose: () => void
  /** IDs dos itens selecionados na tabela */
  selectedItemIds: number[]
  /** Callback para recarregar a fila após distribuição */
  onDistribuido: () => void
}

type ModoDistribuicao = 'balanceado' | 'todos'

// ---------------------------------------------------------------------------
// Configuração visual dos modos
// ---------------------------------------------------------------------------

const MODOS: Array<{
  value: ModoDistribuicao
  label: string
  descricao: string
  icon: React.ReactNode
}> = [
  {
    value: 'balanceado',
    label: 'Balanceado (round-robin)',
    descricao: 'Distribui os itens entre os assessores de forma equilibrada.',
    icon: <AlignJustify className="h-4 w-4" />,
  },
  {
    value: 'todos',
    label: 'Aleatório',
    descricao: 'Cada item vai para um assessor escolhido aleatoriamente.',
    icon: <Shuffle className="h-4 w-4" />,
  },
]

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function DistribuirDialog({
  open,
  onClose,
  selectedItemIds,
  onDistribuido,
}: DistribuirDialogProps) {
  const { toast } = useToast()

  const [assessores, setAssessores] = useState<Assessor[]>([])
  const [loadingAssessores, setLoadingAssessores] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [modo, setModo] = useState<ModoDistribuicao>('balanceado')
  const [distribuindo, setDistribuindo] = useState(false)

  // Busca assessores ao abrir o dialog
  useEffect(() => {
    if (!open) return

    setSelectedIds([])
    setModo('balanceado')

    setLoadingAssessores(true)
    fetchAssessores()
      .then((data) => {
        setAssessores(data.filter((a) => a.ativo))
      })
      .catch(() => {
        toast({
          title: 'Erro ao carregar assessores',
          description: 'Não foi possível buscar a lista de assessores.',
          variant: 'destructive',
        })
      })
      .finally(() => setLoadingAssessores(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const toggleAssessor = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleDistribuir = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Nenhum assessor selecionado',
        description: 'Selecione ao menos um assessor para distribuir os itens.',
        variant: 'destructive',
      })
      return
    }

    setDistribuindo(true)
    try {
      const resultado = await encaminharLote(selectedItemIds, selectedIds, modo)
      toast({
        title: 'Distribuição concluída',
        description: `${resultado.encaminhados} item(s) encaminhado(s).${resultado.erros > 0 ? ` ${resultado.erros} erro(s).` : ''}`,
      })
      onClose()
      onDistribuido()
    } catch (error) {
      toast({
        title: 'Erro ao distribuir',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
        variant: 'destructive',
      })
    } finally {
      setDistribuindo(false)
    }
  }

  const podeDistribuir = selectedIds.length > 0 && !distribuindo

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: C.navy600 }} />
            Distribuir em Lote
          </DialogTitle>
          <DialogDescription>
            Encaminhar{' '}
            <span className="font-semibold" style={{ color: C.navy700 }}>
              {selectedItemIds.length} item(s)
            </span>{' '}
            para assessores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Modo de distribuição */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold" style={{ color: C.text700 }}>
              Modo de distribuição
            </Label>
            <div className="space-y-2">
              {MODOS.map((m) => {
                const isSelected = modo === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setModo(m.value)}
                    className="w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
                    style={{
                      borderColor: isSelected ? C.navy400 : C.gray200,
                      background: isSelected ? C.navy50 : 'white',
                    }}
                  >
                    <div
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                      style={{
                        borderColor: isSelected ? C.navy600 : C.gray300,
                        background: isSelected ? C.navy600 : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: isSelected ? C.navy700 : C.text700 }}
                      >
                        {m.icon}
                        {m.label}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: C.text400 }}>
                        {m.descricao}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lista de assessores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold" style={{ color: C.text700 }}>
                Assessores
              </Label>
              {selectedIds.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{ background: C.navy50, color: C.navy700 }}
                >
                  {selectedIds.length} selecionado(s)
                </Badge>
              )}
            </div>

            {loadingAssessores ? (
              <div
                className="flex items-center justify-center py-6 text-sm"
                style={{ color: C.text400 }}
              >
                Carregando assessores...
              </div>
            ) : assessores.length === 0 ? (
              <div
                className="flex items-center justify-center py-6 text-sm"
                style={{ color: C.text400 }}
              >
                Nenhum assessor ativo cadastrado.
              </div>
            ) : (
              <div
                className="rounded-lg border divide-y"
                style={{ borderColor: C.gray200 }}
              >
                {assessores.map((assessor) => {
                  const checked = selectedIds.includes(assessor.id)
                  return (
                    <div
                      key={assessor.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleAssessor(assessor.id)}
                    >
                      <Checkbox
                        id={`assessor-${assessor.id}`}
                        checked={checked}
                        onCheckedChange={() => toggleAssessor(assessor.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Label
                        htmlFor={`assessor-${assessor.id}`}
                        className="cursor-pointer text-sm font-normal flex-1"
                        style={{ color: C.text700 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {assessor.nome}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={distribuindo}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleDistribuir()}
            disabled={!podeDistribuir}
            style={{ background: C.navy950, color: 'white' }}
          >
            {distribuindo ? 'Distribuindo...' : 'Distribuir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
