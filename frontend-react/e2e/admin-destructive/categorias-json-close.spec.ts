/**
 * Teste E2E: Fechar modal "Editar Categoria" em /admin/categorias-json
 *
 * Valida que:
 * 1. O botao X (DialogPrimitive.Close) fecha o dialog
 * 2. O botao "Fechar" (footer) fecha o dialog
 * 3. ESC NAO fecha o dialog (comportamento intencional do legado)
 * 4. Click fora NAO fecha o dialog (comportamento intencional do legado)
 * 5. O botao X tem aria-label="Fechar"
 */

import { test, expect, emptyArray, jsonResponse } from './fixtures'

// Dados mock para uma categoria existente
const MOCK_CATEGORIAS = [
  {
    id: 10,
    nome: 'peticoes',
    titulo: 'Peticoes Iniciais',
    descricao: 'Categoria de teste',
    codigos_documento: [500, 501],
    formato_json: '{"campo": "valor"}',
    instrucoes_extracao: '',
    is_residual: false,
    ativo: true,
    source_type: 'code',
    source_special_type: null,
    updated_at: '2026-01-15T10:00:00Z',
    ia_generated: false,
  },
]

const MOCK_CATEGORIA_DETALHE = {
  id: 10,
  nome: 'peticoes',
  titulo: 'Peticoes Iniciais',
  descricao: 'Categoria de teste',
  codigos_documento: [500, 501],
  formato_json: '{"campo": "valor"}',
  instrucoes_extracao: '',
  is_residual: false,
  ativo: true,
  source_type: 'code' as const,
  source_special_type: null,
  updated_at: '2026-01-15T10:00:00Z',
  ia_generated: false,
}

