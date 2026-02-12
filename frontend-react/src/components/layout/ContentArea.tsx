import { cn } from '@/lib/utils'

interface ContentAreaProps {
  children: React.ReactNode
  className?: string
  /** Remove padding vertical (py-8) */
  noPaddingY?: boolean
  /** Remove todo o padding */
  noPadding?: boolean
  /** Classe de max-width customizada (default: max-w-pge). Usar max-w-4xl para paginas de formulario simples */
  maxWidthClass?: string
}

/**
 * Container de conteudo padrao do PGE Design System.
 * Garante alinhamento perfeito com o BreadcrumbBar:
 * - max-w-pge = 1350px (token customizado)
 * - lg:px-10 = 40px (mesmo que BreadcrumbBar no desktop)
 * - py-8 = 32px (espacamento vertical padrao)
 */
export function ContentArea({ children, className, noPaddingY, noPadding, maxWidthClass }: ContentAreaProps) {
  return (
    <div className={cn(
      `mx-auto w-full ${maxWidthClass || 'max-w-pge'}`,
      !noPadding && 'px-4 sm:px-6 lg:px-10',
      !noPadding && !noPaddingY && 'py-8',
      className,
    )}>
      {children}
    </div>
  )
}
