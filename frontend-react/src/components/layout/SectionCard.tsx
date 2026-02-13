import { cn } from '@/lib/utils'

interface SectionCardProps {
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * White card wrapper matching legacy filter/section containers.
 * Provides consistent border, radius, shadow and padding.
 */
export function SectionCard({ children, className }: SectionCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border border-gray-200 p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
