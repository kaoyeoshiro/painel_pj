import { Star } from 'lucide-react'
import { AVALIACAO_CONFIG, STAR_COLORS } from '../constants'

interface AvaliacaoBadgeProps {
  avaliacao: string | null | undefined
}

export function AvaliacaoBadge({ avaliacao }: AvaliacaoBadgeProps) {
  if (!avaliacao) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-600">
        Pendente
      </span>
    )
  }

  const config = AVALIACAO_CONFIG[avaliacao]
  if (!config) {
    return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{avaliacao}</span>
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}`}>
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// NotaBadge — shows star rating (1-5)
// ---------------------------------------------------------------------------

interface NotaBadgeProps {
  nota: number | null | undefined
}

export function NotaBadge({ nota }: NotaBadgeProps) {
  if (nota == null || nota < 1 || nota > 5) {
    return <span className="text-gray-300 text-xs">-</span>
  }

  const color = STAR_COLORS[nota] ?? '#6b7280'

  return (
    <span className="inline-flex items-center gap-0.5" title={`${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className="h-3 w-3"
          fill={s <= nota ? color : 'transparent'}
          stroke={s <= nota ? color : '#d1d5db'}
          strokeWidth={2}
        />
      ))}
    </span>
  )
}
