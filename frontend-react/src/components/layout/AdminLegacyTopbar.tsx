import { Link, useRouterState } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getAdminRouteMeta } from './admin-meta'

/**
 * Topbar legado para paginas administrativas.
 * Replica o padrao dos templates HTML antigos (logo + titulo + subtitulo).
 */
export function AdminLegacyTopbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const meta = getAdminRouteMeta(pathname)

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo/logo-pge.png" alt="PGE-MS" className="h-10 w-auto" />
            </Link>

            <div className="border-l border-gray-300 pl-4">
              <h1 className="font-semibold text-gray-800 leading-tight">{meta.title}</h1>
              {meta.subtitle && (
                <p className="text-xs text-gray-500 leading-tight mt-0.5">{meta.subtitle}</p>
              )}
            </div>
          </div>

          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </header>
  )
}
