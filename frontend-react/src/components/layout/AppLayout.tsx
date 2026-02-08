import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

/**
 * Rotas que já possuem botão de voltar próprio no header interno
 * ou que não precisam de botão (ex: dashboard é a página inicial)
 */
const ROTAS_SEM_BOTAO_VOLTAR = new Set([
  '/dashboard',
  '/gerador-pecas',
  '/extrator-autos',
  '/pedido-calculo',
  '/assistencia',
  '/matriculas',
  '/relatorio-cumprimento',
  '/cumprimento-beta',
  '/bert-training',
  '/change-password',
])

/**
 * Layout principal da aplicação autenticada
 * Estrutura: Header (topo) + Sidebar (esquerda) + Content (centro)
 */
export function AppLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const showBackButton = !ROTAS_SEM_BOTAO_VOLTAR.has(pathname)

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
          {showBackButton && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate({ to: '/dashboard' })}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
