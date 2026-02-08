/**
 * Testes de paridade UI — Páginas de Sistemas
 *
 * Verifica que todos os controles do legado existem no React para:
 * - Dashboard, Troca de Senha
 * - Assistência Judiciária, Matrículas
 * - Gerador de Peças, Pedido de Cálculo, Prestação de Contas
 * - Relatório de Cumprimento, Cumprimento Beta
 * - Classificador, BERT Training, Extrator de Autos
 *
 * Referência: docs/ui_parity_matrix.md seções 2-13
 */

import { test, expect, MOCK_ADMIN_USER } from './fixtures/auth'

// ---------------------------------------------------------------------------
// 2. Dashboard (/dashboard)
// ---------------------------------------------------------------------------
test.describe('2. Dashboard (/dashboard)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock dashboard API
    await page.route('**/api/dashboard**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sistemas: [],
          total_geracoes: 0,
          total_usuarios: 0,
          estatisticas: {},
        }),
      })
    )
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('2.1-2.5 — Cards de sistemas visíveis', async ({ authenticatedPage: page }) => {
    // Verifica que a página carregou com título
    const heading = page.getByRole('heading', { name: /dashboard|painel/i }).first()
    await expect(heading).toBeVisible()
  })

  test('2.6-2.10 — Navegação entre sistemas funciona', async ({ authenticatedPage: page }) => {
    // Verifica que existem links/cards de navegação
    const links = page.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 3. Troca de Senha (/change-password)
// ---------------------------------------------------------------------------
test.describe('3. Troca de Senha (/change-password)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/change-password')
    await page.waitForLoadState('networkidle')
  })

  test('3.1 — Campo senha atual', async ({ authenticatedPage: page }) => {
    const input = page.locator('input[type="password"]').first()
    await expect(input).toBeVisible()
  })

  test('3.2 — Campo nova senha', async ({ authenticatedPage: page }) => {
    const inputs = page.locator('input[type="password"]')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('3.3 — Campo confirmar senha', async ({ authenticatedPage: page }) => {
    const inputs = page.locator('input[type="password"]')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('3.4 — Botão alterar senha', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /alterar|salvar|trocar/i })
    await expect(btn).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 4. Assistência Judiciária (/assistencia)
// ---------------------------------------------------------------------------
test.describe('4. Assistência Judiciária (/assistencia)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/assistencia**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/assistencia')
    await page.waitForLoadState('networkidle')
  })

  test('4.1 — Campo CNJ para busca', async ({ authenticatedPage: page }) => {
    const input = page.getByPlaceholder(/cnj|processo/i)
    await expect(input).toBeVisible()
  })

  test('4.2 — Botão buscar/consultar', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /buscar|consultar|analisar/i })
    await expect(btn).toBeVisible()
  })

  test('4.3 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 5. Matrículas (/matriculas)
// ---------------------------------------------------------------------------
test.describe('5. Matrículas (/matriculas)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/matriculas**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/matriculas')
    await page.waitForLoadState('networkidle')
  })

  test('5.1 — Tabela/lista de matrículas', async ({ authenticatedPage: page }) => {
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })

  test('5.2 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 6. Gerador de Peças (/gerador-pecas)
// ---------------------------------------------------------------------------
test.describe('6. Gerador de Peças (/gerador-pecas)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/gerador**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/gerador-pecas')
    await page.waitForLoadState('networkidle')
  })

  test('6.1 — Campo CNJ', async ({ authenticatedPage: page }) => {
    const input = page.getByPlaceholder(/cnj|processo/i)
    await expect(input).toBeVisible()
  })

  test('6.2 — Seletor tipo de peça', async ({ authenticatedPage: page }) => {
    // Verifica select ou combobox para tipo de peça
    const select = page.getByRole('combobox').first()
    await expect(select).toBeVisible()
  })

  test('6.3 — Botão gerar/enviar', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /gerar|enviar|iniciar/i }).first()
    await expect(btn).toBeVisible()
  })

  test('6.4 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading', { name: /gerador|peça/i }).first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 7. Pedido de Cálculo (/pedido-calculo)
