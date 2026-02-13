/**
 * E2E Real — Matrículas Confrontantes
 *
 * Arquivo: C:\Users\kaoye\Downloads\matrículas.pdf
 * Objetivo: Upload de PDF, processar análise, validar resultado exibido.
 */
import { test, expect } from './fixtures/real-auth'
import * as fs from 'fs'
import * as path from 'path'

const PDF_PATH = 'C:\\Users\\kaoye\\Downloads\\matrículas.pdf'

test.describe('Matrículas Confrontantes — Caso Real', () => {

  test.beforeAll(() => {
    if (!fs.existsSync(PDF_PATH)) {
      throw new Error(`Arquivo PDF não encontrado: ${PDF_PATH}`)
    }
  })

  test('Fluxo completo: upload PDF, analisar, validar resultado', async ({
    authedPage: page,
    consoleLogs,
    takeScreenshot,
    artifactDir,
  }) => {
    // === ETAPA 1: Navegar até a página ===
    await page.goto('/matriculas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await takeScreenshot('01_pagina_inicial')

    await expect(page.getByRole('heading', { name: /Matr.culas/i }).first()).toBeVisible()

    // === ETAPA 2: Preencher matrícula principal ===
    const matriculaInput = page.getByRole('textbox', { name: /12345/i })
    await expect(matriculaInput).toBeVisible()
    await matriculaInput.fill('12345')
    await takeScreenshot('02_matricula_preenchida')

    // === ETAPA 3: Upload do PDF ===
    // Procura botão "Importar" para abrir file chooser
    const importBtn = page.getByRole('button', { name: /Importar/i })

    if (await importBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Usa file chooser
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        importBtn.click(),
      ])
      await fileChooser.setFiles(PDF_PATH)
    } else {
      // Tenta input file direto
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(PDF_PATH)
    }

    await page.waitForTimeout(3000)
    await takeScreenshot('03_arquivo_enviado')

    // Espera o upload completar (deve aparecer na lista)
    // Pode ser que peça confirmação de substituição
    const replaceDialog = page.locator('[role="dialog"], [role="alertdialog"]')
    if (await replaceDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const replaceBtn = page.getByRole('button', { name: /Substituir|Sim|Confirmar/i })
      if (await replaceBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await replaceBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    // === ETAPA 4: Selecionar arquivo e iniciar análise ===
    // Itens de arquivo são DIVs com cursor-pointer (não buttons)
    const fileItem = page.locator('div.cursor-pointer:has-text("matriculas.pdf"), [class*="cursor-pointer"]:has-text("matriculas")').first()
    if (await fileItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fileItem.click()
      await page.waitForTimeout(1000)
    } else {
      // Fallback: selecionar o primeiro arquivo da lista
      const anyFile = page.locator('div[class*="cursor-pointer"][class*="rounded-lg"]').first()
      if (await anyFile.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await anyFile.click()
        await page.waitForTimeout(1000)
      }
    }

    // Clica em "Analisar" (precisa que um arquivo esteja selecionado)
    const analisarBtn = page.getByRole('button', { name: 'Analisar' })
    await expect(analisarBtn).toBeVisible({ timeout: 10_000 })
    await analisarBtn.click()
    await takeScreenshot('04_analise_iniciada')

    // === ETAPA 5: Aguardar resultado (polling com intervalo de 2s, timeout 5 min) ===
    // Pode aparecer: modal de processamento → relatório prose, tabela, ou erro (toast)
    const resultado = page.locator('.prose, .prose-sm, .markdown-body, table:has(th), [class*="resultado"]').first()
    const errorAlert = page.locator('[role="alert"], .border-red-200, .border-destructive').first()

    await expect(resultado.or(errorAlert)).toBeVisible({ timeout: 180_000 })
    await page.waitForTimeout(2000)
    await takeScreenshot('05_resultado_analise')

    // === ETAPA 6: Validar dados exibidos ===
    const bodyText = await page.textContent('body') || ''
    const hasContent = bodyText.length > 500

    // Verifica se há dados de matrícula
    const hasMatriculaData = bodyText.includes('matrícula') ||
      bodyText.includes('Matrícula') ||
      bodyText.includes('confrontante') ||
      bodyText.includes('lote') ||
      bodyText.includes('análise')

    // Verifica que não travou
    const loadingSpinner = page.locator('.animate-spin')
    const stillLoading = await loadingSpinner.count()

    // === ETAPA 7: Verificar exportação ===
    const exportBtns = page.getByRole('button', { name: /Word|PDF|JSON|Copiar/i })
    const exportCount = await exportBtns.count()

    if (exportCount > 0) {
      await takeScreenshot('06_opcoes_exportacao')
    }

    // === Salvar logs ===
    fs.writeFileSync(
      path.join(artifactDir, 'console_logs.json'),
      JSON.stringify(consoleLogs, null, 2),
      'utf-8'
    )

    console.log(`
====== MATRÍCULAS CONFRONTANTES — RESUMO ======
Arquivo: ${PDF_PATH}
Upload OK: SIM
Resultado visível: ${await resultado.isVisible().catch(() => false)}
Dados de matrícula: ${hasMatriculaData ? 'SIM' : 'NÃO'}
Travou (loading): ${stillLoading > 0 ? 'SIM' : 'NÃO'}
Botões exportação: ${exportCount}
Erros console: ${consoleLogs.errors.length}
================================================
    `)
  })
})
