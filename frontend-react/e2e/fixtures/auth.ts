/**
 * Fixture de autenticação para testes Playwright.
 *
 * Configura token no localStorage, intercepta /auth/me e APIs comuns
 * para que as páginas renderizem sem backend real.
 */

import { test as base, type Page, type Route } from '@playwright/test'

/** Dados do usuário admin mockado */
const MOCK_ADMIN_USER = {
  id: 1,
  username: 'admin_teste',
  full_name: 'Admin Teste',
  role: 'admin',
}

/** Token fictício usado nos testes */
const MOCK_TOKEN = 'fake-jwt-token-for-e2e-testing'

/**
 * Configura interceptação de rotas da API.
 * Retorna JSON vazio ou arrays vazios para todas as chamadas de API,
 * permitindo que a página renderize sem backend.
 */
async function setupApiMocks(page: Page): Promise<void> {
  // Intercepta /auth/me - retorna usuário admin
  await page.route('**/auth/me', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_USER) })
  )

  // Intercepta qualquer GET na API que retorne listas - retorna array vazio
  await page.route('**/api/**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }
    // POST/PUT/DELETE - retorna sucesso genérico
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  // Intercepta chamadas ao admin api
  await page.route('**/admin/api/**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })
}

/**
 * Configura o localStorage com token de autenticação.
 */
async function setupAuth(page: Page): Promise<void> {
  // Precisa navegar primeiro para poder acessar localStorage do domínio
  await page.goto('/')
  await page.evaluate((token: string) => {
    localStorage.setItem('access_token', token)
  }, MOCK_TOKEN)
}

/** Fixture estendido com autenticação e mocks de API já configurados */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await setupApiMocks(page)
    await setupAuth(page)
    await use(page)
  },
})

export { MOCK_ADMIN_USER, MOCK_TOKEN }
export { expect } from '@playwright/test'
