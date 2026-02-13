/**
 * E2E Real — Prestação de Contas
 *
 * Processo: 0801359-69.2021.8.12.0045
 * Objetivo: Executar fluxo completo até parecer final.
 */
import { test, expect } from './fixtures/real-auth'
import * as fs from 'fs'
import * as path from 'path'

const PROCESSO_CNJ = '0801359-69.2021.8.12.0045'

test.describe('Prestação de Contas — Caso Real', () => {

  test('Fluxo completo: analisar prestação de contas', async ({
    authedPage: page,
    consoleLogs,
    takeScreenshot,
    artifactDir,
  }) => {
    // === ETAPA 1: Navegar até a página ===
    await page.goto('/prestacao-contas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await takeScreenshot('01_pagina_inicial')

    await expect(page.getByRole('heading', { name: /Presta..o de Contas/i }).first()).toBeVisible()

    // === ETAPA 2: Preencher número do processo ===
    const cnjInput = page.getByRole('textbox', { name: /Numero do Processo/i })
    await expect(cnjInput).toBeVisible()
    await cnjInput.fill(PROCESSO_CNJ)
    await page.waitForTimeout(1500) // Espera debounce check
    await takeScreenshot('02_processo_preenchido')

    // === ETAPA 3: Verificar existência (debounce) ===
    const existenteAlert = page.locator('[role="alert"]:has-text("existente"), [role="alert"]:has-text("existe")')
    const hasExistente = await existenteAlert.isVisible({ timeout: 3_000 }).catch(() => false)

    if (hasExistente) {
      await takeScreenshot('02b_analise_existente')
      // Pode ter checkbox de sobrescrever
      const sobrescreverCheck = page.locator('input[type="checkbox"]').first()
      if (await sobrescreverCheck.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sobrescreverCheck.click()
      }
    }

    // === ETAPA 4: Iniciar análise ===
    const analisarBtn = page.getByRole('button', { name: /Analisar Presta/i })
    await expect(analisarBtn).toBeEnabled({ timeout: 10_000 })
    await analisarBtn.click()
    await takeScreenshot('03_analise_iniciada')

    // === ETAPA 5: Acompanhar pipeline SSE (5 etapas) ===
    await page.waitForTimeout(5000)
    await takeScreenshot('04_pipeline_em_andamento')

    await page.waitForTimeout(15000)
    await takeScreenshot('04b_pipeline_progresso')

    // === ETAPA 6: Aguardar resultado final ===
    // Pode terminar em: resultado, dúvidas, ou aguardando documentos
    const finalState = page.locator(
      '.prose, .markdown-body, [role="alert"], textarea'
    ).first()

    await expect(finalState).toBeVisible({ timeout: 150_000 })
    await page.waitForTimeout(2000)
    await takeScreenshot('05_estado_final')

    // === ETAPA 7: Identificar tipo de resultado ===
    const bodyText = await page.textContent('body') || ''

    const hasParecer = /favor.vel|desfavor.vel/i.test(bodyText)
    const hasDuvida = /d.vida|pergunta/i.test(bodyText)
    const hasDocFaltante = /documento.*faltante|falta.*documento/i.test(bodyText)
    const hasValores = bodyText.includes('R$') || /valor|bloqueado|utilizado/i.test(bodyText)

    if (hasDuvida) {
      await takeScreenshot('06_duvidas_ia')
      console.log('IA retornou dúvidas — fluxo parou para interação humana')
    }

    // === ETAPA 8: Verificar exportação ===
    const exportCount = await page.getByRole('button', { name: /DOCX|Exportar|Baixar/i }).count()
    if (exportCount > 0) {
      await takeScreenshot('07_opcoes_exportacao')
    }

    // Verifica erros
    const hasError = await page.locator('[role="alert"]:has-text("Erro")').count()
    if (hasError > 0) {
      await takeScreenshot('ERRO_prestacao')
    }

    // === Salvar logs ===
    fs.writeFileSync(
      path.join(artifactDir, 'console_logs.json'),
      JSON.stringify(consoleLogs, null, 2),
      'utf-8'
    )

    console.log(`
====== PRESTAÇÃO DE CONTAS — RESUMO ======
Processo: ${PROCESSO_CNJ}
Parecer: ${hasParecer ? 'SIM' : 'NÃO'}
Dúvida IA: ${hasDuvida ? 'SIM' : 'NÃO'}
Doc faltante: ${hasDocFaltante ? 'SIM' : 'NÃO'}
Valores extraídos: ${hasValores ? 'SIM' : 'NÃO'}
Exportação: ${exportCount} botões
Erros: ${hasError}
Erros console: ${consoleLogs.errors.length}
==========================================
    `)
  })
})
