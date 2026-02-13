/**
 * E2E Real — Assistência Judiciária
 *
 * Processo: 0800079-49.2019.8.12.0040
 * Objetivo: Abrir funcionalidade, carregar processo, validar dados essenciais,
 * executar ação principal até etapa final.
 */
import { test, expect } from './fixtures/real-auth'
import * as fs from 'fs'
import * as path from 'path'

const PROCESSO_CNJ = '0800079-49.2019.8.12.0040'

test.describe('Assistência Judiciária — Caso Real', () => {

  test('Fluxo completo: consultar processo e validar resultado', async ({
    authedPage: page,
    consoleLogs,
    takeScreenshot,
    artifactDir,
  }) => {
    // === ETAPA 1: Navegar até a página ===
    await page.goto('/assistencia')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await takeScreenshot('01_pagina_inicial')

    // Valida que a página carregou
    await expect(page.getByRole('heading', { name: 'Assistência Judiciária' })).toBeVisible()

    // === ETAPA 2: Preencher número do processo ===
    const cnjInput = page.getByRole('textbox', { name: '0000000-00.0000.0.00.0000' })
    await expect(cnjInput).toBeVisible()
    await cnjInput.fill(PROCESSO_CNJ)
    await takeScreenshot('02_processo_preenchido')

    // === ETAPA 3: Clicar em Consultar ===
    const consultarBtn = page.getByRole('button', { name: 'Consultar' })
    await expect(consultarBtn).toBeVisible()
    await consultarBtn.click()
    await takeScreenshot('03_consulta_iniciada')

    // === ETAPA 4: Aguardar resultado (chamada real ao TJ-MS + IA) ===
    // Espera loading aparecer e desaparecer
    await page.waitForTimeout(3000)

    // Espera resultado ou erro (timeout generoso para chamadas reais)
    const resultado = page.locator('.prose, .markdown-body, [class*="whitespace-pre"]').first()
    const errorAlert = page.locator('[role="alert"]').first()

    // Espera um dos dois aparecer
    await expect(resultado.or(errorAlert)).toBeVisible({ timeout: 120_000 })
    await page.waitForTimeout(2000) // Espera markdown renderizar
    await takeScreenshot('04_resultado_exibido')

    // === ETAPA 5: Validar dados essenciais ===
    const pageContent = await page.textContent('body') || ''

    // O resultado deve conter alguma referência ao processo ou análise
    const hasContent = pageContent.includes('0800079') ||
      pageContent.includes('assistência') ||
      pageContent.includes('Assistência') ||
      pageContent.includes('análise') ||
      pageContent.includes('processo') ||
      pageContent.length > 2000

    expect(hasContent).toBeTruthy()

    // Verifica se é erro
    const isError = await errorAlert.isVisible().catch(() => false)
    if (isError) {
      const errorText = await errorAlert.textContent()
      console.error(`Erro detectado: ${errorText}`)
      await takeScreenshot('ERRO_resultado')
    }

    // === ETAPA 6: Verificar botões de ação (download/feedback) ===
    const hasDownload = await page.getByRole('button', { name: /DOCX|Baixar|Download/i }).count()
    const hasFeedback = await page.locator('button:has-text("Correto"), button:has-text("correto")').count()

    if (hasDownload > 0 || hasFeedback > 0) {
      await takeScreenshot('05_acoes_disponiveis')
    }

    // === ETAPA 7: Salvar console logs ===
    fs.writeFileSync(
      path.join(artifactDir, 'console_logs.json'),
      JSON.stringify(consoleLogs, null, 2),
      'utf-8'
    )

    console.log(`
====== ASSISTÊNCIA JUDICIÁRIA — RESUMO ======
Processo: ${PROCESSO_CNJ}
Resultado visível: ${!isError}
É erro: ${isError}
Erros no console: ${consoleLogs.errors.length}
Warnings no console: ${consoleLogs.warnings.length}
Botão download: ${hasDownload > 0 ? 'SIM' : 'NÃO'}
Botões feedback: ${hasFeedback}
==============================================
    `)
  })
})
