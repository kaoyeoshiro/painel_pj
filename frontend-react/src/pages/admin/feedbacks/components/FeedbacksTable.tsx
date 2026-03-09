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

/**
 * Column width ratios (px values — browser scales proportionally with
 * table-layout:fixed + width:100%). Target sum ~960px so that at
 * 1310px container each column gets ~1.36× its base width.
 */
const COL = {
  sistema:    85,
  processo:  150,
  usuario:   140,
  modo:       90,
  nota:       85,
  comentario:250,
  modeloData:110,
  ver:        56,
} as const

interface FeedbacksTableProps {
  sistema: string
  grupo: string
  mes: string
  ano: string
  onViewReport: (consultaId: number, sistema: string) => void
  onViewComment: (feedback: FeedbackItem) => void
}

export function FeedbacksTable({ sistema, grupo, mes, ano, onViewReport, onViewComment }: FeedbacksTableProps) {
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
        grupo: grupo || undefined,
        mes: mes || undefined,
        ano: ano || undefined,
      })
      setData(resp)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, nota, sistema, grupo, mes, ano])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    setPage(1)
  }, [sistema, grupo, mes, ano, nota])

  const totalPages = data?.total_pages ?? 1

  return (
    <div className="bg-white rounded-2xl shadow-sm border" style={{ borderColor: C.gray200 }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
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
            <colgroup>
              <col style={{ width: COL.sistema }} />
              <col style={{ width: COL.processo }} />
              <col style={{ width: COL.usuario }} />
              <col style={{ width: COL.modo }} />
              <col style={{ width: COL.nota }} />
              <col style={{ width: COL.comentario }} />
              <col style={{ width: COL.modeloData }} />
              <col style={{ width: COL.ver }} />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs px-3">Sistema</TableHead>
                <TableHead className="text-xs px-3">Processo</TableHead>
                <TableHead className="text-xs px-3">Usuário</TableHead>
                <TableHead className="text-xs px-3 text-center">Modo</TableHead>
                <TableHead className="text-xs px-3 text-center">Nota</TableHead>
                <TableHead className="text-xs px-3">Comentário</TableHead>
                <TableHead className="text-xs px-3">Modelo / Data</TableHead>
                <TableHead className="text-xs px-3 text-center">Ver</TableHead>
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
                      {/* Sistema */}
                      <TableCell className="py-2.5 px-3 align-middle">
                        <SistemaBadge sistema={fb.sistema} />
                      </TableCell>

                      {/* Processo */}
                      <TableCell
                        className="py-2.5 px-3 align-middle font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap"
                        title={fb.identificador || fb.cnj || '-'}
                      >
                        {fb.identificador || fb.cnj || '-'}
                      </TableCell>

                      {/* Usuário — wider, allows 2-line wrap */}
                      <TableCell className="py-2.5 px-3 align-middle text-sm leading-tight" title={fb.usuario}>
                        <span className="line-clamp-2">{fb.usuario}</span>
                      </TableCell>

                      {/* Modo — flex center to prevent overlap */}
                      <TableCell className="py-2.5 px-3 align-middle">
                        <div className="flex items-center justify-center">
                          <ModoBadge modo={fb.modo_ativacao} sistema={fb.sistema} />
                        </div>
                      </TableCell>

                      {/* Nota — flex center, fixed height */}
                      <TableCell className="py-2.5 px-3 align-middle">
                        <div className="flex items-center justify-center">
                          <NotaBadge nota={fb.nota} />
                        </div>
                      </TableCell>

                      {/* Comentário — truncated 1 line + expand button */}
                      <TableCell className="py-2.5 px-3 align-middle overflow-hidden">
                        {fb.comentario ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
                              {fb.comentario}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 flex-shrink-0 rounded text-purple-600 hover:bg-purple-50 hover:text-purple-800"
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

                      {/* Modelo / Data — stacked */}
                      <TableCell className="py-2.5 px-3 align-middle text-xs leading-tight" style={{ color: C.text500 }}>
                        {fb.modelo && (
                          <div
                            className="font-mono text-[10px] text-purple-700 overflow-hidden text-ellipsis whitespace-nowrap"
                            title={fb.modelo}
                          >
                            {fb.modelo}
                          </div>
                        )}
                        <div>{formatarData(fb.criado_em)}</div>
                        {hora && <div className="text-[10px] text-gray-400">{hora}</div>}
                      </TableCell>

                      {/* Ver relatório — centered icon button */}
                      <TableCell className="py-2.5 px-3 align-middle">
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800"
                            onClick={() => onViewReport(fb.consulta_id, fb.sistema)}
                            title="Ver relatório"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
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
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
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
