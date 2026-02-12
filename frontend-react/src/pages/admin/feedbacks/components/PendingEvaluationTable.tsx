import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import { C } from '@/lib/designTokens'
import { SistemaBadge } from './SistemaBadge'
import { formatarData, formatarHora } from '../constants'
import type { PendingItem } from '../types'

interface PendingEvaluationTableProps {
  data: PendingItem[]
  onViewReport: (id: number, sistema: string) => void
}

export function PendingEvaluationTable({ data, onViewReport }: PendingEvaluationTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
      <h3 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: C.text900 }}>
        Pendentes de Avaliação (Últimos 20)
      </h3>
      <p className="text-sm mb-4" style={{ color: C.text500 }}>
        Usuários que geraram relatório mas ainda não avaliaram a resposta da IA
      </p>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-orange-50">
              <TableHead>Sistema</TableHead>
              <TableHead>Processo/Arquivo</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Relatório</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-20 text-gray-400">
                  Todos os relatórios foram avaliados!
                </TableCell>
              </TableRow>
            ) : (
              data.map((p) => {
                const hora = formatarHora(p.data)
                return (
                  <TableRow key={`${p.id}-${p.sistema}`} className="hover:bg-orange-50">
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1">
                        <SistemaBadge sistema={p.sistema} />
                        {p.sistema === 'gerador_pecas' && p.modo_ativacao === 'semi_automatico' && (
                          <span
                            className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium"
                            title="Curadoria Humana"
                          >
                            CH
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.identificador || '-'}</TableCell>
                    <TableCell>{p.usuario}</TableCell>
                    <TableCell className="text-gray-500">
                      <div>{formatarData(p.data)}</div>
                      {hora && <div className="text-xs text-gray-400">{hora}</div>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => onViewReport(p.id, p.sistema)}
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
      </div>
    </div>
  )
}
