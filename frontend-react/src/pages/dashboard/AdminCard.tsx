import { Link } from '@tanstack/react-router'
import type { AdminCardConfig } from './types'

/** Mapa cor → classes Tailwind para bg e texto do ícone */
const adminColorMap: Record<string, { bg: string; text: string }> = {
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-600' },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-600' },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-600' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-600' },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-600' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-600' },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-600' },
  green:   { bg: 'bg-green-100',   text: 'text-green-600' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-600' },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-600' },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-600' },
}

interface AdminCardProps {
  card: AdminCardConfig
}

/**
 * Card admin no dashboard — réplica exata do layout legado.
 * Layout horizontal compacto: ícone + título + subtítulo.
 */
export function AdminCard({ card }: AdminCardProps) {
  const colors = adminColorMap[card.color] ?? adminColorMap.gray
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <div
        className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`h-4 w-4 ${colors.text}`} />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-gray-800">{card.title}</p>
        <p className="text-xs text-gray-500">{card.subtitle}</p>
      </div>
    </Link>
  )
}
