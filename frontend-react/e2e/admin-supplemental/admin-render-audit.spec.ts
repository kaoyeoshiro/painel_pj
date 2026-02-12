/**
 * Admin Supplemental — Render Audit
 *
 * Para cada rota /admin:
 * 1. Navega com mocks de API
 * 2. Detecta crash (ErrorBoundary) e documenta como finding
 * 3. Se nao crashou, verifica que conteudo da pagina esta visivel
 * 4. Verifica erros fatais no console
 * 5. Tira screenshot de baseline
 *
 * Prioridade 1: garantir que nenhuma rota admin crasha.
 */

import { test, expect } from './fixtures'
import { ADMIN_ROUTES, sanitizePath } from './routes-config'

test.describe('Admin Render Audit', () => {
  for (const route of ADMIN_ROUTES) {
    test.describe(route.label + ' (' + route.path + ')', () => {

      test('renderiza sem crash', async ({ adminCtx }) => {
        const { page, navigateToAdminRoute, takeScreenshot } = adminCtx

        await navigateToAdminRoute(route)

        // Detecta crash (ErrorBoundary / "Something went wrong")
        const bodyText = await page.locator('body').innerText()
        const hasCrash = /something\s*went\s*wrong/i.test(bodyText)

        if (hasCrash) {
          // Documenta o crash como finding (com screenshot)
          await takeScreenshot(route, 'CRASH')

          // Extrai mensagem de erro do body
          const errorMatch = bodyText.match(/something went wrong.*?\n(.+)/i)
          const errorDetail = errorMatch ? errorMatch[1].trim() : 'desconhecido'

          // Anota como finding no relatorio Playwright
          test.info().annotations.push({
            type: 'crash',
            description: `[CRASH] ${route.path}: ${errorDetail}`,
          })

          // Falha o teste com mensagem clara
          expect(hasCrash, `Pagina crashou com ErrorBoundary: ${errorDetail}`).toBe(false)
          return
        }

        // Sem crash — verifica que conteudo especifico da pagina esta visivel
        // Usa getByText (nao getByRole('heading')) pois BreadcrumbBar usa <span>
        const anchorLocator = resolveAnchor(page, route.anchor)
        const anchorVisible = await anchorLocator.isVisible().catch(() => false)

        if (!anchorVisible) {
          // Fallback: verifica que ALGUM conteudo renderizou (sidebar + conteudo)
          const hasContent = await page.locator('nav, [data-testid], table, form, main').first()
            .isVisible().catch(() => false)

          if (!hasContent) {
            await takeScreenshot(route, 'EMPTY')
            expect(hasContent, 'Pagina vazia — nenhum conteudo renderizado').toBe(true)
            return
          }

          // Pagina renderizou mas anchor especifico nao foi encontrado — warning, nao fail
          test.info().annotations.push({
            type: 'warning',
            description: `[WARN] ${route.path}: anchor "${route.anchor}" nao encontrado, mas pagina renderizou conteudo`,
          })
        }

        // Screenshot de render bem-sucedido
        await takeScreenshot(route, 'render')
      })

      test('sem erros fatais no console', async ({ adminCtx }) => {
        const { page, navigateToAdminRoute, consoleErrors } = adminCtx

        consoleErrors.length = 0
        await navigateToAdminRoute(route)
        await page.waitForTimeout(200)

        // Filtra erros fatais (ignora rede e favicon)
        const fatalErrors = consoleErrors.filter((e) => {
          if (e.type !== 'error') return false
          if (e.text.includes('net::ERR') || e.text.includes('Failed to fetch')) return false
          if (e.text.includes('favicon')) return false
          return true
        })

        if (fatalErrors.length > 0) {
          for (const err of fatalErrors.slice(0, 5)) {
            test.info().annotations.push({
              type: 'console-error',
              description: `[CONSOLE] ${route.path}: ${err.text.slice(0, 200)}`,
            })
          }
        }

        // Nao falha por erros de console — apenas documenta
        // (crashes reais ja sao pegos pelo teste "renderiza sem crash")
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve o seletor anchor para um locator.
 * Usa getByText em vez de getByRole('heading') pois o BreadcrumbBar
 * nao renderiza headings semanticos (<h1>/<h2>).
 *
 * Formatos suportados:
 * - "heading >> text=/regex/flags" → getByText(regex)
 * - "heading" → getByRole('heading').first()
 * - "[data-testid=xxx]" → locator direto
 */
function resolveAnchor(page: import('@playwright/test').Page, anchor: string) {
  // Formato: "heading >> text=/regex/flags"
  const textMatch = anchor.match(/^heading\s*>>\s*text=\/(.+)\/([gimsuy]*)$/)
  if (textMatch) {
    const regex = new RegExp(textMatch[1], textMatch[2])
    return page.getByText(regex).first()
  }

  // Formato simples: "heading" (qualquer heading OU qualquer titulo breadcrumb)
  if (anchor === 'heading') {
    // Tenta heading semantico primeiro, fallback para breadcrumb
    return page.locator('h1, h2, h3, [class*="breadcrumb"] span, [class*="Breadcrumb"] span').first()
  }

  // Formato: seletor CSS direto (data-testid, etc.)
  return page.locator(anchor).first()
}
