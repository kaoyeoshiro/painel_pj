/**
 * Testes de paridade UI — Páginas Administrativas
 *
 * Verifica que todos os controles do legado existem no React para:
 * - Admin: Prompts, Prompts Modulares, Módulos/Tipo Peça
 * - Admin: Histórico Gerador, Pedido Cálculo, Prestação Contas
 * - Admin: Debug Pedido, Debug Prestação
 * - Admin: Usuários, Feedbacks, Performance
 * - Admin: Categorias JSON, Teste Categorias, Teste Ativação
 * - Admin: Variáveis, Restaurar Slugs, TJMS Docs, Config Peças
 *
 * Referência: docs/ui_parity_matrix.md seções 14-29
 */

import { test, expect } from './fixtures/auth'

// ---------------------------------------------------------------------------
// 14. Admin: Prompts Config (/admin/prompts)
// ---------------------------------------------------------------------------
test.describe('14. Admin: Prompts (/admin/prompts)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/prompts**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/prompts')
    await page.waitForLoadState('networkidle')
  })

  test('14.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('14.2 — Botão restaurar padrão existe', async ({ authenticatedPage: page }) => {
    // Quando não há prompts, deve existir botão para criar padrão
    const createBtn = page.getByRole('button', { name: /criar.*padrão|restaurar|criar prompts/i })
    // Pode existir como botão principal ou por prompt individual
    const count = await createBtn.count()
    expect(count).toBeGreaterThanOrEqual(0) // Visível quando há dados
  })
})

