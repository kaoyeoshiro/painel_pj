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
import { CumprimentoBetaPage } from '@/pages/cumprimento-beta/CumprimentoBetaPage'
import { ExtratorAutosPage } from '@/pages/extrator-autos/ExtratorAutosPage'
import { LegacyAdminFramePage } from '@/pages/admin/legacy/LegacyAdminFramePage'


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
  component: GeradorPecasLegacyPage,
})

const extratorAutosRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/extrator-autos',
  component: ExtratorAutosPage,
})

const classificadorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/classificador',
  component: ClassificadorLegacyPage,
})

const pedidoCalculoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/pedido-calculo',
  component: PedidoCalculoLegacyPage,
})

const prestacaoContasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/prestacao-contas',
  component: PrestacaoContasLegacyPage,
})

const relatorioCumprimentoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/relatorio-cumprimento',
  component: RelatorioCumprimentoLegacyPage,
})

const cumprimentoBetaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/cumprimento-beta',
  component: CumprimentoBetaPage,
})

const assistenciaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/assistencia',
  component: AssistenciaLegacyPage,
})

const matriculasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/matriculas',
  component: MatriculasLegacyPage,
})

const bertTrainingRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/bert-training',
  component: BertTrainingLegacyPage,
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

function AssistenciaLegacyPage() { return <LegacyAdminFramePage legacyPath="/assistencia" /> }
function MatriculasLegacyPage() { return <LegacyAdminFramePage legacyPath="/matriculas" /> }
function GeradorPecasLegacyPage() { return <LegacyAdminFramePage legacyPath="/gerador-pecas" /> }
function PedidoCalculoLegacyPage() { return <LegacyAdminFramePage legacyPath="/pedido-calculo" /> }
function PrestacaoContasLegacyPage() { return <LegacyAdminFramePage legacyPath="/prestacao-contas" /> }
function RelatorioCumprimentoLegacyPage() { return <LegacyAdminFramePage legacyPath="/relatorio-cumprimento" /> }
function ClassificadorLegacyPage() { return <LegacyAdminFramePage legacyPath="/classificador" /> }
function BertTrainingLegacyPage() { return <LegacyAdminFramePage legacyPath="/bert-training" /> }

function AdminUsersLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/users" /> }
function AdminPromptsLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/prompts-config" /> }
function AdminPromptsModulosLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/prompts-modulos" /> }
function AdminFeedbacksLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/feedbacks" /> }
function AdminPerformanceLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/performance" /> }
function AdminVariaveisLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/variaveis" /> }
function AdminCategoriasJsonLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/categorias-resumo-json" /> }
function AdminHistoricoGeradorLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/gerador-pecas/historico" /> }
function AdminHistoricoPedidoCalculoLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/pedido-calculo/debug" /> }
function AdminHistoricoPrestacaoContasLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/prestacao-contas/debug" /> }
function AdminModulosTipoPecaLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/modulos-tipo-peca" /> }
function AdminConfigPecasLegacyPage() { return <LegacyAdminFramePage legacyPath="/api/gerador-pecas/config/admin" /> }
function AdminTesteAtivacaoLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/prompts-modulos/teste" /> }
function AdminTesteCategoriasLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/categorias-resumo-json/teste" /> }
function AdminTjmsDocsLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/tjms-docs" /> }
function AdminTjmsDocsPlanoLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/tjms-docs/plano" /> }
function AdminRestaurarSlugsLegacyPage() { return <LegacyAdminFramePage legacyPath="/admin/restaurar-slugs" /> }

// ---------------------------------------------------------------------------
// Rotas administrativas (/admin/*) - com layout
// ---------------------------------------------------------------------------
const adminUsersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/users',
  component: AdminUsersLegacyPage,
})

const adminPromptsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts',
  component: AdminPromptsLegacyPage,
})

const adminPromptsConfigAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-config',
  component: AdminPromptsLegacyPage,
})

const adminPromptsModulosRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-modulos',
  component: AdminPromptsModulosLegacyPage,
})

const adminFeedbacksRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/feedbacks',
  component: AdminFeedbacksLegacyPage,
})

const adminPerformanceRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/performance',
  component: AdminPerformanceLegacyPage,
})

const adminVariaveisRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/variaveis',
  component: AdminVariaveisLegacyPage,
})

const adminCategoriasJsonRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/categorias-json',
  component: AdminCategoriasJsonLegacyPage,
})

const adminCategoriasResumoJsonAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/categorias-resumo-json',
  component: AdminCategoriasJsonLegacyPage,
})

const adminHistoricoGeradorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-gerador',
  component: AdminHistoricoGeradorLegacyPage,
})

const adminHistoricoGeradorAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/gerador-pecas/historico',
  component: AdminHistoricoGeradorLegacyPage,
})

const adminHistoricoPedidoCalculoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-pedido-calculo',
  component: AdminHistoricoPedidoCalculoLegacyPage,
})

const adminHistoricoPedidoCalculoAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/pedido-calculo/debug',
  component: AdminHistoricoPedidoCalculoLegacyPage,
})

const adminHistoricoPrestacaoContasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/historico-prestacao-contas',
  component: AdminHistoricoPrestacaoContasLegacyPage,
})

const adminHistoricoPrestacaoContasAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prestacao-contas/debug',
  component: AdminHistoricoPrestacaoContasLegacyPage,
})

const adminModulosTipoPecaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/modulos-tipo-peca',
  component: AdminModulosTipoPecaLegacyPage,
})

const adminConfigPecasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/config-pecas',
  component: AdminConfigPecasLegacyPage,
})

const adminTesteAtivacaoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/teste-ativacao',
  component: AdminTesteAtivacaoLegacyPage,
})

const adminTesteAtivacaoAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/prompts-modulos/teste',
  component: AdminTesteAtivacaoLegacyPage,
})

const adminTesteCategoriasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/teste-categorias',
  component: AdminTesteCategoriasLegacyPage,
})

const adminTesteCategoriasAliasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/categorias-resumo-json/teste',
  component: AdminTesteCategoriasLegacyPage,
})

const adminTjmsDocsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/tjms-docs',
  component: AdminTjmsDocsLegacyPage,
})

const adminTjmsDocsPlanoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/tjms-docs/plano',
  component: AdminTjmsDocsPlanoLegacyPage,
})

const adminRestaurarSlugsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/restaurar-slugs',
  component: AdminRestaurarSlugsLegacyPage,
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
