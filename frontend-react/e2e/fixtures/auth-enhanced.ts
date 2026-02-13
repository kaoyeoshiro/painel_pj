/**
 * Fixture aprimorada para testes full-regression.
 *
 * Estende a fixture base de autenticação com:
 * - loginAsAdmin / loginAsUser helpers
 * - Mocks realistas por rota (via api-mocks)
 * - Validação de console.error
 * - Helper expectPageRendered
 */

import { test as base, expect, type Page } from '@playwright/test'
import { setupFullRegressionMocks, MOCK_TOKEN, MOCK_ADMIN_USER, MOCK_REGULAR_USER } from './api-mocks'

// ---------------------------------------------------------------------------
// Helpers de autenticação
// ---------------------------------------------------------------------------

/**
 * Configura o localStorage com token de autenticação e navega para '/'.
 * Precisa navegar antes para poder acessar localStorage do domínio.
 */
async function loginWithToken(page: Page): Promise<void> {
  await page.addInitScript((token: string) => {
    localStorage.setItem('access_token', token)
  }, MOCK_TOKEN)
}

/**
 * Configura autenticação como admin e aplica mocks de API.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await setupFullRegressionMocks(page)
  await loginWithToken(page)
}

/**
 * Configura autenticação como usuário regular (não-admin).
 * Substitui o mock de /auth/me para retornar usuário não-admin.
 */
export async function loginAsUser(page: Page): Promise<void> {
  await setupFullRegressionMocks(page)

  // Sobrescreve o mock de /auth/me para retornar usuário regular
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REGULAR_USER),
    })
  )

  await loginWithToken(page)
}

// ---------------------------------------------------------------------------
// Helpers de validação
// ---------------------------------------------------------------------------

/**
 * Verifica que a página renderizou corretamente:
 * - body visível
 * - conteúdo de texto mínimo (não é tela em branco)
 * - sem mensagem de crash/erro React
 */
export async function expectPageRendered(page: Page): Promise<void> {
  const body = page.locator('body')
  await expect(body).toBeVisible({ timeout: 10_000 })

  const text = (await body.innerText()).trim()
  expect(text.length).toBeGreaterThanOrEqual(10)

  // Verifica que não há erro de React (tela de erro genérica)
  const errorBoundary = page.locator('text=Something went wrong')
  const errorCount = await errorBoundary.count()
  expect(errorCount).toBe(0)
}

/**
 * Verifica que a sidebar do AppLayout está presente.
 */
export async function expectLayoutRendered(page: Page): Promise<void> {
  // A sidebar tem nav com links de navegação
  const sidebar = page.locator('nav').first()
  await expect(sidebar).toBeAttached({ timeout: 10_000 })
}

/**
 * Coleta console.error durante a execução e falha se encontrar erros inesperados.
 * Ignora erros conhecidos (React hydration, extensões de browser).
 */
export function createConsoleErrorCollector(page: Page): { getErrors: () => string[] } {
  const errors: string[] = []
  const IGNORED_PATTERNS = [
    'favicon.ico',
    'net::ERR_',
    'ResizeObserver',
    'Download the React DevTools',
    'vite-hmr',
    'schema-validator',
    'React will try to recreate',
    'The above error occurred',
    'Failed to load resource',
    '%o',
    '%s',
  ]

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      const isIgnored = IGNORED_PATTERNS.some((p) => text.includes(p))
      if (!isIgnored) {
        errors.push(text)
      }
    }
  })

  return { getErrors: () => [...errors] }
}

/**
 * Verifica que não houve console.error inesperados.
 */
export function expectNoConsoleErrors(collector: { getErrors: () => string[] }): void {
  const errors = collector.getErrors()
  if (errors.length > 0) {
    throw new Error(`Console errors encontrados:\n${errors.join('\n')}`)
  }
}

// ---------------------------------------------------------------------------
// Fixture estendida
// ---------------------------------------------------------------------------

export const test = base.extend<{
  /** Página autenticada como admin com mocks de API completos */
  adminPage: Page
  /** Página autenticada como usuário regular */
  userPage: Page
}>({
  adminPage: async ({ page }, use) => {
    await loginAsAdmin(page)
    await use(page)
  },
  userPage: async ({ page }, use) => {
    await loginAsUser(page)
    await use(page)
  },
})

export { expect, MOCK_ADMIN_USER, MOCK_REGULAR_USER, MOCK_TOKEN }
