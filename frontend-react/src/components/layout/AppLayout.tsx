import { Outlet, useRouterState } from '@tanstack/react-router'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

const LEGACY_FRAME_ROUTE_PREFIXES = [
  '/admin/',
  '/assistencia',
  '/matriculas',
  '/gerador-pecas',
  '/pedido-calculo',
  '/prestacao-contas',
  '/relatorio-cumprimento',
  '/classificador',
  '/bert-training',
]

function shouldRenderWithoutReactShell(pathname: string): boolean {
  return LEGACY_FRAME_ROUTE_PREFIXES.some((prefix) => {
    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
    return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`)
  })
}

/**
 * Layout principal da aplicação autenticada
 * Estrutura: Header (topo) + Sidebar (esquerda) + Content (centro)
 * O botão "Voltar ao Dashboard" é responsabilidade de cada página via PageHeader.backTo
 */
export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const shouldSkipShell = shouldRenderWithoutReactShell(pathname)

  if (shouldSkipShell) {
    return <Outlet />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Container principal: Header + Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <Header />

        {/* Área de conteúdo (renderiza as páginas) */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
