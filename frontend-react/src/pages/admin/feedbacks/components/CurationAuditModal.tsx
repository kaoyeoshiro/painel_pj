import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarkdown } from '@/hooks/useMarkdown'
import { fetchCuradoriaAudit } from '../api'
import type { CuradoriaAuditData, CuradoriaModulo } from '../types'

interface CurationAuditModalProps {
  open: boolean
  onClose: () => void
  geracaoId: number | null
}

function ModuloCard({ modulo, tipo }: { modulo: CuradoriaModulo; tipo: 'incluido' | 'excluido' }) {
  const [expanded, setExpanded] = useState(false)
  const { html } = useMarkdown(expanded ? modulo.conteudo : '')

  const borderColor = tipo === 'incluido' ? 'border-green-200' : 'border-red-200'
  const headerBg = tipo === 'incluido' ? 'bg-green-50' : 'bg-red-50'
  const tagColor = modulo.tag === '[HUMAN_VALIDATED:MANUAL]'
    ? 'bg-amber-100 text-amber-700'
    : tipo === 'incluido'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700'

  return (
    <div className={`border rounded-lg overflow-hidden ${borderColor}`}>
      <div
        className={`p-3 flex items-center justify-between cursor-pointer ${headerBg}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tagColor}`}>
            {modulo.tag}
          </span>
          <span className="font-medium text-sm truncate">{modulo.titulo}</span>
          <span className="text-xs text-gray-500">{modulo.categoria}</span>
        </div>
        <span className="text-xs text-gray-400 ml-2">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="p-3 border-t text-sm">
          <div className="mb-2 text-xs text-gray-500">
            <span className="font-medium">Decisão:</span> {modulo.decisao_explicacao}
          </div>
          {modulo.conteudo && (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      )}
    </div>
  )
}

export function CurationAuditModal({ open, onClose, geracaoId }: CurationAuditModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CuradoriaAuditData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !geracaoId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Estado de loading para fetch assíncrono no effect
    setLoading(true)
    setError(null)
    fetchCuradoriaAudit(geracaoId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar auditoria'))
      .finally(() => setLoading(false))
  }, [open, geracaoId])

  const meta = data?.metadata

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auditoria de Curadoria</DialogTitle>
          {data && <p className="text-sm text-muted-foreground">Geração #{data.geracao_id}</p>}
        </DialogHeader>

        {loading && (
          <div className="space-y-3 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-500">
            <p>{error}</p>
          </div>
        )}

        {data && meta && (
          <div className="space-y-6">
            {/* Resumo numérico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{meta.total_preview}</p>
                <span className="text-xs text-blue-700">Sugestões do Sistema</span>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{meta.total_confirmados}</p>
                <span className="text-xs text-green-700">Confirmados</span>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{meta.total_manuais}</p>
                <span className="text-xs text-amber-700">Adicionados pelo Usuário</span>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{meta.total_excluidos}</p>
                <span className="text-xs text-red-700">Removidos</span>
              </div>
            </div>

            {/* Módulos incluídos */}
            {data.modulos_incluidos.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 text-green-700">
                  Módulos Incluídos ({data.modulos_incluidos.length})
                </h4>
                <div className="space-y-2">
                  {data.modulos_incluidos.map((m) => (
                    <ModuloCard key={m.id} modulo={m} tipo="incluido" />
                  ))}
                </div>
              </div>
            )}

            {/* Módulos excluídos */}
            {data.modulos_excluidos.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 text-red-700">
                  Módulos Excluídos ({data.modulos_excluidos.length})
                </h4>
                <div className="space-y-2">
                  {data.modulos_excluidos.map((m) => (
                    <ModuloCard key={m.id} modulo={m} tipo="excluido" />
                  ))}
                </div>
              </div>
            )}

            {/* Glossário */}
            {data.glossario && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2" >Glossário</h4>
                <dl className="text-xs space-y-1">
                  {Object.entries(data.glossario).map(([term, def]) => (
                    <div key={term} className="flex gap-2">
                      <dt className="font-mono font-medium text-gray-700 min-w-[180px]">{term}</dt>
                      <dd className="text-gray-600">{def}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
