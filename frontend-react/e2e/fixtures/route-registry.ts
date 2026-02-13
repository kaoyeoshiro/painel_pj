/**
 * Registro centralizado de TODAS as rotas do Portal PGE.
 *
 * Cada entrada contém metadados para os testes de regressão:
 * - path, label, layout, auth
 * - aliasOf (para rotas alias que não precisam de teste duplicado)
 * - interactiveElements (descrição de ações críticas para verificar)
 */

/** Layout que envolve a rota */
export type RouteLayout = 'public' | 'portal' | 'admin'

/** Tipo de renderização da rota */
export type RenderMode = 'native' | 'legacy-iframe' | 'redirect'

export interface RouteEntry {
  /** Caminho React da rota */
  path: string
  /** Nome legível para relatórios */
  label: string
  /** Requer autenticação? */
  requiresAuth: boolean
  /** Layout aplicado */
  layout: RouteLayout
  /** Se é alias, indica o path canônico (pular testes duplicados de render) */
  aliasOf?: string
  /** Modo de renderização */
  renderMode: RenderMode
  /** Requer role admin? */
  requiresAdmin: boolean
  /** Descrição dos elementos interativos esperados na página */
  interactiveElements: string[]
  /** Feature flag que controla nativo vs legado (undefined = sempre nativo) */
  featureFlag?: string
}

// ---------------------------------------------------------------------------
// Rotas Públicas (2)
// ---------------------------------------------------------------------------
const PUBLIC_ROUTES: RouteEntry[] = [
  {
    path: '/',
    label: 'Index (redirect para /dashboard)',
    requiresAuth: false,
    layout: 'public',
    renderMode: 'redirect',
    requiresAdmin: false,
    interactiveElements: [],
  },
  {
    path: '/login',
    label: 'Login',
    requiresAuth: false,
    layout: 'public',
    renderMode: 'native',
    requiresAdmin: false,
    interactiveElements: ['input username', 'input password', 'botão entrar'],
  },
]

// ---------------------------------------------------------------------------
// Rotas Portal Autenticadas (13)
// ---------------------------------------------------------------------------
const PORTAL_ROUTES: RouteEntry[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    interactiveElements: ['cards de sistemas', 'links de navegação'],
  },
  {
    path: '/gerador-pecas',
    label: 'Gerador de Peças',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_GERADOR_PECAS',
    interactiveElements: ['input processo', 'select tipo peça', 'botão gerar'],
  },
  {
    path: '/extrator-autos',
    label: 'Extrator de Autos',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    interactiveElements: ['input processo', 'tabs (documentos, categorias, histórico, lote)'],
  },
  {
    path: '/classificador',
    label: 'Classificador de Documentos',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_CLASSIFICADOR',
    interactiveElements: ['área de upload', 'tabs'],
  },
  {
    path: '/pedido-calculo',
    label: 'Pedido de Cálculo',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_PEDIDO_CALCULO',
    interactiveElements: ['input processo', 'botão gerar'],
  },
  {
    path: '/prestacao-contas',
    label: 'Prestação de Contas',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_PRESTACAO_CONTAS',
    interactiveElements: ['input processo', 'botão gerar'],
  },
  {
    path: '/relatorio-cumprimento',
    label: 'Relatório de Cumprimento',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_RELATORIO_CUMPRIMENTO',
    interactiveElements: ['input processo', 'botão gerar'],
  },
  {
    path: '/cumprimento-beta',
    label: 'Cumprimento Beta',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    interactiveElements: ['input processo', 'botão gerar'],
  },
  {
    path: '/assistencia',
    label: 'Assistência Judiciária',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_ASSISTENCIA',
    interactiveElements: ['input processo', 'botão gerar'],
  },
  {
    path: '/matriculas',
    label: 'Matrículas Confrontantes',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_MATRICULAS',
    interactiveElements: ['área de upload', 'botão processar'],
  },
  {
    path: '/bert-training',
    label: 'BERT Training',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    featureFlag: 'VITE_PORTAL_NATIVE_BERT_TRAINING',
    interactiveElements: ['status worker', 'botões de ação'],
  },
  {
    path: '/change-password',
    label: 'Alterar Senha',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    interactiveElements: ['input senha atual', 'input nova senha', 'input confirmar', 'botão salvar'],
  },
  {
    path: '/dev/design-system',
    label: 'Design System',
    requiresAuth: true,
    layout: 'portal',
    renderMode: 'native',
    requiresAdmin: false,
    interactiveElements: ['showcase de componentes'],
  },
]

