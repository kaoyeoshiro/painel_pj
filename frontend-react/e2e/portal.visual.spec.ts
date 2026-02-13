import { test, expect, type Frame, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const LEGACY_BASE_URL = process.env.E2E_LEGACY_BASE_URL || 'http://127.0.0.1:8000'
const MAX_DIFF_PIXEL_RATIO = Number(process.env.E2E_MAX_DIFF_RATIO || '0.18')

interface PortalVisualRoute {
  id: string
  label: string
  legacyPath: string
  reactPath: string
}

const PORTAL_ROUTES: PortalVisualRoute[] = [
  { id: 'assistencia', label: 'Assistencia Judiciaria', legacyPath: '/assistencia', reactPath: '/assistencia' },
  { id: 'matriculas', label: 'Matriculas Confrontantes', legacyPath: '/matriculas', reactPath: '/matriculas' },
  { id: 'gerador-pecas', label: 'Gerador de Pecas', legacyPath: '/gerador-pecas', reactPath: '/gerador-pecas' },
  { id: 'pedido-calculo', label: 'Pedido de Calculo', legacyPath: '/pedido-calculo', reactPath: '/pedido-calculo' },
  { id: 'prestacao-contas', label: 'Prestacao de Contas', legacyPath: '/prestacao-contas', reactPath: '/prestacao-contas' },
  { id: 'relatorio-cumprimento', label: 'Relatorio de Cumprimento', legacyPath: '/relatorio-cumprimento', reactPath: '/relatorio-cumprimento' },
  { id: 'classificador', label: 'Classificador de Documentos', legacyPath: '/classificador', reactPath: '/classificador' },
  { id: 'bert-training', label: 'BERT Training', legacyPath: '/bert-training', reactPath: '/bert-training' },
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

async function setupVisualPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'visual-parity-token')
    localStorage.setItem('auth_token', 'visual-parity-token')
    sessionStorage.setItem('auth_token', 'visual-parity-token')
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

async function waitForReactVisualReady(page: Page): Promise<void> {
  const iframe = page.locator('iframe[title="Tela administrativa legada"]')
  const iframeCount = await iframe.count()

  if (iframeCount === 0) {
    // Modo canary de migração: rota pode estar em componente React nativo.
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 })
    await page.waitForTimeout(1200)
    return
  }

  await expect(iframe.first()).toBeVisible({ timeout: 10_000 })

  const handle = await iframe.first().elementHandle()
  const frame = await handle?.contentFrame()
  if (frame) {
    try {
      await frame.waitForLoadState('domcontentloaded', { timeout: 10_000 })
    } catch {
      // Alguns templates fazem redirects internos.
    }
    try {
      await frame.waitForLoadState('networkidle', { timeout: 5_000 })
    } catch {
      // Alguns scripts mantem polling.
    }
  }

  await page.waitForTimeout(1200)
}

async function resetScrollToOrigin(context: Page | Frame): Promise<void> {
  try {
    await context.evaluate(() => {
      window.scrollTo(0, 0)
      const scrollingElement = document.scrollingElement as HTMLElement | null
      if (scrollingElement) {
        scrollingElement.scrollTop = 0
        scrollingElement.scrollLeft = 0
      }
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
        document.body.scrollLeft = 0
      }

      // Alguns templates legados usam wrappers com overflow próprio.
      // Força reset de posição em qualquer container scrollável para evitar drift
      // horizontal entre baseline e captura atual.
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        if (element.scrollTop !== 0) element.scrollTop = 0
        if (element.scrollLeft !== 0) element.scrollLeft = 0
      }
    })
  } catch {
    // Algumas páginas legadas podem redirecionar no momento da avaliação.
  }
}

