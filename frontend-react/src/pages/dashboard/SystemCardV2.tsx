import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { SystemCardConfig } from './types'

/** Gradient + text colors per card color key */
const colorMap: Record<string, { gradient: string; cta: string }> = {
  primary: { gradient: 'from-primary-500 to-primary-600', cta: 'text-primary-600' },
  green:   { gradient: 'from-green-500 to-green-600',     cta: 'text-green-600' },
  purple:  { gradient: 'from-purple-500 to-purple-600',   cta: 'text-purple-600' },
  amber:   { gradient: 'from-amber-500 to-amber-600',     cta: 'text-amber-600' },
  teal:    { gradient: 'from-teal-500 to-teal-600',       cta: 'text-teal-600' },
  emerald: { gradient: 'from-emerald-500 to-emerald-600', cta: 'text-emerald-600' },
  indigo:  { gradient: 'from-indigo-500 to-indigo-600',   cta: 'text-indigo-600' },
  rose:    { gradient: 'from-rose-500 to-rose-600',       cta: 'text-rose-600' },
}

interface SystemCardV2Props {
  card: SystemCardConfig
}

/**
 * System card — TailAdmin style.
 * Vertical layout: gradient icon circle on top, title, description, CTA.
 */
export function SystemCardV2({ card }: SystemCardV2Props) {
  const colors = colorMap[card.color] ?? colorMap.primary
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-5 py-7 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* Gradient icon circle */}
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${colors.gradient} shadow-md`}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>

      <h3 className="mt-4 font-semibold text-gray-800">
        {card.title}
      </h3>

      <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">
        {card.description}
      </p>

      <span
        className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${colors.cta}`}
      >
        Acessar
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  )
}
