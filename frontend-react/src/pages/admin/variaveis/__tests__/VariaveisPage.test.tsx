import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariaveisPage } from '../VariaveisPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('VariaveisPage', () => {
  const mockResumo = {
    total: 15,
    variaveis_com_uso: 10,
    variaveis_sem_uso: 5,
    distribuicao_tipos: {
      text: 8,
      number: 3,
      choice: 2,
      boolean: 1,
      date: 1,
    },
  }

  const mockVariaveis = [
    {
      id: 1,
      slug: 'valor_causa',
      label: 'Valor da Causa',
      tipo: 'number',
      descricao: 'Valor monetário da causa',
      opcoes: null,
      categoria_id: 1,
      categoria_nome: 'Dados do Processo',
      ativo: true,
      em_uso_json: true,
      uso_count_prompts: 3,
    },
    {
      id: 2,
      slug: 'tipo_acao',
      label: 'Tipo de Ação',
      tipo: 'choice',
      descricao: 'Classificação da ação',
      opcoes: ['Cível', 'Penal', 'Trabalhista'],
      categoria_id: 1,
      categoria_nome: 'Dados do Processo',
      ativo: true,
      em_uso_json: false,
      uso_count_prompts: 5,
    },
    {
      id: 3,
      slug: 'observacoes',
      label: 'Observações',
      tipo: 'text',
      descricao: null,
      opcoes: null,
      categoria_id: null,
      categoria_nome: null,
      ativo: true,
      em_uso_json: false,
      uso_count_prompts: 0,
    },
  ]

  const mockCategorias = [
    { id: 1, nome: 'Dados do Processo' },
    { id: 2, nome: 'Partes' },
    { id: 3, nome: 'Valores' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Configurar mocks padrão
    vi.mocked(adminApi.get).mockImplementation((url: string) => {
      if (url === '/admin/api/extraction/variaveis/resumo') {
        return Promise.resolve(mockResumo)
      }
      if (url.startsWith('/admin/api/extraction/variaveis?')) {
        return Promise.resolve(mockVariaveis)
      }
      if (url.startsWith('/admin/api/categorias-resumo-json')) {
        return Promise.resolve(mockCategorias)
      }
      return Promise.reject(new Error('URL não mockada'))
    })
  })

  it('deve renderizar a página com resumo e variáveis', async () => {
    render(<VariaveisPage />)

    // Verificar título
    expect(screen.getByText('Gerenciar Variáveis')).toBeInTheDocument()

    // Aguardar carregamento dos dados
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument() // Total
    })

    // Verificar cards de resumo
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Em Uso')).toBeInTheDocument()
    expect(screen.getByText('Sem Uso')).toBeInTheDocument()
    expect(screen.getByText('Tipos')).toBeInTheDocument()

    expect(screen.getByText('10')).toBeInTheDocument() // Em uso
    expect(screen.getByText('5')).toBeInTheDocument() // Sem uso

    // Verificar que as variáveis foram carregadas
    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
      expect(screen.getByText('Valor da Causa')).toBeInTheDocument()
      expect(screen.getByText('tipo_acao')).toBeInTheDocument()
      expect(screen.getByText('observacoes')).toBeInTheDocument()
    })

    // Verificar chamadas à API
    expect(adminApi.get).toHaveBeenCalledWith('/admin/api/extraction/variaveis/resumo')
    expect(adminApi.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/api/extraction/variaveis?')
    )
    expect(adminApi.get).toHaveBeenCalledWith(
      '/admin/api/categorias-resumo-json?apenas_com_variaveis=true'
    )
  })

  it('deve abrir dialog ao clicar em Nova Variável', async () => {
    const user = userEvent.setup()
    render(<VariaveisPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    // Clicar no botão Nova Variável
    const novaVariavelBtn = screen.getByRole('button', { name: /nova variável/i })
    await user.click(novaVariavelBtn)

    // Verificar que o dialog foi aberto - usar getAllByText e verificar que há mais de um
    await waitFor(() => {
      const titles = screen.getAllByText('Nova Variável')
      expect(titles.length).toBeGreaterThan(0)
      expect(screen.getByText('Crie uma nova variável de extração')).toBeInTheDocument()
    })

    // Verificar campos do formulário - usando IDs específicos
    expect(screen.getByLabelText('Slug *')).toBeInTheDocument()
    expect(screen.getByLabelText('Label *')).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo *')).toBeInTheDocument()
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument()
  })

  it('deve criar uma nova variável com sucesso', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.post).mockResolvedValue({ id: 4 })

    render(<VariaveisPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    // Abrir dialog
    const novaVariavelBtn = screen.getByRole('button', { name: /nova variável/i })
    await user.click(novaVariavelBtn)

    // Preencher formulário - usar labels específicas
    await waitFor(() => {
      expect(screen.getByLabelText('Slug *')).toBeInTheDocument()
    })

    const slugInput = screen.getByLabelText('Slug *')
    const labelInput = screen.getByLabelText('Label *')
    const descricaoInput = screen.getByLabelText('Descrição')

    await user.type(slugInput, 'nova_variavel')
    await user.type(labelInput, 'Nova Variável')
    await user.type(descricaoInput, 'Descrição da nova variável')

    // Salvar
    const salvarBtn = screen.getByRole('button', { name: /salvar/i })
    await user.click(salvarBtn)

    // Verificar chamada à API
    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/extraction/variaveis',
        expect.objectContaining({
          slug: 'nova_variavel',
          label: 'Nova Variável',
          descricao: 'Descrição da nova variável',
          tipo: 'text',
          ativo: true,
        })
      )
    })

    // Verificar que recarregou os dados
    expect(adminApi.get).toHaveBeenCalledWith('/admin/api/extraction/variaveis/resumo')
  })

  it('deve filtrar variáveis por busca', async () => {
    const user = userEvent.setup()
    render(<VariaveisPage />)

    // Aguardar carregamento inicial
    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    // Limpar mock para contar novas chamadas
    vi.clearAllMocks()
    vi.mocked(adminApi.get).mockImplementation((url: string) => {
      if (url === '/admin/api/extraction/variaveis/resumo') {
        return Promise.resolve(mockResumo)
      }
      if (url.startsWith('/admin/api/extraction/variaveis?')) {
        return Promise.resolve([mockVariaveis[0]]) // Retornar apenas valor_causa
      }
      if (url.startsWith('/admin/api/categorias-resumo-json')) {
        return Promise.resolve(mockCategorias)
      }
      return Promise.reject(new Error('URL não mockada'))
    })

    // Buscar por "valor"
    const buscaInput = screen.getByPlaceholderText(/slug ou label/i)
    await user.type(buscaInput, 'valor')

    // Verificar que chamou a API com o filtro
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith(
        expect.stringContaining('busca=valor')
      )
    })
  })

  it('deve abrir dialog de edição ao clicar em Editar', async () => {
    const user = userEvent.setup()
    render(<VariaveisPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    // Clicar no botão Editar da primeira variável
    const editarBtns = screen.getAllByRole('button', { name: /editar/i })
    await user.click(editarBtns[0])

    // Verificar que o dialog foi aberto com os dados corretos
    await waitFor(() => {
      expect(screen.getByText('Editar Variável')).toBeInTheDocument()
      expect(screen.getByText('Atualize os dados da variável de extração')).toBeInTheDocument()
    })

    // Verificar que os campos estão preenchidos - usar labels específicas
    const slugInput = screen.getByLabelText('Slug *') as HTMLInputElement
    expect(slugInput.value).toBe('valor_causa')
    expect(slugInput).toBeDisabled() // Slug não pode ser editado

    const labelInput = screen.getByLabelText('Label *') as HTMLInputElement
    expect(labelInput.value).toBe('Valor da Causa')
  })

  it('deve excluir uma variável com confirmação', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.delete).mockResolvedValue({})

    render(<VariaveisPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('observacoes')).toBeInTheDocument()
    })

    // Clicar no botão Excluir da última variável (observacoes)
    const excluirBtns = screen.getAllByRole('button', { name: /excluir/i })
    await user.click(excluirBtns[2]) // Terceira variável

    // Verificar dialog de confirmação
    await waitFor(() => {
      expect(screen.getByText('Confirmar exclusão')).toBeInTheDocument()
      // Verificar que o texto de confirmação aparece (texto está dentro de um <strong>)
      const confirmText = screen.getByText(/tem certeza que deseja excluir/i)
      expect(confirmText).toBeInTheDocument()
    })

    // Confirmar exclusão - pegar todos os botões excluir e usar o último (do dialog)
    const allExcluirBtns = screen.getAllByRole('button', { name: /excluir/i })
    const confirmarBtn = allExcluirBtns[allExcluirBtns.length - 1]
    await user.click(confirmarBtn)

    // Verificar chamada à API
    await waitFor(() => {
      expect(adminApi.delete).toHaveBeenCalledWith('/admin/api/extraction/variaveis/3')
    })

    // Verificar que recarregou os dados
    expect(adminApi.get).toHaveBeenCalledWith('/admin/api/extraction/variaveis/resumo')
  })

  it('deve exibir campo de opções para tipo choice', async () => {
    render(<VariaveisPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    // Editar uma variável do tipo choice (tipo_acao)
    const editarBtns = screen.getAllByRole('button', { name: /editar/i })
    await userEvent.click(editarBtns[1]) // Segunda variável (tipo_acao, tipo choice)

    // Verificar que campo de opções está visível (variável é tipo choice)
    await waitFor(() => {
      expect(screen.getByLabelText(/opções/i)).toBeInTheDocument()
    })

    // Verificar que as opções estão preenchidas
    const opcoesTextarea = screen.getByLabelText(/opções/i) as HTMLTextAreaElement
    expect(opcoesTextarea.value).toContain('Cível')
    expect(opcoesTextarea.value).toContain('Penal')
    expect(opcoesTextarea.value).toContain('Trabalhista')
  })
})
