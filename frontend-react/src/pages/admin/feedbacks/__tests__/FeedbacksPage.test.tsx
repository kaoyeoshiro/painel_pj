import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbacksPage } from '../FeedbacksPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    blob: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do useToast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock recharts (SVG components cause issues in jsdom)
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}))

describe('FeedbacksPage', () => {
  const mockDashboard = {
    total_consultas: 150,
    total_feedbacks: 120,
    taxa_acerto: 75.5,
    consultas_sem_feedback: 30,
    avaliacoes: {
      correto: 90,
      parcial: 20,
      incorreto: 10,
      erro_ia: 0,
    },
  }

  const mockEvolucao: { data: string; total: number }[] = []

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar o título da página', () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockDashboard)

    render(<FeedbacksPage />)

    expect(screen.getByText('Dashboard de Feedbacks')).toBeInTheDocument()
    // Subtítulo removido na refatoração visual — verificar botão Exportar
    expect(screen.getByText('Exportar')).toBeInTheDocument()
  })

  it('deve carregar e exibir estatísticas do dashboard', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (typeof url === 'string' && url.includes('/admin/feedbacks/evolucao')) {
        return Promise.resolve(mockEvolucao)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument() // total_consultas
      expect(screen.getByText('120')).toBeInTheDocument() // total_feedbacks
      expect(screen.getByText('30')).toBeInTheDocument() // sem_feedback
    })
  })

  it('deve exibir os cards de métricas', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (typeof url === 'string' && url.includes('/admin/feedbacks/evolucao')) {
        return Promise.resolve(mockEvolucao)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Total de Consultas')).toBeInTheDocument()
      expect(screen.getByText('Feedbacks Recebidos')).toBeInTheDocument()
      expect(screen.getByText('Taxa de Acerto')).toBeInTheDocument()
      expect(screen.getByText('Sem Avaliação')).toBeInTheDocument()
    })
  })

  it('deve exibir seção de distribuição de avaliações', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (typeof url === 'string' && url.includes('/admin/feedbacks/evolucao')) {
        return Promise.resolve(mockEvolucao)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Distribuição de Avaliações')).toBeInTheDocument()
    })
  })

  it('deve exibir filtros de período e sistema', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (typeof url === 'string' && url.includes('/admin/feedbacks/evolucao')) {
        return Promise.resolve(mockEvolucao)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    // Verificar labels de filtro (may appear multiple times in different filter sections)
    expect(screen.getAllByText('Período:').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sistema:').length).toBeGreaterThan(0)
    expect(screen.getByText('Limpar filtros')).toBeInTheDocument()
  })

  it('deve exibir botão de exportar', () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockDashboard)

    render(<FeedbacksPage />)

    expect(screen.getByText('Exportar')).toBeInTheDocument()
  })

  it('deve chamar as APIs corretas ao carregar', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (typeof url === 'string' && url.includes('/admin/feedbacks/evolucao')) {
        return Promise.resolve(mockEvolucao)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(vi.mocked(adminApi.get)).toHaveBeenCalledWith(
        expect.stringContaining('/admin/feedbacks/dashboard')
      )
      expect(vi.mocked(adminApi.get)).toHaveBeenCalledWith(
        expect.stringContaining('/admin/feedbacks/evolucao')
      )
    })
  })

  it('deve clicar no botão limpar filtros sem erros', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (typeof url === 'string' && url.includes('/admin/feedbacks/evolucao')) {
        return Promise.resolve(mockEvolucao)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const user = userEvent.setup()
    render(<FeedbacksPage />)

    // Verificar que o botão de limpar filtros está presente
    const limparButton = screen.getByText('Limpar filtros')
    expect(limparButton).toBeInTheDocument()

    // Clicar no botão não deve causar erros
    await user.click(limparButton)

    // Verificar que o botão ainda está presente após o clique
    expect(limparButton).toBeInTheDocument()
  })

  it('deve exibir seção de evolução da taxa de acerto', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (typeof url === 'string' && url.includes('/admin/feedbacks/evolucao')) {
        return Promise.resolve(mockEvolucao)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Evolução da Taxa de Acerto por Sistema')).toBeInTheDocument()
    })
  })
})
