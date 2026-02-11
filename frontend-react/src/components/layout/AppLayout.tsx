import { Suspense } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

/** Prefixos que usam topbar inline no mobile (header oculto em telas pequenas) */
const MOBILE_INLINE_TOPBAR_PREFIXES = [
  '/classificador',
]

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`)
}

function shouldUseInlineTopbarOnMobile(pathname: string): boolean {
  return MOBILE_INLINE_TOPBAR_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))
}

/** Fallback de carregamento para rotas lazy-loaded (evita layout shift) */
function PageLoadingFallback() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-gray-200" />
      <div className="h-4 w-96 rounded-md bg-gray-200" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full rounded-md bg-gray-100" />
        <div className="h-4 w-5/6 rounded-md bg-gray-100" />
        <div className="h-4 w-4/6 rounded-md bg-gray-100" />
      </div>
    </div>
  )
}

/**
 * Layout principal da aplicação autenticada
 * Estrutura: Header (topo) + Sidebar (esquerda) + Content (centro)
 * O botão "Voltar ao Dashboard" é responsabilidade de cada página via PageHeader.backTo
 */
export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const useInlineTopbarOnMobile = shouldUseInlineTopbarOnMobile(pathname)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F7F8F9' }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Container principal: Header + Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        {useInlineTopbarOnMobile ? (
          <div className="hidden sm:block">
            <Header />
          </div>
        ) : (
          <Header />
        )}

        {/* Área de conteúdo (renderiza as páginas) */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#F7F8F9' }}>
          <Suspense fallback={<PageLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