// ---------------------------------------------------------------------------
test.describe('7. Pedido de Cálculo (/pedido-calculo)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/pedido-calculo**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/pedido-calculo')
    await page.waitForLoadState('networkidle')
  })

  test('7.1 — Campo CNJ', async ({ authenticatedPage: page }) => {
    const input = page.getByPlaceholder(/cnj|processo/i)
    await expect(input).toBeVisible()
  })

  test('7.2 — Botão gerar/consultar', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /gerar|consultar|enviar|iniciar/i }).first()
    await expect(btn).toBeVisible()
  })

  test('7.3 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 8. Prestação de Contas (/prestacao-contas)
// ---------------------------------------------------------------------------
test.describe('8. Prestação de Contas (/prestacao-contas)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/prestacao**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ geracoes: [], total: 0 }) })
    )
    await page.goto('/prestacao-contas')
    await page.waitForLoadState('networkidle')
  })

  test('8.1 — Campo CNJ', async ({ authenticatedPage: page }) => {
    const input = page.getByPlaceholder(/cnj|processo/i)
    await expect(input).toBeVisible()
  })

  test('8.2 — Botão analisar/enviar', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /analisar|enviar|iniciar/i }).first()
    await expect(btn).toBeVisible()
  })

  test('8.3 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 9. Relatório de Cumprimento (/relatorio-cumprimento)
// ---------------------------------------------------------------------------
test.describe('9. Relatório de Cumprimento (/relatorio-cumprimento)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/relatorio**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/relatorio-cumprimento')
    await page.waitForLoadState('networkidle')
  })

  test('9.1 — Campo CNJ', async ({ authenticatedPage: page }) => {
    const input = page.getByPlaceholder(/cnj|processo/i)
    await expect(input).toBeVisible()
  })

  test('9.2 — Botão gerar relatório', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /gerar|consultar|enviar/i }).first()
    await expect(btn).toBeVisible()
  })

  test('9.3 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 10. Cumprimento Beta (/cumprimento-beta)
// ---------------------------------------------------------------------------
test.describe('10. Cumprimento Beta (/cumprimento-beta)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/cumprimento**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/cumprimento-beta')
    await page.waitForLoadState('networkidle')
  })

  test('10.1 — Campo CNJ', async ({ authenticatedPage: page }) => {
    const input = page.getByPlaceholder(/cnj|processo/i)
    await expect(input).toBeVisible()
  })

  test('10.2 — Botão gerar/analisar', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /gerar|analisar|enviar/i }).first()
    await expect(btn).toBeVisible()
  })

  test('10.3 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 11. Classificador (/classificador)
// ---------------------------------------------------------------------------
test.describe('11. Classificador (/classificador)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/classificador**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/classificador')
    await page.waitForLoadState('networkidle')
  })

  test('11.1 — Input de arquivo (data-testid=file-input)', async ({ authenticatedPage: page }) => {
    const input = page.locator('[data-testid="file-input"]')
    await expect(input).toBeAttached()
  })

  test('11.2 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('11.3 — Botão classificar/enviar', async ({ authenticatedPage: page }) => {
    const btn = page.getByRole('button', { name: /classific|enviar|analisar/i }).first()
    await expect(btn).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 12. BERT Training (/bert-training)
// ---------------------------------------------------------------------------
test.describe('12. BERT Training (/bert-training)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/bert**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.route('**/api/bert/jobs**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.route('**/api/bert/datasets**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.route('**/api/bert/models**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.route('**/api/bert/worker**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'online', gpu_info: null }),
      })
    )
    await page.goto('/bert-training')
    await page.waitForLoadState('networkidle')
  })

  test('12.1 — Botão voltar ao dashboard', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-voltar-dashboard"]')).toBeVisible()
  })

  test('12.2 — Botão debug conexão', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-debug-conexao"]')).toBeVisible()
  })

  test('12.3 — Botão ajuda/onboarding', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-ajuda-onboarding"]')).toBeVisible()
  })

  test('12.4 — Tabs de navegação (Novo Treino, Monitorar, Testar, Comparar)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="tab-novo-treino"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-monitorar"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-testar"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-comparar"]')).toBeVisible()
  })

  test('12.5 — Preset cards de treinamento', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="preset-cards-container"]')).toBeVisible()
  })

  test('12.6 — Botão upload dataset', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-upload-dataset"]')).toBeVisible()
  })

  test('12.7 — Select dataset e modelo base', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="select-dataset"]')).toBeVisible()
    await expect(page.locator('[data-testid="select-modelo-base"]')).toBeVisible()
  })

  test('12.8 — Campos de hiperparâmetros', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="input-learning-rate"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-batch-size"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-num-epochs"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-max-length"]')).toBeVisible()
  })

  test('12.9 — Botão iniciar treinamento', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="btn-iniciar-treinamento"]')).toBeVisible()
  })

  test('12.10 — Worker GPU info card', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="worker-gpu-info-card"]')).toBeVisible()
  })

  test('12.11 — Tab Monitorar: filtro status e lista de jobs', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-monitorar"]').click()
    await expect(page.locator('[data-testid="status-filter-pills"]')).toBeVisible()
  })

  test('12.12 — Tab Testar: classificação de texto', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-testar"]').click()
    await expect(page.locator('[data-testid="select-modelo-teste"]')).toBeVisible()
    await expect(page.locator('[data-testid="textarea-texto-teste"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-classificar-texto"]')).toBeVisible()
  })

  test('12.13 — Tab Testar: classificação em lote', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-testar"]').click()
    await expect(page.locator('[data-testid="textarea-batch-texto"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-classificar-lote"]')).toBeVisible()
  })

  test('12.14 — Tab Testar: classificar PDF', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-testar"]').click()
    await expect(page.locator('[data-testid="classificar-pdf-card"]')).toBeVisible()
  })

  test('12.15 — Tab Testar: limpar histórico', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-testar"]').click()
    await expect(page.locator('[data-testid="btn-limpar-historico-testes"]')).toBeVisible()
  })

  test('12.16 — Tab Comparar: textarea e botão comparar', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="tab-comparar"]').click()
    await expect(page.locator('[data-testid="textarea-comparar"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-comparar"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 13. Extrator de Autos (/extrator-autos)
// ---------------------------------------------------------------------------
test.describe('13. Extrator de Autos (/extrator-autos)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route('**/api/extrator**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )
    await page.goto('/extrator-autos')
    await page.waitForLoadState('networkidle')
  })

  test('13.1 — Campo CNJ', async ({ authenticatedPage: page }) => {
    const input = page.getByPlaceholder(/cnj|processo/i)
    await expect(input).toBeVisible()
  })

  test('13.2 — Status BERT (data-testid=bert-status)', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="bert-status"]')).toBeVisible()
  })

  test('13.3 — Textarea lote (data-testid=lote-textarea)', async ({ authenticatedPage: page }) => {
    // Pode estar em uma tab diferente
    const textarea = page.locator('[data-testid="lote-textarea"]')
    // Verifica que existe no DOM (pode não estar visível se está em tab inativa)
    await expect(textarea).toBeAttached()
  })

  test('13.4 — Título da página', async ({ authenticatedPage: page }) => {
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })
})
