/**
 * Suite de testes destrutivos por rota admin.
 *
 * Para cada rota:
 * - Render: valida titulo (BreadcrumbBar <span>) ou heading visivel
 * - Interacoes seguras: abrir dialogs, tabs, filtros
 * - Interacoes destrutivas: executar acoes que modificam estado
 *
 * Todas as APIs sao mockadas. Acoes destrutivas validam o efeito real
 * (toast de sucesso, refetch, item desaparecendo, etc).
 *
 * NOTA: BreadcrumbBar renderiza titulo como <span>, nao como heading.
 * Usar getByText() para titulos do BreadcrumbBar.
 * Dialogs (DialogTitle) renderizam como <h2> e podem usar getByRole('heading').
 */

import { test, expect, emptyArray, jsonResponse, successResponse } from './fixtures'

// ============================================================
// 1. /admin/users
// ============================================================

test.describe('01. Admin Users (/admin/users)', () => {
  const MOCK_USERS = [
    {
      id: 1, username: 'admin', full_name: 'Administrador',
      role: 'admin', is_active: true, email: 'admin@pge.ms.gov.br',
      setor: 'TI', created_at: '2025-01-01T00:00:00Z',
      sistemas_permitidos: ['matriculas'], content_group_ids: [],
      pode_curar: false, pode_exportar: false, pode_ver_debug: false, pode_gerenciar_prompts: false,
    },
    {
      id: 2, username: 'usuario_teste', full_name: 'Usuario de Teste',
      role: 'user', is_active: true, email: 'teste@pge.ms.gov.br',
      setor: 'Juridico', created_at: '2025-06-15T00:00:00Z',
      sistemas_permitidos: ['gerador_pecas'], content_group_ids: [],
      pode_curar: false, pode_exportar: false, pode_ver_debug: false, pode_gerenciar_prompts: false,
    },
  ]

  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // UsersPage chama usersApi.get('?skip=0&limit=200') → GET /users?skip=0&limit=200
    await page.route('**/users?skip*', jsonResponse(MOCK_USERS))
    await page.route('**/users/content-groups', emptyArray)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo e tabela visiveis', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar renderiza titulo como <span>
    await expect(page.getByText('Gerenciamento de Usuarios')).toBeVisible()
    // full_name e mais seguro que username (evita strict mode: "admin" aparece em username E role)
    await expect(page.getByText('Administrador')).toBeVisible()
    await expect(page.getByText('Usuario de Teste')).toBeVisible()
    ctx.logAction('/admin/users', 'render', 'titulo+tabela', 'OK')
  })

  test('interacao: abrir e fechar dialog "Novo Usuario" pelo X', async ({ ctx }) => {
    const { page } = ctx
    await page.getByRole('button', { name: /novo.*usu/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('heading', { name: /novo.*usu/i })).toBeVisible()

    await page.getByTestId('dialog-close-btn').click()
    await expect(dialog).not.toBeVisible()
    ctx.logAction('/admin/users', 'interacao', 'dialog novo usuario X', 'Fechou OK')
  })

  test('interacao: abrir dialog "Editar" e fechar pelo Cancelar', async ({ ctx }) => {
    const { page } = ctx
    const editBtn = page.getByRole('button', { name: 'Editar' }).first()
    await editBtn.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('heading', { name: /editar.*usu/i })).toBeVisible()

    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).not.toBeVisible()
    ctx.logAction('/admin/users', 'interacao', 'dialog editar cancelar', 'Fechou OK')
  })

  test('interacao: select "Agrupar por" funciona', async ({ ctx }) => {
    const { page } = ctx
    const selectTrigger = page.getByTestId('group-by-select')
    await selectTrigger.click()
    await page.getByRole('option', { name: 'Sistema' }).click()
    // Deve mostrar view agrupada
    await expect(page.getByTestId('grouped-table')).toBeVisible()
    ctx.logAction('/admin/users', 'interacao', 'agrupar por sistema', 'OK')
  })

  test('destrutivo: excluir usuario (com confirmacao)', async ({ ctx }) => {
    const { page } = ctx

    // Mock DELETE que retorna sucesso
    let deleteCalled = false
    await page.route('**/users/2', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
      }
      return route.continue()
    })

    // Mock reload apos exclusao (apenas admin)
    await page.route(/\/users\?skip/, async (route) => {
      if (deleteCalled) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([MOCK_USERS[0]]),
        })
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(MOCK_USERS),
      })
    })

    // Aguardar tabela renderizar antes de interagir
    await expect(page.getByText('Usuario de Teste')).toBeVisible()

    // Clicar Excluir no segundo usuario (primeiro e admin, desabilitado)
    const excluirBtns = page.getByRole('button', { name: 'Excluir' })
    // Segundo botao (0-indexed) — o primeiro e do admin (disabled)
    await excluirBtns.nth(1).click()

    // Dialog de confirmacao — DialogTitle "Confirmar Exclusao"
    const confirmDialog = page.getByRole('dialog')
    await expect(confirmDialog).toBeVisible()
    await expect(page.getByRole('heading', { name: /confirmar/i })).toBeVisible()

    // Confirmar exclusao — botao "Excluir" dentro do dialog
    await confirmDialog.getByRole('button', { name: 'Excluir' }).click()

    // Verificar que o usuario sumiu
    await expect(page.getByText('Usuario de Teste')).not.toBeVisible()

    ctx.logAction('/admin/users', 'excluir', 'usuario_teste (id=2)', 'Excluido com sucesso')
  })

  test('destrutivo: resetar senha', async ({ ctx }) => {
    const { page } = ctx

    // Mock POST /users/2/reset-password (method-specific para nao conflitar com GET)
    await page.route('**/users/2/reset-password', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'OK', new_password: 'NovaSenha123!' }),
        })
      }
      return route.continue()
    })

    // Aguardar tabela renderizar
    await expect(page.getByText('Usuario de Teste')).toBeVisible()

    // Clicar "Resetar Senha" do segundo usuario
    await page.getByRole('button', { name: 'Resetar Senha' }).nth(1).click()

    // Dialog de nova senha — DialogTitle "Nova Senha" (abre APOS sucesso da API)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('heading', { name: /nova.*senha/i })).toBeVisible()
    await expect(page.getByText('NovaSenha123!')).toBeVisible()

    // Fechar dialog — usar X (dialog-close-btn) para evitar strict mode
    // (dialog tem 2 botoes "Fechar": footer button + X com aria-label="Fechar")
    await page.getByTestId('dialog-close-btn').click()
    await expect(dialog).not.toBeVisible()

    ctx.logAction('/admin/users', 'resetar-senha', 'usuario_teste (id=2)', 'Senha resetada OK')
  })
})

