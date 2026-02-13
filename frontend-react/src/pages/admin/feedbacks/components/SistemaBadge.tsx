import { SISTEMA_MAP } from '../constants'

interface SistemaBadgeProps {
  sistema: string
}

export function SistemaBadge({ sistema }: SistemaBadgeProps) {
  const config = SISTEMA_MAP[sistema]
  if (!config) return <span className="text-gray-500 text-xs">{sistema}</span>

  return (
    <span className="text-xs font-medium" style={{ color: config.color }}>
      {config.shortLabel}
    </span>
  )
}
