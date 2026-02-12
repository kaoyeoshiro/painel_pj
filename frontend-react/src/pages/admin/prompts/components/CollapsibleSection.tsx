import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { C } from '@/lib/designTokens'

interface CollapsibleSectionProps {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  /** Controle externo (para Expandir/Recolher tudo) */
  isOpen?: boolean
  onToggle?: (open: boolean) => void
  badge?: React.ReactNode
  children: React.ReactNode
  testId?: string
}

/**
 * Seção colapsável reutilizável com chevron animado.
 * Suporta controle externo via isOpen/onToggle.
 */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  isOpen: controlledOpen,
  onToggle,
  badge,
  children,
  testId,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen

  useEffect(() => {
    if (controlledOpen !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sincronização de prop controlada com estado interno
      setInternalOpen(controlledOpen)
    }
  }, [controlledOpen])

  const toggle = () => {
    const next = !open
    setInternalOpen(next)
    onToggle?.(next)
  }

  return (
    <div
      data-testid={testId}
      className="rounded-lg"
      style={{ border: `1px solid ${C.gray200}` }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex items-center justify-between w-full px-4 py-3 text-left transition-colors rounded-lg hover:bg-gray-50/60"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="transition-transform duration-200"
            style={{ display: 'inline-flex', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            <ChevronDown className="h-4 w-4" style={{ color: C.text400 }} />
          </span>
          <div className="min-w-0">
            <span className="text-sm font-semibold" style={{ color: C.text900 }}>{title}</span>
            {subtitle && (
              <span className="text-xs ml-2" style={{ color: C.text500 }}>{subtitle}</span>
            )}
          </div>
          {badge}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  )
}