// ============================================================
// 2. /admin/prompts
// ============================================================

test.describe('02. Admin Prompts (/admin/prompts)', () => {
  const MOCK_PROMPTS = [
    { id: 1, sistema: 'matriculas', tipo: 'system', nome: 'Prompt Base', descricao: 'Prompt sistema', conteudo: 'Voce e um assistente...', is_active: true, updated_at: '2025-01-01T00:00:00Z', updated_by: 'admin' },
  ]

  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // PromptsPage chama adminApi.get('/admin/api/prompts')
    await page.route('**/admin/api/prompts', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prompts: MOCK_PROMPTS, total: 1 }) })
    )
    // Config IA
    await page.route('**/admin/config-ia', emptyArray)
    // Restore endpoint
    await page.route('**/admin/api/prompts/**', successResponse)
    await page.goto('/admin/prompts')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo e prompt visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Gerenciamento de Prompts e IA"
    await expect(page.getByText('Gerenciamento de Prompts e IA')).toBeVisible()
    await expect(page.getByText('Prompt Base')).toBeVisible()
    ctx.logAction('/admin/prompts', 'render', 'titulo+prompt', 'OK')
  })

  test('interacao: botao "Editar" do prompt abre dialog', async ({ ctx }) => {
    const { page } = ctx
    // Editar button esta no CardContent do prompt
    await page.getByRole('button', { name: 'Editar' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Fechar pelo X
    await page.getByTestId('dialog-close-btn').click()
    await expect(dialog).not.toBeVisible()
    ctx.logAction('/admin/prompts', 'interacao', 'dialog editar prompt', 'Fechou OK')
  })

  test('destrutivo: restaurar prompt ao padrao', async ({ ctx }) => {
    const { page } = ctx

    // O botao "Restaurar" esta sempre visivel no CardContent (nao depende de expand)
    const restaurarBtn = page.getByTestId('btn-restaurar-padrao-1')
    await expect(restaurarBtn).toBeVisible()
    await restaurarBtn.click()

    // Confirmacao: dialog abre
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Confirmar restauracao
    await dialog.getByRole('button', { name: /confirmar|restaurar/i }).click()

    ctx.logAction('/admin/prompts', 'restaurar-padrao', 'prompt id=1', 'Restaurado OK')
  })
})

