import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const LEGACY_BASE_URL = process.env.E2E_LEGACY_BASE_URL || 'http://127.0.0.1:8000'

interface AdminVisualRoute {
  id: string
  label: string
  legacyPath: string
  reactPath: string
}

const MAX_DIFF_PIXEL_RATIO = Number(process.env.E2E_MAX_DIFF_RATIO || '0.18')

const ADMIN_ROUTES: AdminVisualRoute[] = [
  { id: 'users', label: 'Usuarios', legacyPath: '/admin/users', reactPath: '/admin/users' },
  { id: 'prompts', label: 'Prompts IA', legacyPath: '/admin/prompts-config', reactPath: '/admin/prompts' },
  { id: 'prompts-modulos', label: 'Prompts Modulares', legacyPath: '/admin/prompts-modulos', reactPath: '/admin/prompts-modulos' },
  { id: 'feedbacks', label: 'Dashboard Feedbacks', legacyPath: '/admin/feedbacks', reactPath: '/admin/feedbacks' },
  { id: 'historico-gerador', label: 'Historico Geracoes', legacyPath: '/admin/gerador-pecas/historico', reactPath: '/admin/historico-gerador' },
  { id: 'historico-pedido-calculo', label: 'Debug Pedido Calculo', legacyPath: '/admin/pedido-calculo/debug', reactPath: '/admin/historico-pedido-calculo' },
  { id: 'historico-prestacao-contas', label: 'Debug Prestacao Contas', legacyPath: '/admin/prestacao-contas/debug', reactPath: '/admin/historico-prestacao-contas' },
  { id: 'categorias-json', label: 'Formatos JSON', legacyPath: '/admin/categorias-resumo-json', reactPath: '/admin/categorias-json' },
  { id: 'teste-categorias', label: 'Teste Categorias JSON', legacyPath: '/admin/categorias-resumo-json/teste', reactPath: '/admin/teste-categorias' },
  { id: 'teste-ativacao', label: 'Teste Ativacao', legacyPath: '/admin/prompts-modulos/teste', reactPath: '/admin/teste-ativacao' },
  { id: 'variaveis', label: 'Variaveis Extracao', legacyPath: '/admin/variaveis', reactPath: '/admin/variaveis' },
  { id: 'modulos-tipo-peca', label: 'Modulos por Tipo de Peca', legacyPath: '/admin/modulos-tipo-peca', reactPath: '/admin/modulos-tipo-peca' },
  { id: 'config-pecas', label: 'Config Tipos de Peca', legacyPath: '/api/gerador-pecas/config/admin', reactPath: '/admin/config-pecas' },
  { id: 'performance', label: 'Logs Performance', legacyPath: '/admin/performance', reactPath: '/admin/performance' },
  { id: 'tjms-docs', label: 'Integracao TJMS', legacyPath: '/admin/tjms-docs', reactPath: '/admin/tjms-docs' },
  { id: 'restaurar-slugs', label: 'Restaurar Slugs', legacyPath: '/admin/restaurar-slugs', reactPath: '/admin/restaurar-slugs' },
]

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function getMockJson(pathname: string): JsonValue {
  if (pathname === '/auth/me') {
    return { id: 1, username: 'admin', full_name: 'Admin', role: 'admin', is_admin: true }
  }
  if (pathname.startsWith('/users/content-groups')) return []
  if (pathname.startsWith('/users')) return []

  if (pathname.includes('/admin/api/feedbacks/dashboard')) {
    return {
      total_consultas: 0,
      total_feedbacks: 0,
      taxa_acerto: 0,
      consultas_sem_feedback: 0,
      avaliacoes: { correto: 0, parcial: 0, incorreto: 0, erro_ia: 0 },
      por_sistema: {},
      evolucao_por_sistema: {},
      feedbacks_por_usuario: [],
      pendentes_feedback: [],
      filtro_aplicado: { mes: null, ano: null, sistema: null },
    }
  }
  if (pathname.includes('/admin/modelos-ia')) {
    return {
      assistencia_judiciaria: { id: 1, modelo: 'gemini-2.0-flash', descricao: '' },
      matriculas: { id: 2, modelo: 'gemini-2.0-flash', descricao: '' },
      gerador_pecas: { id: 3, modelo: 'gemini-2.0-flash', descricao: '' },
      pedido_calculo: { id: 4, modelo: 'gemini-2.0-flash', descricao: '' },
    }
  }
  if (pathname.includes('/admin/api/feedbacks/lista')) {
    return { feedbacks: [], total: 0, page: 1, per_page: 20, total_pages: 0 }
  }
  if (pathname.includes('/admin/api/feedbacks/top-usuarios')) return []
  if (pathname.includes('/admin/api/feedbacks/modelos-em-uso')) return []
  if (pathname.includes('/admin/api/feedbacks/pendentes')) return []
  if (pathname.includes('/admin/api/feedbacks/')) {
    return {
      id: 1,
      sistema: 'gerador_pecas',
      numero_cnj: '0000000-00.0000.0.00.0000',
      conteudo_gerado: '',
      historico_chat: [],
      versoes: [],
    }
  }

  if (pathname.includes('/admin/api/performance/summary')) {
    return {
      bottleneck_summary: { llm: 0, db: 0, parse: 0, network: 0 },
      avg_times: { llm: 0, db: 0, parse: 0, total: 0 },
      recent_errors: [],
      top_slowest: [],
    }
  }
  if (pathname.includes('/admin/api/performance/logs')) return { logs: [] }
  if (pathname.includes('/admin/api/performance/route-mapping')) return { mappings: [] }
  if (pathname.includes('/admin/api/gemini-logs/summary')) {
    return {
      total_calls: 0,
      stats: {
        success_count: 0,
        error_count: 0,
        avg_latency_ms: 0,
        success_rate: 100,
        total_prompt_tokens: 0,
        total_response_tokens: 0,
      },
      by_sistema: [],
      by_model: [],
    }
  }
  if (pathname.includes('/admin/api/gemini-logs')) return { logs: [] }

  if (pathname.includes('/admin/api/extraction/variaveis/resumo')) {
    return { total: 0, variaveis_com_uso: 0, variaveis_sem_uso: 0, distribuicao_tipos: {} }
  }
  if (pathname.includes('/admin/api/extraction/variaveis')) return []
  if (pathname.includes('/admin/api/categorias-resumo-json/teste-categorias')) return []
  if (pathname.includes('/admin/api/categorias-resumo-json')) return []
  if (pathname.includes('/admin/api/prompts-modulos/grupos')) return []
  if (pathname.includes('/admin/api/prompts-modulos')) return []
  if (pathname.includes('/admin/api/prompts') && !pathname.includes('/admin/api/prompts-modulos')) return { prompts: [], total: 0 }
  if (pathname.includes('/admin/config-ia')) return []

  if (pathname.includes('/api/gerador-pecas/config/categorias')) return []
  if (pathname.includes('/api/gerador-pecas/config/tipos-peca')) return []
  if (pathname.includes('/api/gerador-pecas/config/admin')) return { configuracoes: [], tipos_peca: [] }
  if (pathname.includes('/admin/api/config-pecas')) return { configuracoes: [], tipos_peca: [] }

  if (pathname.includes('/gerador-pecas-admin/')) return []
  if (pathname.includes('/pedido-calculo-admin/')) return []
  if (pathname.includes('/admin/api/prestacao-admin/')) return []

  if (pathname.includes('/teste-ativacao/')) return []

  return []
}

