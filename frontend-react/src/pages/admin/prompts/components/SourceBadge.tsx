import type { SourceType } from '../types'
import { SOURCE_COLORS } from '../constants'

interface SourceBadgeProps {
  source: SourceType
  className?: string
}

/**
 * Badge colorido que indica de onde vem o valor resolvido de um parâmetro.
 * Hierarquia: agente > sistema > global > padrão
 */
export function SourceBadge({ source, className = '' }: SourceBadgeProps) {
  const colors = SOURCE_COLORS[source] || SOURCE_COLORS.default

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      {colors.label}
    </span>
  )
}
