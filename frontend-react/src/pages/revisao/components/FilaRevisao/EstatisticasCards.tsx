/**
 * Cards de estatísticas da fila de revisão.
 * Exibe totais por status em cards visuais com ícones.
 */

import { Clock, Send, AlertCircle, BookCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { C } from '@/lib/designTokens'
import type { Estatisticas } from '../../types'

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

export function EstatisticasCards({ stats, loading }: EstatisticasCardsProps) {
  const cards: CardConfig[] = [
    {
      label: 'Pendentes',
      value: stats.pendentes + stats.em_revisao,
      icon: <Clock className="h-6 w-6" />,
      iconBg: C.gray100,
      iconColor: C.gray600,
      valueColor: C.gray700,
    },
    {
      label: 'Com Assessores',
      value: stats.encaminhados,
      icon: <Send className="h-6 w-6" />,
      iconBg: '#fffbeb',
      iconColor: '#92400e',
      valueColor: '#92400e',
    },
    {
      label: 'Aguardando Inserção',
      value: stats.aguardando_insercao,
      icon: <AlertCircle className="h-6 w-6" />,
      iconBg: '#fffbeb',
      iconColor: C.statusWarning,
      valueColor: C.statusWarning,
    },
    {
      label: 'Concluídos (7 dias)',
      value: stats.concluidos_7d,
      icon: <BookCheck className="h-6 w-6" />,
      iconBg: '#eef2ff',
      iconColor: '#3730a3',
      valueColor: '#3730a3',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
