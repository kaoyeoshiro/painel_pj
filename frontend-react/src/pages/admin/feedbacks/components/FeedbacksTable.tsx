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
import { Eye, Expand, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { C } from '@/lib/designTokens'
import { fetchFeedbackList } from '../api'
import { AVALIACAO_OPTIONS, formatarData, formatarHora } from '../constants'
import { SistemaBadge } from './SistemaBadge'
import { AvaliacaoBadge, NotaBadge } from './AvaliacaoBadge'
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
  const [avaliacao, setAvaliacao] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FeedbackListResponse | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetchFeedbackList({
        page,
        per_page: 20,
        avaliacao: avaliacao || undefined,
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
  }, [page, avaliacao, sistema, mes, ano])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /** Reseta para página 1 quando filtros globais mudam */
  useEffect(() => {
    setPage(1)
  }, [sistema, mes, ano, avaliacao])

  const totalPages = data?.total_pages ?? 1

  return (
    <div className="bg-white rounded-2xl shadow-sm border" style={{ borderColor: C.gray200 }}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: C.text900 }}>Feedbacks Recentes</h3>
        <Select value={avaliacao || '__all__'} onValueChange={(v) => setAvaliacao(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AVALIACAO_OPTIONS.map((o) => (
              <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Sistema</TableHead>
                <TableHead>Processo/Arquivo</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-center">Modelo IA</TableHead>
                <TableHead className="text-center">Modo</TableHead>
                <TableHead className="text-center">Avaliação</TableHead>
                <TableHead className="text-center">Nota</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Relatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.feedbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center h-24 text-gray-400">
                    Nenhum feedback encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data.feedbacks.map((fb) => {
                  const hora = formatarHora(fb.criado_em)
                  return (
                    <TableRow key={fb.id} className="hover:bg-gray-50">
                      <TableCell className="text-xs">
                        <SistemaBadge sistema={fb.sistema} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{fb.identificador || fb.cnj || '-'}</TableCell>
                      <TableCell className="text-sm">{fb.usuario}</TableCell>
                      <TableCell className="text-center">
                        {fb.modelo ? (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-mono">
                            {fb.modelo}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <ModoBadge modo={fb.modo_ativacao} sistema={fb.sistema} />
                      </TableCell>
                      <TableCell className="text-center">
                        <AvaliacaoBadge avaliacao={fb.avaliacao} />
                      </TableCell>
                      <TableCell className="text-center">
                        <NotaBadge nota={fb.nota} />
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {fb.comentario ? (
                          <div className="flex items-center gap-1">
                            <span className="truncate text-sm text-gray-600">{fb.comentario}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 flex-shrink-0 text-purple-700 hover:bg-purple-100"
                              onClick={() => onViewComment(fb)}
                              title="Ver comentário completo"
                            >
                              <Expand className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        <div>{formatarData(fb.criado_em)}</div>
                        {hora && <div className="text-xs text-gray-400">{hora}</div>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
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
