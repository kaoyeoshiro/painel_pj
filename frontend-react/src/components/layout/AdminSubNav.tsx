import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { C } from '@/lib/designTokens'
import type { LucideIcon } from 'lucide-react'
import { FileEdit, FileJson, Variable, Settings, Tags, Zap, FlaskConical, Filter } from 'lucide-react'

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
  { to: '/admin/filtro-documentos', label: 'Filtro Docs', icon: Filter },
  { to: '/admin/teste-ativacao', label: 'Teste Ativação', icon: Zap },
  { to: '/admin/teste-categorias', label: 'Teste Categorias', icon: FlaskConical },
]

interface AdminSubNavProps {
  /** Itens de navegação. Se omitido, usa o ecossistema de prompts padrão. */
  items?: SubNavItem[]
  /** Classes CSS adicionais */
  className?: string
}

/**
 * Sub-navegação horizontal para páginas admin relacionadas.
 * Estilo tabs underline com tokens do PGE Design System.
 */
export function AdminSubNav({ items = PROMPTS_ECOSYSTEM_ITEMS, className }: AdminSubNavProps) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className={cn('mb-6 border-b', className)} style={{ borderColor: C.gray200 }}>
      <div className="-mb-px flex gap-0 overflow-x-auto scrollbar-hide">
        {items.map((item) => {
          const isActive = currentPath === item.to || currentPath.startsWith(item.to + '/')

          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors"
              style={{
                color: isActive ? C.navy700 : C.text400,
                borderColor: isActive ? C.navy700 : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = C.text700
                  e.currentTarget.style.borderColor = C.gray300
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = C.text400
                  e.currentTarget.style.borderColor = 'transparent'
                }
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