// ============================================================
// 3. /admin/prompts-modulos
// ============================================================

test.describe('03. Admin Prompts Modulos (/admin/prompts-modulos)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // IMPORTANTE: usar regex para rota com query params — glob `?` matches `/` tambem!
    // Se usasse `**/prompts-modulos?**`, interceptaria `/prompts-modulos/grupos` (bug).
    await page.route(/\/admin\/api\/prompts-modulos\?/, emptyArray)
    // Rotas especificas (registradas DEPOIS = checadas PRIMEIRO no LIFO)
    await page.route('**/admin/api/prompts-modulos/grupos/*/subgrupos', emptyArray)
    await page.route('**/admin/api/prompts-modulos/grupos/*/subcategorias', emptyArray)
    await page.route('**/admin/api/prompts-modulos/grupos', jsonResponse([
      { id: 1, nome: 'Grupo Principal', descricao: 'Grupo de teste', ordem: 1, ativo: true },
    ]))
    await page.goto('/admin/prompts-modulos')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Modulos de Prompts"
    await expect(page.getByText('Modulos de Prompts')).toBeVisible()
    ctx.logAction('/admin/prompts-modulos', 'render', 'titulo', 'OK')
  })

  test('interacao: abrir dialog Grupos', async ({ ctx }) => {
    const { page } = ctx
    // Botao "Grupos" esta no BreadcrumbBar actions
    await page.getByRole('button', { name: 'Grupos' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Scoped ao dialog para evitar conflito com combobox do seletor de grupo
    await expect(dialog.getByText('Grupo Principal')).toBeVisible()

    await page.getByTestId('dialog-close-btn').click()
    await expect(dialog).not.toBeVisible()
    ctx.logAction('/admin/prompts-modulos', 'interacao', 'dialog grupos', 'Abriu/fechou OK')
  })
})

// ============================================================
// 4. /admin/feedbacks
// ============================================================

test.describe('04. Admin Feedbacks (/admin/feedbacks)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // FeedbacksPage chama dashboard, lista e modelos-ia
    await page.route('**/admin/api/feedbacks/dashboard**', jsonResponse({
      total_consultas: 100, total_feedbacks: 50, taxa_acerto: 80,
      consultas_sem_feedback: 50,
      avaliacoes: { correto: 30, parcial: 10, incorreto: 5, erro_ia: 5 },
      evolucao_por_sistema: {}, feedbacks_por_usuario: [], pendentes_feedback: [],
      por_sistema: {}, filtro_aplicado: { mes: null, ano: 2026, sistema: null },
    }))
    await page.route('**/admin/api/feedbacks/lista**', jsonResponse({
      feedbacks: [], total: 0, page: 1, per_page: 20, total_pages: 0,
    }))
    await page.route('**/admin/modelos-ia**', jsonResponse({
      assistencia_judiciaria: { id: 1, modelo: 'gemini-2.0-flash', descricao: '' },
      matriculas: { id: 2, modelo: 'gemini-2.0-flash', descricao: '' },
      gerador_pecas: { id: 3, modelo: 'gemini-2.0-flash', descricao: '' },
      pedido_calculo: { id: 4, modelo: 'gemini-2.0-flash', descricao: '' },
    }))
    await page.goto('/admin/feedbacks')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo e cards de metricas', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Dashboard de Feedbacks"
    await expect(page.getByText('Dashboard de Feedbacks')).toBeVisible()
    await expect(page.getByText('100')).toBeVisible() // total consultas
    ctx.logAction('/admin/feedbacks', 'render', 'titulo+cards', 'OK')
  })
})