async function setupVisualPage(page: Page): Promise<void> {
  if (process.env.E2E_DEBUG_VISUAL === '1') {
    page.on('console', (msg) => {
      // eslint-disable-next-line no-console
      console.log(`[visual-debug][console] ${msg.type()} ${msg.text()}`)
    })
    page.on('pageerror', (err) => {
      // eslint-disable-next-line no-console
      console.log(`[visual-debug][pageerror] ${err.message}`)
    })
    page.on('requestfailed', (request) => {
      // eslint-disable-next-line no-console
      console.log(`[visual-debug][requestfailed] ${request.url()} ${request.failure()?.errorText || ''}`)
    })
  }

  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'visual-parity-token')
    localStorage.setItem('auth_token', 'visual-parity-token')
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
      pathname.startsWith('/admin') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/gerador-pecas-admin') ||
      pathname.startsWith('/pedido-calculo-admin') ||
      pathname.startsWith('/teste-ativacao')

    if (!isApiRequest) return route.continue()

    const payload = req.method() === 'GET' ? getMockJson(pathname) : { success: true }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })

  // Mantemos o comportamento de rede igual entre baseline legado e React.
}

async function waitForReactVisualReady(page: Page): Promise<void> {
  const iframe = page.locator('iframe[title="Tela administrativa legada"]')
  const hasIframe = (await iframe.count()) > 0

  if (!hasIframe) {
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
      // Alguns templates legados fazem redirects internos; seguimos com timeout de estabilização.
    }
    try {
      await frame.waitForLoadState('networkidle', { timeout: 5_000 })
    } catch {
      // Ignore: alguns scripts legados mantêm atividade de rede intermitente.
    }
  }

  await page.waitForTimeout(1200)
}

