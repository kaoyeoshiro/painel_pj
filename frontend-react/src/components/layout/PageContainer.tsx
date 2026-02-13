import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  /** Classes CSS adicionais */
  className?: string
  /** Usa largura total (sem max-width) — para páginas com sidebar interna */
  fluid?: boolean
  /** Remove padding interno (para páginas com sidebar interna) */
  noPadding?: boolean
}

/**
 * Container padrao de pagina alinhado com o BreadcrumbBar.
 * - Padrao: max-w-pge (1350px), px-10 (40px) no desktop
 * - `fluid`: sem max-width — layouts com sidebar interna
 * - `noPadding`: remove padding — combinado com fluid para sidebars
 */
export function PageContainer({ children, className, fluid, noPadding }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        !noPadding && 'px-4 sm:px-6 lg:px-10 py-8',
        !fluid && 'max-w-pge',
        className,
      )}
    >
      {children}
    </div>
  )
}
