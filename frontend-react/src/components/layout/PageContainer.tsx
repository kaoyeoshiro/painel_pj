import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Use full width (no max-width constraint) */
  fluid?: boolean
}

/**
 * Standard page container matching legacy max-w-7xl layout.
 * Provides consistent horizontal padding and max-width for all pages.
 * Use `fluid` prop for pages that need the full content area width.
 */
export function PageContainer({ children, className, fluid }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8 py-6',
        !fluid && 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
