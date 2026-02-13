import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração Playwright para testes E2E reais.
 *
 * Conecta ao backend real (localhost:8000) via proxy do Vite.
 * Grava video, screenshots, trace e console logs para cada teste.
 */
export default defineConfig({
  testDir: './e2e-real',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'e2e-artifacts/report' }],
    ['list'],
  ],
  timeout: 180_000,      // 3 min por teste (fluxos reais demoram)
  expect: { timeout: 30_000 },

  use: {
    baseURL: 'http://localhost:5174',
    // Captura de artefatos
    video: 'on',
    screenshot: 'on',
    trace: 'on',
    // Viewport
    viewport: { width: 1440, height: 900 },
    // Navegação
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium-real',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Não sobe server automaticamente — usa o vite dev que já está rodando em 5173
  // com proxy para o backend em 8000
})
