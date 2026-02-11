/**
 * Definicao centralizada de todas as rotas admin, seus mocks de API
 * e elementos esperados para os testes supplemental.
 *
 * Headings conferidos diretamente nos componentes React:
 * - UsersPage: "Gerenciamento de Usuarios"
 * - PromptsPage: heading generico
 * - PromptsModulosPage: "Modulos de Prompts"
 * - FeedbacksPage: contém "Feedback"
 * - PerformancePage: "Performance & Logs"
 * - VariaveisPage: "Painel de Variaveis"
 * - CategoriasJsonPage: "Categorias JSON"
 * - HistoricoGeradorPage: "Historico - Gerador de Pecas"
 * - HistoricoPedidoCalculoPage: "Historico - Pedido de Calculo"
 * - HistoricoPrestacaoContasPage: heading generico
 * - ModulosTipoPecaPage: heading generico
 * - ConfigPecasPage: heading generico
 * - TesteAtivacaoPage: usa data-testid como anchor
 * - TesteCategoriasPage: usa data-testid como anchor
 * - TjmsDocsPage: contém "TJMS" ou "Documentação"
 * - RestaurarSlugsPage: heading generico
 */

import type { Page, Route } from '@playwright/test'

export interface AdminRoute {
  path: string
  label: string
  anchor: string
  apiMocks: (page: Page) => Promise<void>
  safeButtons: SafeButton[]
  tabs?: TabInteraction[]
}

export interface SafeButton {
  /** Seletor: data-testid ou { role, name } */
  selector: string | { role: 'button'; name: RegExp }
  /** Descricao da acao esperada */
  description: string
  /** Tipo de efeito esperado apos clique */
  expectedEffect: 'dialog-opens' | 'tab-switches' | 'filter-applied' | 'toggle' | 'expand-collapse' | 'noop'
}

export interface TabInteraction {
  /** Seletor do tab trigger */
  selector: string
  /** Conteudo esperado apos clicar (seletor parcial) */
  contentHint?: string
}

// ---------------------------------------------------------------------------
// Mocks compartilhados
// ---------------------------------------------------------------------------

/** Fulfills com JSON vazio (array) */
function emptyArray(route: Route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
}

/** Fulfills com { success: true } */
function successResponse(route: Route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
}

// ---------------------------------------------------------------------------
// Definicao de rotas
// ---------------------------------------------------------------------------

