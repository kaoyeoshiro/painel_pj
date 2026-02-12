/**
 * Fixture de autenticacao e mocks para suite admin-destructive.
 *
 * Reutiliza a mesma estrategia das fixtures existentes:
 * - Token JWT fake no localStorage
 * - Mock de /auth/me retornando usuario admin
 * - Catch-all para APIs (GET retorna [], POST retorna { success: true })
 *
 * Diferencial: suporta mocks granulares por rota para testar
 * acoes destrutivas com dados realisticos.
 */

import { test as base, type Page, type Route, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const MOCK_ADMIN_USER = {
  id: 1,
  username: 'admin_teste',
  full_name: 'Admin Teste',
  role: 'admin',
  email: null,
  must_change_password: false,
  sistemas_permitidos: null,
  permissoes_especiais: null,
  setor: null,
  default_group_id: null,
  allowed_group_ids: null,
}

export const MOCK_TOKEN = 'fake-jwt-token-for-e2e-destructive'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

async function setupBaseApiMocks(page: Page): Promise<void> {
  await page.route('**/auth/me', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_USER) })
  )

  await page.route('**/api/**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })

  await page.route('**/admin/api/**', (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

async function setupAuth(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate((token: string) => {
    localStorage.setItem('access_token', token)
  }, MOCK_TOKEN)
}

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface DestructiveTestContext {
  page: Page
  consoleErrors: Array<{ type: string; text: string }>
  /** Log de acoes executadas durante o teste */
  actionLog: Array<{ rota: string; acao: string; alvo: string; hora: string; resultado: string }>
  /** Registra uma acao no log */
  logAction: (rota: string, acao: string, alvo: string, resultado: string) => void
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const test = base.extend<{ ctx: DestructiveTestContext }>({
  ctx: async ({ page }, use) => {
    const consoleErrors: Array<{ type: string; text: string }> = []
    const actionLog: Array<{ rota: string; acao: string; alvo: string; hora: string; resultado: string }> = []

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ type: msg.type(), text: msg.text() })
      }
    })

    await setupBaseApiMocks(page)
    await setupAuth(page)

    const logAction = (rota: string, acao: string, alvo: string, resultado: string) => {
      actionLog.push({ rota, acao, alvo, hora: new Date().toISOString(), resultado })
    }

    await use({ page, consoleErrors, actionLog, logAction })
  },
})

export { expect }

// ---------------------------------------------------------------------------
// Helpers reutilizaveis
// ---------------------------------------------------------------------------

/** Fulfills rota com array vazio */
export function emptyArray(route: Route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
}

/** Fulfills rota com { success: true } */
export function successResponse(route: Route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
}

/** Fulfills rota com objeto customizado */
export function jsonResponse(data: unknown) {
  return (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
}
