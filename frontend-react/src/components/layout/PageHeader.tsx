import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Page title */
  title: string
  /** Optional subtitle / description */
  description?: string
  /** Action buttons rendered on the right */
  actions?: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Consistent page header matching legacy pattern.
 * Title on the left, optional actions on the right.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6', className)}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
