/**
 * Configuracao central do router (Tanstack Router).
 *
 * Todas as rotas sao definidas aqui com componentes placeholder.
 * Conforme os modulos forem migrados, os componentes serao substituidos
 * pelas paginas reais.
 */

import { createRouter, createRootRoute, createRoute, redirect, Outlet } from '@tanstack/react-router'

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
// Root route
// ---------------------------------------------------------------------------
const rootRoute = createRootRoute({
  component: () => <Outlet />,
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
// Rotas publicas
// ---------------------------------------------------------------------------
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => <Placeholder titulo="Login" />,
})

// ---------------------------------------------------------------------------
// Rotas autenticadas
// ---------------------------------------------------------------------------
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: () => <Placeholder titulo="Dashboard" />,
})

const geradorPecasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gerador-pecas',
  component: () => <Placeholder titulo="Gerador de Pecas" />,
})

const extratorAutosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/extrator-autos',
  component: () => <Placeholder titulo="Extrator de Autos" />,
})

const classificadorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/classificador',
  component: () => <Placeholder titulo="Classificador de Documentos" />,
})

const pedidoCalculoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedido-calculo',
  component: () => <Placeholder titulo="Pedido de Calculo" />,
})

const prestacaoContasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prestacao-contas',
  component: () => <Placeholder titulo="Prestacao de Contas" />,
})

const relatorioCumprimentoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/relatorio-cumprimento',
  component: () => <Placeholder titulo="Relatorio de Cumprimento" />,
})

const cumprimentoBetaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cumprimento-beta',
  component: () => <Placeholder titulo="Cumprimento (Beta)" />,
})

const assistenciaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/assistencia',
  component: () => <Placeholder titulo="Assistencia Judiciaria" />,
})

const matriculasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/matriculas',
  component: () => <Placeholder titulo="Matriculas Confrontantes" />,
})

const bertTrainingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bert-training',
  component: () => <Placeholder titulo="BERT Training" />,
})

const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/change-password',
  component: () => <Placeholder titulo="Alterar Senha" />,
})

const devDesignSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/design-system',
  component: () => <Placeholder titulo="Design System" />,
})

// ---------------------------------------------------------------------------
// Rotas administrativas (/admin/*)
// ---------------------------------------------------------------------------
const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: () => <Placeholder titulo="Gerenciar Usuarios" />,
})

const adminPromptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/prompts',
  component: () => <Placeholder titulo="Configuracao de Prompts" />,
})

const adminPromptsModulosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/prompts-modulos',
  component: () => <Placeholder titulo="Modulos de Prompts" />,
})

const adminFeedbacksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/feedbacks',
  component: () => <Placeholder titulo="Feedbacks" />,
})

const adminPerformanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/performance',
  component: () => <Placeholder titulo="Performance" />,
})

const adminVariaveisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/variaveis',
  component: () => <Placeholder titulo="Variaveis" />,
})

const adminCategoriasJsonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/categorias-json',
  component: () => <Placeholder titulo="Categorias JSON" />,
})

const adminHistoricoGeradorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/historico-gerador',
  component: () => <Placeholder titulo="Historico - Gerador de Pecas" />,
})

const adminHistoricoPedidoCalculoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/historico-pedido-calculo',
  component: () => <Placeholder titulo="Historico - Pedido de Calculo" />,
})

const adminHistoricoPrestacaoContasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/historico-prestacao-contas',
  component: () => <Placeholder titulo="Historico - Prestacao de Contas" />,
})

const adminModulosTipoPecaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/modulos-tipo-peca',
  component: () => <Placeholder titulo="Modulos por Tipo de Peca" />,
})

const adminConfigPecasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/config-pecas',
  component: () => <Placeholder titulo="Configuracao de Pecas" />,
})

const adminTesteAtivacaoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/teste-ativacao',
  component: () => <Placeholder titulo="Teste de Ativacao" />,
})

const adminTesteCategoriasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/teste-categorias',
  component: () => <Placeholder titulo="Teste de Categorias" />,
})

const adminTjmsDocsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/tjms-docs',
  component: () => <Placeholder titulo="Documentacao TJ-MS" />,
})

const adminRestaurarSlugsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/restaurar-slugs',
  component: () => <Placeholder titulo="Restaurar Slugs" />,
})

// ---------------------------------------------------------------------------
// Arvore de rotas
// ---------------------------------------------------------------------------
const routeTree = rootRoute.addChildren([
  // Index (redirect)
  indexRoute,

  // Publica
  loginRoute,

  // Autenticadas
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
