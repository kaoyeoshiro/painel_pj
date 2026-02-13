/**
 * Fixture de autenticacao e mocks para suite admin-supplemental.
 *
 * Reutiliza a mesma estrategia da fixture original (e2e/fixtures/auth.ts)
 * sem modifica-la. Estende com:
 * - mocks de API mais granulares por rota
 * - helpers de screenshot padronizados
 * - coleta de erros de console
 */

import { test as base, type Page, type Route, expect } from '@playwright/test'
import { type AdminRoute, sanitizePath } from './routes-config'

// ---------------------------------------------------------------------------
// Constantes (mesmas da fixture original para manter compatibilidade)
// ---------------------------------------------------------------------------

const MOCK_ADMIN_USER = {
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

const MOCK_TOKEN = 'fake-jwt-token-for-e2e-testing'

// ---------------------------------------------------------------------------
// Setup de mocks base (auth + catch-all API)
// ---------------------------------------------------------------------------

async function setupBaseApiMocks(page: Page): Promise<void> {
  // Auth
  await page.route('**/auth/me', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_USER) })
  )

  // Catch-all para /api/** e /admin/api/** (fallback)
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
// Tipos e helpers
// ---------------------------------------------------------------------------

export interface ConsoleEntry {
  type: string
  text: string
}

export interface AdminTestContext {
  /** Pagina autenticada com mocks base */
  page: Page
  /** Erros de console capturados */
  consoleErrors: ConsoleEntry[]
  /** Navega para uma rota admin com mocks especificos */
  navigateToAdminRoute: (route: AdminRoute) => Promise<void>
  /** Tira screenshot padronizado */
  takeScreenshot: (route: AdminRoute, suffix: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const test = base.extend<{ adminCtx: AdminTestContext }>({
  adminCtx: async ({ page }, use) => {
    const consoleErrors: ConsoleEntry[] = []

    // Captura erros de console
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ type: msg.type(), text: msg.text() })
      }
    })

    // Setup base
    await setupBaseApiMocks(page)
    await setupAuth(page)

    const navigateToAdminRoute = async (route: AdminRoute) => {
      // Registra mocks especificos ANTES de navegar
      await route.apiMocks(page)
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')
    }

    const takeScreenshot = async (route: AdminRoute, suffix: string) => {
      const name = `${sanitizePath(route.path)}__${suffix}.png`
      await page.screenshot({
        path: `test-results/admin-supplemental-screenshots/${name}`,
        fullPage: true,
      })
    }

    await use({ page, consoleErrors, navigateToAdminRoute, takeScreenshot })
  },
})

export { expect }