async function writeLegacyBaselineIfNeeded(page: Page, snapshotPath: string): Promise<void> {
  const shouldWrite = process.env.SKIP_LEGACY_BASELINE_WRITE !== '1'

  if (!shouldWrite) return

  await mkdir(dirname(snapshotPath), { recursive: true })
  const image = await page.screenshot({ fullPage: false, animations: 'disabled', scale: 'css' })
  await writeFile(snapshotPath, image)
}

test.describe('Admin Visual Parity', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route.id} - ${route.label}`, async ({ browser }, testInfo) => {
      const legacyContext = await browser.newContext()
      const legacyPage = await legacyContext.newPage()
      await setupVisualPage(legacyPage)

      // Alinha estado inicial mobile (header superior presente no legado após primeiro acesso).
      if (testInfo.project.name === 'mobile') {
        await legacyPage.goto(`${LEGACY_BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
        await legacyPage.waitForTimeout(250)
      }

      await legacyPage.goto(`${LEGACY_BASE_URL}${route.legacyPath}`, { waitUntil: 'domcontentloaded' })
      await legacyPage.waitForTimeout(1200)

      const snapshotName = `admin-${route.id}.png`
      const snapshotPath = testInfo.snapshotPath(snapshotName)
      await writeLegacyBaselineIfNeeded(legacyPage, snapshotPath)
      await legacyContext.close()

      const reactContext = await browser.newContext()
      const reactPage = await reactContext.newPage()
      await setupVisualPage(reactPage)

      // No emulador mobile, abrimos o mesmo dashboard legado antes da rota alvo
      // para equalizar cabeçalho/estado global de scripts entre baseline e React.
      if (testInfo.project.name === 'mobile') {
        await reactPage.goto('/dashboard', { waitUntil: 'domcontentloaded' })
        await reactPage.waitForTimeout(250)
      }

      await reactPage.goto(route.reactPath, { waitUntil: 'domcontentloaded' })
      await waitForReactVisualReady(reactPage)

      // Debug auxiliar para rotas com frame em branco/intermitente durante comparação visual.
      if (process.env.E2E_DEBUG_VISUAL === '1') {
        const iframeCount = await reactPage.locator('iframe[title="Tela administrativa legada"]').count()
        const hasPortalHeader = (await reactPage.locator('button[aria-label="Abrir menu"]').count()) > 0
        const bodyText = await reactPage.locator('body').innerText().catch(() => '')
        const title = await reactPage.title().catch(() => '')
        const currentUrl = reactPage.url()
        // eslint-disable-next-line no-console
        console.log(`[visual-debug] ${route.id} url=${currentUrl} title=${title} iframeCount=${iframeCount} hasPortalHeader=${hasPortalHeader} bodyLen=${bodyText.length}`)
      }

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
