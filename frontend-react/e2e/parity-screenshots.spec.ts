/**
 * Playwright spec that captures screenshots of each system page
 * for visual parity comparison against reference prints in `prints/`.
 *
 * Screenshots are saved to `e2e-artifacts/screenshots/` and can be
 * compared side-by-side with the reference prints.
 *
 * Run: npx playwright test e2e/parity-screenshots.spec.ts
 */

import { test, expect } from './fixtures/auth'

const SCREENSHOT_DIR = 'e2e-artifacts/screenshots'

/** Routes to capture, mapped from reference prints */
const ROUTES = [
  { name: 'assistencia', path: '/assistencia', waitFor: 'Assistência Judiciária' },
  { name: 'calculo', path: '/pedido-calculo', waitFor: 'Pedido de Cálculo Judicial' },
  { name: 'prestacao', path: '/prestacao-contas', waitFor: 'Análise de Prestação de Contas' },
  { name: 'relatorio', path: '/relatorio-cumprimento', waitFor: 'Relatorio de Cumprimento' },
  { name: 'bert', path: '/bert-training', waitFor: 'Treinamento de IA' },
  { name: 'editor_gerador', path: '/gerador-pecas', waitFor: 'Gerador' },
]

test.describe('Visual Parity Screenshots', () => {
  for (const route of ROUTES) {
    test(`capture ${route.name} (${route.path})`, async ({ authenticatedPage: page }) => {
      // Set viewport to match reference prints (desktop)
      await page.setViewportSize({ width: 1280, height: 900 })

      // Navigate to the page
      await page.goto(route.path)

      // Wait for the page to render its title/key element
      await page.waitForSelector(`text=${route.waitFor}`, { timeout: 10_000 })

      // Small delay for CSS transitions/animations to settle
      await page.waitForTimeout(500)

      // Capture full-page screenshot
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${route.name}.png`,
        fullPage: true,
      })

      // Basic structural assertion: the page rendered without errors
      const errorOverlay = page.locator('.vite-error-overlay, [data-error-boundary]')
      await expect(errorOverlay).toHaveCount(0)
    })
  }
})

test.describe('Visual Parity — SystemTopbar structure', () => {
  const TOPBAR_ROUTES = [
    { name: 'assistencia', path: '/assistencia', title: 'Assistência Judiciária' },
    { name: 'calculo', path: '/pedido-calculo', title: 'Pedido de Cálculo Judicial' },
    { name: 'prestacao', path: '/prestacao-contas', title: 'Análise de Prestação de Contas' },
    { name: 'relatorio', path: '/relatorio-cumprimento', title: 'Relatorio de Cumprimento' },
    { name: 'bert', path: '/bert-training', title: 'Treinamento de IA' },
  ]

  for (const route of TOPBAR_ROUTES) {
    test(`${route.name} — topbar has PGE logo, title, back arrow, logout`, async ({ authenticatedPage: page }) => {
      await page.goto(route.path)
      await page.waitForSelector(`text=${route.title}`, { timeout: 10_000 })

      // SystemTopbar structure assertions
      const header = page.locator('header')
      await expect(header).toBeVisible()

      // PGE logo
      const logo = header.locator('img[alt="PGE-MS"]')
      await expect(logo).toBeVisible()

      // Back arrow link
      const backLink = header.locator('a[aria-label="Voltar"]')
      await expect(backLink).toBeVisible()

      // Logout button
      const logoutBtn = header.locator('button[aria-label="Sair"]')
      await expect(logoutBtn).toBeVisible()

      // Title text
      await expect(header.locator(`text=${route.title}`)).toBeVisible()
    })
  }
})

test.describe('Visual Parity — CTA buttons', () => {
  test('calculo — sky-to-teal gradient CTA', async ({ authenticatedPage: page }) => {
    await page.goto('/pedido-calculo')
    await page.waitForSelector('text=Pedido de Cálculo Judicial', { timeout: 10_000 })

    const cta = page.locator('button:has-text("Gerar Pedido")')
    await expect(cta).toBeVisible()

    // Check gradient classes
    const classes = await cta.getAttribute('class')
    expect(classes).toContain('from-sky-500')
    expect(classes).toContain('to-teal-500')
  })

  test('relatorio — emerald-to-green gradient CTA', async ({ authenticatedPage: page }) => {
    await page.goto('/relatorio-cumprimento')
    await page.waitForSelector('text=Relatorio de Cumprimento', { timeout: 10_000 })

    const cta = page.locator('button:has-text("Gerar Relatorio")')
    await expect(cta).toBeVisible()

    const classes = await cta.getAttribute('class')
    expect(classes).toContain('from-emerald-500')
    expect(classes).toContain('to-green-600')
  })

  test('bert — emerald-to-green gradient CTA', async ({ authenticatedPage: page }) => {
    await page.goto('/bert-training')
    await page.waitForSelector('text=Treinamento de IA', { timeout: 10_000 })

    const cta = page.locator('button:has-text("Iniciar Treinamento")')
    await expect(cta).toBeVisible()

    const classes = await cta.getAttribute('class')
    expect(classes).toContain('from-emerald-500')
    expect(classes).toContain('to-green-600')
  })
})
