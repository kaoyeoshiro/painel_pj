/**
 * Full Regression — Autenticação
 *
 * Testa o fluxo completo de autenticação:
 * login, logout, guards, token expirado, redirect pós-login.
 */

import { test, expect } from '@playwright/test'
import {
  setupFullRegressionMocks,
  setupAuthMeError,
  setupLoginError,
  MOCK_TOKEN,
} from './fixtures/api-mocks'

test.describe('Autenticação — Login Page', () => {
  test('renderiza formulário de login com inputs e botão', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const usernameInput = page.getByPlaceholder(/usuário|username|login/i)
      .or(page.locator('input[type="text"]').first())
    const passwordInput = page.locator('input[type="password"]')
    const submitBtn = page.getByRole('button', { name: /entrar|login|acessar/i })

    await expect(usernameInput).toBeVisible({ timeout: 10_000 })
    await expect(passwordInput).toBeVisible()
    await expect(submitBtn).toBeVisible()
  })

  test('login com credenciais válidas redireciona para /dashboard', async ({ page }) => {
    await setupFullRegressionMocks(page)

    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const usernameInput = page.getByPlaceholder(/usuário|username|login/i)
      .or(page.locator('input[type="text"]').first())
    const passwordInput = page.locator('input[type="password"]')
    const submitBtn = page.getByRole('button', { name: /entrar|login|acessar/i })

    await usernameInput.fill('admin_teste')
    await passwordInput.fill('senha123')
    await submitBtn.click()

    // Após login bem-sucedido, deve redirecionar para dashboard
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('login com credenciais inválidas exibe mensagem de erro', async ({ page }) => {
    await setupLoginError(page, 400)

    // Mocks para auth/me (para caso a página tente validar)
    await page.route('**/auth/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Não autenticado' }) })
    )

    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const usernameInput = page.getByPlaceholder(/usuário|username|login/i)
      .or(page.locator('input[type="text"]').first())
    const passwordInput = page.locator('input[type="password"]')
    const submitBtn = page.getByRole('button', { name: /entrar|login|acessar/i })

    await usernameInput.fill('usuario_errado')
    await passwordInput.fill('senha_errada')
    await submitBtn.click()

    // Deve exibir mensagem de erro
    const errorMsg = page.getByText(/inválid|incorret|erro|falha/i)
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Autenticação — Guards e Redirects', () => {
  test('acesso a rota protegida sem token redireciona para /login', async ({ page }) => {
    // Sem token no localStorage e auth/me retorna 401
    await setupAuthMeError(page, 401)

    // Mock genérico para APIs
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Não autenticado' }) })
    )

    await page.goto('/dashboard')
    await page.waitForURL('**/login', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('acesso a rota admin sem token redireciona para /login', async ({ page }) => {
    await setupAuthMeError(page, 401)

    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Não autenticado' }) })
    )

    await page.goto('/admin/users')
    await page.waitForURL('**/login', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('token expirado (auth/me 401) redireciona para /login', async ({ page }) => {
    // Seta token mas auth/me retorna 401 (expirado)
    await page.addInitScript((token: string) => {
      localStorage.setItem('access_token', token)
    }, MOCK_TOKEN)

    await setupAuthMeError(page, 401)

    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )

    await page.goto('/dashboard')
    await page.waitForURL('**/login', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('rota / redireciona para /dashboard quando autenticado', async ({ page }) => {
    await setupFullRegressionMocks(page)

    await page.addInitScript((token: string) => {
      localStorage.setItem('access_token', token)
    }, MOCK_TOKEN)

    await page.goto('/')
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('refresh de página autenticada mantém sessão', async ({ page }) => {
    await setupFullRegressionMocks(page)

    await page.addInitScript((token: string) => {
      localStorage.setItem('access_token', token)
    }, MOCK_TOKEN)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Reload
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Deve continuar no dashboard (não redirecionar para login)
    expect(page.url()).toContain('/dashboard')
  })
})