// ---------------------------------------------------------------------------
// Rotas Admin (20 únicas + 10 aliases)
// ---------------------------------------------------------------------------
const ADMIN_ROUTES: RouteEntry[] = [
  // --- Rotas únicas ---
  {
    path: '/admin/users',
    label: 'Usuários',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['tabela de usuários', 'botão criar usuário'],
  },
  {
    path: '/admin/prompts',
    label: 'Prompts Config',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['lista de prompts', 'editor'],
  },
  {
    path: '/admin/prompts-modulos',
    label: 'Prompts Modulares',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['lista de módulos'],
  },
  {
    path: '/admin/feedbacks',
    label: 'Feedbacks',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['gráficos', 'filtros', 'seleção de sistema'],
  },
  {
    path: '/admin/performance',
    label: 'Performance',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['gráficos de métricas'],
  },
  {
    path: '/admin/variaveis',
    label: 'Variáveis',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['tabela de variáveis'],
  },
  {
    path: '/admin/categorias-json',
    label: 'Categorias JSON',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['árvore de categorias', 'editor JSON'],
  },
  {
    path: '/admin/historico-gerador',
    label: 'Histórico Gerador',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['tabela com filtros'],
  },
  {
    path: '/admin/historico-pedido-calculo',
    label: 'Histórico Pedido de Cálculo',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['tabela com filtros'],
  },
  {
    path: '/admin/historico-prestacao-contas',
    label: 'Histórico Prestação de Contas',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['tabela com filtros'],
  },
  {
    path: '/admin/modulos-tipo-peca',
    label: 'Módulos/Tipo Peça',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['lista de módulos'],
  },
  {
    path: '/admin/config-pecas',
    label: 'Config Peças',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['formulário de configuração'],
  },
  {
    path: '/admin/teste-ativacao',
    label: 'Teste de Ativação',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['input de teste', 'botão executar'],
  },
  {
    path: '/admin/teste-categorias',
    label: 'Teste de Categorias',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['input de teste', 'botão executar'],
  },
  {
    path: '/admin/tjms-docs',
    label: 'TJ-MS Docs',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['conteúdo documentação'],
  },
  {
    path: '/admin/tjms-docs/plano',
    label: 'TJ-MS Docs (Plano)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['conteúdo documentação'],
  },
  {
    path: '/admin/restaurar-slugs',
    label: 'Restaurar Slugs',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    interactiveElements: ['botão restaurar'],
  },

  // --- Aliases ---
  {
    path: '/admin/prompts-config',
    label: 'Prompts Config (alias)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    aliasOf: '/admin/prompts',
    interactiveElements: [],
  },
  {
    path: '/admin/categorias-resumo-json',
    label: 'Categorias Resumo JSON (alias)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    aliasOf: '/admin/categorias-json',
    interactiveElements: [],
  },
  {
    path: '/admin/gerador-pecas/historico',
    label: 'Histórico Gerador (alias)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    aliasOf: '/admin/historico-gerador',
    interactiveElements: [],
  },
  {
    path: '/admin/pedido-calculo/debug',
    label: 'Debug Pedido Cálculo (alias)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    aliasOf: '/admin/historico-pedido-calculo',
    interactiveElements: [],
  },
  {
    path: '/admin/prestacao-contas/debug',
    label: 'Debug Prestação Contas (alias)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    aliasOf: '/admin/historico-prestacao-contas',
    interactiveElements: [],
  },
  {
    path: '/admin/prompts-modulos/teste',
    label: 'Teste Ativação (alias)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    aliasOf: '/admin/teste-ativacao',
    interactiveElements: [],
  },
  {
    path: '/admin/categorias-resumo-json/teste',
    label: 'Teste Categorias (alias)',
    requiresAuth: true,
    layout: 'admin',
    renderMode: 'native',
    requiresAdmin: true,
    aliasOf: '/admin/teste-categorias',
    interactiveElements: [],
  },
]

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Todas as rotas públicas */
export const publicRoutes = PUBLIC_ROUTES

/** Todas as rotas portal autenticadas */
export const portalRoutes = PORTAL_ROUTES

/** Todas as rotas admin (únicas + aliases) */
export const adminRoutes = ADMIN_ROUTES

/** Apenas rotas admin únicas (sem aliases) */
export const adminUniqueRoutes = ADMIN_ROUTES.filter((r) => !r.aliasOf)

/** Apenas aliases admin */
export const adminAliasRoutes = ADMIN_ROUTES.filter((r) => !!r.aliasOf)

/** Todas as 45 rotas */
export const allRoutes = [...PUBLIC_ROUTES, ...PORTAL_ROUTES, ...ADMIN_ROUTES]

/** Contagem total */
export const TOTAL_ROUTES = allRoutes.length
