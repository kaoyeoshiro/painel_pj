import { Link, useRouterState } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Título da página */
  title: string
  /** Descrição opcional abaixo do título (text-sm) */
  description?: string
  /** Subtítulo menor abaixo do título (text-xs) */
  subtitle?: string
  /** Ícone do sistema exibido como badge à esquerda do título */
  icon?: React.ReactNode
  /** Botões de ação renderizados à direita */
  actions?: React.ReactNode
  /** Rota de navegação de retorno (ex: "/dashboard"). Renderiza botão de voltar acima do título. */
  backTo?: string
  /** Texto do botão de voltar (padrão: "Voltar ao Dashboard") */
  backLabel?: string
  /** Classes CSS adicionais */
  className?: string
}

/**
 * Header de página consistente com o padrão legado.
 * Título à esquerda, ações opcionais à direita.
 * Suporta ícone como badge gradiente, subtítulo e navegação de retorno.
 */
export function PageHeader({ title, description, subtitle, icon, actions, backTo, backLabel, className }: PageHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAdminRoute = pathname.startsWith('/admin/')

  if (isAdminRoute) {
    return (
      <div className={cn('mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4', className)}>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          {description && (
            <p className="mt-1 text-gray-500">{description}</p>
          )}
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    )
  }

  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          {backTo && (
            <Link
              to={backTo}
              title={backLabel || 'Voltar ao Dashboard'}
              aria-label={backLabel || 'Voltar ao Dashboard'}
              className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-700"
              data-testid="btn-voltar-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}

          {icon && (
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl text-white shadow-sm">
              {icon}
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            )}
            {description && (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
