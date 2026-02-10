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
import { DashboardPageV2 } from '@/pages/dashboard/DashboardPageV2'
import { ChangePasswordPage } from '@/pages/change-password/ChangePasswordPage'
import { DesignSystemPage } from '@/pages/dev/DesignSystemPage'
import { CumprimentoBetaPage } from '@/pages/cumprimento-beta/CumprimentoBetaPage'
import { ExtratorAutosPage } from '@/pages/extrator-autos/ExtratorAutosPage'
import { LegacyAdminFramePage } from '@/pages/admin/legacy/LegacyAdminFramePage'
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
import MatriculasPage from '@/pages/matriculas/MatriculasPage'
import { AssistenciaPage } from '@/pages/assistencia/AssistenciaPage'
import { ClassificadorPage } from '@/pages/classificador/ClassificadorPage'
import { PedidoCalculoPage } from '@/pages/pedido-calculo/PedidoCalculoPage'
import { PrestacaoContasPage } from '@/pages/prestacao-contas/PrestacaoContasPage'
import { RelatorioCumprimentoPage } from '@/pages/relatorio-cumprimento/RelatorioCumprimentoPage'
import { GeradorPecasPage } from '@/pages/gerador-pecas/GeradorPecasPage'
import { BertTrainingPage } from '@/pages/bert-training/BertTrainingPage'


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
  component: DashboardPageV2,
})

const geradorPecasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/gerador-pecas',
  component: GeradorPecasRoutePage,
})

const extratorAutosRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/extrator-autos',
  component: ExtratorAutosPage,
})

const classificadorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/classificador',
  component: ClassificadorRoutePage,
})

const pedidoCalculoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/pedido-calculo',
  component: PedidoCalculoRoutePage,
})

const prestacaoContasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/prestacao-contas',
  component: PrestacaoContasRoutePage,
})

const relatorioCumprimentoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/relatorio-cumprimento',
  component: RelatorioCumprimentoRoutePage,
})

const cumprimentoBetaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/cumprimento-beta',
  component: CumprimentoBetaPage,
})

const assistenciaRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/assistencia',
  component: AssistenciaRoutePage,
})

const matriculasRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/matriculas',
  component: MatriculasRoutePage,
})

const bertTrainingRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/bert-training',
  component: BertTrainingRoutePage,
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

function shouldUseNativeByDefault(nativeFlag: string | undefined): boolean {
  return nativeFlag !== '0'
}

function shouldUseNativeMatriculas(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_MATRICULAS)
}

function MatriculasRoutePage() {
  if (shouldUseNativeMatriculas()) return <MatriculasPage />
  return <MatriculasLegacyPage />
}

function shouldUseNativeAssistencia(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_ASSISTENCIA)
}

function AssistenciaRoutePage() {
  if (shouldUseNativeAssistencia()) return <AssistenciaPage />
  return <AssistenciaLegacyPage />
}

function shouldUseNativeClassificador(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_CLASSIFICADOR)
}

function ClassificadorRoutePage() {
  if (shouldUseNativeClassificador()) return <ClassificadorPage />
  return <ClassificadorLegacyPage />
}

function shouldUseNativePedidoCalculo(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_PEDIDO_CALCULO)
}

function PedidoCalculoRoutePage() {
  if (shouldUseNativePedidoCalculo()) return <PedidoCalculoPage />
  return <PedidoCalculoLegacyPage />
}

function shouldUseNativePrestacaoContas(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_PRESTACAO_CONTAS)
}

function PrestacaoContasRoutePage() {
  if (shouldUseNativePrestacaoContas()) return <PrestacaoContasPage />
  return <PrestacaoContasLegacyPage />
}

function shouldUseNativeRelatorioCumprimento(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_RELATORIO_CUMPRIMENTO)
}

function RelatorioCumprimentoRoutePage() {
  if (shouldUseNativeRelatorioCumprimento()) return <RelatorioCumprimentoPage />
  return <RelatorioCumprimentoLegacyPage />
}

function shouldUseNativeGeradorPecas(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_GERADOR_PECAS)
}

function GeradorPecasRoutePage() {
  if (shouldUseNativeGeradorPecas()) return <GeradorPecasPage />
  return <GeradorPecasLegacyPage />
}

function shouldUseNativeBertTraining(): boolean {
  return shouldUseNativeByDefault(import.meta.env.VITE_PORTAL_NATIVE_BERT_TRAINING)
}

function BertTrainingRoutePage() {
  if (shouldUseNativeBertTraining()) return <BertTrainingPage />
  return <BertTrainingLegacyPage />
}

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
