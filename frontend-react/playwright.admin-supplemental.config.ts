/**
 * Configuracao Playwright para suite admin-supplemental.
 *
 * Roda APENAS os testes em e2e/admin-supplemental/.
 * NAO interfere com as suites existentes (parity, visual, smoke, ci-smoke).
 *
 * Sem dependencia de backend — todas as APIs sao mockadas via fixture.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/admin-supplemental',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'test-results/admin-supplemental-report',
      open: process.env.CI ? 'never' : 'on-failure',
    }],
  ],

  outputDir: 'test-results/admin-supplemental-results',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5178',
    viewport: { width: 1440, height: 900 },
    timezoneId: 'America/Campo_Grande',
    locale: 'pt-BR',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },

  projects: [
    {
      name: 'admin-supplemental',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: {
    command: 'npx vite --port 5178 --host 127.0.0.1',
    cwd: '.',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
