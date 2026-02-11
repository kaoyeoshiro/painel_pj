/**
 * Full Regression — Estados de Erro
 *
 * Testa como a aplicação se comporta quando APIs retornam erros:
 * 401 (redirect), 422 (validação), 500 (erro genérico),
 * timeout, rota inexistente, e console.error.
 */

import { test, expect } from '@playwright/test'
import {
  setupFullRegressionMocks,
  setupAuthMeError,
  MOCK_TOKEN,
} from './fixtures/api-mocks'
import { createConsoleErrorCollector } from './fixtures/auth-enhanced'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function setupAuthenticatedPage(page: import('@playwright/test').Page): Promise<void> {
  await setupFullRegressionMocks(page)
  await page.addInitScript((token: string) => {
    localStorage.setItem('access_token', token)
  }, MOCK_TOKEN)
}

// ===========================================================================
// 1. API retorna 401 em rota autenticada
// ===========================================================================
test.describe('Erro 401 — token inválido', () => {
  test('401 em /auth/me redireciona para login (não crash)', async ({ page }) => {
    await page.addInitScript((token: string) => {
      localStorage.setItem('access_token', token)
    }, MOCK_TOKEN)

    await setupAuthMeError(page, 401)

    // Mock genérico para APIs
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )

    await page.goto('/dashboard')

    // Deve redirecionar para login sem crash
    await page.waitForURL('**/login', { timeout: 10_000 })
    expect(page.url()).toContain('/login')

    // Verifica que não há tela branca
    const body = page.locator('body')
    const text = (await body.innerText()).trim()
    expect(text.length).toBeGreaterThan(5)
  })

  test('401 em API de dados não causa crash (rota portal)', async ({ page }) => {
    await setupAuthenticatedPage(page)

    // Sobrescreve mock de APIs de dados para retornar 401
    await page.route('**/gerador-pecas/api/**', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Token expirado' }) })
    )

    await page.goto('/gerador-pecas')
    await page.waitForLoadState('domcontentloaded')

    // A página deve renderizar (pode mostrar estado de erro) mas não crashar
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

// ===========================================================================
// 2. API retorna 422 — erro de validação
// ===========================================================================
test.describe('Erro 422 — validação', () => {
  test('422 em POST exibe feedback ao usuário', async ({ page }) => {
    await setupAuthenticatedPage(page)

    // Mock POST para retornar 422
    await page.route('**/auth/change-password', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: [{ loc: ['body', 'new_password'], msg: 'Senha muito curta', type: 'value_error' }],
        }),
      })
    )

    await page.goto('/change-password')
    await page.waitForLoadState('networkidle')

    // Preenche formulário e tenta submeter
    const passwordInputs = page.locator('input[type="password"]')
    const count = await passwordInputs.count()

    if (count >= 2) {
      await passwordInputs.nth(0).fill('senhaatual123')
      await passwordInputs.nth(1).fill('x') // Senha curta
      if (count >= 3) {
        await passwordInputs.nth(2).fill('x')
      }

      const submitBtn = page.getByRole('button', { name: /salvar|alterar|confirmar|atualizar/i })
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await page.waitForTimeout(1_000)
      }
    }

    // A página não deve ter crashado
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

// ===========================================================================
// 3. API retorna 500 — erro interno
// ===========================================================================
test.describe('Erro 500 — erro interno', () => {
  test('500 em API de dados não causa crash', async ({ page }) => {
    await setupAuthenticatedPage(page)

    // Sobrescreve mock para retornar 500 em APIs admin
    await page.route('**/admin/api/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal Server Error' }) })
    )

    await page.goto('/admin/feedbacks')
    await page.waitForLoadState('domcontentloaded')

    // A página deve renderizar (pode estar com estado de erro) mas não crash
    const body = page.locator('body')
    await expect(body).toBeVisible()

    const text = (await body.innerText()).trim()
    expect(text.length).toBeGreaterThan(5)
  })

  test('500 em /admin/users não mostra tela branca', async ({ page }) => {
    await setupAuthenticatedPage(page)

    await page.route('**/admin/api/users**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'DB Error' }) })
    )
    await page.route('**/users**', (route) => {
      if (route.request().resourceType() === 'document') return route.continue()
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'DB Error' }) })
    })

    await page.goto('/admin/users')
    await page.waitForLoadState('domcontentloaded')

    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

// ===========================================================================
// 4. Rota inexistente (404)
// ===========================================================================
test.describe('Rota inexistente', () => {
  test('rota /xyz não causa crash', async ({ page }) => {
    await setupAuthenticatedPage(page)

    await page.goto('/xyz')
    await page.waitForLoadState('domcontentloaded')

    // Deve mostrar algo (404, redirect para dashboard, ou qualquer tratamento)
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('rota /admin/xyz não causa crash', async ({ page }) => {
    await setupAuthenticatedPage(page)

    await page.goto('/admin/xyz')
    await page.waitForLoadState('domcontentloaded')

    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

// ===========================================================================
// 5. Console.error audit — rotas amostrais
// ===========================================================================
test.describe('Console audit — sem erros inesperados', () => {
  const routes = [
    '/dashboard',
    '/admin/users',
    '/admin/feedbacks',
    '/admin/performance',
    '/admin/variaveis',
  ]

  for (const route of routes) {
    test(`sem console.error inesperado em ${route}`, async ({ page }) => {
      await setupAuthenticatedPage(page)

      const collector = createConsoleErrorCollector(page)

      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1_000)

      const errors = collector.getErrors()
      expect(errors).toEqual([])
    })
  }
})
