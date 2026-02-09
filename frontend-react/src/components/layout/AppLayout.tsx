import { Outlet, useRouterState } from '@tanstack/react-router'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

const ALWAYS_LEGACY_FRAME_PREFIXES = ['/admin/']
const ALWAYS_NATIVE_NO_SHELL_PREFIXES = [
  '/pedido-calculo',
  '/prestacao-contas',
  '/bert-training',
]

const MOBILE_INLINE_TOPBAR_PREFIXES = [
  '/assistencia',
  '/matriculas',
  '/pedido-calculo',
  '/prestacao-contas',
  '/relatorio-cumprimento',
  '/classificador',
]

const CONDITIONAL_LEGACY_SYSTEM_PREFIXES: Array<{ prefix: string; nativeFlag: string | undefined }> = [
  { prefix: '/assistencia', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_ASSISTENCIA },
  { prefix: '/matriculas', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_MATRICULAS },
  { prefix: '/gerador-pecas', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_GERADOR_PECAS },
  { prefix: '/pedido-calculo', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_PEDIDO_CALCULO },
  { prefix: '/prestacao-contas', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_PRESTACAO_CONTAS },
  { prefix: '/relatorio-cumprimento', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_RELATORIO_CUMPRIMENTO },
  { prefix: '/classificador', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_CLASSIFICADOR },
  { prefix: '/bert-training', nativeFlag: import.meta.env.VITE_PORTAL_NATIVE_BERT_TRAINING },
]

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`)
}

function shouldRenderWithoutReactShell(pathname: string): boolean {
  const isAlwaysLegacy = ALWAYS_LEGACY_FRAME_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix)
  )

  if (isAlwaysLegacy) return true

  const isAlwaysNativeNoShell = ALWAYS_NATIVE_NO_SHELL_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix)
  )

  if (isAlwaysNativeNoShell) return true

  // Em sistemas do portal, só removemos o shell quando houver rollback explícito
  // para legado (VITE_PORTAL_NATIVE_*=0).
  return CONDITIONAL_LEGACY_SYSTEM_PREFIXES.some(
    ({ prefix, nativeFlag }) => nativeFlag === '0' && pathMatchesPrefix(pathname, prefix)
  )
}

function shouldUseInlineTopbarOnMobile(pathname: string): boolean {
  return MOBILE_INLINE_TOPBAR_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))
}

/**
 * Layout principal da aplicação autenticada
 * Estrutura: Header (topo) + Sidebar (esquerda) + Content (centro)
 * O botão "Voltar ao Dashboard" é responsabilidade de cada página via PageHeader.backTo
 */
export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const shouldSkipShell = shouldRenderWithoutReactShell(pathname)
  const useInlineTopbarOnMobile = shouldUseInlineTopbarOnMobile(pathname)

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
        {useInlineTopbarOnMobile ? (
          <div className="hidden sm:block">
            <Header />
          </div>
        ) : (
          <Header />
        )}

        {/* Área de conteúdo (renderiza as páginas) */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