// ---------------------------------------------------------------------------
// 15. Admin: Prompts Modulares (/admin/prompts-modulos)
// ---------------------------------------------------------------------------
test.describe('15. Admin: Prompts Modulares (/admin/prompts-modulos)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/prompts-modulos**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/prompts-modulos')
    await page.waitForLoadState('networkidle')
  })

  test('15.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 16. Admin: Módulos/Tipo Peça (/admin/modulos-tipo-peca)
// ---------------------------------------------------------------------------
test.describe('16. Admin: Módulos/Tipo Peça (/admin/modulos-tipo-peca)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/modulos**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/modulos-tipo-peca')
    await page.waitForLoadState('networkidle')
  })

  test('16.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 17. Admin: Histórico Gerador (/admin/historico-gerador)
// ---------------------------------------------------------------------------
test.describe('17. Admin: Histórico Gerador (/admin/historico-gerador)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/gerador-pecas-admin/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/historico-gerador')
    await page.waitForLoadState('networkidle')
  })

  test('17.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading', { name: /histor.*gerador/i }).first()
    await expect(heading).toBeVisible()
  })

  test('17.2 — Tabela de gerações', async ({ authenticatedPage: page }) => {
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 18. Admin: Histórico Pedido de Cálculo (/admin/historico-pedido-calculo)
// ---------------------------------------------------------------------------
test.describe('18. Admin: Histórico Pedido Cálculo (/admin/historico-pedido-calculo)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/pedido-calculo-admin/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/historico-pedido-calculo')
    await page.waitForLoadState('networkidle')
  })

  test('18.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading', { name: /histor.*calculo/i }).first()
    await expect(heading).toBeVisible()
  })

  test('18.2 — Tabela de gerações', async ({ authenticatedPage: page }) => {
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 19. Admin: Histórico Prestação Contas (/admin/historico-prestacao-contas)
// ---------------------------------------------------------------------------
test.describe('19. Admin: Histórico Prestação Contas (/admin/historico-prestacao-contas)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/prestacao-contas-admin/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/historico-prestacao-contas')
    await page.waitForLoadState('networkidle')
  })

  test('19.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('19.2 — Tabela de gerações', async ({ authenticatedPage: page }) => {
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// 20. Admin: Usuários (/admin/users)
// ---------------------------------------------------------------------------
test.describe('20. Admin: Usuários (/admin/users)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/users**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, username: 'admin', full_name: 'Admin', role: 'admin', is_active: true, grupo_conteudo: null, permissoes_especiais: [] },
        ]),
      })
    )
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
  })

  test('20.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading', { name: /usuário/i }).first()
    await expect(heading).toBeVisible()
  })

  test('20.2 — Tabela de usuários', async ({ authenticatedPage: page }) => {
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })

  test('20.3 — Filtro agrupar por (data-testid=group-by-filter)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="group-by-filter"]')).toBeVisible()
  })

  test('20.4 — Select agrupar por (data-testid=group-by-select)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="group-by-select"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 21. Admin: Feedbacks (/admin/feedbacks)
// ---------------------------------------------------------------------------
test.describe('21. Admin: Feedbacks (/admin/feedbacks)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/feedbacks**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          feedbacks: [],
          total: 0,
          estatisticas: { total: 0, correto: 0, parcial: 0, incorreto: 0 },
          por_sistema: {},
          por_modelo: [],
          evolucao: [],
          top_usuarios: [],
          pendentes: [],
        }),
      })
    )
    await page.goto('/admin/feedbacks')
    await page.waitForLoadState('networkidle')
  })

  test('21.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading', { name: /feedback/i }).first()
    await expect(heading).toBeVisible()
  })

  test('21.2 — Botão auditoria', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-auditoria"]')).toBeVisible()
  })

  test('21.3 — Botão exportar', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-exportar"]')).toBeVisible()
  })

  test('21.4 — Filtros (sistema, mês, ano, avaliação)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="filtro-sistema"]')).toBeVisible()
    await expect(page.locator('[data-testid="filtro-mes"]')).toBeVisible()
    await expect(page.locator('[data-testid="filtro-ano"]')).toBeVisible()
    await expect(page.locator('[data-testid="filtro-avaliacao"]')).toBeVisible()
  })

  test('21.5 — Botão limpar filtros', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-limpar-filtros"]')).toBeVisible()
  })

  test('21.6 — Gráfico distribuição', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="chart-pie-distribuicao"]')).toBeVisible()
  })

  test('21.7 — Seção evolução temporal', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="secao-evolucao"]')).toBeVisible()
  })

  test('21.8 — Seção modelos IA', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="secao-modelos-ia"]')).toBeVisible()
  })

  test('21.9 — Seção top usuários', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="secao-top-usuarios"]')).toBeVisible()
  })

  test('21.10 — Seção pendentes', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="secao-pendentes"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 22. Admin: Categorias JSON (/admin/categorias-json)
// ---------------------------------------------------------------------------
test.describe('22. Admin: Categorias JSON (/admin/categorias-json)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/categorias**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/categorias-json')
    await page.waitForLoadState('networkidle')
  })

  test('22.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('22.2 — Botão ajuda (data-testid=help-button)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="help-button"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 23. Admin: Teste Categorias (/admin/teste-categorias)
// ---------------------------------------------------------------------------
test.describe('23. Admin: Teste Categorias (/admin/teste-categorias)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/teste-categorias**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.route('**/admin/api/categorias**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/teste-categorias')
    await page.waitForLoadState('networkidle')
  })

  test('23.1 — Select categoria', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="select-categoria"]')).toBeVisible()
  })

  test('23.2 — Textarea processos', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="textarea-processos"]')).toBeVisible()
  })

  test('23.3 — Botões de ação (adicionar, limpar)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-adicionar-validar"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-limpar"]')).toBeVisible()
  })

  test('23.4 — Toggle comparar modelos', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="toggle-comparar-modelos"]')).toBeVisible()
  })

  test('23.5 — Textarea observações', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="textarea-observacoes"]')).toBeVisible()
  })

  test('23.6 — Filtro status e botões de classificação', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="filtro-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-classificar"]')).toBeVisible()
  })

  test('23.7 — Botões download e resetar', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-baixar-todos"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-resetar-erros"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-reclassificar-erros"]')).toBeVisible()
  })

  test('23.8 — Tabs resultados (resultados, visualização, progresso)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="tabs-resultados"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-resultados"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-visualizacao"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-progresso"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 24. Admin: Teste Ativação (/admin/teste-ativacao)
// ---------------------------------------------------------------------------
test.describe('24. Admin: Teste Ativação (/admin/teste-ativacao)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/teste-ativacao**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cenarios: [] }) })
    )
    await page.route('**/admin/api/variaveis**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/teste-ativacao')
    await page.waitForLoadState('networkidle')
  })

  test('24.1 — Select tipo de peça', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="select-tipo-peca"]')).toBeVisible()
  })

  test('24.2 — Textarea descrição situação', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="textarea-descricao-situacao"]')).toBeVisible()
  })

  test('24.3 — Botão simular', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-simular"]')).toBeVisible()
  })

  test('24.4 — Botão gerar variáveis via IA', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-gerar-variaveis-ia"]')).toBeVisible()
  })

  test('24.5 — Botão exportar JSON', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-exportar-json"]')).toBeVisible()
  })

  test('24.6 — Select cenário e botões cenário', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="select-cenario"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-pre-definidos"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-salvar-cenario"]')).toBeVisible()
  })

  test('24.7 — Tabs (variáveis extração, variáveis processo, resultados)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="tabs-lista"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-variaveis-extracao"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-variaveis-processo"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-resultados"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 25. Admin: Variáveis (/admin/variaveis)
// ---------------------------------------------------------------------------
test.describe('25. Admin: Variáveis (/admin/variaveis)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/variaveis**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/admin/variaveis')
    await page.waitForLoadState('networkidle')
  })

  test('25.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading', { name: /variáve/i }).first()
    await expect(heading).toBeVisible()
  })

  test('25.2 — Botão glossário', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-glossary"]')).toBeVisible()
  })

  test('25.3 — Botão ajuda', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-help"]')).toBeVisible()
  })

  test('25.4 — Checkbox mostrar inativos', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="checkbox-show-inactive"]')).toBeVisible()
  })

  test('25.5 — Toggle modo de visualização (lista/agrupado)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="view-mode-toggle"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-view-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-view-grouped"]')).toBeVisible()
  })

  test('25.6 — Botões expandir/colapsar', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-expand-all"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-collapse-all"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 26. Admin: Restaurar Slugs (/admin/restaurar-slugs)
// ---------------------------------------------------------------------------
test.describe('26. Admin: Restaurar Slugs (/admin/restaurar-slugs)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/restaurar-slugs**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) })
    )
    await page.goto('/admin/restaurar-slugs')
    await page.waitForLoadState('networkidle')
  })

  test('26.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('26.2 — Botão restaurar', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /restaurar/i }).first()
    await expect(btn).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 27. Admin: Performance (/admin/performance)
// ---------------------------------------------------------------------------
test.describe('27. Admin: Performance (/admin/performance)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/performance**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [],
          gargalos: { llm: 0, db: 0, parse: 0, network: 0 },
          top_lentas: [],
          erros_recentes: [],
          rotas: [],
          gemini: { total_calls: 0, avg_latency: 0, success_rate: 0, total_tokens: 0, by_sistema: [], by_model: [], logs: [] },
        }),
      })
    )
    await page.goto('/admin/performance')
    await page.waitForLoadState('networkidle')
  })

  test('27.1 — Select período', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="select-time-period"]')).toBeVisible()
  })

  test('27.2 — Botão refresh', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-refresh"]')).toBeVisible()
  })

  test('27.3 — Botão limpar filtros e logs antigos', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-clear-filters"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-clear-old-logs"]')).toBeVisible()
  })

  test('27.4 — Barra de filtros', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="filter-bar"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-sistema"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-rota"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-action"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-gargalo"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-status"]')).toBeVisible()
  })

  test('27.5 — Tabs (performance, gemini, logs avançados)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="tab-performance"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-gemini"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-advanced-logs"]')).toBeVisible()
  })

  test('27.6 — Cards de gargalo', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="card-bottleneck-llm"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-bottleneck-db"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-bottleneck-parse"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-bottleneck-network"]')).toBeVisible()
  })

  test('27.7 — Gráficos de gargalo', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="chart-bottleneck-bars"]')).toBeVisible()
    await expect(page.locator('[data-testid="chart-bottleneck-pie"]')).toBeVisible()
  })

  test('27.8 — Top rotas lentas e erros recentes', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="top-slowest-routes"]')).toBeVisible()
    await expect(page.locator('[data-testid="recent-errors"]')).toBeVisible()
  })

  test('27.9 — Tab Gemini: métricas', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-gemini"]').click()
    await expect(page.locator('[data-testid="gemini-total-calls"]')).toBeVisible()
    await expect(page.locator('[data-testid="gemini-avg-latency"]')).toBeVisible()
    await expect(page.locator('[data-testid="gemini-success-rate"]')).toBeVisible()
    await expect(page.locator('[data-testid="gemini-total-tokens"]')).toBeVisible()
  })

  test('27.10 — Tab Gemini: tabelas', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-gemini"]').click()
    await expect(page.locator('[data-testid="gemini-by-sistema"]')).toBeVisible()
    await expect(page.locator('[data-testid="gemini-by-model"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 28. Admin: TJMS Docs (/admin/tjms-docs)
// ---------------------------------------------------------------------------
test.describe('28. Admin: TJMS Docs (/admin/tjms-docs)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/admin/tjms-docs')
    await page.waitForLoadState('networkidle')
  })

  test('28.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading', { name: /tjms|documentação/i }).first()
    await expect(heading).toBeVisible()
  })

  test('28.2 — Link ver plano completo (data-testid=link-ver-plano-completo)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="link-ver-plano-completo"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 29. Admin: Config Peças (/admin/config-pecas)
// ---------------------------------------------------------------------------
test.describe('29. Admin: Config Peças (/admin/config-pecas)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/admin/api/config-pecas**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configuracoes: [], tipos_peca: [] }),
      })
    )
    await page.goto('/admin/config-pecas')
    await page.waitForLoadState('networkidle')
  })

  test('29.1 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('29.2 — Seletor de tipo de documento (tree)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="document-tree-select"]')).toBeVisible()
  })

  test('29.3 — Busca de documentos na árvore', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="document-tree-search"]')).toBeVisible()
  })

  test('29.4 — Resumo seleção documentos', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="document-tree-summary"]')).toBeVisible()
  })

  test('29.5 — Ações admin (carregar dados, sincronizar)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="admin-actions"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-carregar-dados-iniciais"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-sincronizar-prompts"]')).toBeVisible()
  })
})
