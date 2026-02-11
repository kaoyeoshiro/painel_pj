import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração dedicada para suite Full Regression.
 *
 * Testa 100% das rotas do Portal PGE com mocks de API (sem backend).
 * Foco: renderização, interações, autenticação e estados de erro.
 *
 * Uso: npx playwright test -c playwright.full-regression.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'full-regression-*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/full-regression' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results/full-regression',
  use: {
    baseURL: 'http://127.0.0.1:5178',
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Campo_Grande',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'full-regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 5178 --host 127.0.0.1',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