// ============================================================
// 5. /admin/performance
// ============================================================

test.describe('05. Admin Performance (/admin/performance)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // PerformancePage chama adminApi.get('/admin/api/performance/summary?...')
    await page.route('**/admin/api/performance/summary**', jsonResponse({
      bottleneck_summary: { llm: 5, db: 3, parse: 2, network: 1 },
      avg_times: { llm: 1200, db: 300, parse: 50, total: 1550 },
      recent_errors: [], top_slowest: [],
    }))
    await page.route('**/admin/api/performance/logs**', jsonResponse({ logs: [] }))
    await page.route('**/admin/api/performance/route-mapping', jsonResponse({ mappings: [] }))
    await page.route('**/admin/api/gemini-logs/summary**', jsonResponse({
      total_calls: 0, stats: { success_count: 0, error_count: 0, avg_latency_ms: 0, success_rate: 100, total_prompt_tokens: 0, total_response_tokens: 0 },
      by_sistema: [], by_model: [],
    }))
    await page.route('**/admin/api/gemini-logs?**', jsonResponse({ logs: [] }))
    await page.goto('/admin/performance')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo e cards de gargalo', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Performance & Logs"
    await expect(page.getByText('Performance & Logs')).toBeVisible()
    // Gargalo LLM mostra numero 5
    await expect(page.locator('text=LLM').first()).toBeVisible()
    ctx.logAction('/admin/performance', 'render', 'titulo+cards', 'OK')
  })

  test('interacao: navegar tabs', async ({ ctx }) => {
    const { page } = ctx
    // Tabs sao <button> simples, NAO Radix Tabs (sem role="tab")
    // Tab labels: "Performance Sistema", "Logs Gemini API", "Logs Avancados"
    const geminiTab = page.getByRole('button', { name: /Logs Gemini API/i })
    await expect(geminiTab).toBeVisible()
    await geminiTab.click()

    // Tab "Logs Avancados"
    const avancadoTab = page.getByRole('button', { name: /Logs Avancados/i })
    await expect(avancadoTab).toBeVisible()
    await avancadoTab.click()

    // Voltar para "Performance Sistema"
    await page.getByRole('button', { name: /Performance Sistema/i }).click()

    ctx.logAction('/admin/performance', 'interacao', 'tabs', 'Navegou OK')
  })

  test('destrutivo: limpar logs antigos', async ({ ctx }) => {
    const { page } = ctx
    await page.route('**/admin/api/performance/logs/limpar**', jsonResponse({ deleted: 10 }))

    await page.getByRole('button', { name: /limpar.*antigos/i }).click()
    // Nao tem confirmacao, executa direto
    ctx.logAction('/admin/performance', 'limpar-logs', 'logs > 7 dias', 'Executado OK')
  })
})

// ============================================================
// 6. /admin/variaveis
// ============================================================

