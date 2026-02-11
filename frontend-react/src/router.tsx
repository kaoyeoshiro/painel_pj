/**
 * Configuracao central do router (Tanstack Router).
 *
 * Todas as rotas sao definidas aqui. Todos os sistemas e admins
 * foram migrados para React.
 *
 * PERFORMANCE: Todas as paginas sao lazy-loaded via React.lazy().
 * O Suspense boundary fica no AppLayout (ao redor do Outlet).
 * Apenas LoginPage e carregada eagerly (primeira pagina visivel).
 */

import { lazy } from 'react'
import { createRouter, createRootRoute, createRoute, redirect, Outlet } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { LoginPage } from '@/pages/login/LoginPage'

// ---------------------------------------------------------------------------
// Lazy imports — cada pagina vira um chunk separado no build
// ---------------------------------------------------------------------------

// Sistemas
const DashboardPageV2 = lazy(() => import('@/pages/dashboard/DashboardPageV2').then(m => ({ default: m.DashboardPageV2 })))
const GeradorPecasPage = lazy(() => import('@/pages/gerador-pecas/GeradorPecasPage').then(m => ({ default: m.GeradorPecasPage })))
const ExtratorAutosPage = lazy(() => import('@/pages/extrator-autos/ExtratorAutosPage').then(m => ({ default: m.ExtratorAutosPage })))
const ClassificadorPage = lazy(() => import('@/pages/classificador/ClassificadorPage').then(m => ({ default: m.ClassificadorPage })))
const PedidoCalculoPage = lazy(() => import('@/pages/pedido-calculo/PedidoCalculoPage').then(m => ({ default: m.PedidoCalculoPage })))
const PrestacaoContasPage = lazy(() => import('@/pages/prestacao-contas/PrestacaoContasPage').then(m => ({ default: m.PrestacaoContasPage })))
const RelatorioCumprimentoPage = lazy(() => import('@/pages/relatorio-cumprimento/RelatorioCumprimentoPage').then(m => ({ default: m.RelatorioCumprimentoPage })))
const CumprimentoBetaPage = lazy(() => import('@/pages/cumprimento-beta/CumprimentoBetaPage').then(m => ({ default: m.CumprimentoBetaPage })))
const AssistenciaPage = lazy(() => import('@/pages/assistencia/AssistenciaPage').then(m => ({ default: m.AssistenciaPage })))
const MatriculasPage = lazy(() => import('@/pages/matriculas/MatriculasPage'))
const BertTrainingPage = lazy(() => import('@/pages/bert-training/BertTrainingPage').then(m => ({ default: m.BertTrainingPage })))
const ChangePasswordPage = lazy(() => import('@/pages/change-password/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage })))
const DesignSystemPage = lazy(() => import('@/pages/dev/DesignSystemPage').then(m => ({ default: m.DesignSystemPage })))

// Admin
const UsersPage = lazy(() => import('@/pages/admin/users/UsersPage').then(m => ({ default: m.UsersPage })))
const PromptsPage = lazy(() => import('@/pages/admin/prompts/PromptsPage').then(m => ({ default: m.PromptsPage })))
const PromptsModulosPage = lazy(() => import('@/pages/admin/prompts-modulos/PromptsModulosPage').then(m => ({ default: m.PromptsModulosPage })))
const FeedbacksPage = lazy(() => import('@/pages/admin/feedbacks/FeedbacksPage').then(m => ({ default: m.FeedbacksPage })))
const PerformancePage = lazy(() => import('@/pages/admin/performance/PerformancePage').then(m => ({ default: m.PerformancePage })))
const VariaveisPage = lazy(() => import('@/pages/admin/variaveis/VariaveisPage').then(m => ({ default: m.VariaveisPage })))
const CategoriasJsonPage = lazy(() => import('@/pages/admin/categorias-json/CategoriasJsonPage').then(m => ({ default: m.CategoriasJsonPage })))
const HistoricoGeradorPage = lazy(() => import('@/pages/admin/historico-gerador/HistoricoGeradorPage').then(m => ({ default: m.HistoricoGeradorPage })))
const HistoricoPedidoCalculoPage = lazy(() => import('@/pages/admin/historico-pedido-calculo/HistoricoPedidoCalculoPage').then(m => ({ default: m.HistoricoPedidoCalculoPage })))
const HistoricoPrestacaoContasPage = lazy(() => import('@/pages/admin/historico-prestacao-contas/HistoricoPrestacaoContasPage').then(m => ({ default: m.HistoricoPrestacaoContasPage })))
const ModulosTipoPecaPage = lazy(() => import('@/pages/admin/modulos-tipo-peca/ModulosTipoPecaPage').then(m => ({ default: m.ModulosTipoPecaPage })))
const ConfigPecasPage = lazy(() => import('@/pages/admin/config-pecas/ConfigPecasPage').then(m => ({ default: m.ConfigPecasPage })))
const TesteAtivacaoPage = lazy(() => import('@/pages/admin/teste-ativacao/TesteAtivacaoPage').then(m => ({ default: m.TesteAtivacaoPage })))
const TesteCategoriasPage = lazy(() => import('@/pages/admin/teste-categorias/TesteCategoriasPage').then(m => ({ default: m.TesteCategoriasPage })))
const TjmsDocsPage = lazy(() => import('@/pages/admin/tjms-docs/TjmsDocsPage').then(m => ({ default: m.TjmsDocsPage })))
const RestaurarSlugsPage = lazy(() => import('@/pages/admin/restaurar-slugs/RestaurarSlugsPage').then(m => ({ default: m.RestaurarSlugsPage })))

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
// Rotas autenticadas (com layout) — componentes lazy-loaded
// ---------------------------------------------------------------------------
const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/dashboard',
  component: DashboardPageV2,
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

const adminPromptsConfigAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-config',
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

const adminCategoriasResumoJsonAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/categorias-resumo-json',
  component: CategoriasJsonPage,
})

const adminHistoricoGeradorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-gerador',
  component: HistoricoGeradorPage,
})

const adminHistoricoGeradorAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/gerador-pecas/historico',
  component: HistoricoGeradorPage,
})

const adminHistoricoPedidoCalculoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-pedido-calculo',
  component: HistoricoPedidoCalculoPage,
})

const adminHistoricoPedidoCalculoAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/pedido-calculo/debug',
  component: HistoricoPedidoCalculoPage,
})

const adminHistoricoPrestacaoContasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-prestacao-contas',
  component: HistoricoPrestacaoContasPage,
})

const adminHistoricoPrestacaoContasAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prestacao-contas/debug',
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

const adminTesteAtivacaoAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-modulos/teste',
  component: TesteAtivacaoPage,
})

const adminTesteCategoriasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/teste-categorias',
  component: TesteCategoriasPage,
})

const adminTesteCategoriasAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/categorias-resumo-json/teste',
  component: TesteCategoriasPage,
})

const adminTjmsDocsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/tjms-docs',
  component: TjmsDocsPage,
})

const adminTjmsDocsPlanoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/tjms-docs/plano',
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
    adminPromptsConfigAliasRoute,
    adminPromptsModulosRoute,
    adminFeedbacksRoute,
    adminPerformanceRoute,
    adminVariaveisRoute,
    adminCategoriasJsonRoute,
    adminCategoriasResumoJsonAliasRoute,
    adminHistoricoGeradorRoute,
    adminHistoricoGeradorAliasRoute,
    adminHistoricoPedidoCalculoRoute,
    adminHistoricoPedidoCalculoAliasRoute,
    adminHistoricoPrestacaoContasRoute,
    adminHistoricoPrestacaoContasAliasRoute,
    adminModulosTipoPecaRoute,
    adminConfigPecasRoute,
    adminTesteAtivacaoRoute,
    adminTesteAtivacaoAliasRoute,
    adminTesteCategoriasRoute,
    adminTesteCategoriasAliasRoute,
    adminTjmsDocsRoute,
    adminTjmsDocsPlanoRoute,
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
