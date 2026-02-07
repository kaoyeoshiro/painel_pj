/**
 * Configuracao central do router (Tanstack Router).
 *
 * Todas as rotas sao definidas aqui com componentes placeholder.
 * Conforme os modulos forem migrados, os componentes serao substituidos
 * pelas paginas reais.
 */

import { createRouter, createRootRoute, createRoute, redirect, Outlet } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { LoginPage } from '@/pages/login/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ChangePasswordPage } from '@/pages/change-password/ChangePasswordPage'
import { DesignSystemPage } from '@/pages/dev/DesignSystemPage'
import { AssistenciaPage } from '@/pages/assistencia/AssistenciaPage'
import MatriculasPage from '@/pages/matriculas/MatriculasPage'
import { CumprimentoBetaPage } from '@/pages/cumprimento-beta/CumprimentoBetaPage'
import { PedidoCalculoPage } from '@/pages/pedido-calculo/PedidoCalculoPage'
import { PrestacaoContasPage } from '@/pages/prestacao-contas/PrestacaoContasPage'
import { RelatorioCumprimentoPage } from '@/pages/relatorio-cumprimento/RelatorioCumprimentoPage'
import { BertTrainingPage } from '@/pages/bert-training/BertTrainingPage'
import { GeradorPecasPage } from '@/pages/gerador-pecas/GeradorPecasPage'
import { ExtratorAutosPage } from '@/pages/extrator-autos/ExtratorAutosPage'
import { ClassificadorPage } from '@/pages/classificador/ClassificadorPage'

// ---------------------------------------------------------------------------
// Componente placeholder generico
// ---------------------------------------------------------------------------
function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="mt-2 text-muted-foreground">Em construcao...</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root route - renderiza apenas Outlet
// ---------------------------------------------------------------------------
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// ---------------------------------------------------------------------------
// Layout route - wraps authenticated routes com AppLayout + AuthGuard
// ---------------------------------------------------------------------------
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
  component: () => (
    <AuthGuard>
      <AppLayout />
    </AuthGuard>
  ),
})

// ---------------------------------------------------------------------------
// Rota index — redireciona para /dashboard
// ---------------------------------------------------------------------------
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})

// ---------------------------------------------------------------------------
// Rotas publicas (sem layout)
// ---------------------------------------------------------------------------
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// ---------------------------------------------------------------------------
// Rotas autenticadas (com layout)
// ---------------------------------------------------------------------------
const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const geradorPecasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/gerador-pecas',
  component: GeradorPecasPage,
})

const extratorAutosRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/extrator-autos',
  component: ExtratorAutosPage,
})

const classificadorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/classificador',
  component: ClassificadorPage,
})

const pedidoCalculoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/pedido-calculo',
  component: PedidoCalculoPage,
})

const prestacaoContasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/prestacao-contas',
  component: PrestacaoContasPage,
})

const relatorioCumprimentoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/relatorio-cumprimento',
  component: RelatorioCumprimentoPage,
})

const cumprimentoBetaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/cumprimento-beta',
  component: CumprimentoBetaPage,
})

const assistenciaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/assistencia',
  component: AssistenciaPage,
})

const matriculasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/matriculas',
  component: MatriculasPage,
})

const bertTrainingRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/bert-training',
  component: BertTrainingPage,
})

const changePasswordRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/change-password',
  component: ChangePasswordPage,
})

const devDesignSystemRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/dev/design-system',
  component: DesignSystemPage,
})

// ---------------------------------------------------------------------------
// Rotas administrativas (/admin/*) - com layout
// ---------------------------------------------------------------------------
const adminUsersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/users',
  component: () => <Placeholder titulo="Gerenciar Usuarios" />,
})

const adminPromptsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts',
  component: () => <Placeholder titulo="Configuracao de Prompts" />,
})

const adminPromptsModulosRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-modulos',
  component: () => <Placeholder titulo="Modulos de Prompts" />,
})

const adminFeedbacksRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/feedbacks',
  component: () => <Placeholder titulo="Feedbacks" />,
})

const adminPerformanceRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/performance',
  component: () => <Placeholder titulo="Performance" />,
})

const adminVariaveisRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/variaveis',
  component: () => <Placeholder titulo="Variaveis" />,
})

const adminCategoriasJsonRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/categorias-json',
  component: () => <Placeholder titulo="Categorias JSON" />,
})

const adminHistoricoGeradorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-gerador',
  component: () => <Placeholder titulo="Historico - Gerador de Pecas" />,
})

const adminHistoricoPedidoCalculoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-pedido-calculo',
  component: () => <Placeholder titulo="Historico - Pedido de Calculo" />,
})

const adminHistoricoPrestacaoContasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-prestacao-contas',
  component: () => <Placeholder titulo="Historico - Prestacao de Contas" />,
})

const adminModulosTipoPecaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/modulos-tipo-peca',
  component: () => <Placeholder titulo="Modulos por Tipo de Peca" />,
})

const adminConfigPecasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/config-pecas',
  component: () => <Placeholder titulo="Configuracao de Pecas" />,
})

const adminTesteAtivacaoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/teste-ativacao',
  component: () => <Placeholder titulo="Teste de Ativacao" />,
})

const adminTesteCategoriasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/teste-categorias',
  component: () => <Placeholder titulo="Teste de Categorias" />,
})

const adminTjmsDocsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/tjms-docs',
  component: () => <Placeholder titulo="Documentacao TJ-MS" />,
})

const adminRestaurarSlugsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/restaurar-slugs',
  component: () => <Placeholder titulo="Restaurar Slugs" />,
})

// ---------------------------------------------------------------------------
// Arvore de rotas
// ---------------------------------------------------------------------------
const routeTree = rootRoute.addChildren([
  // Index (redirect)
  indexRoute,

  // Publica (sem layout)
  loginRoute,

  // Layout route com todas as rotas autenticadas aninhadas
  layoutRoute.addChildren([
    // Sistemas
    dashboardRoute,
    geradorPecasRoute,
    extratorAutosRoute,
    classificadorRoute,
    pedidoCalculoRoute,
    prestacaoContasRoute,
    relatorioCumprimentoRoute,
    cumprimentoBetaRoute,
    assistenciaRoute,
    matriculasRoute,
    bertTrainingRoute,
    changePasswordRoute,
    devDesignSystemRoute,

    // Admin
    adminUsersRoute,
    adminPromptsRoute,
    adminPromptsModulosRoute,
    adminFeedbacksRoute,
    adminPerformanceRoute,
    adminVariaveisRoute,
    adminCategoriasJsonRoute,
    adminHistoricoGeradorRoute,
    adminHistoricoPedidoCalculoRoute,
    adminHistoricoPrestacaoContasRoute,
    adminModulosTipoPecaRoute,
    adminConfigPecasRoute,
    adminTesteAtivacaoRoute,
    adminTesteCategoriasRoute,
    adminTjmsDocsRoute,
    adminRestaurarSlugsRoute,
  ]),
])

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const router = createRouter({ routeTree })

// ---------------------------------------------------------------------------
// Registro de tipos para TypeScript
// ---------------------------------------------------------------------------
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