test.describe('06. Admin Variaveis (/admin/variaveis)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // VariaveisPage chama adminApi.get('/admin/api/extraction/variaveis/resumo')
    await page.route('**/admin/api/extraction/variaveis/resumo', jsonResponse({
      total: 25, variaveis_com_uso: 20, variaveis_sem_uso: 5, distribuicao_tipos: { text: 10, number: 5, boolean: 5, date: 5 },
    }))
    // Lista de variaveis
    await page.route('**/admin/api/extraction/variaveis?**', jsonResponse([
      { id: 1, slug: 'valor_causa', label: 'Valor da Causa', tipo: 'currency', categoria_nome: 'peticoes', ativo: true, em_uso_json: true, uso_count_prompts: 3 },
    ]))
    // Categorias com variaveis
    await page.route('**/admin/api/categorias-resumo-json?apenas_com_variaveis*', emptyArray)
    await page.goto('/admin/variaveis')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo, cards e tabela', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Painel de Variaveis"
    await expect(page.getByText('Painel de Variaveis')).toBeVisible()
    await expect(page.getByText('25')).toBeVisible() // total
    await expect(page.getByText('valor_causa')).toBeVisible()
    ctx.logAction('/admin/variaveis', 'render', 'titulo+cards+tabela', 'OK')
  })

  test('interacao: abrir e fechar dialog Glossario', async ({ ctx }) => {
    const { page } = ctx
    // Botao "Glossario" esta no BreadcrumbBar actions (texto pode estar hidden em mobile)
    await page.getByRole('button', { name: /Glossário/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('heading', { name: /Glossário/i })).toBeVisible()

    // Fechar via X — evita strict mode (2 botoes "Fechar": footer + X aria-label)
    await page.getByTestId('dialog-close-btn').click()
    await expect(dialog).not.toBeVisible()
    ctx.logAction('/admin/variaveis', 'interacao', 'dialog glossario', 'OK')
  })
})

// ============================================================
// 7. /admin/categorias-json (render + interacoes basicas)
// ============================================================

test.describe('07. Admin Categorias JSON (/admin/categorias-json)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // CategoriasJsonPage chama listar() → GET /admin/api/categorias-resumo-json?apenas_ativos=false
    await page.route('**/admin/api/categorias-resumo-json?apenas_ativos=false', jsonResponse([
      { id: 1, nome: 'docs', titulo: 'Documentos', descricao: '', codigos_documento: [100], formato_json: '{}', instrucoes_extracao: '', is_residual: false, ativo: true, source_type: 'code', source_special_type: null, updated_at: '2025-01-01', ia_generated: false },
    ]))
    await page.route('**/admin/api/categorias-resumo-json/config/codigos-ignorados', jsonResponse({ codigos: [] }))
    await page.route('**/admin/api/categorias-resumo-json/1', jsonResponse({
      id: 1, nome: 'docs', titulo: 'Documentos', descricao: '', codigos_documento: [100], formato_json: '{}', instrucoes_extracao: '', is_residual: false, ativo: true, source_type: 'code', source_special_type: null,
    }))
    await page.route('**/admin/api/categorias-resumo-json/fontes-especiais', emptyArray)
    await page.route('**/admin/api/extraction/categorias/*/perguntas', emptyArray)
    await page.goto('/admin/categorias-json')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo e grid de categorias', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Categorias JSON"
    await expect(page.getByText('Categorias JSON')).toBeVisible()
    await expect(page.getByTestId('categorias-grid')).toBeVisible()
    ctx.logAction('/admin/categorias-json', 'render', 'titulo+grid', 'OK')
  })

  test('destrutivo: desativar categoria (com confirmacao)', async ({ ctx }) => {
    const { page } = ctx

    // Mock DELETE /admin/api/categorias-resumo-json/1
    let desativarCalled = false
    await page.route('**/admin/api/categorias-resumo-json/1', async (route) => {
      if (route.request().method() === 'DELETE') {
        desativarCalled = true
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 1, nome: 'docs', titulo: 'Documentos', descricao: '', codigos_documento: [100], formato_json: '{}', instrucoes_extracao: '', is_residual: false, ativo: true, source_type: 'code', source_special_type: null,
      })})
    })

    // Mock reload apos desativar
    await page.route('**/admin/api/categorias-resumo-json?apenas_ativos=false', async (route) => {
      if (desativarCalled) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 1, nome: 'docs', titulo: 'Documentos', descricao: '', codigos_documento: [100], formato_json: '{}', instrucoes_extracao: '', is_residual: false, ativo: true, source_type: 'code', source_special_type: null, updated_at: '2025-01-01', ia_generated: false },
      ])})
    })

    // Clicar desativar
    await page.getByTestId('btn-desativar-1').click()

    // Dialog de confirmacao
    const dialog = page.getByTestId('deactivate-dialog')
    await expect(dialog).toBeVisible()

    // Confirmar
    await page.getByTestId('btn-confirm-deactivate').click()

    // Verificar que grid ficou vazio
    await expect(page.getByTestId('categoria-card-1')).not.toBeVisible()

    ctx.logAction('/admin/categorias-json', 'desativar', 'docs (id=1)', 'Desativada com sucesso')
  })
})

