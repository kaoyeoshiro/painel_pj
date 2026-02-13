/**
 * Testes de paridade UI — Página de Login
 *
 * Verifica que todos os controles do legado existem no React.
 * Referência: docs/ui_parity_matrix.md seção 1 (Login)
 */

import { test, expect } from '@playwright/test'

test.describe('1. Login (/login)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('1.1 — Campo Username existe', async ({ page }) => {
    const input = page.locator('input[name="username"], input[type="text"]').first()
    await expect(input).toBeVisible()
  })

  test('1.2 — Campo Senha existe', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await expect(input).toBeVisible()
  })

  test('1.3 — Botão Entrar existe', async ({ page }) => {
    const btn = page.getByRole('button', { name: /entrar/i })
    await expect(btn).toBeVisible()
  })

  test('1.4 — Logo/título da aplicação visível', async ({ page }) => {
    // Verifica que o título ou logo do portal está presente
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('1.5 — Mensagem de erro ao falhar login', async ({ page }) => {
    // Simula submissão com credenciais inválidas
    await page.route('**/auth/login', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Credenciais inválidas' }) })
    )

    await page.locator('input[name="username"], input[type="text"]').first().fill('invalid')
    await page.locator('input[type="password"]').fill('invalid')
    await page.getByRole('button', { name: /entrar/i }).click()

    // Aguarda mensagem de erro aparecer
    await expect(page.getByText(/inválid|erro|falh/i)).toBeVisible({ timeout: 5000 })
  })

  test('1.6 — Campo senha tem tipo password (oculta texto)', async ({ page }) => {
    const input = page.locator('input[type="password"]')
    await expect(input).toHaveAttribute('type', 'password')
  })

  test('1.7 — Formulário tem estrutura completa', async ({ page }) => {
    // Verifica que existe um form ou container com os campos
    const form = page.locator('form').first()
    await expect(form).toBeVisible()
  })
})