async function waitForLegacyFontAwesomeReady(context: Page | Frame): Promise<void> {
  try {
    await context.waitForFunction(
      () => {
        const icon = document.querySelector('i.fas, i.fa-solid, i.far, i.fa-regular')
        if (!icon) return true

        const before = window.getComputedStyle(icon, '::before').content
        const family = window.getComputedStyle(icon).fontFamily.toLowerCase()
        const hasGlyph = !!before && before !== 'none' && before !== 'normal' && before !== '""'
        return hasGlyph && family.includes('awesome')
      },
      {},
      { timeout: 8_000 }
    )
  } catch {
    // Se a página não depender de Font Awesome, segue normalmente.
  }

  try {
    await context.evaluate(async () => {
      if (!('fonts' in document) || !document.fonts?.ready) return
      await document.fonts.ready
    })
  } catch {
    // Alguns frames podem redirecionar durante o carregamento.
  }
}

async function dismissBertTrainingWelcome(context: Page | Frame): Promise<void> {
  const closeButton = context
    .getByRole('button', { name: /comecar|comecar|começar/i })
    .first()

  const visible = await closeButton.isVisible({ timeout: 1500 }).catch(() => false)
  if (!visible) return

  await closeButton.click()
  await context.waitForTimeout(300)
}

async function getReactLegacyFrame(page: Page): Promise<Frame | null> {
  const iframe = page.locator('iframe[title="Tela administrativa legada"]')
  const hasIframe = (await iframe.count()) > 0
  if (!hasIframe) return null

  const handle = await iframe.first().elementHandle()
  if (!handle) return null
  return handle.contentFrame()
}

async function writeLegacyBaselineIfNeeded(page: Page, snapshotPath: string): Promise<void> {
  const shouldWrite = process.env.SKIP_LEGACY_BASELINE_WRITE !== '1'
  if (!shouldWrite) return

  await mkdir(dirname(snapshotPath), { recursive: true })
  const image = await page.screenshot({ fullPage: false, animations: 'disabled', scale: 'css' })
  await writeFile(snapshotPath, image)
}

test.describe('Portal Visual Parity - Sistemas', () => {
  for (const route of PORTAL_ROUTES) {
    test(`${route.id} - ${route.label}`, async ({ browser }, testInfo) => {
      const legacyContext = await browser.newContext()
      const legacyPage = await legacyContext.newPage()
      await setupVisualPage(legacyPage)

      if (testInfo.project.name === 'mobile') {
        await legacyPage.goto(`${LEGACY_BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
        await legacyPage.waitForTimeout(250)
      }

      await legacyPage.goto(`${LEGACY_BASE_URL}${route.legacyPath}`, { waitUntil: 'domcontentloaded' })
      await legacyPage.waitForTimeout(1200)
      if (route.id === 'bert-training') {
        await dismissBertTrainingWelcome(legacyPage)
      }
      await waitForLegacyFontAwesomeReady(legacyPage)
      await resetScrollToOrigin(legacyPage)

      const snapshotName = `portal-${route.id}.png`
      const snapshotPath = testInfo.snapshotPath(snapshotName)
      await writeLegacyBaselineIfNeeded(legacyPage, snapshotPath)
      await legacyContext.close()

      const reactContext = await browser.newContext()
      const reactPage = await reactContext.newPage()
      await setupVisualPage(reactPage)

      if (testInfo.project.name === 'mobile') {
        await reactPage.goto('/dashboard', { waitUntil: 'domcontentloaded' })
        await reactPage.waitForTimeout(250)
      }

      await reactPage.goto(route.reactPath, { waitUntil: 'domcontentloaded' })
      await waitForReactVisualReady(reactPage)
      if (route.id === 'bert-training') {
        const frame = await getReactLegacyFrame(reactPage)
        if (frame) {
          await dismissBertTrainingWelcome(frame)
          await waitForLegacyFontAwesomeReady(frame)
          await resetScrollToOrigin(frame)
        }
      } else {
        const frame = await getReactLegacyFrame(reactPage)
        if (frame) {
          await waitForLegacyFontAwesomeReady(frame)
        }
      }
      await resetScrollToOrigin(reactPage)

      await expect(reactPage).toHaveScreenshot(snapshotName, {
        fullPage: false,
        animations: 'disabled',
        scale: 'css',
        maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
      })

      await reactContext.close()
    })
  }
})
