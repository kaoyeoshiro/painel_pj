import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TesteAtivacaoPage } from '../TesteAtivacaoPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('TesteAtivacaoPage', () => {
  const mockTiposPeca = [
    { slug: 'peticao_inicial', nome: 'Petição Inicial' },
    { slug: 'contestacao', nome: 'Contestação' },
  ]

  const mockCategorias = [
    {
      id: 1,
      titulo: 'Categoria A',
      variaveis: [
        { slug: 'var_a1', label: 'Variável A1', tipo: 'boolean' },
        { slug: 'var_a2', label: 'Variável A2', tipo: 'text' },
      ],
    },
    {
      id: 2,
      titulo: 'Categoria B',
      variaveis: [
        { slug: 'var_b1', label: 'Variável B1', tipo: 'number' },
      ],
    },
  ]

  const mockVariaveis = [
    { slug: 'var_global', label: 'Variável Global', tipo: 'text' },
  ]

  const mockCenarios: unknown[] = []

  const mockResultado = {
    modulos_ativados: [
      {
        id: 1,
        titulo: 'Módulo Ativado',
        grupo: 'Grupo A',
        modo: 'automático',
        ativado: true,
        regra_usada: 'regra_1',
        detalhes: 'Detalhes do módulo',
      },
    ],
    modulos_nao_ativados: [
      {
        id: 2,
        titulo: 'Módulo Não Ativado',
        grupo: 'Grupo B',
        modo: 'manual',
        ativado: false,
        detalhes: 'Não atende critérios',
      },
    ],
    totais: {
      ativados: 1,
      nao_ativados: 1,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock inicial para as 4 chamadas GET (tipos-peca, categorias, variaveis, cenarios)
    vi.mocked(adminApi.get)
      .mockResolvedValueOnce(mockTiposPeca)
      .mockResolvedValueOnce(mockCategorias)
      .mockResolvedValueOnce(mockVariaveis)
      .mockResolvedValueOnce(mockCenarios)
  })

  it('renders title and main elements', async () => {
    render(<TesteAtivacaoPage />)

    // Verificar título (sem acentos no componente)
    expect(screen.getByText('Teste de Ativacao de Modulos')).toBeInTheDocument()
    expect(
      screen.getByText('Simule ativacao de prompts com variaveis de teste')
    ).toBeInTheDocument()

    // Aguardar carregamento
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/teste-ativacao/tipos-peca')
    })
  })

  it('loads and displays tipos de peca', async () => {
    render(<TesteAtivacaoPage />)

    // Aguardar carregamento dos tipos
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/teste-ativacao/tipos-peca')
    })

    // Verificar que o label de tipo de peça está renderizado
    expect(screen.getByText('Tipo de Peca:')).toBeInTheDocument()
  })

  it('loads and displays categorias de extracao', async () => {
    render(<TesteAtivacaoPage />)

    // Aguardar carregamento das categorias
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/teste-ativacao/categorias-extracao')
    })

    // Verificar que as categorias foram renderizadas
    await waitFor(() => {
      expect(screen.getByText('Categoria A')).toBeInTheDocument()
    })
    expect(screen.getByText('Categoria B')).toBeInTheDocument()
  })

  it('shows variaveis when categoria is selected', async () => {
    const user = userEvent.setup()
    render(<TesteAtivacaoPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('Categoria A')).toBeInTheDocument()
    })

    // Selecionar categoria A using checkbox label
    const checkboxLabel = screen.getByText('Categoria A')
    await user.click(checkboxLabel)

    // Clicar na aba Variáveis Extracao (custom button tab, not role="tab")
    const tabVariaveis = screen.getByText('Variaveis Extracao')
    await user.click(tabVariaveis)

    // Verificar que as variáveis da categoria A aparecem
    await waitFor(() => {
      expect(screen.getByText('Variável A1')).toBeInTheDocument()
    })
    expect(screen.getByText('Variável A2')).toBeInTheDocument()
  })

  it('executes simulation and shows results', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.post).mockResolvedValue(mockResultado)

    render(<TesteAtivacaoPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('Categoria A')).toBeInTheDocument()
    })

    // Selecionar categoria
    const checkboxLabel = screen.getByText('Categoria A')
    await user.click(checkboxLabel)

    // Clicar no botão SIMULAR ATIVACAO
    const botaoSimular = screen.getByRole('button', { name: /SIMULAR ATIVACAO/i })
    await user.click(botaoSimular)

    // Verificar chamada à API
    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith('/teste-ativacao/simular', expect.any(Object))
    })

    // Os resultados devem ser mostrados na aba Resultados (auto-switched)
    await waitFor(() => {
      expect(screen.getByText('Módulo Ativado')).toBeInTheDocument()
    })
    expect(screen.getByText('Módulo Não Ativado')).toBeInTheDocument()
    expect(screen.getByText('Grupo A')).toBeInTheDocument()
    expect(screen.getByText('Grupo B')).toBeInTheDocument()
  })

  it('shows loading state correctly', () => {
    // Mock com delay para simular loading
    vi.mocked(adminApi.get).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    )

    render(<TesteAtivacaoPage />)

    // Verificar estados de loading
    expect(screen.getAllByText('Carregando...').length).toBeGreaterThan(0)
  })

  it('handles API error gracefully', async () => {
    vi.mocked(adminApi.get).mockRejectedValue(new Error('Erro na API'))

    const { container } = render(<TesteAtivacaoPage />)

    // Aguardar tentativa de carregamento
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled()
    })

    // Verificar que a página ainda renderiza
    expect(screen.getByText('Teste de Ativacao de Modulos')).toBeInTheDocument()
    expect(container).toBeTruthy()
  })

  it('disables simular button when loading', async () => {
    // Mock com delay para tipos de peça
    vi.mocked(adminApi.get)
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve([]), 100)))
      .mockResolvedValueOnce(mockCategorias)
      .mockResolvedValueOnce(mockVariaveis)
      .mockResolvedValueOnce(mockCenarios)

    render(<TesteAtivacaoPage />)

    // Verificar que o botão está desabilitado durante o loading
    const botaoSimular = screen.getByRole('button', { name: /SIMULAR ATIVACAO/i })
    expect(botaoSimular).toBeDisabled()

    // Aguardar carregamento completo
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/teste-ativacao/tipos-peca')
    })
  })
})
