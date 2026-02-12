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
  /** Classe de max-width customizada (default: max-w-pge). Usar max-w-4xl para paginas de formulario simples */
  maxWidthClass?: string
}

/**
 * Barra de breadcrumb padrao do PGE Design System.
 * Subordinada ao Header global navy do AppLayout.
 * Altura fixa de 48px, maxWidth 1350px, accent navy.
 */
export function BreadcrumbBar({ title, icon, actions, backTo = '/dashboard', className, fullWidth, maxWidthClass }: BreadcrumbBarProps) {
  return (
    <div className={cn('border-b border-gray-200', className)}>
      <div className={cn('flex h-12 items-center justify-between px-4 sm:px-6 lg:px-10', !fullWidth && `mx-auto ${maxWidthClass || 'max-w-pge'}`)}>
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
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ChevronRight className="mx-1 h-3.5 w-3.5" style={{ color: C.text400 }} />
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: C.navy100, color: C.navy700 }}
          >
            {icon}
          </div>
          <span className="ml-1 text-[15px] font-semibold" style={{ color: C.text900 }}>
            {title}
          </span>
        </div>

        {/* Lado direito: acoes customizaveis */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
