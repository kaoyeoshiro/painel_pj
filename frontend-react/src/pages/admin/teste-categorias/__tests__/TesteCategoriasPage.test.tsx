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
    post: vi.fn()
  }
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

    expect(screen.getByText('Teste de Categorias')).toBeInTheDocument()
    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/0000000-00.0000.0.00.0000/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Validar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Classificar/i })).toBeInTheDocument()
  })

  it('deve carregar categorias ao montar o componente', async () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)

    render(<TesteCategoriasPage />)

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/teste-categorias/categorias-ativas'
      )
    })

    // Verificar que o select não está mais disabled após carregar
    const selectTrigger = screen.getByRole('combobox')
    expect(selectTrigger).not.toBeDisabled()
  })

  it('deve validar processos e exibir badges corretos', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)
    vi.mocked(adminApi.post).mockResolvedValue(mockProcessosValidados)

    render(<TesteCategoriasPage />)

    // Digitar números de processo
    const textarea = screen.getByPlaceholderText(/0000000-00.0000.0.00.0000/i)
    await user.type(textarea, '0000000-00.0000.0.00.0000{Enter}invalido')

    // Clicar em validar
    const btnValidar = screen.getByRole('button', { name: /Validar/i })
    await user.click(btnValidar)

    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/teste-categorias/validar-processos',
        { processos: ['0000000-00.0000.0.00.0000', 'invalido'] }
      )
    })

    // Verificar badges
    await waitFor(() => {
      const badges = screen.getAllByText(/válido|inválido/i)
      expect(badges).toHaveLength(2)
      expect(screen.getByText('válido')).toBeInTheDocument()
      expect(screen.getByText('inválido')).toBeInTheDocument()
    })
  })

  it('deve classificar processos e exibir resultados', async () => {
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

    // Selecionar categoria - click no trigger para abrir
    const selectTrigger = screen.getByRole('combobox')
    await user.click(selectTrigger)

    // Aguardar opções aparecerem e clicar na categoria
    await waitFor(() => {
      expect(screen.getByText('Categoria A')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Categoria A'))

    // Digitar e validar processos
    const textarea = screen.getByPlaceholderText(/0000000-00.0000.0.00.0000/i)
    await user.type(textarea, '0000000-00.0000.0.00.0000')
    await user.click(screen.getByRole('button', { name: /Validar/i }))

    await waitFor(() => {
      expect(screen.getByText('válido')).toBeInTheDocument()
    })

    // Classificar
    const btnClassificar = screen.getByRole('button', { name: /Classificar/i })
    expect(btnClassificar).not.toBeDisabled()

    await user.click(btnClassificar)

    // Aguardar chamada da API de classificação
    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json/teste-categorias/classificar',
        {
          processos: ['0000000-00.0000.0.00.0000'],
          categoria_id: 1
        }
      )
    }, { timeout: 3000 })

    // Verificar que resultados foram exibidos
    await waitFor(() => {
      expect(screen.getByText('JSON Extraído:')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('valor1')).toBeInTheDocument()
    expect(screen.getByText(/gemini/i)).toBeInTheDocument()
  })

  it('deve desabilitar botão classificar quando não há processos válidos', async () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)

    render(<TesteCategoriasPage />)

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled()
    })

    const btnClassificar = screen.getByRole('button', { name: /Classificar/i })
    expect(btnClassificar).toBeDisabled()
  })

  it('deve exibir mensagem de erro quando classificação falha', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.get).mockResolvedValue(mockCategorias)
    vi.mocked(adminApi.post)
      .mockResolvedValueOnce(mockProcessosValidados)
      .mockResolvedValueOnce([
        {
          ...mockResultados[0],
          status: 'erro' as const,
          erro: 'Erro ao processar'
        }
      ])

    render(<TesteCategoriasPage />)

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled()
    })

    // Selecionar categoria
    const selectTrigger = screen.getByRole('combobox')
    await user.click(selectTrigger)

    await waitFor(() => {
      expect(screen.getByText('Categoria A')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Categoria A'))

    // Validar e classificar
    const textarea = screen.getByPlaceholderText(/0000000-00.0000.0.00.0000/i)
    await user.type(textarea, '0000000-00.0000.0.00.0000')
    await user.click(screen.getByRole('button', { name: /Validar/i }))

    await waitFor(() => {
      expect(screen.getByText('válido')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Classificar/i }))

    // Verificar erro
    await waitFor(() => {
      expect(screen.getByText('Erro ao processar')).toBeInTheDocument()
    })
  })
})
