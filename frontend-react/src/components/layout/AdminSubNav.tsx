import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { FileEdit, FileJson, Variable, Settings, Tags } from 'lucide-react'

interface SubNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Itens de navegação do ecossistema de prompts/configuração do gerador de peças */
const PROMPTS_ECOSYSTEM_ITEMS: SubNavItem[] = [
  { to: '/admin/prompts', label: 'Prompts', icon: FileEdit },
  { to: '/admin/prompts-modulos', label: 'Módulos', icon: FileJson },
  { to: '/admin/categorias-json', label: 'Categorias', icon: Tags },
  { to: '/admin/variaveis', label: 'Variáveis', icon: Variable },
  { to: '/admin/config-pecas', label: 'Config Peças', icon: Settings },
]

interface AdminSubNavProps {
  /** Itens de navegação. Se omitido, usa o ecossistema de prompts padrão. */
  items?: SubNavItem[]
  /** Classes CSS adicionais */
  className?: string
}

/**
 * Sub-navegação horizontal para páginas admin relacionadas.
 * Estilo tabs underline inspirado no legado.
 * Usado principalmente no ecossistema de prompts/configuração.
 */
export function AdminSubNav({ items = PROMPTS_ECOSYSTEM_ITEMS, className }: AdminSubNavProps) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className={cn('border-b border-gray-200 mb-6', className)}>
      <div className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
        {items.map((item) => {
          const isActive = currentPath === item.to || currentPath.startsWith(item.to + '/')

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors',
                isActive
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
