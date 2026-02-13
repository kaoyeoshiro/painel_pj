import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests para CI — NAO requer backend.
 *
 * Os testes mockam todas as chamadas API via page.route(),
 * entao so precisamos do Vite dev server.
 *
 * Uso: npx playwright test -c playwright.ci-smoke.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'portal.smoke.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5178',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'ci-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 5178 --host 127.0.0.1',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