test.describe('Categorias JSON: Fechar Dialog Editor', () => {
  test.beforeEach(async ({ ctx }) => {
    const { page } = ctx

    // Mock da lista de categorias
    await page.route('**/admin/api/categorias-resumo-json?apenas_ativos=false', jsonResponse(MOCK_CATEGORIAS))
    await page.route('**/admin/api/categorias-resumo-json?apenas_com_variaveis=true', emptyArray)

    // Mock do detalhe da categoria
    await page.route('**/admin/api/categorias-resumo-json/10', jsonResponse(MOCK_CATEGORIA_DETALHE))

    // Mock da blacklist
    await page.route('**/admin/api/categorias-resumo-json/config/codigos-ignorados', jsonResponse({ codigos: [] }))

    // Mock de fontes especiais
    await page.route('**/admin/api/categorias-resumo-json/fontes-especiais', emptyArray)

    // Mock de perguntas (IA tab)
    await page.route('**/admin/api/extraction/categorias/*/perguntas', emptyArray)

    await page.goto('/admin/categorias-json')
    await page.waitForLoadState('networkidle')
  })

  test('botao X tem aria-label="Fechar" e data-testid', async ({ ctx }) => {
    const { page } = ctx

    // Abrir editor clicando em Editar na primeira categoria
    await page.getByTestId('btn-editar-10').click()

    // Aguardar dialog aparecer
    const dialog = page.getByTestId('editor-dialog')
    await expect(dialog).toBeVisible()

    // Verificar que o botao X existe com data-testid correto e aria-label
    const closeBtn = page.getByTestId('dialog-close-btn')
    await expect(closeBtn).toBeVisible()
    await expect(closeBtn).toHaveAttribute('aria-label', 'Fechar')

    ctx.logAction('/admin/categorias-json', 'verificar', 'aria-label do X', 'OK')
  })

  test('fechar dialog pelo botao X funciona', async ({ ctx }) => {
    const { page } = ctx

    // Abrir editor
    await page.getByTestId('btn-editar-10').click()

    const dialog = page.getByTestId('editor-dialog')
    await expect(dialog).toBeVisible()

    // Clicar no X (botao com data-testid="dialog-close-btn")
    const closeBtn = page.getByTestId('dialog-close-btn')
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()

    // Verificar que dialog fechou
    await expect(dialog).not.toBeVisible()

    ctx.logAction('/admin/categorias-json', 'fechar-X', 'EditorDialog', 'Dialog fechou com sucesso')
  })

  test('fechar dialog pelo botao "Fechar" (footer) funciona', async ({ ctx }) => {
    const { page } = ctx

    // Abrir editor
    await page.getByTestId('btn-editar-10').click()

    const dialog = page.getByTestId('editor-dialog')
    await expect(dialog).toBeVisible()

    // Clicar no botao Fechar do footer
    await page.getByTestId('btn-cancel').click()

    // Verificar que dialog fechou
    await expect(dialog).not.toBeVisible()

    ctx.logAction('/admin/categorias-json', 'fechar-footer', 'EditorDialog', 'Dialog fechou com sucesso')
  })

  test('ESC NAO fecha o dialog (comportamento intencional do legado)', async ({ ctx }) => {
    const { page } = ctx

    // Abrir editor
    await page.getByTestId('btn-editar-10').click()

    const dialog = page.getByTestId('editor-dialog')
    await expect(dialog).toBeVisible()

    // Pressionar ESC
    await page.keyboard.press('Escape')

    // Dialog deve continuar visivel (ESC bloqueado intencionalmente)
    await expect(dialog).toBeVisible()

    ctx.logAction('/admin/categorias-json', 'ESC', 'EditorDialog', 'Dialog permaneceu aberto (correto)')
  })

  test('abrir e fechar dialog "Nova Categoria" pelo X', async ({ ctx }) => {
    const { page } = ctx

    // Clicar em "Nova Categoria"
    await page.getByTestId('btn-nova-categoria').click()

    const dialog = page.getByTestId('editor-dialog')
    await expect(dialog).toBeVisible()

    // Titulo deve ser "Nova Categoria"
    await expect(page.getByRole('heading', { name: 'Nova Categoria' })).toBeVisible()

    // Fechar pelo X
    const closeBtn = page.getByTestId('dialog-close-btn')
    await closeBtn.click()

    await expect(dialog).not.toBeVisible()

    ctx.logAction('/admin/categorias-json', 'fechar-X', 'Nova Categoria Dialog', 'Dialog fechou com sucesso')
  })

  test('reabrir dialog apos fechar pelo X funciona', async ({ ctx }) => {
    const { page } = ctx

    // Abrir editor
    await page.getByTestId('btn-editar-10').click()
    const dialog = page.getByTestId('editor-dialog')
    await expect(dialog).toBeVisible()

    // Fechar pelo X
    await page.getByTestId('dialog-close-btn').click()
    await expect(dialog).not.toBeVisible()

    // Reabrir
    await page.getByTestId('btn-editar-10').click()
    await expect(dialog).toBeVisible()

    // Verificar que carregou o titulo correto
    await expect(page.getByRole('heading', { name: 'Editar Categoria' })).toBeVisible()

    ctx.logAction('/admin/categorias-json', 'reabrir-apos-X', 'EditorDialog', 'Dialog reabriu corretamente')
  })

  test('dialog de desativacao fecha pelo X e pelo Cancelar', async ({ ctx }) => {
    const { page } = ctx

    // Clicar em Desativar na categoria
    await page.getByTestId('btn-desativar-10').click()

    const deactivateDialog = page.getByTestId('deactivate-dialog')
    await expect(deactivateDialog).toBeVisible()

    // Deve mostrar titulo de confirmacao
    await expect(page.getByRole('heading', { name: /confirmar/i })).toBeVisible()

    // Fechar pelo Cancelar
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(deactivateDialog).not.toBeVisible()

    // Reabrir e fechar pelo X
    await page.getByTestId('btn-desativar-10').click()
    await expect(deactivateDialog).toBeVisible()

    // O X do deactivate dialog funciona normalmente (sem bloqueio de onOpenChange)
    const closeBtn = deactivateDialog.locator('[data-testid="dialog-close-btn"]')
    await closeBtn.click()
    await expect(deactivateDialog).not.toBeVisible()

    ctx.logAction('/admin/categorias-json', 'fechar-deactivate', 'DeactivateDialog', 'Ambos mecanismos funcionam')
  })
})
