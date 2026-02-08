import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoriasJsonPage } from '../CategoriasJsonPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

// Mock do toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

describe('CategoriasJsonPage', () => {
  const mockCategorias = [
    {
      id: 1,
      nome: 'Categoria Teste 1',
      descricao: 'Descrição da categoria 1',
      codigos_documento: ['10', '20'],
      formato_json: { campo1: 'string', campo2: 'number' },
      ativo: true,
      json_gerado_por_ia: true,
      criado_em: '2024-01-01T00:00:00',
      atualizado_em: '2024-01-01T00:00:00'
    },
    {
      id: 2,
      nome: 'Categoria Teste 2',
      descricao: 'Descrição da categoria 2',
      codigos_documento: ['30'],
      formato_json: { campo3: 'boolean' },
      ativo: false,
      json_gerado_por_ia: false,
      criado_em: '2024-01-02T00:00:00',
      atualizado_em: '2024-01-02T00:00:00'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve carregar e exibir categorias ao montar o componente', async () => {
    vi.mocked(adminApi.get).mockResolvedValueOnce(mockCategorias)

    render(<CategoriasJsonPage />)

    // Deve mostrar loading inicialmente
    expect(screen.getByText(/carregando categorias/i)).toBeInTheDocument()

    // Aguardar carregar categorias
    await waitFor(() => {
      expect(screen.getByText('Categoria Teste 1')).toBeInTheDocument()
    })

    // Verificar se chamou API correta
    expect(adminApi.get).toHaveBeenCalledWith('/admin/api/categorias-resumo-json')

    // Verificar se exibe as duas categorias
    expect(screen.getByText('Categoria Teste 1')).toBeInTheDocument()
    expect(screen.getByText('Descrição da categoria 1')).toBeInTheDocument()
    expect(screen.getByText('Categoria Teste 2')).toBeInTheDocument()
    expect(screen.getByText('Descrição da categoria 2')).toBeInTheDocument()

    // Verificar badges
    expect(screen.getAllByText('Ativo')).toHaveLength(1)
    expect(screen.getAllByText('Inativo')).toHaveLength(1)
    expect(screen.getAllByText('IA')).toHaveLength(1)

    // Verificar códigos de documentos
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('deve abrir dialog de criação ao clicar em "Nova Categoria"', async () => {
    vi.mocked(adminApi.get).mockResolvedValueOnce(mockCategorias)

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    // Aguardar carregar
    await waitFor(() => {
      expect(screen.getByText('Categoria Teste 1')).toBeInTheDocument()
    })

    // Clicar em Nova Categoria (botão no header)
    const buttons = screen.getAllByRole('button', { name: /nova categoria/i })
    const headerButton = buttons.find(btn => !btn.closest('[role="dialog"]'))
    expect(headerButton).toBeDefined()
    await user.click(headerButton!)

    // Verificar se dialog abriu
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Verificar campos do formulário
    expect(screen.getByLabelText(/^nome$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/códigos de documentos/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/formato json/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ativo/i)).toBeInTheDocument()
  })

  it('deve criar nova categoria com sucesso', async () => {
    vi.mocked(adminApi.get).mockResolvedValueOnce(mockCategorias)
    vi.mocked(adminApi.post).mockResolvedValueOnce({ id: 3 })
    vi.mocked(adminApi.get).mockResolvedValueOnce([...mockCategorias]) // Reload após criar

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    // Aguardar carregar
    await waitFor(() => {
      expect(screen.getByText('Categoria Teste 1')).toBeInTheDocument()
    })

    // Abrir dialog de criação
    const buttons = screen.getAllByRole('button', { name: /nova categoria/i })
    const headerButton = buttons.find(btn => !btn.closest('[role="dialog"]'))
    await user.click(headerButton!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Preencher formulário
    const nomeInput = screen.getByLabelText(/^nome$/i)
    const descricaoInput = screen.getByLabelText(/descrição/i)
    const codigosInput = screen.getByLabelText(/códigos de documentos/i)
    const formatoInput = screen.getByLabelText(/formato json/i)

    await user.clear(nomeInput)
    await user.type(nomeInput, 'Nova Categoria')
    await user.clear(descricaoInput)
    await user.type(descricaoInput, 'Descrição da nova categoria')
    await user.clear(codigosInput)
    await user.type(codigosInput, '40, 50')
    await user.clear(formatoInput)
    await user.paste('{"campo": "string"}')

    // Clicar em Criar
    const criarButton = screen.getByRole('button', { name: /criar/i })
    await user.click(criarButton)

    // Verificar se chamou API de criação
    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json',
        expect.objectContaining({
          nome: 'Nova Categoria',
          descricao: 'Descrição da nova categoria',
          codigos_documento: ['40', '50'],
          formato_json: { campo: 'string' },
          ativo: true
        })
      )
    })

    // Verificar se mostrou toast de sucesso
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sucesso',
        description: 'Categoria criada com sucesso'
      })
    )

    // Verificar se recarregou categorias
    expect(adminApi.get).toHaveBeenCalledTimes(2)
  })

  it('deve editar categoria existente', async () => {
    const categoriaCompleta = {
      ...mockCategorias[0],
      codigos_documento: ['10', '20']
    }

    vi.mocked(adminApi.get)
      .mockResolvedValueOnce(mockCategorias) // Lista inicial
      .mockResolvedValueOnce(categoriaCompleta) // Detalhes da categoria
      .mockResolvedValueOnce(mockCategorias) // Reload após editar

    vi.mocked(adminApi.put).mockResolvedValueOnce({ id: 1 })

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    // Aguardar carregar
    await waitFor(() => {
      expect(screen.getByText('Categoria Teste 1')).toBeInTheDocument()
    })

    // Clicar em Editar na primeira categoria
    const editButtons = screen.getAllByRole('button', { name: /editar/i })
    await user.click(editButtons[0])

    // Aguardar dialog abrir
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/editar categoria/i)).toBeInTheDocument()
    })

    // Verificar se carregou dados da categoria
    expect(adminApi.get).toHaveBeenCalledWith('/admin/api/categorias-resumo-json/1')

    // Aguardar campos serem populados
    await waitFor(() => {
      const nomeInput = screen.getByLabelText(/^nome$/i) as HTMLInputElement
      expect(nomeInput.value).toBe('Categoria Teste 1')
    }, { timeout: 3000 })

    // Modificar nome
    const nomeInput = screen.getByLabelText(/^nome$/i)
    await user.clear(nomeInput)
    await user.type(nomeInput, 'Categoria Editada')

    // Clicar em Atualizar
    const atualizarButton = screen.getByRole('button', { name: /atualizar/i })
    await user.click(atualizarButton)

    // Verificar se chamou API de atualização
    await waitFor(() => {
      expect(adminApi.put).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/1',
        expect.objectContaining({
          nome: 'Categoria Editada'
        })
      )
    })

    // Verificar toast de sucesso
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sucesso',
        description: 'Categoria atualizada com sucesso'
      })
    )
  })

  it('deve excluir categoria após confirmação', async () => {
    vi.mocked(adminApi.get)
      .mockResolvedValueOnce(mockCategorias) // Lista inicial
      .mockResolvedValueOnce([mockCategorias[1]]) // Reload após excluir

    vi.mocked(adminApi.delete).mockResolvedValueOnce(undefined)

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    // Aguardar carregar
    await waitFor(() => {
      expect(screen.getByText('Categoria Teste 1')).toBeInTheDocument()
    })

    // Clicar em Excluir na primeira categoria
    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i })
    await user.click(deleteButtons[0])

    // Aguardar dialog de confirmação
    await waitFor(() => {
      expect(screen.getByText(/confirmar exclusão/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Confirmar exclusão - pegar botão dentro do dialog de confirmação
    const dialogs = screen.getAllByRole('dialog')
    const deleteDialog = dialogs.find(d => d.textContent?.includes('Confirmar Exclusão'))
    expect(deleteDialog).toBeDefined()

    const confirmarButtons = screen.getAllByRole('button', { name: /excluir/i })
    const confirmarButton = confirmarButtons.find(btn => btn.closest('[role="dialog"]') === deleteDialog)
    expect(confirmarButton).toBeDefined()
    await user.click(confirmarButton!)

    // Verificar se chamou API de exclusão
    await waitFor(() => {
      expect(adminApi.delete).toHaveBeenCalledWith('/admin/api/categorias-resumo-json/1')
    })

    // Verificar toast de sucesso
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sucesso',
        description: 'Categoria excluída com sucesso'
      })
    )

    // Verificar se recarregou categorias
    expect(adminApi.get).toHaveBeenCalledTimes(2)
  })

  it('deve validar JSON inválido no formulário', async () => {
    vi.mocked(adminApi.get).mockResolvedValueOnce(mockCategorias)

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    // Aguardar carregar
    await waitFor(() => {
      expect(screen.getByText('Categoria Teste 1')).toBeInTheDocument()
    })

    // Abrir dialog de criação
    const buttons = screen.getAllByRole('button', { name: /nova categoria/i })
    const headerButton = buttons.find(btn => !btn.closest('[role="dialog"]'))
    await user.click(headerButton!)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Preencher com JSON inválido
    const formatoInput = screen.getByLabelText(/formato json/i)
    await user.clear(formatoInput)
    await user.paste('{invalid json}')

    // Tentar criar
    const criarButton = screen.getByRole('button', { name: /criar/i })
    await user.click(criarButton)

    // Verificar mensagem de erro
    await waitFor(() => {
      expect(screen.getByText(/json inválido/i)).toBeInTheDocument()
    })

    // Verificar toast de erro
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erro',
        description: 'Corrija os erros de JSON antes de salvar',
        variant: 'destructive'
      })
    )

    // Não deve ter chamado API de criação
    expect(adminApi.post).not.toHaveBeenCalled()
  })

  it('deve exibir mensagem quando não há categorias', async () => {
    vi.mocked(adminApi.get).mockResolvedValueOnce([])

    render(<CategoriasJsonPage />)

    // Aguardar carregar
    await waitFor(() => {
      expect(screen.getByText(/nenhuma categoria cadastrada/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('deve exibir erro ao falhar no carregamento', async () => {
    vi.mocked(adminApi.get).mockRejectedValueOnce(new Error('Erro de rede'))

    render(<CategoriasJsonPage />)

    // Aguardar erro
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erro',
          description: 'Erro ao carregar categorias',
          variant: 'destructive'
        })
      )
    }, { timeout: 3000 })
  })
})
