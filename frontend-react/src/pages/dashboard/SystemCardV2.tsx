import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { SystemCardConfig } from './types'

interface SystemCardV2Props {
  card: SystemCardConfig
}

export function SystemCardV2({ card }: SystemCardV2Props) {
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="group flex items-start gap-4 rounded-2xl border border-transparent bg-white p-5 transition-all hover:border-stone-200 hover:shadow-sm"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500 transition-colors group-hover:bg-stone-900 group-hover:text-white">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-800">
            {card.title}
          </h3>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-stone-300 transition-all group-hover:translate-x-0.5 group-hover:text-stone-500" />
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-400">
          {card.description}
        </p>
      </div>
    </Link>
  )
}
