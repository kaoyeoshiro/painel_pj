import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração Playwright para testes de paridade UI.
 *
 * Verifica que todos os controles do frontend legado existem
 * no React frontend, usando data-testid como âncora.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5178',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 5178',
    url: process.env.E2E_BASE_URL || 'http://localhost:5178',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
