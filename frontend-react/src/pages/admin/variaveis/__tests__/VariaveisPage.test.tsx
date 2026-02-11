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

  it('deve renderizar a página com título e resumo', async () => {
    render(<VariaveisPage />)

    // Verificar título
    expect(screen.getByText('Painel de Variaveis')).toBeInTheDocument()
    expect(screen.getByText('Variaveis de extracao do sistema')).toBeInTheDocument()

    // Aguardar carregamento dos dados
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument() // Total
    })

    // Verificar cards de resumo
    expect(screen.getByText('Total de Variaveis')).toBeInTheDocument()
    expect(screen.getByText('Em Uso')).toBeInTheDocument()
    expect(screen.getByText('Sem Uso')).toBeInTheDocument()
    expect(screen.getByText('Tipos')).toBeInTheDocument()

    expect(screen.getByText('10')).toBeInTheDocument() // Em uso
    // '5' appears in both "Sem Uso" card and "Tipos" card (5 types), so use getAllByText
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(2) // Sem uso + Tipos
  })

  it('deve carregar e exibir variáveis na tabela', async () => {
    render(<VariaveisPage />)

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

  it('deve exibir cabeçalhos da tabela', async () => {
    render(<VariaveisPage />)

    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    // Verificar cabeçalhos
    expect(screen.getByText('Slug')).toBeInTheDocument()
    expect(screen.getByText('Label')).toBeInTheDocument()
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Uso')).toBeInTheDocument()
  })

  it('deve exibir badges de tipo corretamente', async () => {
    render(<VariaveisPage />)

    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    // Verificar que os tipos são traduzidos
    expect(screen.getByText('Numero')).toBeInTheDocument()
    expect(screen.getByText('Escolha')).toBeInTheDocument()
    expect(screen.getByText('Texto')).toBeInTheDocument()
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
    const buscaInput = screen.getByPlaceholderText(/slug.*label/i)
    await user.type(buscaInput, 'valor')

    // Verificar que chamou a API com o filtro
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith(
        expect.stringContaining('busca=valor')
      )
    })
  })

  it('deve exibir Nova Variavel button', async () => {
    render(<VariaveisPage />)

    await waitFor(() => {
      expect(screen.getByText('valor_causa')).toBeInTheDocument()
    })

    expect(screen.getByText('Nova Variavel')).toBeInTheDocument()
  })

  it('deve exibir links de navegação via AdminSubNav', async () => {
    render(<VariaveisPage />)

    expect(screen.getByText('Categorias')).toBeInTheDocument()
    expect(screen.getByText('Módulos')).toBeInTheDocument()
  })

  it('deve exibir estado vazio quando não há variáveis', async () => {
    vi.mocked(adminApi.get).mockImplementation((url: string) => {
      if (url === '/admin/api/extraction/variaveis/resumo') {
        return Promise.resolve({ total: 0, variaveis_com_uso: 0, variaveis_sem_uso: 0, distribuicao_tipos: {} })
      }
      if (url.startsWith('/admin/api/extraction/variaveis?')) {
        return Promise.resolve([])
      }
      if (url.startsWith('/admin/api/categorias-resumo-json')) {
        return Promise.resolve([])
      }
      return Promise.reject(new Error('URL não mockada'))
    })

    render(<VariaveisPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma variavel encontrada')).toBeInTheDocument()
    })
  })
})
