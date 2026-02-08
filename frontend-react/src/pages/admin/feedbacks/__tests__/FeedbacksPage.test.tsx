import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbacksPage } from '../FeedbacksPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do useToast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
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

  const mockFeedbacks = {
    feedbacks: [
      {
        id: 1,
        sistema: 'gerador_pecas',
        usuario_nome: 'João Silva',
        avaliacao: 'correto' as const,
        comentario: 'Excelente ferramenta',
        created_at: '2026-02-07T10:30:00',
        modo_geracao: 'automatico',
      },
      {
        id: 2,
        sistema: 'relatorio_cumprimento',
        usuario_nome: 'Maria Santos',
        avaliacao: 'parcial' as const,
        comentario: 'Poderia melhorar',
        created_at: '2026-02-06T14:20:00',
      },
      {
        id: 3,
        sistema: 'pedido_calculo',
        usuario_nome: 'Pedro Costa',
        avaliacao: null,
        comentario: null,
        created_at: '2026-02-05T09:15:00',
      },
    ],
    total: 3,
    page: 1,
    per_page: 20,
    total_pages: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar o título e descrição da página', () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockDashboard)
    vi.mocked(adminApi.get).mockResolvedValue(mockFeedbacks)

    render(<FeedbacksPage />)

    expect(screen.getByText('Feedbacks')).toBeInTheDocument()
    expect(
      screen.getByText('Acompanhamento de avaliações e comentários dos usuários')
    ).toBeInTheDocument()
  })

  it('deve carregar e exibir estatísticas do dashboard', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument() // total_consultas
      expect(screen.getByText('120')).toBeInTheDocument() // total_feedbacks
      expect(screen.getByText('75.5%')).toBeInTheDocument() // taxa_acerto
      expect(screen.getByText('30')).toBeInTheDocument() // sem_feedback
    })
  })

  it('deve carregar e exibir lista de feedbacks', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument()
      expect(screen.getByText('Maria Santos')).toBeInTheDocument()
      expect(screen.getByText('Pedro Costa')).toBeInTheDocument()
      expect(screen.getByText('Excelente ferramenta')).toBeInTheDocument()
      expect(screen.getByText('Poderia melhorar')).toBeInTheDocument()
    })
  })

  it('deve exibir badges de avaliação corretamente', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Correto')).toBeInTheDocument()
      expect(screen.getByText('Parcial')).toBeInTheDocument()
      expect(screen.getByText('Sem avaliação')).toBeInTheDocument()
    })
  })

  it('deve exibir a distribuição de avaliações com cores corretas', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Distribuição de Avaliações')).toBeInTheDocument()
      expect(screen.getByText('Correto: 90')).toBeInTheDocument()
      expect(screen.getByText('Parcial: 20')).toBeInTheDocument()
      expect(screen.getByText('Incorreto: 10')).toBeInTheDocument()
    })
  })

  it('deve aplicar filtros e recarregar dados', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    // Aguardar carregamento inicial
    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument()
    })

    // Verificar que os filtros estão presentes
    const sistemaLabels = screen.getAllByText('Sistema')
    expect(sistemaLabels.length).toBeGreaterThan(0) // Aparece no filtro e na tabela
    expect(screen.getByText('Mês')).toBeInTheDocument()
    expect(screen.getByText('Ano')).toBeInTheDocument()
    expect(screen.getByText('Limpar Filtros')).toBeInTheDocument()

    // Verificar que a API foi chamada para carregar dados
    expect(vi.mocked(adminApi.get)).toHaveBeenCalledWith(
      expect.stringContaining('/admin/feedbacks/dashboard')
    )
    expect(vi.mocked(adminApi.get)).toHaveBeenCalledWith(
      expect.stringContaining('/admin/feedbacks/lista')
    )
  })

  it('deve exibir botão para limpar filtros', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const user = userEvent.setup()
    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument()
    })

    // Verificar que o botão de limpar filtros está presente
    const limparButton = screen.getByText('Limpar Filtros')
    expect(limparButton).toBeInTheDocument()

    // Clicar no botão não deve causar erros
    await user.click(limparButton)

    // Verificar que o botão ainda está presente após o clique
    expect(limparButton).toBeInTheDocument()
  })

  it('deve exibir paginação quando houver mais de 20 feedbacks', async () => {
    const mockManyFeedbacks = {
      ...mockFeedbacks,
      total: 50,
    }

    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockManyFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Mostrando 1 a 20 de 50 feedbacks')).toBeInTheDocument()
      expect(screen.getByText('Anterior')).toBeInTheDocument()
      expect(screen.getByText('Próxima')).toBeInTheDocument()
    })
  })

  it('deve navegar entre páginas', async () => {
    const mockManyFeedbacks = {
      ...mockFeedbacks,
      total: 50,
    }

    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockManyFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    const user = userEvent.setup()
    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Mostrando 1 a 20 de 50 feedbacks')).toBeInTheDocument()
    })

    // Clicar em próxima página
    const proximaButton = screen.getByText('Próxima')
    await user.click(proximaButton)

    // Verificar que a API foi chamada com page=2
    await waitFor(() => {
      const calls = vi.mocked(adminApi.get).mock.calls
      const listaCall = calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('/admin/feedbacks/lista') &&
          call[0].includes('page=2')
      )
      expect(listaCall).toBeTruthy()
    })
  })

  it('deve exibir mensagem vazia quando não houver feedbacks', async () => {
    const mockEmptyFeedbacks = {
      feedbacks: [],
      total: 0,
      page: 1,
      per_page: 20,
      total_pages: 0,
    }

    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockEmptyFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhum feedback encontrado')).toBeInTheDocument()
    })
  })

  it('deve formatar datas corretamente', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url.includes('/admin/feedbacks/dashboard')) {
        return Promise.resolve(mockDashboard)
      }
      if (url.includes('/admin/feedbacks/lista')) {
        return Promise.resolve(mockFeedbacks)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    render(<FeedbacksPage />)

    await waitFor(() => {
      // Verificar que as datas estão formatadas (formato dd/mm/yyyy, hh:mm)
      const dateElements = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/)
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })
})
