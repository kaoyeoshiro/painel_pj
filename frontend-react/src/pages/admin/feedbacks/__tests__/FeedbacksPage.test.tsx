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

// Mock do useMarkdown (regra CLAUDE.md)
vi.mock('@/hooks/useMarkdown', () => ({
  useMarkdown: (text: string) => ({ html: text || '' }),
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
  Legend: () => <div />,
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
    evolucao_por_sistema: {},
    feedbacks_por_usuario: [
      { nome: 'João Silva', total: 20, corretos: 15 },
      { nome: 'Maria Santos', total: 10, corretos: 8 },
    ],
    pendentes_feedback: [
      { id: 1, sistema: 'gerador_pecas', identificador: '0001234-56.2026.8.12.0001', usuario: 'João', data: '2026-02-10T14:30:00', modo_ativacao: null },
    ],
    por_sistema: {},
    filtro_aplicado: { mes: null, ano: 2026, sistema: null },
  }

  const mockFeedbackLista = {
    total: 2,
    page: 1,
    per_page: 20,
    total_pages: 1,
    feedbacks: [
      { id: 1, consulta_id: 10, sistema: 'gerador_pecas', identificador: '0001234-56.2026.8.12.0001', cnj: null, modelo: 'gemini-2.0-flash', usuario: 'João Silva', username: 'joao', avaliacao: 'correto', comentario: 'Muito bom', campos_incorretos: null, criado_em: '2026-02-10T14:30:00', modo_ativacao: null },
      { id: 2, consulta_id: 11, sistema: 'assistencia_judiciaria', identificador: '0009876-54.2026.8.12.0001', cnj: null, modelo: 'gemini-2.0-flash', usuario: 'Maria Santos', username: 'maria', avaliacao: 'parcial', comentario: null, campos_incorretos: null, criado_em: '2026-02-09T10:00:00', modo_ativacao: null },
    ],
  }

  const mockModelosIA = {
    assistencia_judiciaria: { id: 1, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
    matriculas: { id: 2, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
    gerador_pecas: { id: 3, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
    pedido_calculo: { id: 4, modelo: 'gemini-2.0-flash', descricao: 'Modelo padrão' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupMocks() {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url.includes('/admin/api/feedbacks/dashboard')) return Promise.resolve(mockDashboard)
        if (url.includes('/admin/api/feedbacks/lista')) return Promise.resolve(mockFeedbackLista)
        if (url.includes('/admin/modelos-ia')) return Promise.resolve(mockModelosIA)
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  }

  it('deve renderizar o título da página', () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockDashboard)
    render(<FeedbacksPage />)
    expect(screen.getByText('Dashboard de Feedbacks')).toBeInTheDocument()
    expect(screen.getByText('Exportar')).toBeInTheDocument()
  })

  it('deve carregar e exibir estatísticas do dashboard', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument()
      expect(screen.getByText('120')).toBeInTheDocument()
      expect(screen.getByText('30')).toBeInTheDocument()
    })
  })

  it('deve exibir os cards de métricas', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('Total de Consultas')).toBeInTheDocument()
      expect(screen.getByText('Feedbacks Recebidos')).toBeInTheDocument()
      expect(screen.getByText('Taxa de Acerto')).toBeInTheDocument()
      expect(screen.getByText('Sem Avaliação')).toBeInTheDocument()
    })
  })

  it('deve exibir seção de distribuição de avaliações', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('Distribuição de Avaliações')).toBeInTheDocument()
    })
  })

  it('deve exibir filtros de período e sistema', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    expect(screen.getAllByText('Período:').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sistema:').length).toBeGreaterThan(0)
    expect(screen.getByText('Limpar filtros')).toBeInTheDocument()
  })

  it('deve exibir botão de exportar', () => {
    vi.mocked(adminApi.get).mockResolvedValue(mockDashboard)
    render(<FeedbacksPage />)
    expect(screen.getByText('Exportar')).toBeInTheDocument()
  })

  it('deve chamar a API do dashboard ao carregar', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(vi.mocked(adminApi.get)).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/feedbacks/dashboard')
      )
    })
  })

  it('deve clicar no botão limpar filtros sem erros', async () => {
    setupMocks()
    const user = userEvent.setup()
    render(<FeedbacksPage />)
    const limparButton = screen.getByText('Limpar filtros')
    expect(limparButton).toBeInTheDocument()
    await user.click(limparButton)
    expect(limparButton).toBeInTheDocument()
  })

  it('deve exibir seção de evolução da taxa de acerto', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('Evolução da Taxa de Acerto por Sistema')).toBeInTheDocument()
    })
  })

  it('deve exibir seção de modelos de IA em uso', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('Modelos de IA em Uso')).toBeInTheDocument()
    })
  })

  it('deve exibir tabela de feedbacks por usuário', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('Feedbacks por Usuário (Top 10)')).toBeInTheDocument()
    })
    // "João Silva" pode estar tanto na tabela de usuários quanto na de feedbacks
    await waitFor(() => {
      expect(screen.getAllByText('João Silva').length).toBeGreaterThan(0)
    })
  })

  it('deve exibir tabela de pendentes de avaliação', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('Pendentes de Avaliação (Últimos 20)')).toBeInTheDocument()
    })
  })

  it('deve exibir tabela de feedbacks recentes com paginação', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(screen.getByText('Feedbacks Recentes')).toBeInTheDocument()
    })
    // Verifica que chamou a API de lista
    await waitFor(() => {
      expect(vi.mocked(adminApi.get)).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/feedbacks/lista')
      )
    })
  })

  it('deve exibir modelos de IA carregados do backend', async () => {
    setupMocks()
    render(<FeedbacksPage />)
    await waitFor(() => {
      expect(vi.mocked(adminApi.get)).toHaveBeenCalledWith(
        expect.stringContaining('/admin/modelos-ia')
      )
    })
    await waitFor(() => {
      // Verifica que os nomes de modelos aparecem
      const flashTexts = screen.getAllByText('gemini-2.0-flash')
      expect(flashTexts.length).toBeGreaterThan(0)
    })
  })
})
