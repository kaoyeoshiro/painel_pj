import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { SystemCardConfig } from './types'

/** Mapa cor → classes Tailwind para hover de border, bg ícone, hover bg ícone, texto título hover, CTA */
const colorMap: Record<string, { border: string; iconBg: string; iconHover: string; titleHover: string; cta: string }> = {
  primary:  { border: 'hover:border-primary-300', iconBg: 'bg-primary-100', iconHover: 'group-hover:bg-primary-200', titleHover: 'group-hover:text-primary-600', cta: 'text-primary-600' },
  green:    { border: 'hover:border-green-300',   iconBg: 'bg-green-100',   iconHover: 'group-hover:bg-green-200',   titleHover: 'group-hover:text-green-600',   cta: 'text-green-600' },
  purple:   { border: 'hover:border-purple-300',  iconBg: 'bg-purple-100',  iconHover: 'group-hover:bg-purple-200',  titleHover: 'group-hover:text-purple-600',  cta: 'text-purple-600' },
  amber:    { border: 'hover:border-amber-300',   iconBg: 'bg-amber-100',   iconHover: 'group-hover:bg-amber-200',   titleHover: 'group-hover:text-amber-600',   cta: 'text-amber-600' },
  teal:     { border: 'hover:border-teal-300',    iconBg: 'bg-teal-100',    iconHover: 'group-hover:bg-teal-200',    titleHover: 'group-hover:text-teal-600',    cta: 'text-teal-600' },
  emerald:  { border: 'hover:border-emerald-300', iconBg: 'bg-emerald-100', iconHover: 'group-hover:bg-emerald-200', titleHover: 'group-hover:text-emerald-600', cta: 'text-emerald-600' },
  indigo:   { border: 'hover:border-indigo-300',  iconBg: 'bg-indigo-100',  iconHover: 'group-hover:bg-indigo-200',  titleHover: 'group-hover:text-indigo-600',  cta: 'text-indigo-600' },
  rose:     { border: 'hover:border-rose-300',    iconBg: 'bg-rose-100',    iconHover: 'group-hover:bg-rose-200',    titleHover: 'group-hover:text-rose-600',    cta: 'text-rose-600' },
}

/** Mapa cor → classe do ícone SVG */
const iconColorMap: Record<string, string> = {
  primary: 'text-primary-600',
  green:   'text-green-600',
  purple:  'text-purple-600',
  amber:   'text-amber-600',
  teal:    'text-teal-600',
  emerald: 'text-emerald-600',
  indigo:  'text-indigo-600',
  rose:    'text-rose-600',
}

interface SystemCardProps {
  card: SystemCardConfig
}

/**
 * Card de sistema no dashboard — réplica exata do layout legado.
 * Layout horizontal com ícone, título, descrição e CTA "Acessar sistema".
 */
export function SystemCard({ card }: SystemCardProps) {
  const colors = colorMap[card.color] ?? colorMap.primary
  const iconColor = iconColorMap[card.color] ?? 'text-primary-600'
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className={`group bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg ${colors.border} transition-all block`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-14 h-14 ${colors.iconBg} rounded-xl flex items-center justify-center ${colors.iconHover} transition-colors flex-shrink-0`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-lg font-semibold text-gray-800 ${colors.titleHover} transition-colors`}
          >
            {card.title}
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            {card.description}
          </p>
          <div className={`flex items-center gap-2 mt-4 ${colors.cta} text-sm font-medium`}>
            <span>Acessar sistema</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  )
}
