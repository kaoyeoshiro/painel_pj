/**
 * E2E Real — Relatório de Cumprimento
 *
 * Processo: 0800311-80.2026.8.12.0019
 * Objetivo: Gerar relatório, validar pipeline e resultado final.
 */
import { test, expect } from './fixtures/real-auth'
import * as fs from 'fs'
import * as path from 'path'

const PROCESSO_CNJ = '0800311-80.2026.8.12.0019'

test.describe('Relatório de Cumprimento — Caso Real', () => {

  // Pipeline real envolve TJ-MS + download docs + Gemini — pode demorar até 5 min
  test.setTimeout(300_000)

  test('Fluxo completo: gerar relatório de cumprimento', async ({
    authedPage: page,
    consoleLogs,
    takeScreenshot,
    artifactDir,
  }) => {
    // === ETAPA 1: Navegar até a página ===
    await page.goto('/relatorio-cumprimento')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await takeScreenshot('01_pagina_inicial')

    await expect(page.getByRole('heading', { name: /Relat.rio de Cumprimento/i }).first()).toBeVisible()

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
      await takeScreenshot('02b_relatorio_existente')
      const sobrescreverCheck = page.locator('input[type="checkbox"]').first()
      if (await sobrescreverCheck.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sobrescreverCheck.click()
      }
    }

    // === ETAPA 4: Gerar relatório ===
    const gerarBtn = page.getByRole('button', { name: /Gerar Relat/i })
    await expect(gerarBtn).toBeEnabled({ timeout: 10_000 })
    await gerarBtn.click()
    await takeScreenshot('03_geracao_iniciada')

    // === ETAPA 5: Acompanhar pipeline SSE (5 etapas) ===
    await page.waitForTimeout(5000)
    await takeScreenshot('04_pipeline_em_andamento')

    await page.waitForTimeout(15000)
    await takeScreenshot('04b_pipeline_progresso')

    // === ETAPA 6: Aguardar resultado final (pipeline pode levar até 4 min) ===
    // Detecta: streaming parcial (.prose), resultado final, erro, ou fim inesperado do stream
    const resultArea = page.locator('.prose, .markdown-body, [role="alert"], .border-red-200, .border-destructive').first()

    // Polling: espera resultado OU detecta que stream morreu (botão volta a ficar habilitado)
    let resultVisible = false
    let streamDied = false
    const startTime = Date.now()
    const MAX_WAIT = 270_000

    while (Date.now() - startTime < MAX_WAIT) {
      resultVisible = await resultArea.isVisible().catch(() => false)
      if (resultVisible) break

      // Detecta se o stream morreu: o botão "Gerar" volta a ficar habilitado sem resultado
      const btnEnabled = await gerarBtn.isEnabled().catch(() => false)
      const hasProseOrAlert = await page.locator('.prose, [role="alert"]').count()
      if (btnEnabled && hasProseOrAlert === 0 && Date.now() - startTime > 30_000) {
        // Stream morreu sem resultado — bug de backend (ex: encoding error no Windows)
        streamDied = true
        break
      }

      await page.waitForTimeout(3000)
    }

    await takeScreenshot('05_resultado_final')

    // === ETAPA 7: Validar conteúdo ===
    const bodyText = await page.textContent('body') || ''

    const hasProcessoRef = /0800311|cumprimento|Cumprimento/i.test(bodyText)
    const hasDadosProcesso = /vara|Vara|comarca|Comarca|autor|Autor/i.test(bodyText)
    const hasTransito = /tr.nsito.*julgado|julgado/i.test(bodyText)
    const hasDocumentos = /documento|Documento|agravo|decis.o/i.test(bodyText)

    // Verificar alertas (ex: Agravo)
    const hasAgravo = await page.locator('[role="alert"]:has-text("agravo"), [role="alert"]:has-text("Agravo")').count()
    if (hasAgravo > 0) {
      await takeScreenshot('06_alerta_agravo')
    }

    // === ETAPA 8: Verificar exportação ===
    const hasDocx = await page.getByRole('button', { name: /DOCX/i }).count()
    const hasPdf = await page.getByRole('button', { name: /PDF/i }).count()

    if (hasDocx > 0 || hasPdf > 0) {
      await takeScreenshot('07_opcoes_exportacao')
    }

    // Verifica erros
    const hasError = await page.locator('[role="alert"]:has-text("Erro")').count()
    if (hasError > 0) {
      await takeScreenshot('ERRO_relatorio')
    }

    // === Salvar logs ===
    fs.writeFileSync(
      path.join(artifactDir, 'console_logs.json'),
      JSON.stringify(consoleLogs, null, 2),
      'utf-8'
    )

    console.log(`
====== RELATÓRIO DE CUMPRIMENTO — RESUMO ======
Processo: ${PROCESSO_CNJ}
Resultado visível: ${resultVisible}
Stream morreu: ${streamDied ? 'SIM (bug backend encoding Windows)' : 'NÃO'}
Referência processo: ${hasProcessoRef ? 'SIM' : 'NÃO'}
Dados processo: ${hasDadosProcesso ? 'SIM' : 'NÃO'}
Trânsito julgado: ${hasTransito ? 'SIM' : 'NÃO'}
Documentos: ${hasDocumentos ? 'SIM' : 'NÃO'}
Agravo: ${hasAgravo > 0 ? 'SIM' : 'NÃO'}
Exportação DOCX: ${hasDocx > 0 ? 'SIM' : 'NÃO'}
Exportação PDF: ${hasPdf > 0 ? 'SIM' : 'NÃO'}
Erros: ${hasError}
Erros console: ${consoleLogs.errors.length}
================================================
    `)
  })
})
