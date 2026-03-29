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

import { lazy, type ComponentType } from 'react'
import { createRouter, createRootRoute, createRoute, redirect, Outlet } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { LoginPage } from '@/pages/login/LoginPage'

// ---------------------------------------------------------------------------
// lazyWithRetry — tenta importar o chunk novamente apos falha (ex: deploy novo)
// Resolve "Failed to fetch dynamically imported module" intermitente.
// ---------------------------------------------------------------------------

function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    importFn().catch(() => {
      // Chunk antigo nao existe mais (novo deploy alterou os hashes).
      // Forca reload para buscar o HTML atualizado com os novos chunks.
      // Usa sessionStorage flag para evitar loop infinito de reloads.
      const key = 'chunk-reload'
      const hasReloaded = sessionStorage.getItem(key)
      if (!hasReloaded) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
      }
      // Se ja recarregou e ainda falha, limpa flag e propaga o erro
      sessionStorage.removeItem(key)
      return importFn()
    }),
  )
}

// ---------------------------------------------------------------------------
// Lazy imports — cada pagina vira um chunk separado no build
// ---------------------------------------------------------------------------

// Sistemas
const DashboardPageV2 = lazyWithRetry(() => import('@/pages/dashboard/DashboardPageV2').then(m => ({ default: m.DashboardPageV2 as ComponentType<unknown> })))
const GeradorPecasPage = lazyWithRetry(() => import('@/pages/gerador-pecas/GeradorPecasPage').then(m => ({ default: m.GeradorPecasPage as ComponentType<unknown> })))
const ExtratorAutosPage = lazyWithRetry(() => import('@/pages/extrator-autos/ExtratorAutosPage').then(m => ({ default: m.ExtratorAutosPage as ComponentType<unknown> })))
const ClassificadorPage = lazyWithRetry(() => import('@/pages/classificador/ClassificadorPage').then(m => ({ default: m.ClassificadorPage as ComponentType<unknown> })))
const PedidoCalculoPage = lazyWithRetry(() => import('@/pages/pedido-calculo/PedidoCalculoPage').then(m => ({ default: m.PedidoCalculoPage as ComponentType<unknown> })))
const PrestacaoContasPage = lazyWithRetry(() => import('@/pages/prestacao-contas/PrestacaoContasPage').then(m => ({ default: m.PrestacaoContasPage as ComponentType<unknown> })))
const RelatorioCumprimentoPage = lazyWithRetry(() => import('@/pages/relatorio-cumprimento/RelatorioCumprimentoPage').then(m => ({ default: m.RelatorioCumprimentoPage as ComponentType<unknown> })))
const CumprimentoBetaPage = lazyWithRetry(() => import('@/pages/cumprimento-beta/CumprimentoBetaPage').then(m => ({ default: m.CumprimentoBetaPage as ComponentType<unknown> })))
const AssistenciaPage = lazyWithRetry(() => import('@/pages/assistencia/AssistenciaPage').then(m => ({ default: m.AssistenciaPage as ComponentType<unknown> })))
const MatriculasPage = lazyWithRetry(() => import('@/pages/matriculas/MatriculasPage').then(m => ({ default: m.default as ComponentType<unknown> })))
const BertTrainingPage = lazyWithRetry(() => import('@/pages/bert-training/BertTrainingPage').then(m => ({ default: m.BertTrainingPage as ComponentType<unknown> })))
const ChangePasswordPage = lazyWithRetry(() => import('@/pages/change-password/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage as ComponentType<unknown> })))
const DesignSystemPage = lazyWithRetry(() => import('@/pages/dev/DesignSystemPage').then(m => ({ default: m.DesignSystemPage as ComponentType<unknown> })))

// Admin
const UsersPage = lazyWithRetry(() => import('@/pages/admin/users/UsersPage').then(m => ({ default: m.UsersPage as ComponentType<unknown> })))
const PromptsPage = lazyWithRetry(() => import('@/pages/admin/prompts/PromptsPage').then(m => ({ default: m.PromptsPage as ComponentType<unknown> })))
const PromptsModulosPage = lazyWithRetry(() => import('@/pages/admin/prompts-modulos/PromptsModulosPage').then(m => ({ default: m.PromptsModulosPage as ComponentType<unknown> })))
const FeedbacksPage = lazyWithRetry(() => import('@/pages/admin/feedbacks/FeedbacksPage').then(m => ({ default: m.FeedbacksPage as ComponentType<unknown> })))
const PerformancePage = lazyWithRetry(() => import('@/pages/admin/performance/PerformancePage').then(m => ({ default: m.PerformancePage as ComponentType<unknown> })))
const VariaveisPage = lazyWithRetry(() => import('@/pages/admin/variaveis/VariaveisPage').then(m => ({ default: m.VariaveisPage as ComponentType<unknown> })))
const CategoriasJsonPage = lazyWithRetry(() => import('@/pages/admin/categorias-json/CategoriasJsonPage').then(m => ({ default: m.CategoriasJsonPage as ComponentType<unknown> })))
const HistoricoGeradorPage = lazyWithRetry(() => import('@/pages/admin/historico-gerador/HistoricoGeradorPage').then(m => ({ default: m.HistoricoGeradorPage as ComponentType<unknown> })))
const HistoricoPedidoCalculoPage = lazyWithRetry(() => import('@/pages/admin/historico-pedido-calculo/HistoricoPedidoCalculoPage').then(m => ({ default: m.HistoricoPedidoCalculoPage as ComponentType<unknown> })))
const HistoricoPrestacaoContasPage = lazyWithRetry(() => import('@/pages/admin/historico-prestacao-contas/HistoricoPrestacaoContasPage').then(m => ({ default: m.HistoricoPrestacaoContasPage as ComponentType<unknown> })))
const ModulosTipoPecaPage = lazyWithRetry(() => import('@/pages/admin/modulos-tipo-peca/ModulosTipoPecaPage').then(m => ({ default: m.ModulosTipoPecaPage as ComponentType<unknown> })))
const ConfigPecasPage = lazyWithRetry(() => import('@/pages/admin/config-pecas/ConfigPecasPage').then(m => ({ default: m.ConfigPecasPage as ComponentType<unknown> })))
const FiltroDocumentosPage = lazyWithRetry(() => import('@/pages/admin/filtro-documentos/FiltroDocumentosPage').then(m => ({ default: m.FiltroDocumentosPage as ComponentType<unknown> })))
const TesteAtivacaoPage = lazyWithRetry(() => import('@/pages/admin/teste-ativacao/TesteAtivacaoPage').then(m => ({ default: m.TesteAtivacaoPage as ComponentType<unknown> })))
const TesteCategoriasPage = lazyWithRetry(() => import('@/pages/admin/teste-categorias/TesteCategoriasPage').then(m => ({ default: m.TesteCategoriasPage as ComponentType<unknown> })))
const TjmsDocsPage = lazyWithRetry(() => import('@/pages/admin/tjms-docs/TjmsDocsPage').then(m => ({ default: m.TjmsDocsPage as ComponentType<unknown> })))
const RestaurarSlugsPage = lazyWithRetry(() => import('@/pages/admin/restaurar-slugs/RestaurarSlugsPage').then(m => ({ default: m.RestaurarSlugsPage as ComponentType<unknown> })))
const ArvoreDecisaoPage = lazyWithRetry(() => import('@/pages/admin/arvore-decisao/ArvoreDecisaoPage').then(m => ({ default: m.ArvoreDecisaoPage as ComponentType<unknown> })))

// Revisao de Pecas
const RevisaoPage = lazyWithRetry(() =>
  import('@/pages/revisao/RevisaoPage').then(m => ({ default: m.RevisaoPage as ComponentType<unknown> }))
)
const RevisaoItemPage = lazyWithRetry(() =>
  import('@/pages/revisao/RevisaoItemPage').then(m => ({ default: m.RevisaoItemPage as ComponentType<unknown> }))
)

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

// Alias: /admin/prompts-config redireciona para /admin/prompts (rota canonica)
const adminPromptsConfigAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-config',
  beforeLoad: () => {
    throw redirect({ to: '/admin/prompts' })
  },
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

const adminFiltroDocumentosRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/filtro-documentos',
  component: FiltroDocumentosPage,
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

const adminArvoreDecisaoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/arvore-decisao',
  component: ArvoreDecisaoPage,
})

const revisaoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/revisao',
  component: RevisaoPage,
})

const revisaoItemRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/revisao/$itemId',
  component: RevisaoItemPage,
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
    adminFiltroDocumentosRoute,
    adminTesteAtivacaoRoute,
    adminTesteAtivacaoAliasRoute,
    adminTesteCategoriasRoute,
    adminTesteCategoriasAliasRoute,
    adminTjmsDocsRoute,
    adminTjmsDocsPlanoRoute,
    adminRestaurarSlugsRoute,
    adminArvoreDecisaoRoute,

    // Revisao de Pecas
    revisaoRoute,
    revisaoItemRoute,
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
