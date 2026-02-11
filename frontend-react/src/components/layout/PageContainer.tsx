import { cn } from '@/lib/utils'
import { useRouterState } from '@tanstack/react-router'

interface PageContainerProps {
  children: React.ReactNode
  /** Classes CSS adicionais */
  className?: string
  /** Usa largura total (sem max-width) — para páginas com sidebar interna */
  fluid?: boolean
  /** Usa max-w-screen-xl (1440px) — para páginas admin com tabelas densas */
  wide?: boolean
  /** Remove padding interno (para páginas com sidebar interna) */
  noPadding?: boolean
}

/**
 * Container padrão de página seguindo o layout legado.
 * - Padrão: max-w-7xl (1280px) — forms e conteúdo simples
 * - `wide`: max-w-screen-xl (1440px) — admin com tabelas/listas
 * - `fluid`: sem max-width — layouts com sidebar interna
 * - `noPadding`: remove padding — combinado com fluid para sidebars
 */
export function PageContainer({ children, className, fluid, wide, noPadding }: PageContainerProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAdminRoute = pathname.startsWith('/admin/')

  return (
    <div
      className={cn(
        'mx-auto w-full',
        !noPadding && 'px-4 sm:px-6 lg:px-8 py-8',
        !fluid && !wide && 'max-w-7xl',
        wide && !fluid && (isAdminRoute ? 'max-w-7xl' : 'max-w-screen-xl'),
        className,
      )}
    >
      {children}
    </div>
  )
}
