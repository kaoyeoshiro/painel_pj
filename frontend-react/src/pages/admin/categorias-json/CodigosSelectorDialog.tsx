/**
 * Dialog de selecao de codigos de documento TJ-MS.
 * Permite buscar, filtrar e selecionar codigos para uma categoria.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Check, AlertTriangle } from 'lucide-react'
import { C } from '@/lib/designTokens'
import type { CodigoDisponivel } from './types'
import * as categoriasApi from './api'

interface CodigosSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCodes: number[]
  onToggleCode: (codigo: number) => void
  currentCategoriaId: number | null
}

export function CodigosSelectorDialog({
  open,
  onOpenChange,
  selectedCodes,
  onToggleCode,
  currentCategoriaId,
}: CodigosSelectorDialogProps) {
  const [codigos, setCodigos] = useState<CodigoDisponivel[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    loadCodigos()
  }, [open])

  const loadCodigos = async () => {
    setLoading(true)
    try {
      const data = await categoriasApi.codigosDisponiveis()
      setCodigos(data)
    } catch {
      console.error('Erro ao carregar codigos disponiveis')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return codigos
    const term = search.toLowerCase()
    return codigos.filter(
      c => String(c.codigo).includes(term) || c.descricao.toLowerCase().includes(term)
    )
  }, [codigos, search])

  const isSelected = (codigo: number) => selectedCodes.includes(codigo)

  const isInOtherCategory = (item: CodigoDisponivel) =>
    item.categoria !== null && item.categoria.categoria_id !== currentCategoriaId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="codigos-selector-dialog">
        <DialogHeader>
          <DialogTitle>Codigos de Documento TJ-MS</DialogTitle>
          <DialogDescription>
            Clique para adicionar ou remover codigos da categoria.
          </DialogDescription>
        </DialogHeader>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.text400 }} />
          <Input
            placeholder="Buscar por codigo ou descricao..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-busca-codigos"
          />
        </div>

        {/* Lista */}
        <div className="overflow-y-auto max-h-[50vh] border rounded-lg" style={{ borderColor: C.gray200 }}>
          {loading && (
            <div className="text-center py-8 text-sm" style={{ color: C.text400 }}>
              Carregando codigos...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: C.text400 }}>
              Nenhum codigo encontrado
            </div>
          )}

          {!loading && filtered.map(item => {
            const selected = isSelected(item.codigo)
            const inOther = isInOtherCategory(item)

            return (
              <button
                key={item.codigo}
                type="button"
                onClick={() => onToggleCode(item.codigo)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left border-b last:border-b-0 transition-colors hover:bg-gray-50"
                style={{ borderColor: C.gray100 }}
                data-testid={`codigo-item-${item.codigo}`}
              >
                {/* Indicador de selecao */}
                <div
                  className="flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center"
                  style={{
                    borderColor: selected ? C.navy700 : C.gray300,
                    backgroundColor: selected ? C.navy700 : 'transparent',
                  }}
                >
                  {selected && <Check className="h-3 w-3 text-white" />}
                </div>

                {/* Codigo */}
                <span className="font-mono text-sm font-medium min-w-[60px]" style={{ color: C.text900 }}>
                  {item.codigo}
                </span>

                {/* Descricao */}
                <span className="flex-1 text-sm" style={{ color: C.text500 }}>
                  {item.descricao}
                </span>

                {/* Aviso se em outra categoria */}
                {inOther && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    {item.categoria!.categoria_titulo}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-sm" style={{ color: C.text400 }}>
              {selectedCodes.length} codigo(s) selecionado(s)
            </span>
            <Button onClick={() => onOpenChange(false)} style={{ background: C.navy950, color: 'white' }}>
              Concluir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
