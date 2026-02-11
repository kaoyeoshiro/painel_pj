import { Link } from '@tanstack/react-router'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

interface SystemTopbarProps {
  /** Page title displayed next to the logo */
  title: string
  /** Small subtitle below the title */
  subtitle?: string
  /** Optional icon rendered before the title (inside a colored badge) */
  icon?: React.ReactNode
  /** Right-side action buttons */
  actions?: React.ReactNode
  /** Back link destination (default: /dashboard) */
  backTo?: string
  /** Additional CSS classes on the root element */
  className?: string
}

/**
 * Standalone topbar for system pages that render WITHOUT the React shell
 * (Header + Sidebar). Matches the legacy portal header pattern:
 *   ← | PGE Logo | divider | icon? + title/subtitle | actions | logout
 */
export function SystemTopbar({
  title,
  subtitle,
  icon,
  actions,
  backTo = '/dashboard',
  className,
}: SystemTopbarProps) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        {/* Left: back + logo + divider + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={backTo}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <Link to="/dashboard" className="flex-shrink-0 hover:opacity-80 transition-opacity">
            <img
              src="/logo/logo-pge.png"
              alt="PGE-MS"
              className="h-10 w-auto"
            />
          </Link>

          <div className="h-8 w-px bg-gray-300 flex-shrink-0" />

          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="flex-shrink-0 text-primary-600">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-800 leading-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-gray-500 leading-tight mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions + logout */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}
          <button
            onClick={handleLogout}
            className="ml-2 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-50"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
