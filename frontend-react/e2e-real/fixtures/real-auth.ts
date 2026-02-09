/**
 * Fixture de autenticação real para testes E2E.
 *
 * Obtém token via API e injeta no localStorage — evita problemas
 * de concorrência e rate limiting ao fazer login via formulário.
 * Captura console logs do browser automaticamente.
 */
import { test as base, type Page, type ConsoleMessage } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Credenciais de teste (não são secrets — ambiente local de dev)
const TEST_USERNAME = 'admin'
const TEST_PASSWORD = 'Km0301052271*'
const BACKEND_URL = 'http://localhost:8000'

interface ConsoleLogs {
  errors: string[]
  warnings: string[]
  all: string[]
}

interface RealTestFixtures {
  /** Página autenticada com token real */
  authedPage: Page
  /** Logs do console do browser */
  consoleLogs: ConsoleLogs
  /** Salva screenshot com nome descritivo */
  takeScreenshot: (name: string) => Promise<void>
  /** Diretório de artefatos deste teste */
  artifactDir: string
}

/** Obtém token via API REST diretamente */
async function getAuthToken(): Promise<string> {
  const resp = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(TEST_USERNAME)}&password=${encodeURIComponent(TEST_PASSWORD)}`,
  })
  if (!resp.ok) {
    throw new Error(`Login falhou: ${resp.status} ${await resp.text()}`)
  }
  const data = await resp.json()
  return data.access_token
}

export const test = base.extend<RealTestFixtures>({
  artifactDir: async ({ }, use, testInfo) => {
    const sanitizedName = testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    const runDir = path.join(
      process.cwd(),
      'e2e-artifacts',
      'runs',
      new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      sanitizedName,
    )
    fs.mkdirSync(runDir, { recursive: true })
    await use(runDir)
  },

  consoleLogs: async ({ }, use) => {
    const logs: ConsoleLogs = { errors: [], warnings: [], all: [] }
    await use(logs)
  },

  authedPage: async ({ page, consoleLogs }, use) => {
    // Captura console logs
    page.on('console', (msg: ConsoleMessage) => {
      const text = `[${msg.type()}] ${msg.text()}`
      consoleLogs.all.push(text)
      if (msg.type() === 'error') consoleLogs.errors.push(text)
      if (msg.type() === 'warning') consoleLogs.warnings.push(text)
    })

    // Obtém token via API (não via formulário — evita race condition)
    const token = await getAuthToken()

    // Navega para /login para ter acesso ao localStorage do domínio
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    // Injeta token no localStorage
    await page.evaluate((t: string) => {
      localStorage.setItem('access_token', t)
    }, token)

    // Navega diretamente para o dashboard
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Espera a página carregar (pode estar no dashboard ou redirecionar para login se token inválido)
    const currentUrl = page.url()
    if (currentUrl.includes('/login')) {
      // Fallback: login via formulário
      await page.getByRole('textbox', { name: 'Usuário' }).fill(TEST_USERNAME)
      await page.getByRole('textbox', { name: 'Senha' }).fill(TEST_PASSWORD)
      await page.getByRole('button', { name: 'Entrar' }).click()
      await page.waitForURL('**/dashboard**', { timeout: 15_000 })
    }

    await use(page)
  },

  takeScreenshot: async ({ page, artifactDir }, use) => {
    let counter = 0
    const fn = async (name: string) => {
      counter++
      const filename = `${String(counter).padStart(2, '0')}_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`
      await page.screenshot({ path: path.join(artifactDir, filename), fullPage: true })
    }
    await use(fn)
  },
})

export { expect } from '@playwright/test'
