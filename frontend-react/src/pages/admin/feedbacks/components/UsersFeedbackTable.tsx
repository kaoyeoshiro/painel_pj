import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { C } from '@/lib/designTokens'
import type { UserFeedbackSummary } from '../types'

interface UsersFeedbackTableProps {
  data: UserFeedbackSummary[]
}

export function UsersFeedbackTable({ data }: UsersFeedbackTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: C.text900 }}>
        Feedbacks por Usuário (Top 10)
      </h3>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Corretos</TableHead>
              <TableHead className="text-center">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-20 text-gray-400">
                  Nenhum dado disponível
                </TableCell>
              </TableRow>
            ) : (
              data.map((u) => {
                const taxa = u.total > 0 ? Math.round((u.corretos / u.total) * 100) : 0
                const taxaClass =
                  taxa >= 70 ? 'bg-green-100 text-green-700'
                  : taxa >= 50 ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'

                return (
                  <TableRow key={u.nome} className="hover:bg-gray-50">
                    <TableCell>{u.nome}</TableCell>
                    <TableCell className="text-center">{u.total}</TableCell>
                    <TableCell className="text-center text-green-600">{u.corretos}</TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${taxaClass}`}>{taxa}%</span>
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