export const ADMIN_ROUTES: AdminRoute[] = [
  // 1. Users
  {
    path: '/admin/users',
    label: 'Usuarios',
    anchor: 'heading >> text=/gerenciamento.*usu/i',
    apiMocks: async (page) => {
      await page.route('**/users?**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, username: 'admin', full_name: 'Admin', role: 'admin', is_active: true, grupo_conteudo: null, permissoes_especiais: [], setor: 'TI', sistemas_permitidos: [] },
          ]),
        })
      )
      await page.route('**/users/content-groups', emptyArray)
    },
    safeButtons: [
      { selector: '[data-testid="group-by-select"]', description: 'Filtro agrupar por', expectedEffect: 'filter-applied' },
    ],
  },

  // 2. Prompts
  {
    path: '/admin/prompts',
    label: 'Prompts Config',
    anchor: 'heading',
    apiMocks: async (page) => {
      await page.route(/\/admin\/prompts$/, (route) => {
        if (route.request().resourceType() === 'document') return route.continue()
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ prompts: [], total: 0 }),
        })
      })
      await page.route('**/admin/config-ia', emptyArray)
      await page.route('**/admin/api/prompts/**', successResponse)
    },
    safeButtons: [],
  },

  // 3. Prompts Modulos
  {
    path: '/admin/prompts-modulos',
    label: 'Prompts Modulares',
    anchor: 'heading >> text=/modulos.*prompts|prompts.*modul/i',
    apiMocks: async (page) => {
      await page.route('**/admin/api/prompts-modulos**', emptyArray)
      await page.route('**/admin/api/prompts-modulos/grupos', emptyArray)
    },
    safeButtons: [],
  },

  // 4. Feedbacks
  {
    path: '/admin/feedbacks',
    label: 'Feedbacks',
    anchor: 'heading >> text=/feedback/i',
    apiMocks: async (page) => {
      await page.route('**/admin/feedbacks/dashboard**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total_consultas: 42, total_feedbacks: 20, taxa_acerto: 75,
            consultas_sem_feedback: 22,
            avaliacoes: { correto: 10, parcial: 5, incorreto: 3, erro_ia: 2 },
            por_sistema: {},
          }),
        })
      )
      await page.route('**/admin/feedbacks/lista**', (route) =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ feedbacks: [], total: 0, page: 1, per_page: 20, total_pages: 0 }),
        })
      )
      await page.route('**/admin/feedbacks/evolucao**', emptyArray)
      await page.route('**/admin/feedbacks/top-usuarios**', emptyArray)
      await page.route('**/admin/feedbacks/modelos-em-uso**', emptyArray)
      await page.route('**/admin/feedbacks/pendentes**', emptyArray)
      await page.route('**/admin/feedbacks/exportar**', emptyArray)
    },
    safeButtons: [
      { selector: '[data-testid="btn-limpar-filtros"]', description: 'Limpar filtros', expectedEffect: 'filter-applied' },
    ],
  },

  // 5. Performance
  {
    path: '/admin/performance',
    label: 'Performance',
    anchor: 'heading >> text=/performance/i',
    apiMocks: async (page) => {
      await page.route(/\/admin\/api\/performance\//, (route) => {
        const url = route.request().url()
        let body: unknown
        if (url.includes('/summary')) {
          body = {
            bottleneck_summary: { llm: 0, db: 0, parse: 0, network: 0 },
            avg_times: { llm: 0, db: 0, parse: 0, total: 0 },
            recent_errors: [], top_slowest: [],
          }
        } else if (url.includes('/logs')) {
          body = { logs: [] }
        } else if (url.includes('/route-mapping')) {
          body = { mappings: [] }
        } else {
          body = []
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      })
      await page.route(/\/admin\/api\/gemini-logs/, (route) => {
        const url = route.request().url()
        let body: unknown
        if (url.includes('/summary')) {
          body = {
            total_calls: 0,
            stats: { success_count: 0, error_count: 0, avg_latency_ms: 0, success_rate: 100, total_prompt_tokens: 0, total_response_tokens: 0 },
            by_sistema: [], by_model: [],
          }
        } else {
          body = { logs: [] }
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      })
    },
    safeButtons: [
      { selector: '[data-testid="btn-refresh"]', description: 'Refresh dados', expectedEffect: 'noop' },
      { selector: '[data-testid="btn-clear-filters"]', description: 'Limpar filtros', expectedEffect: 'filter-applied' },
    ],
    tabs: [
      { selector: '[data-testid="tab-performance"]', contentHint: 'card-bottleneck' },
      { selector: '[data-testid="tab-gemini"]', contentHint: 'gemini-total-calls' },
      { selector: '[data-testid="tab-advanced-logs"]' },
    ],
  },

  // 6. Variaveis
  {
    path: '/admin/variaveis',
    label: 'Variaveis',
    anchor: 'heading >> text=/painel.*vari|vari.*veis/i',
    apiMocks: async (page) => {
      await page.route('**/admin/api/extraction/variaveis/resumo', (route) =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ total: 0, variaveis_com_uso: 0, variaveis_sem_uso: 0, distribuicao_tipos: {} }),
        })
      )
      await page.route('**/admin/api/extraction/variaveis?**', emptyArray)
      await page.route('**/admin/api/extraction/variaveis', emptyArray)
      await page.route('**/admin/api/categorias-resumo-json**', emptyArray)
    },
    safeButtons: [
      { selector: '[data-testid="btn-glossary"]', description: 'Abrir glossario', expectedEffect: 'dialog-opens' },
      { selector: '[data-testid="btn-help"]', description: 'Abrir ajuda', expectedEffect: 'dialog-opens' },
      { selector: '[data-testid="btn-view-grouped"]', description: 'Modo agrupado', expectedEffect: 'toggle' },
      { selector: '[data-testid="btn-view-list"]', description: 'Modo lista', expectedEffect: 'toggle' },
    ],
  },

  // 7. Categorias JSON
  {
    path: '/admin/categorias-json',
    label: 'Categorias JSON',
    anchor: 'heading >> text=/categ/i',
    apiMocks: async (page) => {
      await page.route('**/admin/api/categorias-resumo-json**', emptyArray)
    },
    safeButtons: [
      { selector: '[data-testid="help-button"]', description: 'Abrir ajuda', expectedEffect: 'dialog-opens' },
    ],
  },

  // 8. Historico Gerador
  {
    path: '/admin/historico-gerador',
    label: 'Historico Gerador',
    anchor: 'heading >> text=/histor.*gerador|gerador.*pe/i',
    apiMocks: async (page) => {
      await page.route('**/admin/api/gerador-pecas-admin/**', emptyArray)
      await page.route('**/api/gerador-pecas/admin/**', (route) => {
        const url = route.request().url()
        if (url.includes('/geracoes')) {
          return route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({ items: [], total: 0, page: 1, pages: 0 }),
          })
        }
        return emptyArray(route)
      })
    },
    safeButtons: [],
  },

  // 9. Historico Pedido Calculo
  {
    path: '/admin/historico-pedido-calculo',
    label: 'Historico Pedido Calculo',
    anchor: 'heading >> text=/histor.*calculo|pedido.*calculo/i',
    apiMocks: async (page) => {
      await page.route('**/pedido-calculo-admin/**', emptyArray)
      await page.route('**/admin/api/pedido-calculo/**', emptyArray)
    },
    safeButtons: [],
  },

  // 10. Historico Prestacao Contas
  {
    path: '/admin/historico-prestacao-contas',
    label: 'Historico Prestacao Contas',
    anchor: 'heading',
    apiMocks: async (page) => {
      await page.route('**/admin/api/prestacao-admin/**', emptyArray)
      await page.route('**/prestacao-contas-admin/**', emptyArray)
    },
    safeButtons: [],
  },

  // 11. Modulos Tipo Peca
  {
    path: '/admin/modulos-tipo-peca',
    label: 'Modulos / Tipo Peca',
    anchor: 'heading',
    apiMocks: async (page) => {
      await page.route('**/admin/api/prompts-modulos/grupos', emptyArray)
      await page.route('**/admin/api/prompts-modulos/**', emptyArray)
      await page.route('**/admin/api/prompts-modulos/tipos-peca', emptyArray)
      await page.route('**/admin/api/prompts-modulos/resumo-configuracao-tipos-peca', emptyArray)
    },
    safeButtons: [],
  },

  // 12. Config Pecas
  {
    path: '/admin/config-pecas',
    label: 'Config Pecas',
    anchor: 'heading',
    apiMocks: async (page) => {
      await page.route('**/api/gerador-pecas/config/categorias', emptyArray)
      await page.route('**/api/gerador-pecas/config/tipos-peca', emptyArray)
      await page.route('**/admin/api/config-pecas**', (route) =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ configuracoes: [], tipos_peca: [] }),
        })
      )
    },
    safeButtons: [],
  },

  // 13. Teste Ativacao
  {
    path: '/admin/teste-ativacao',
    label: 'Teste Ativacao',
    anchor: '[data-testid="select-tipo-peca"]',
    apiMocks: async (page) => {
      await page.route('**/teste-ativacao/tipos-peca', emptyArray)
      await page.route('**/teste-ativacao/categorias-extracao', emptyArray)
      await page.route('**/teste-ativacao/variaveis-processo', emptyArray)
      await page.route('**/teste-ativacao/cenarios', emptyArray)
    },
    safeButtons: [
      { selector: '[data-testid="btn-pre-definidos"]', description: 'Cenarios pre-definidos', expectedEffect: 'dialog-opens' },
    ],
    tabs: [
      { selector: '[data-testid="tab-variaveis-extracao"]' },
      { selector: '[data-testid="tab-variaveis-processo"]' },
      { selector: '[data-testid="tab-resultados"]' },
    ],
  },

  // 14. Teste Categorias
  {
    path: '/admin/teste-categorias',
    label: 'Teste Categorias',
    anchor: '[data-testid="select-categoria"]',
    apiMocks: async (page) => {
      await page.route('**/admin/api/categorias-resumo-json/teste-categorias/**', emptyArray)
      await page.route('**/admin/api/categorias-resumo-json**', emptyArray)
    },
    safeButtons: [
      { selector: '[data-testid="btn-limpar"]', description: 'Limpar campos', expectedEffect: 'filter-applied' },
    ],
    tabs: [
      { selector: '[data-testid="tab-resultados"]' },
      { selector: '[data-testid="tab-visualizacao"]' },
      { selector: '[data-testid="tab-progresso"]' },
    ],
  },

  // 15. TJMS Docs
  {
    path: '/admin/tjms-docs',
    label: 'TJMS Docs',
    anchor: 'heading >> text=/tjms|documenta/i',
    apiMocks: async (_page) => {
      // Pagina estatica, sem chamadas API
    },
    safeButtons: [],
  },

  // 16. TJMS Docs Plano
  {
    path: '/admin/tjms-docs/plano',
    label: 'TJMS Docs — Plano',
    anchor: 'heading',
    apiMocks: async (_page) => {
      // Pagina estatica
    },
    safeButtons: [],
  },

  // 17. Restaurar Slugs
  {
    path: '/admin/restaurar-slugs',
    label: 'Restaurar Slugs',
    anchor: 'heading',
    apiMocks: async (page) => {
      await page.route('**/admin/api/restaurar-slugs**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) })
      )
    },
    safeButtons: [],
    // NOTA: botao "Restaurar" e destrutivo — NAO clicar
  },
]

/**
 * Regex para identificar botoes destrutivos.
 * Testes de safe-click devem IGNORAR botoes cujo texto/aria-label
 * bata com algum desses padroes.
 */
export const DANGEROUS_BUTTON_PATTERNS = /excluir|remover|deletar|apagar|desativar|revogar|resetar|restaurar.*slug|limpar.*log|carregar.*dados.*iniciais|sincronizar.*prompt/i

/**
 * Sanitiza o path para usar como nome de arquivo.
 * Ex: /admin/teste-ativacao → admin__teste-ativacao
 */
export function sanitizePath(path: string): string {
  return path.replace(/^\//, '').replace(/\//g, '__')
}
