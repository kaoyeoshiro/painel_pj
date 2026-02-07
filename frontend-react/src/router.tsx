/**
 * Configuracao central do router (Tanstack Router).
 *
 * Todas as rotas sao definidas aqui. Todos os sistemas e admins
 * foram migrados para React.
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

// Admin pages
import { UsersPage } from '@/pages/admin/users/UsersPage'
import { PromptsPage } from '@/pages/admin/prompts/PromptsPage'
import { PromptsModulosPage } from '@/pages/admin/prompts-modulos/PromptsModulosPage'
import { FeedbacksPage } from '@/pages/admin/feedbacks/FeedbacksPage'
import { PerformancePage } from '@/pages/admin/performance/PerformancePage'
import { VariaveisPage } from '@/pages/admin/variaveis/VariaveisPage'
import { CategoriasJsonPage } from '@/pages/admin/categorias-json/CategoriasJsonPage'
import { HistoricoGeradorPage } from '@/pages/admin/historico-gerador/HistoricoGeradorPage'
import { HistoricoPedidoCalculoPage } from '@/pages/admin/historico-pedido-calculo/HistoricoPedidoCalculoPage'
import { HistoricoPrestacaoContasPage } from '@/pages/admin/historico-prestacao-contas/HistoricoPrestacaoContasPage'
import { ModulosTipoPecaPage } from '@/pages/admin/modulos-tipo-peca/ModulosTipoPecaPage'
import { ConfigPecasPage } from '@/pages/admin/config-pecas/ConfigPecasPage'
import { TesteAtivacaoPage } from '@/pages/admin/teste-ativacao/TesteAtivacaoPage'
import { TesteCategoriasPage } from '@/pages/admin/teste-categorias/TesteCategoriasPage'
import { TjmsDocsPage } from '@/pages/admin/tjms-docs/TjmsDocsPage'
import { RestaurarSlugsPage } from '@/pages/admin/restaurar-slugs/RestaurarSlugsPage'

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
  component: UsersPage,
})

const adminPromptsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts',
  component: PromptsPage,
})

const adminPromptsModulosRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-modulos',
  component: PromptsModulosPage,
})

const adminFeedbacksRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/feedbacks',
  component: FeedbacksPage,
})

const adminPerformanceRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/performance',
  component: PerformancePage,
})

const adminVariaveisRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/variaveis',
  component: VariaveisPage,
})

const adminCategoriasJsonRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/categorias-json',
  component: CategoriasJsonPage,
})

const adminHistoricoGeradorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-gerador',
  component: HistoricoGeradorPage,
})

const adminHistoricoPedidoCalculoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-pedido-calculo',
  component: HistoricoPedidoCalculoPage,
})

const adminHistoricoPrestacaoContasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-prestacao-contas',
  component: HistoricoPrestacaoContasPage,
})

const adminModulosTipoPecaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/modulos-tipo-peca',
  component: ModulosTipoPecaPage,
})

const adminConfigPecasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/config-pecas',
  component: ConfigPecasPage,
})

const adminTesteAtivacaoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/teste-ativacao',
  component: TesteAtivacaoPage,
})

const adminTesteCategoriasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/teste-categorias',
  component: TesteCategoriasPage,
})

const adminTjmsDocsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/tjms-docs',
  component: TjmsDocsPage,
})

const adminRestaurarSlugsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/restaurar-slugs',
  component: RestaurarSlugsPage,
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
