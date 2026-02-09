import { test, expect, type Frame, type Page } from '@playwright/test'

interface PortalSmokeRoute {
  id: string
  label: string
  reactPath: string
  expectedUrlContains: string
}

const PORTAL_ROUTES: PortalSmokeRoute[] = [
  { id: 'assistencia', label: 'Assistencia Judiciaria', reactPath: '/assistencia', expectedUrlContains: '/assistencia' },
  { id: 'matriculas', label: 'Matriculas Confrontantes', reactPath: '/matriculas', expectedUrlContains: '/matriculas' },
  { id: 'gerador-pecas', label: 'Gerador de Pecas', reactPath: '/gerador-pecas', expectedUrlContains: '/gerador-pecas' },
  { id: 'pedido-calculo', label: 'Pedido de Calculo', reactPath: '/pedido-calculo', expectedUrlContains: '/pedido-calculo' },
  { id: 'prestacao-contas', label: 'Prestacao de Contas', reactPath: '/prestacao-contas', expectedUrlContains: '/prestacao-contas' },
  { id: 'relatorio-cumprimento', label: 'Relatorio de Cumprimento', reactPath: '/relatorio-cumprimento', expectedUrlContains: '/relatorio-cumprimento' },
  { id: 'classificador', label: 'Classificador de Documentos', reactPath: '/classificador', expectedUrlContains: '/classificador' },
  { id: 'bert-training', label: 'BERT Training', reactPath: '/bert-training', expectedUrlContains: '/bert-training' },
]

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function getMockJson(pathname: string): JsonValue {
  if (pathname === '/auth/me') {
    return { id: 1, username: 'admin', full_name: 'Admin', role: 'admin', is_admin: true }
  }

  if (pathname === '/auth/verify') {
    return { valid: true }
  }

  if (pathname.startsWith('/users/content-groups')) return []
  if (pathname.startsWith('/users')) return []

  if (pathname.includes('/api/')) return []

  return []
}

async function setupSmokePage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'smoke-parity-token')
    localStorage.setItem('auth_token', 'smoke-parity-token')
    sessionStorage.setItem('auth_token', 'smoke-parity-token')
  })

  await page.route('**/*', async (route) => {
    const req = route.request()
    const type = req.resourceType()
    if (type === 'document' || type === 'stylesheet' || type === 'image' || type === 'font') {
      return route.continue()
    }

    const url = new URL(req.url())
    const pathname = url.pathname
    const isApiRequest =
      pathname.startsWith('/auth') ||
      pathname.startsWith('/users') ||
      pathname.includes('/api/')

    if (!isApiRequest) return route.continue()

    const payload = req.method() === 'GET' ? getMockJson(pathname) : { success: true }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}

async function getLegacyFrameIfAny(page: Page): Promise<Frame | null> {
  const iframe = page.locator('iframe[title="Tela administrativa legada"]')
  const count = await iframe.count()
  if (count === 0) return null

  await expect(iframe.first()).toBeVisible({ timeout: 10_000 })
  const handle = await iframe.first().elementHandle()
  const frame = await handle?.contentFrame()
  if (!frame) {
    return null
  }

  try {
    await frame.waitForLoadState('domcontentloaded', { timeout: 10_000 })
  } catch {
    // Alguns templates fazem redirects internos.
  }

  await page.waitForTimeout(800)
  return frame
}

async function assertRouteLoaded(page: Page, frame: Frame | null, expectedUrlContains: string): Promise<void> {
  if (frame) {
    const frameUrl = frame.url()
    expect(frameUrl).toContain(expectedUrlContains)
  } else {
    expect(page.url()).toContain(expectedUrlContains)
  }
}

async function assertContextNotBlank(context: Page | Frame): Promise<void> {
  const body = context.locator('body')
  await expect(body).toBeVisible()
  const text = (await body.innerText()).trim()
  expect(text.length).toBeGreaterThan(25)
}

async function runBasicInteraction(context: Page | Frame): Promise<void> {
  const interactive = context.locator(
    'button:not([disabled]), [role="tab"], select:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"])'
  )

  const count = await interactive.count()
  expect(count).toBeGreaterThan(0)

  const first = interactive.first()
  await first.scrollIntoViewIfNeeded()
  await first.focus()
}

test.describe('Portal Smoke - Sistemas iframe legado no React', () => {
  for (const route of PORTAL_ROUTES) {
    test(`${route.id} - abre e permite interacao basica`, async ({ page }) => {
      await setupSmokePage(page)

      await page.goto(route.reactPath, { waitUntil: 'domcontentloaded' })
      const frame = await getLegacyFrameIfAny(page)

      await assertRouteLoaded(page, frame, route.expectedUrlContains)
      await assertContextNotBlank(frame ?? page)
      await runBasicInteraction(frame ?? page)
    })
  }
})
