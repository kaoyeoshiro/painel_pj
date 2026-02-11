import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HistoricoPedidoCalculoPage } from '../HistoricoPedidoCalculoPage'

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock do API
vi.mock('@/lib/api', () => ({
  pedidoCalculoAdminApi: {
    get: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do useMarkdown
vi.mock('@/hooks/useMarkdown', () => ({
  useMarkdown: (text: string) => ({
    html: `<p>${text || ''}</p>`,
  }),
}))

describe('HistoricoPedidoCalculoPage', () => {
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const api = await import('@/lib/api')
    mockGet = vi.mocked(api.pedidoCalculoAdminApi.get)
  })

  it('deve renderizar o titulo da pagina', async () => {
    mockGet.mockResolvedValue([])

    render(<HistoricoPedidoCalculoPage />)

    expect(screen.getByText('Histórico - Pedido de Cálculo')).toBeInTheDocument()
    expect(
      screen.getByText('Todas as gerações de pedidos de cálculo com logs de IA')
    ).toBeInTheDocument()
  })

  it('deve mostrar loading state e depois exibir dados', async () => {
    const mockData = [
      {
        id: 1,
        numero_cnj: '0000000002024812',
        numero_cnj_formatado: '0000000-00.2024.8.12.0001',
        modelo_usado: 'gemini-pro',
        tempo_processamento: 45.5,
        criado_em: '2024-01-15T10:30:00Z',
        total_logs: 3,
        tem_erro: false,
      },
      {
        id: 2,
        numero_cnj: '0000000012024812',
        numero_cnj_formatado: '0000000-01.2024.8.12.0001',
        modelo_usado: 'gemini-flash',
        tempo_processamento: 23.1,
        criado_em: '2024-01-16T14:20:00Z',
        total_logs: 2,
        tem_erro: true,
      },
    ]

    // Primeiro retorna promise pendente, depois resolve
    mockGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockData), 50)
        })
    )

    render(<HistoricoPedidoCalculoPage />)

    // Verifica que mostra loading (skeleton)
    // O DataTable mostra os headers mesmo durante loading
    expect(screen.getByText('CNJ')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()

    // Aguarda os dados aparecerem
    await waitFor(
      () => {
        expect(screen.getByText('0000000-00.2024.8.12.0001')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    expect(screen.getByText('0000000-01.2024.8.12.0001')).toBeInTheDocument()
    expect(screen.getByText('gemini-pro')).toBeInTheDocument()
    expect(screen.getByText('45.5s')).toBeInTheDocument()
    expect(screen.getByText('23.1s')).toBeInTheDocument()

    // Verifica badges de status
    const badges = screen.getAllByText(/Sucesso|Erro/)
    expect(badges).toHaveLength(2)
    expect(screen.getByText('Sucesso')).toBeInTheDocument()
    expect(screen.getByText('Erro')).toBeInTheDocument()
  })

  it('deve mostrar estado vazio quando nao ha dados', async () => {
    mockGet.mockResolvedValue([])

    render(<HistoricoPedidoCalculoPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma geracao encontrada')).toBeInTheDocument()
    })
  })

  it('deve exibir campo de busca', async () => {
    mockGet.mockResolvedValue([])

    render(<HistoricoPedidoCalculoPage />)

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Buscar por CNJ...')
      expect(searchInput).toBeInTheDocument()
    })
  })

  it('deve exibir todas as colunas da tabela', async () => {
    mockGet.mockResolvedValue([])

    render(<HistoricoPedidoCalculoPage />)

    await waitFor(() => {
      expect(screen.getByText('CNJ')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Modelo')).toBeInTheDocument()
      expect(screen.getByText('Tempo')).toBeInTheDocument()
      expect(screen.getByText('Data')).toBeInTheDocument()
      expect(screen.getByText('Logs')).toBeInTheDocument()
    })
  })

  it('deve formatar corretamente a data', async () => {
    const mockData = [
      {
        id: 1,
        numero_cnj: '0000000002024812',
        numero_cnj_formatado: '0000000-00.2024.8.12.0001',
        modelo_usado: 'gemini-pro',
        tempo_processamento: 45.5,
        criado_em: '2024-01-15T10:30:00Z',
        total_logs: 3,
        tem_erro: false,
      },
    ]

    mockGet.mockResolvedValue(mockData)

    render(<HistoricoPedidoCalculoPage />)

    await waitFor(() => {
      // Verifica que a data foi formatada (formato depende da localidade)
      const dateText = screen.getByText(/15\/01\/2024/)
      expect(dateText).toBeInTheDocument()
    })
  })

  it('deve exibir total de logs corretamente', async () => {
    const mockData = [
      {
        id: 1,
        numero_cnj: '0000000002024812',
        numero_cnj_formatado: '0000000-00.2024.8.12.0001',
        modelo_usado: 'gemini-pro',
        tempo_processamento: 45.5,
        criado_em: '2024-01-15T10:30:00Z',
        total_logs: 5,
        tem_erro: false,
      },
    ]

    mockGet.mockResolvedValue(mockData)

    render(<HistoricoPedidoCalculoPage />)

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })

  it('deve mostrar travessao quando modelo nao esta disponivel', async () => {
    const mockData = [
      {
        id: 1,
        numero_cnj: '0000000002024812',
        numero_cnj_formatado: '0000000-00.2024.8.12.0001',
        modelo_usado: undefined,
        tempo_processamento: undefined,
        criado_em: '2024-01-15T10:30:00Z',
        total_logs: 0,
        tem_erro: false,
      },
    ]

    mockGet.mockResolvedValue(mockData)

    render(<HistoricoPedidoCalculoPage />)

    await waitFor(() => {
      // Verifica que mostra o travessao para campos vazios
      const emDashes = screen.getAllByText('—')
      expect(emDashes.length).toBeGreaterThanOrEqual(2) // Modelo e Tempo
    })
  })
})
