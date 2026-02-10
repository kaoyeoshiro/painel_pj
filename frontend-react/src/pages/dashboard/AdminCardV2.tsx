import { Link } from '@tanstack/react-router'
import type { AdminCardConfig } from './types'

/** Gradient colors for admin icon badges */
const adminColorMap: Record<string, string> = {
  gray:   'from-gray-500 to-gray-600',
  purple: 'from-purple-500 to-purple-600',
  orange: 'from-orange-500 to-orange-600',
  blue:   'from-blue-500 to-blue-600',
  indigo: 'from-indigo-500 to-indigo-600',
  amber:  'from-amber-500 to-amber-600',
  teal:   'from-teal-500 to-teal-600',
  green:  'from-green-500 to-green-600',
  cyan:   'from-cyan-500 to-cyan-600',
  rose:   'from-rose-500 to-rose-600',
  sky:    'from-sky-500 to-sky-600',
}

interface AdminCardV2Props {
  card: AdminCardConfig
}

/**
 * Admin card — TailAdmin compact style.
 * Horizontal: gradient icon badge + title/subtitle.
 */
export function AdminCardV2({ card }: AdminCardV2Props) {
  const gradient = adminColorMap[card.color] ?? adminColorMap.gray
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-gray-800">{card.title}</p>
        <p className="text-xs text-gray-500">{card.subtitle}</p>
      </div>
    </Link>
  )
}
