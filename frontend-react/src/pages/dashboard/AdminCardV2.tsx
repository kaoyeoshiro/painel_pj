import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { AdminCardConfig } from './types'

interface AdminCardV2Props {
  card: AdminCardConfig
}

export function AdminCardV2({ card }: AdminCardV2Props) {
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-stone-100/80"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-200/60 text-stone-500 transition-colors group-hover:bg-stone-900 group-hover:text-white">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700">{card.title}</p>
        <p className="text-[11px] text-stone-400">{card.subtitle}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-stone-300 opacity-0 transition-all group-hover:opacity-100" />
    </Link>
  )
}
