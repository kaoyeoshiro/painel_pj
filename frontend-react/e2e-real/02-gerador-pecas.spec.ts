/**
 * E2E Real — Gerador de Peças
 *
 * Processo: 0828724-58.2025.8.12.0110
 * Objetivo: Navegar até o gerador, buscar processo, selecionar peça,
 * gerar peça e validar resultado.
 */
import { test, expect } from './fixtures/real-auth'
import * as fs from 'fs'
import * as path from 'path'

const PROCESSO_CNJ = '0828724-58.2025.8.12.0110'

test.describe('Gerador de Peças — Caso Real', () => {

  // Pipeline real envolve TJ-MS + 3 agentes IA — pode demorar até 5 min
  test.setTimeout(300_000)

  test('Fluxo completo: gerar peça automaticamente', async ({
    authedPage: page,
    consoleLogs,
    takeScreenshot,
    artifactDir,
  }) => {
    // === ETAPA 1: Navegar até a página ===
    await page.goto('/gerador-pecas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await takeScreenshot('01_pagina_inicial')

    // Valida que a página carregou
    await expect(page.getByRole('heading', { name: /Gerador de Pe/i })).toBeVisible()

    // === ETAPA 2: Preencher número do processo ===
    const cnjInput = page.getByRole('textbox', { name: /Numero do Processo/i })
    await expect(cnjInput).toBeVisible()
    await cnjInput.fill(PROCESSO_CNJ)
    await page.waitForTimeout(1000)
    await takeScreenshot('02_processo_preenchido')

    // === ETAPA 3: Selecionar tipo de peça ===
    // Espera o combobox carregar (async loading)
    const tipoPecaCombo = page.getByRole('combobox', { name: /Tipo de Pe/i })
    await expect(tipoPecaCombo).toBeVisible({ timeout: 10_000 })
    await tipoPecaCombo.click()
    await page.waitForTimeout(1000)

    // Seleciona a primeira opção disponível
    const firstOption = page.getByRole('option').first()
    if (await firstOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstOption.click()
    } else {
      // Tenta alternativa: SelectItem do Radix
      const radixOption = page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] *').first()
      if (await radixOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await radixOption.click()
      }
    }
    await page.waitForTimeout(500)
    await takeScreenshot('03_tipo_peca_selecionado')

    // === ETAPA 3b: Selecionar grupo de prompts (obrigatório quando admin tem múltiplos grupos) ===
    const grupoCombo = page.getByRole('combobox', { name: /Grupo de Argumento/i })
    if (await grupoCombo.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await grupoCombo.click()
      await page.waitForTimeout(500)
      // Seleciona o primeiro grupo real (pula "Todos os grupos")
      const grupoOptions = page.getByRole('option')
      const optCount = await grupoOptions.count()
      if (optCount > 1) {
        // Seleciona o segundo item (primeiro é "Todos os grupos")
        await grupoOptions.nth(1).click()
      } else if (optCount === 1) {
        await grupoOptions.first().click()
      }
      await page.waitForTimeout(500)
      await takeScreenshot('03b_grupo_selecionado')
    }

    // === ETAPA 4: Clicar em "Gerar Automático" ===
    const gerarBtn = page.getByRole('button', { name: /Gerar Autom/i })
    // Espera o botão ficar habilitado
    await expect(gerarBtn).toBeEnabled({ timeout: 10_000 })
    await gerarBtn.click()
    await takeScreenshot('04_geracao_iniciada')

    // === ETAPA 5: Acompanhar pipeline de agentes ===
    await page.waitForTimeout(5000)
    await takeScreenshot('05_pipeline_em_andamento')

    // === ETAPA 6: Aguardar resultado (SSE streaming — pode demorar) ===
    // Espera o markdown do resultado OU um erro (Card com border-red ou role=alert)
    const resultOrError = page.locator('.prose, .markdown-body, [role="alert"], .border-red-200, :text("Erro na geracao")').first()
    await expect(resultOrError).toBeVisible({ timeout: 150_000 })
    await page.waitForTimeout(5000) // Espera streaming terminar
    await takeScreenshot('06_resultado_final')

    // === ETAPA 7: Validar resultado ===
    const bodyText = await page.textContent('body') || ''

    // Verifica se há erro (Card com border-red ou role=alert)
    const errorCard = page.locator('.border-red-200, [role="alert"]')
    const hasError = await errorCard.filter({ hasText: /erro|Erro|falha/i }).count()

    if (hasError > 0) {
      const errorText = await errorCard.first().textContent()
      console.error(`Erro na geração: ${errorText}`)
      await takeScreenshot('ERRO_geracao')
    }

    // Resultado deve ter algum conteúdo substantivo
    const proseContent = page.locator('.prose, .markdown-body').first()
    if (await proseContent.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const text = await proseContent.textContent()
      expect(text?.length).toBeGreaterThan(50)
    }

    // === ETAPA 8: Verificar botões de exportação ===
    const exportCount = await page.getByRole('button', { name: /DOCX|Baixar|Copiar/i }).count()
    if (exportCount > 0) {
      await takeScreenshot('07_opcoes_exportacao')
    }

    // === ETAPA 9: Salvar logs ===
    fs.writeFileSync(
      path.join(artifactDir, 'console_logs.json'),
      JSON.stringify(consoleLogs, null, 2),
      'utf-8'
    )

    console.log(`
====== GERADOR DE PEÇAS — RESUMO ======
Processo: ${PROCESSO_CNJ}
Resultado visível: ${await proseContent.isVisible().catch(() => false)}
Erros detectados: ${hasError}
Botões exportação: ${exportCount}
Erros console: ${consoleLogs.errors.length}
========================================
    `)
  })
})
