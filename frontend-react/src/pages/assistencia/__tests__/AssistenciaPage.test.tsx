import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AssistenciaPage } from '../AssistenciaPage'
import * as api from '@/lib/api'

// Mock do módulo de API
vi.mock('@/lib/api', () => ({
  assistenciaApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    blob: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock de dados
const mockHistorico = [
  {
    id: 1,
    cnj: '0800123-45.2024.8.12.0001',
    classe: 'Ação Civil Pública',
    data: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    cnj: '0800456-78.2024.8.12.0002',
    classe: 'Mandado de Segurança',
    data: '2024-01-16T14:30:00Z',
  },
]

describe('AssistenciaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar sem erros', async () => {
    // Mock da API retornando histórico vazio
    vi.mocked(api.assistenciaApi.get).mockResolvedValue([])

    render(<AssistenciaPage />)

    // Verifica elementos principais
    expect(screen.getByText('Assistência Judiciária')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0000000-00.0000.0.00.0000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /consultar/i })).toBeInTheDocument()
  })

  it('deve mostrar loading enquanto busca histórico', async () => {
    // Mock da API com delay
    vi.mocked(api.assistenciaApi.get).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    )

    render(<AssistenciaPage />)

    // Verifica se mostra skeleton durante carregamento
    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  it('deve mostrar histórico quando API retorna sucesso', async () => {
    // Mock da API retornando dados
    vi.mocked(api.assistenciaApi.get).mockResolvedValue(mockHistorico)

    render(<AssistenciaPage />)

    // Aguarda o histórico carregar
    await waitFor(() => {
      expect(screen.getByText('0800123-45.2024.8.12.0001')).toBeInTheDocument()
      expect(screen.getByText('Ação Civil Pública')).toBeInTheDocument()
    })
  })

  it('deve mostrar mensagem quando não há histórico', async () => {
    // Mock da API retornando array vazio
    vi.mocked(api.assistenciaApi.get).mockResolvedValue([])

    render(<AssistenciaPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma consulta ainda')).toBeInTheDocument()
    })
  })

  it('deve exibir estado inicial por padrão', async () => {
    vi.mocked(api.assistenciaApi.get).mockResolvedValue([])

    render(<AssistenciaPage />)

    await waitFor(() => {
      expect(screen.getByText('Consulta de Processos')).toBeInTheDocument()
      expect(
        screen.getByText(/Digite o número CNJ do processo para consultar/i)
      ).toBeInTheDocument()
    })
  })
})
