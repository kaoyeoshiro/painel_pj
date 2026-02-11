import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TesteCategoriasPage } from '../TesteCategoriasPage'
import { adminApi } from '@/lib/api'

// Mock pointer capture and scrollIntoView for Radix UI
Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  value: vi.fn().mockReturnValue(false),
  writable: true
})

Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
})

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    blob: vi.fn()
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('TesteCategoriasPage', () => {
  const mockCategorias = [
    { id: 1, nome: 'Categoria A' },
    { id: 2, nome: 'Categoria B' }
  ]

  const mockProcessosValidados = [
    {
      original: '0000000-00.0000.0.00.0000',
      normalizado: '0000000-00.0000.0.00.0000',
      valido: true,
      erro: null
    },
    {
      original: 'invalido',
      normalizado: null,
      valido: false,
      erro: 'Formato inválido'
    }
  ]

  const mockResultados = [
    {
      processo: '0000000-00.0000.0.00.0000',
      categoria_id: 1,
      json_extraido: { campo1: 'valor1', campo2: 'valor2' },
      modelo_usado: 'gemini-1.5-flash',
      tempo_segundos: 1.23,
      tokens_usados: 450,
      status: 'ok' as const
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar o título e elementos principais', async () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)

    render(<TesteCategoriasPage />)

    expect(screen.getByText('Ambiente de Teste de Categorias')).toBeInTheDocument()
    expect(screen.getByText('Teste e valide a extracao de JSON por categoria')).toBeInTheDocument()
    expect(screen.getByText('Categoria:')).toBeInTheDocument()
  })

  it('deve carregar categorias ao montar o componente', async () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)

    render(<TesteCategoriasPage />)

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/teste-categorias/categorias-ativas'
      )
    })

    // Verificar que at least one combobox exists (category select)
    const selectTriggers = screen.getAllByRole('combobox')
    expect(selectTriggers.length).toBeGreaterThan(0)
  })

  it('deve adicionar processos e exibir na lista de pendentes', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)
    vi.mocked(adminApi.post).mockResolvedValue(mockProcessosValidados)

    render(<TesteCategoriasPage />)

    // Digitar números de processo no textarea
    const textarea = screen.getByPlaceholderText(/Cole os numeros aqui/i)
    await user.type(textarea, '0000000-00.0000.0.00.0000{Enter}invalido')

    // Clicar em Adicionar
    const btnAdicionar = screen.getByRole('button', { name: /Adicionar/i })
    await user.click(btnAdicionar)

    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/teste-categorias/validar-processos',
        { processos: ['0000000-00.0000.0.00.0000', 'invalido'] }
      )
    })
  })

  it('deve classificar processos quando categoria está selecionada', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)
    vi.mocked(adminApi.post)
      .mockResolvedValueOnce(mockProcessosValidados)
      .mockResolvedValueOnce(mockResultados)

    render(<TesteCategoriasPage />)

    // Aguardar carregamento de categorias
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled()
    })

    // Selecionar categoria - click no first combobox trigger to open (the category select)
    const selectTriggers = screen.getAllByRole('combobox')
    await user.click(selectTriggers[0])

    // Aguardar opções aparecerem e clicar na categoria
    await waitFor(() => {
      expect(screen.getByText('Categoria A')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Categoria A'))

    // Digitar e adicionar processos
    const textarea = screen.getByPlaceholderText(/Cole os numeros aqui/i)
    await user.type(textarea, '0000000-00.0000.0.00.0000')
    await user.click(screen.getByRole('button', { name: /Adicionar/i }))

    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/teste-categorias/validar-processos',
        expect.any(Object)
      )
    })

    // Classificar
    const btnClassificar = screen.getByRole('button', { name: /Classificar Pendentes/i })
    await user.click(btnClassificar)

    // Aguardar chamada da API de classificação
    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/teste-categorias/classificar',
        expect.objectContaining({
          processos: ['0000000-00.0000.0.00.0000'],
          categoria_id: 1
        })
      )
    }, { timeout: 3000 })
  })

  it('deve exibir as tabs de navegação', async () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)

    render(<TesteCategoriasPage />)

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled()
    })

    // Verificar as tabs (custom buttons)
    expect(screen.getByText(/Resultados/)).toBeInTheDocument()
    expect(screen.getByText('Visualizacao')).toBeInTheDocument()
    expect(screen.getByText('Progresso')).toBeInTheDocument()
  })

  it('deve exibir seção Adicionar Processos', async () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)

    render(<TesteCategoriasPage />)

    expect(screen.getByText('Adicionar Processos')).toBeInTheDocument()
  })

  it('deve exibir seção de Observações', async () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)

    render(<TesteCategoriasPage />)

    expect(screen.getByText('Observacoes')).toBeInTheDocument()
  })
})