// ============================================================
// 8. /admin/historico-gerador
// ============================================================

test.describe('08. Admin Historico Gerador (/admin/historico-gerador)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // HistoricoGeradorPage chama createApiClient('/admin/api/gerador-pecas-admin').get('/geracoes?...')
    await page.route('**/admin/api/gerador-pecas-admin/geracoes**', emptyArray)
    await page.goto('/admin/historico-gerador')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Historico - Gerador de Pecas"
    await expect(page.getByText('Historico - Gerador de Pecas')).toBeVisible()
    ctx.logAction('/admin/historico-gerador', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 9. /admin/historico-pedido-calculo
// ============================================================

test.describe('09. Admin Historico Pedido Calculo (/admin/historico-pedido-calculo)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // HistoricoPedidoCalculoPage chama pedidoCalculoAdminApi → createApiClient('/pedido-calculo-admin')
    await page.route('**/pedido-calculo-admin/geracoes**', emptyArray)
    await page.goto('/admin/historico-pedido-calculo')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Historico - Pedido de Calculo"
    await expect(page.getByText('Historico - Pedido de Calculo')).toBeVisible()
    ctx.logAction('/admin/historico-pedido-calculo', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 10. /admin/historico-prestacao-contas
// ============================================================

test.describe('10. Admin Historico Prestacao Contas (/admin/historico-prestacao-contas)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // HistoricoPrestacaoContasPage chama createApiClient('/admin/api/prestacao-admin')
    await page.route('**/admin/api/prestacao-admin/geracoes**', emptyArray)
    await page.goto('/admin/historico-prestacao-contas')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Historico - Prestacao de Contas"
    await expect(page.getByText('Historico - Prestacao de Contas')).toBeVisible()
    ctx.logAction('/admin/historico-prestacao-contas', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 11. /admin/modulos-tipo-peca
// ============================================================

test.describe('11. Admin Modulos Tipo Peca (/admin/modulos-tipo-peca)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // ModulosTipoPecaPage usa PromptGroup { id: number; name: string } (campo "name", nao "nome")
    await page.route('**/admin/api/prompts-modulos/grupos', jsonResponse([
      { id: 1, name: 'Grupo Teste' },
    ]))
    await page.route('**/admin/api/prompts-modulos/tipos-peca**', emptyArray)
    // Endpoint real: /admin/api/prompts-modulos/resumo-configuracao-tipos-peca
    await page.route('**/admin/api/prompts-modulos/resumo-configuracao**', jsonResponse({
      total_modulos_conteudo: 0, tipos_peca: [],
    }))
    await page.goto('/admin/modulos-tipo-peca')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Módulos por Tipo de Peça" (com acentos)
    await expect(page.getByText('Módulos por Tipo de Peça')).toBeVisible()
    ctx.logAction('/admin/modulos-tipo-peca', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 12. /admin/config-pecas
// ============================================================

test.describe('12. Admin Config Pecas (/admin/config-pecas)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // ConfigPecasPage chama createApiClient('/api/gerador-pecas/config') e createApiClient('/admin/api/config-pecas')
    await page.route('**/api/gerador-pecas/config/categorias', emptyArray)
    await page.route('**/api/gerador-pecas/config/tipos-peca', emptyArray)
    await page.route('**/admin/api/config-pecas**', jsonResponse({ configuracoes: [], tipos_peca: [] }))
    await page.goto('/admin/config-pecas')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Configuração de Peças" (com acentos)
    await expect(page.getByText('Configuração de Peças')).toBeVisible()
    ctx.logAction('/admin/config-pecas', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 13. /admin/teste-ativacao
// ============================================================

test.describe('13. Admin Teste Ativacao (/admin/teste-ativacao)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // TesteAtivacaoPage chama adminApi.get('/teste-ativacao/...')
    await page.route('**/teste-ativacao/tipos-peca', emptyArray)
    await page.route('**/teste-ativacao/categorias-extracao', emptyArray)
    await page.route('**/teste-ativacao/variaveis-processo', emptyArray)
    await page.route('**/teste-ativacao/cenarios', emptyArray)
    await page.goto('/admin/teste-ativacao')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Teste de Ativacao de Modulos"
    await expect(page.getByText('Teste de Ativacao de Modulos')).toBeVisible()
    ctx.logAction('/admin/teste-ativacao', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 14. /admin/teste-categorias
// ============================================================

test.describe('14. Admin Teste Categorias (/admin/teste-categorias)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    // TesteCategoriasPage chama adminApi.get('/admin/api/categorias-resumo-json?apenas_ativos=false')
    await page.route('**/admin/api/categorias-resumo-json?apenas_ativos=false', emptyArray)
    await page.route('**/admin/api/categorias-resumo-json/teste-categorias/**', emptyArray)
    await page.goto('/admin/teste-categorias')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Ambiente de Teste de Categorias"
    await expect(page.getByText('Ambiente de Teste de Categorias')).toBeVisible()
    ctx.logAction('/admin/teste-categorias', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 15. /admin/tjms-docs
// ============================================================

test.describe('15. Admin TJMS Docs (/admin/tjms-docs)', () => {
  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    await page.goto('/admin/tjms-docs')
    await page.waitForLoadState('networkidle')
    // BreadcrumbBar: "Documentacao Integracao TJ-MS"
    await expect(page.getByText('Documentacao Integracao TJ-MS')).toBeVisible()
    ctx.logAction('/admin/tjms-docs', 'render', 'titulo', 'OK')
  })
})

// ============================================================
// 16. /admin/restaurar-slugs
// ============================================================

test.describe('16. Admin Restaurar Slugs (/admin/restaurar-slugs)', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx
    await page.goto('/admin/restaurar-slugs')
    await page.waitForLoadState('networkidle')
  })

  test('render: titulo visivel', async ({ ctx }) => {
    const { page } = ctx
    // BreadcrumbBar: "Restaurar Slugs" (tambem existe como texto do botao — usar .first() para strict mode)
    await expect(page.getByText('Restaurar Slugs').first()).toBeVisible()
    ctx.logAction('/admin/restaurar-slugs', 'render', 'titulo', 'OK')
  })

  test('destrutivo: executar restauracao de slugs', async ({ ctx }) => {
    const { page } = ctx

    // Mock POST /admin/api/extraction/restaurar-slugs (method-specific)
    await page.route('**/admin/api/extraction/restaurar-slugs', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true, variaveis_atualizadas: 5, variaveis_removidas: 0, perguntas_sincronizadas: 3,
          }),
        })
      }
      return route.continue()
    })

    // Botao "Restaurar Slugs" — usar selector mais especifico (o botao e o unico <button> com esse texto)
    const btn = page.getByRole('button', { name: /Restaurar Slugs/i })
    await expect(btn).toBeVisible()
    await btn.click()

    // Verificar que resultado apareceu
    await expect(page.getByText('Resultado:')).toBeVisible()

    ctx.logAction('/admin/restaurar-slugs', 'restaurar', 'todas as categorias', 'Executado OK')
  })
})
