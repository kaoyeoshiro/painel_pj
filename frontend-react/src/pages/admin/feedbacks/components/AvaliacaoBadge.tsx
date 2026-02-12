import { AVALIACAO_CONFIG } from '../constants'

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
