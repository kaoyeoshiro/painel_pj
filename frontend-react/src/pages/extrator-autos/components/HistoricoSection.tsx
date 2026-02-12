/**
 * Secao colapsavel de historico de downloads do Extrator de Autos.
 *
 * Exibe tabela com downloads anteriores, incluindo processo, modo,
 * formato, quantidade de documentos, status e data.
 */

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { C } from '@/lib/designTokens'
import { formatarData, statusBadgeStyle } from '../types'
import type { UseExtratorAutosReturn } from '../hooks/useExtratorAutos'

// ============================================================================
// Props
// ============================================================================

interface HistoricoSectionProps {
  h: UseExtratorAutosReturn
}

// ============================================================================
// Componente
// ============================================================================

export function HistoricoSection({ h }: HistoricoSectionProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
      <div
        className="flex cursor-pointer items-center justify-between p-5"
        onClick={h.toggleHistorico}
      >
        <div className="flex items-center gap-2">
          <Clock style={{ width: 16, height: 16, color: C.text400 }} />
          <h3 className="font-bold" style={{ fontSize: 15, color: C.text900 }}>
            Historico de Downloads
          </h3>
        </div>
        <span style={{ fontSize: 14, color: C.text400 }}>{h.historicoAberto ? '\u25B2' : '\u25BC'}</span>
      </div>

      {h.historicoAberto && (
        <div className="border-t px-5 pb-5" style={{ borderColor: C.gray200 }}>
          {h.isLoadingHistorico ? (
            <div className="space-y-2 pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !h.historico || h.historico.length === 0 ? (
            <p className="py-4 text-center text-sm" style={{ color: C.text400 }}>
              Nenhum download registrado
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: C.gray200 }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: C.navy100 }}>
                    <TableHead style={{ color: C.text700 }}>Processo</TableHead>
                    <TableHead style={{ color: C.text700 }}>Modo</TableHead>
                    <TableHead style={{ color: C.text700 }}>Formato</TableHead>
                    <TableHead style={{ color: C.text700 }}>Docs</TableHead>
                    <TableHead style={{ color: C.text700 }}>Status</TableHead>
                    <TableHead style={{ color: C.text700 }}>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {h.historico.map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono" style={{ fontSize: 12, color: C.text700 }}>
                        {item.numero_cnj}
                      </TableCell>
                      <TableCell style={{ fontSize: 14, color: C.text700 }}>{item.modo}</TableCell>
                      <TableCell style={{ fontSize: 14, color: C.text700 }}>{item.formato}</TableCell>
                      <TableCell style={{ fontSize: 14, color: C.text700 }}>{item.total_docs}</TableCell>
                      <TableCell>
                        <Badge style={statusBadgeStyle(item.status)} className="text-xs">
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ fontSize: 12, color: C.text500 }}>
                        {formatarData(item.criado_em)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
