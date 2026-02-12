/**
 * Configuracao Playwright para suite admin-destructive.
 *
 * Suite de testes agressivos que cobrem render, interacao e acoes
 * destrutivas em TODAS as rotas /admin.
 *
 * - Reporter HTML separado
 * - Trace habilitado sempre
 * - Screenshot em toda falha
 * - Video em toda falha
 * - Sem paralelismo (acoes destrutivas podem afetar estado compartilhado)
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/admin-destructive',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'test-results/admin-destructive-report',
      open: process.env.CI ? 'never' : 'on-failure',
    }],
  ],

  outputDir: 'test-results/admin-destructive-results',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5178',
    viewport: { width: 1440, height: 900 },
    timezoneId: 'America/Campo_Grande',
    locale: 'pt-BR',
    trace: 'on',
    screenshot: 'on',
    video: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },

  projects: [
    {
      name: 'admin-destructive',
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
