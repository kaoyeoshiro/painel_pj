import { Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { C } from '@/lib/designTokens'

interface BreadcrumbBarProps {
  title: string
  icon: React.ReactNode
  actions?: React.ReactNode
  backTo?: string
  /** Classes CSS adicionais no wrapper externo (ex: flex-shrink-0 para layouts flex) */
  className?: string
  /** Remove max-w-pge para paginas com layout full-width (ex: Matriculas Confrontantes) */
  fullWidth?: boolean
}

/**
 * Barra de breadcrumb padrao do PGE Design System.
 * Subordinada ao Header global navy do AppLayout.
 * Altura fixa de 48px, maxWidth 1350px, accent navy.
 */
export function BreadcrumbBar({ title, icon, actions, backTo = '/dashboard', className, fullWidth }: BreadcrumbBarProps) {
  return (
    <div className={cn('border-b border-gray-200', className)}>
      <div className={cn('flex h-12 items-center justify-between px-4 sm:px-6 lg:px-10', !fullWidth && 'mx-auto max-w-pge')}>
        {/* Lado esquerdo: voltar > icone > titulo */}
        <div className="flex items-center gap-2">
          <Link
            to={backTo}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
            style={{ color: C.text400 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.gray100
              e.currentTarget.style.color = C.text700
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = C.text400
            }}
            aria-label="Voltar ao Dashboard"
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </Link>
          <ChevronRight style={{ width: 14, height: 14, color: C.text400, margin: '0 4px' }} />
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: C.navy100, color: C.navy700 }}
          >
            {icon}
          </div>
          <span className="font-semibold" style={{ fontSize: 15, color: C.text900, marginLeft: 4 }}>
            {title}
          </span>
        </div>

        {/* Lado direito: acoes customizaveis */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
