/**
 * Cards de estatísticas da fila de revisão.
 * Exibe totais por status em cards visuais com ícones.
 */

import { ClipboardList, Clock, Eye, CheckCircle, BookCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { C } from '@/lib/designTokens'
import type { Estatisticas } from '../../types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface EstatisticasCardsProps {
  stats: Estatisticas
  loading: boolean
}

interface CardConfig {
  label: string
  value: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  valueColor: string
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function EstatisticasCards({ stats, loading }: EstatisticasCardsProps) {
  const cards: CardConfig[] = [
    {
      label: 'Total de Itens',
      value: stats.total,
      icon: <ClipboardList className="h-6 w-6" />,
      iconBg: C.navy100,
      iconColor: C.navy700,
      valueColor: C.text900,
    },
    {
      label: 'Pendentes',
      value: stats.pendentes,
      icon: <Clock className="h-6 w-6" />,
      iconBg: C.gray100,
      iconColor: C.gray600,
      valueColor: C.gray700,
    },
    {
      label: 'Em Revisão',
      value: stats.em_revisao,
      icon: <Eye className="h-6 w-6" />,
      iconBg: C.navy50,
      iconColor: C.navy600,
      valueColor: C.navy700,
    },
    {
      label: 'Aprovados / Encaminhados',
      value: stats.aprovados + stats.encaminhados,
      icon: <CheckCircle className="h-6 w-6" />,
      iconBg: C.successBg,
      iconColor: C.successText,
      valueColor: C.successText,
    },
    {
      label: 'Concluídos',
      value: stats.concluidos,
      icon: <BookCheck className="h-6 w-6" />,
      iconBg: '#eef2ff', // indigo-50
      iconColor: '#3730a3', // indigo-800
      valueColor: '#3730a3',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="border" style={{ borderColor: C.gray200 }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: C.text500 }}>
                  {card.label}
                </p>
                <p
                  className="text-3xl font-bold leading-none mt-1"
                  style={{ color: loading ? C.gray300 : card.valueColor }}
                >
                  {loading ? '—' : card.value}
                </p>
              </div>
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
