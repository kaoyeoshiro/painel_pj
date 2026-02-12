/**
 * Mocks de API realistas por endpoint.
 *
 * Cada mock retorna dados estáticos representativos para que as páginas
 * renderizem corretamente sem backend. Usado pela suite full-regression.
 */

import type { Page, Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// ---------------------------------------------------------------------------
// Dados mock
// ---------------------------------------------------------------------------

export const MOCK_ADMIN_USER = {
  id: 1,
  username: 'admin_teste',
  full_name: 'Admin Teste',
  email: 'admin@pge.ms.gov.br',
  role: 'admin',
  is_admin: true,
  is_active: true,
  setor: 'LAB',
  must_change_password: false,
}

export const MOCK_REGULAR_USER = {
  id: 2,
  username: 'procurador_teste',
  full_name: 'Procurador Teste',
  email: 'procurador@pge.ms.gov.br',
  role: 'user',
  is_admin: false,
  is_active: true,
  setor: 'Contencioso',
  must_change_password: false,
}

export const MOCK_TOKEN = 'fake-jwt-token-for-e2e-testing'

const MOCK_LOGIN_RESPONSE = {
  access_token: MOCK_TOKEN,
  token_type: 'bearer',
}

const MOCK_USERS_LIST = [
  MOCK_ADMIN_USER,
  MOCK_REGULAR_USER,
  { id: 3, username: 'analista', full_name: 'Analista Teste', role: 'user', is_active: true, setor: 'Fiscal' },
]

const MOCK_CONTENT_GROUPS = [
  { id: 1, nome: 'Grupo Geral', descricao: 'Acesso padrão' },
  { id: 2, nome: 'Grupo Admin', descricao: 'Acesso administrativo' },
]

const MOCK_TIPOS_PECA = {
  tipos: [
    { id: 1, nome: 'contestacao', titulo: 'Contestação', ativo: true },
    { id: 2, nome: 'recurso', titulo: 'Recurso', ativo: true },
    { id: 3, nome: 'contrarrazoes', titulo: 'Contrarrazões', ativo: true },
  ],
}

const MOCK_GRUPOS_DISPONIVEIS = {
  grupos: [
    { nome: 'Cível', slug: 'civel' },
    { nome: 'Fiscal', slug: 'fiscal' },
  ],
}

const MOCK_CATEGORIAS_JSON = [
  { id: 1, nome: 'Dados do Processo', descricao: 'Extração básica', ativo: true, codigos_documento: [8369] },
  { id: 2, nome: 'Partes', descricao: 'Polos ativo e passivo', ativo: true, codigos_documento: [500] },
]

const MOCK_PROMPTS = {
  prompts: [
    { id: 1, nome: 'Prompt Contestação', sistema: 'gerador_pecas', tipo: 'system', is_active: true, descricao: 'Prompt base', conteudo: 'Você é um assistente jurídico...', updated_at: '2026-02-10T10:00:00Z' },
    { id: 2, nome: 'Prompt Análise', sistema: 'gerador_pecas', tipo: 'analise', is_active: true, descricao: 'Análise', conteudo: 'Analise o documento...', updated_at: '2026-02-10T10:00:00Z' },
  ],
  total: 2,
}

const MOCK_CONFIG_IA = [
  { id: 1, sistema: 'gerador_pecas', chave: 'modelo_ativacao_agente2', valor: 'gemini-2.0-flash', tipo: 'text' },
  { id: 2, sistema: 'gerador_pecas', chave: 'max_tokens', valor: '8192', tipo: 'number' },
]

const MOCK_FEEDBACKS_DASHBOARD = {
  total_consultas: 142,
  total_feedbacks: 89,
  taxa_acerto: 78.5,
  consultas_sem_feedback: 53,
  avaliacoes: { correto: 55, parcial: 20, incorreto: 10, erro_ia: 4 },
  por_sistema: {
    gerador_pecas: { total: 60, feedbacks: 40 },
    pedido_calculo: { total: 30, feedbacks: 20 },
    prestacao_contas: { total: 20, feedbacks: 15 },
    relatorio_cumprimento: { total: 10, feedbacks: 5 },
    assistencia_judiciaria: { total: 15, feedbacks: 7 },
    matriculas: { total: 7, feedbacks: 2 },
  },
  evolucao_por_sistema: {},
  feedbacks_por_usuario: [
    { nome: 'João Silva', total: 20, corretos: 15 },
    { nome: 'Maria Santos', total: 15, corretos: 12 },
  ],
  pendentes_feedback: [
    { id: 1, sistema: 'gerador_pecas', identificador: '0001234-56.2026.8.12.0001', usuario: 'João Silva', data: '2026-02-10T14:30:00', modo_ativacao: null },
  ],
  filtro_aplicado: { mes: null, ano: 2026, sistema: null },
}

const MOCK_FEEDBACKS_LISTA = {
  total: 2,
  page: 1,
  per_page: 20,
  total_pages: 1,
  feedbacks: [
    { id: 1, consulta_id: 10, sistema: 'gerador_pecas', identificador: '0001234-56.2026.8.12.0001', cnj: null, modelo: 'gemini-2.0-flash', usuario: 'João Silva', username: 'joao', avaliacao: 'correto', comentario: 'Muito bom', campos_incorretos: null, criado_em: '2026-02-10T14:30:00', modo_ativacao: null },
    { id: 2, consulta_id: 11, sistema: 'assistencia_judiciaria', identificador: '0009876-54.2026.8.12.0001', cnj: null, modelo: 'gemini-2.0-flash', usuario: 'Maria Santos', username: 'maria', avaliacao: 'parcial', comentario: null, campos_incorretos: null, criado_em: '2026-02-09T10:00:00', modo_ativacao: null },
  ],
}

const MOCK_MODELOS_IA = {
  assistencia_judiciaria: { id: 1, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
  matriculas: { id: 2, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
  gerador_pecas: { id: 3, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
  pedido_calculo: { id: 4, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
}

const MOCK_PERFORMANCE_SUMMARY = {
  bottleneck_summary: { llm: 45, db: 30, parse: 15, other: 10 },
  avg_times: { total: 2.5, llm: 1.2, db: 0.8, parse: 0.3 },
  recent_errors: [],
  top_slowest: [
    { rota: '/api/gerador-pecas/gerar', total: 8.2, gargalo: 'llm' },
    { rota: '/api/pedido-calculo/gerar', total: 5.1, gargalo: 'llm' },
    { rota: '/api/classificador/classificar', total: 3.4, gargalo: 'db' },
  ],
}

const MOCK_GEMINI_SUMMARY = {
  total_chamadas: 523,
  latencia_media: 1.8,
  tokens_prompt_total: 125000,
  taxa_sucesso: 96.2,
}

const MOCK_VARIAVEIS_RESUMO = {
  total: 45,
  variaveis_com_uso: 38,
  variaveis_sem_uso: 7,
  distribuicao_tipos: { texto: 20, numero: 10, data: 8, booleano: 7 },
}

const MOCK_GERACOES_HISTORICO = [
  { id: 1, numero_cnj: '0001234-56.2025.8.12.0001', tipo_peca: 'contestacao', modo: 'semi_automatico', criado_em: '2026-02-10T14:30:00Z', tempo_processamento: 12.5, modulos_ativados_det: 3, modulos_ativados_llm: 2 },
  { id: 2, numero_cnj: '0005678-90.2025.8.12.0002', tipo_peca: 'recurso', modo: 'fast_path', criado_em: '2026-02-09T10:15:00Z', tempo_processamento: 3.1, modulos_ativados_det: 5, modulos_ativados_llm: 0 },
]

const MOCK_PROMPTS_MODULOS = [
  { id: 1, titulo: 'Tema 793', nome: 'tema_793', categoria: 'merito', tipo: 'peca', modo_ativacao: 'deterministic', ativo: true },
  { id: 2, titulo: 'Honorários Sucumbência', nome: 'honorarios_sucumbencia', categoria: 'honorarios', tipo: 'peca', modo_ativacao: 'llm', ativo: true },
]

const MOCK_PROMPT_GROUPS = [
  { id: 1, name: 'Cível' },
  { id: 2, name: 'Fiscal' },
]

const MOCK_TIPOS_PECA_ADMIN = [
  { id: 1, titulo: 'Contestação', categoria: 'contestacao' },
  { id: 2, titulo: 'Recurso', categoria: 'recurso' },
]

const MOCK_RESUMO_CONFIGURACAO = {
  total_modulos_conteudo: 12,
  tipos_peca: [
    { tipo_peca: 'contestacao', titulo: 'Contestação', modulos_ativos: 8, modulos_inativos: 4, total_modulos: 12 },
    { tipo_peca: 'recurso', titulo: 'Recurso', modulos_ativos: 6, modulos_inativos: 6, total_modulos: 12 },
  ],
}

const MOCK_ROUTE_MAPPING = {
  routes: [
    { path: '/api/gerador-pecas/gerar', sistema: 'gerador_pecas' },
    { path: '/api/pedido-calculo/gerar', sistema: 'pedido_calculo' },
  ],
}

const MOCK_EXTRATOR_CATEGORIAS = [
  { id: 1, nome: 'Petição Inicial', tipo: 'primeiro_documento', codigos_diretos: [9500, 500], ativo: true },
  { id: 2, nome: 'Contestação', tipo: 'bert_classification', codigos_bert: [8369], ativo: true },
]

// ---------------------------------------------------------------------------
// Resolução de mock por pathname
// ---------------------------------------------------------------------------

/**
 * Retorna dados mock adequados para o pathname da requisição.
 * Usado internamente pelo setupFullRegressionMocks.
 */
export function getMockResponse(pathname: string, method: string): { status: number; body: JsonValue } {
  // --- Auth ---
  if (pathname === '/auth/me') return { status: 200, body: MOCK_ADMIN_USER as unknown as JsonValue }
  if (pathname === '/auth/verify') return { status: 200, body: { valid: true } }
  if (pathname === '/auth/login' && method === 'POST') return { status: 200, body: MOCK_LOGIN_RESPONSE as unknown as JsonValue }

  // --- Users ---
  if (pathname.startsWith('/users/content-groups')) return { status: 200, body: MOCK_CONTENT_GROUPS as unknown as JsonValue }
  if (pathname.match(/^\/users\/?$/)) return { status: 200, body: MOCK_USERS_LIST as unknown as JsonValue }

  // --- Admin API ---
  if (pathname.includes('/admin/api/users')) return { status: 200, body: MOCK_USERS_LIST as unknown as JsonValue }
  if (pathname.includes('/admin/config-ia')) return { status: 200, body: MOCK_CONFIG_IA as unknown as JsonValue }
  if (pathname.match(/\/admin\/prompts$/)) return { status: 200, body: MOCK_PROMPTS as unknown as JsonValue }
  if (pathname.match(/\/admin\/api\/prompts-modulos\/grupos\/\d+\/subcategorias/)) return { status: 200, body: [{ id: 1, nome: 'Mérito' }, { id: 2, nome: 'Honorários' }] as unknown as JsonValue }
  if (pathname.match(/\/admin\/api\/prompts-modulos\/grupos\/\d+\/subgrupos/)) return { status: 200, body: [{ id: 1, nome: 'Subgrupo A' }, { id: 2, nome: 'Subgrupo B' }] as unknown as JsonValue }
  if (pathname.includes('/admin/api/prompts-modulos/grupos')) return { status: 200, body: MOCK_PROMPT_GROUPS as unknown as JsonValue }
  if (pathname.includes('/admin/api/prompts-modulos/tipos-peca')) return { status: 200, body: MOCK_TIPOS_PECA_ADMIN as unknown as JsonValue }
  if (pathname.includes('/admin/api/prompts-modulos/resumo-configuracao')) return { status: 200, body: MOCK_RESUMO_CONFIGURACAO as unknown as JsonValue }
  if (pathname.includes('/admin/api/prompts-modulos/modulos-por-tipo-peca')) return { status: 200, body: { modulos: MOCK_PROMPTS_MODULOS } as unknown as JsonValue }
  if (pathname.includes('/admin/api/prompts-modulos')) return { status: 200, body: MOCK_PROMPTS_MODULOS as unknown as JsonValue }
  if (pathname.includes('/admin/api/feedbacks/lista')) return { status: 200, body: MOCK_FEEDBACKS_LISTA as unknown as JsonValue }
  if (pathname.includes('/admin/api/feedbacks/dashboard')) return { status: 200, body: MOCK_FEEDBACKS_DASHBOARD as unknown as JsonValue }
  if (pathname.includes('/admin/modelos-ia')) return { status: 200, body: MOCK_MODELOS_IA as unknown as JsonValue }
  if (pathname.includes('/admin/api/performance/summary')) return { status: 200, body: MOCK_PERFORMANCE_SUMMARY as unknown as JsonValue }
  if (pathname.includes('/admin/api/performance/route-mapping')) return { status: 200, body: MOCK_ROUTE_MAPPING as unknown as JsonValue }
  if (pathname.includes('/admin/api/performance/logs')) return { status: 200, body: { logs: [] } }
  if (pathname.includes('/admin/api/gemini-logs/summary')) return { status: 200, body: MOCK_GEMINI_SUMMARY as unknown as JsonValue }
  if (pathname.includes('/admin/api/gemini-logs')) return { status: 200, body: { logs: [] } }
  if (pathname.includes('/admin/api/extraction/variaveis/resumo')) return { status: 200, body: MOCK_VARIAVEIS_RESUMO as unknown as JsonValue }
  if (pathname.includes('/admin/api/extraction/variaveis')) return { status: 200, body: [] }
  if (pathname.includes('/admin/api/categorias-resumo-json')) return { status: 200, body: MOCK_CATEGORIAS_JSON as unknown as JsonValue }
  if (pathname.includes('/admin/api/gerador-pecas-admin/geracoes')) return { status: 200, body: MOCK_GERACOES_HISTORICO as unknown as JsonValue }

  // --- Sistema: Gerador de Peças ---
  if (pathname.includes('/gerador-pecas/api/tipos-peca') || pathname.includes('/gerador-pecas/api/tipos_peca')) return { status: 200, body: MOCK_TIPOS_PECA as unknown as JsonValue }
  if (pathname.includes('/gerador-pecas/api/grupos-disponiveis')) return { status: 200, body: MOCK_GRUPOS_DISPONIVEIS as unknown as JsonValue }

  // --- Sistema: Extrator de Autos ---
  if (pathname.includes('/extrator-autos/api/categorias')) return { status: 200, body: MOCK_EXTRATOR_CATEGORIAS as unknown as JsonValue }

  // --- Sistema: BERT Training ---
  if (pathname.includes('/bert-training/api/status')) return { status: 200, body: { worker_running: false, queue_size: 0 } }
  if (pathname.includes('/bert-training/api/runs')) return { status: 200, body: [] }

  // --- Fallback genérico ---
  if (method === 'GET') return { status: 200, body: [] }
  return { status: 200, body: { success: true } }
}

// ---------------------------------------------------------------------------
// Setup principal
// ---------------------------------------------------------------------------

/**
 * Configura interceptação de TODAS as chamadas API da página,
 * retornando mocks realistas por endpoint.
 */
export async function setupFullRegressionMocks(page: Page): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const req = route.request()
    const type = req.resourceType()

    // Deixa recursos estáticos passarem normalmente
    if (['document', 'stylesheet', 'image', 'font', 'script', 'other'].includes(type)) {
      return route.continue()
    }

    const url = new URL(req.url())
    const pathname = url.pathname

    // Só intercepta chamadas de API (auth, users, */api/*)
    const isApiRequest =
      pathname.startsWith('/auth') ||
      pathname.startsWith('/users') ||
      pathname.includes('/api/') ||
      pathname.match(/^\/admin\//) !== null

    if (!isApiRequest) return route.continue()

    const method = req.method()
    const { status, body } = getMockResponse(pathname, method)

    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

/**
 * Configura mock para retornar erro em /auth/me (simula token inválido/expirado).
 */
export async function setupAuthMeError(page: Page, status: number = 401): Promise<void> {
  await page.route('**/auth/me', (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Token inválido ou expirado' }),
    })
  )
}

/**
 * Configura mock para retornar erro em login.
 */
export async function setupLoginError(page: Page, status: number = 400): Promise<void> {
  await page.route('**/auth/login', (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Credenciais inválidas' }),
    })
  )
}

/**
 * Configura mock que faz TODAS as APIs retornarem um status de erro.
 */
export async function setupApiError(page: Page, status: number, detail: string = 'Erro interno'): Promise<void> {
  await page.route('**/api/**', (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail }),
    })
  )
  await page.route('**/admin/api/**', (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail }),
    })
  )
}
