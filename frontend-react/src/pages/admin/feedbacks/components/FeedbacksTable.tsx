import { useCallback, useEffect, useState } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, Expand, ChevronLeft, ChevronRight } from 'lucide-react'
import { C } from '@/lib/designTokens'
import { fetchFeedbackList } from '../api'
import { NOTA_FILTER_OPTIONS, formatarData, formatarHora } from '../constants'
import { SistemaBadge } from './SistemaBadge'
import { NotaBadge } from './AvaliacaoBadge'
import { ModoBadge } from './ModoBadge'
import type { FeedbackItem, FeedbackListResponse } from '../types'

interface FeedbacksTableProps {
  /** Filtro global de sistema */
  sistema: string
  /** Filtro global de mês */
  mes: string
  /** Filtro global de ano */
  ano: string
  onViewReport: (consultaId: number, sistema: string) => void
  onViewComment: (feedback: FeedbackItem) => void
}

export function FeedbacksTable({ sistema, mes, ano, onViewReport, onViewComment }: FeedbacksTableProps) {
  const [nota, setNota] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FeedbackListResponse | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetchFeedbackList({
        page,
        per_page: 20,
        nota: nota || undefined,
        sistema: sistema || undefined,
        mes: mes || undefined,
        ano: ano || undefined,
      })
      setData(resp)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, nota, sistema, mes, ano])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /** Reseta para página 1 quando filtros globais mudam */
  useEffect(() => {
    setPage(1)
  }, [sistema, mes, ano, nota])

  const totalPages = data?.total_pages ?? 1

  return (
    <div className="bg-white rounded-2xl shadow-sm border" style={{ borderColor: C.gray200 }}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: C.text900 }}>Feedbacks Recentes</h3>
        <Select value={nota || '__all__'} onValueChange={(v) => setNota(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NOTA_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead style={{ width: 95 }} className="text-xs">Sistema</TableHead>
                <TableHead style={{ width: 140 }} className="text-xs">Processo</TableHead>
                <TableHead style={{ width: 100 }} className="text-xs">Usuário</TableHead>
                <TableHead style={{ width: 80 }} className="text-xs text-center">Modo</TableHead>
                <TableHead style={{ width: 85 }} className="text-xs text-center">Nota</TableHead>
                <TableHead className="text-xs">Comentário</TableHead>
                <TableHead style={{ width: 100 }} className="text-xs">Modelo / Data</TableHead>
                <TableHead style={{ width: 50 }} className="text-xs text-center">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.feedbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24 text-gray-400">
                    Nenhum feedback encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data.feedbacks.map((fb) => {
                  const hora = formatarHora(fb.criado_em)
                  return (
                    <TableRow key={fb.id} className="hover:bg-gray-50">
                      <TableCell className="py-2 px-3">
                        <SistemaBadge sistema={fb.sistema} />
                      </TableCell>
                      <TableCell className="py-2 px-3 font-mono text-xs truncate" title={fb.identificador || fb.cnj || '-'}>
                        {fb.identificador || fb.cnj || '-'}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs truncate" title={fb.usuario}>
                        {fb.usuario}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-center">
                        <ModoBadge modo={fb.modo_ativacao} sistema={fb.sistema} />
                      </TableCell>
                      <TableCell className="py-2 px-3 text-center">
                        <NotaBadge nota={fb.nota} />
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        {fb.comentario ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="truncate text-xs text-gray-600">{fb.comentario}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 flex-shrink-0 text-purple-700 hover:bg-purple-100"
                              onClick={() => onViewComment(fb)}
                              title="Ver comentário completo"
                            >
                              <Expand className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs" style={{ color: C.text500 }}>
                        {fb.modelo && (
                          <div className="truncate font-mono text-[10px] text-purple-700" title={fb.modelo}>
                            {fb.modelo}
                          </div>
                        )}
                        <div>{formatarData(fb.criado_em)}</div>
                        {hora && <div className="text-[10px] text-gray-400">{hora}</div>}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 bg-blue-100 text-blue-700 hover:bg-blue-200"
                          onClick={() => onViewReport(fb.consulta_id, fb.sistema)}
                          title="Ver relatório"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginação */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-sm" style={{ color: C.text500 }}>
          {data ? `Página ${data.page} de ${totalPages} (${data.total} registros)` : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
