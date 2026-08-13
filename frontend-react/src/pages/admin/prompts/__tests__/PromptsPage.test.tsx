import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptsPage } from '../PromptsPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

const mockConfigsIA = [
  { sistema: 'matriculas', chave: 'prompt_criterios_relevancia', valor: 'criterio teste' },
  { sistema: 'matriculas', chave: 'busca_vetorial_top_k', valor: '5' },
  { sistema: 'gerador_pecas', chave: 'competencia_999_ativo', valor: 'true' },
  { sistema: 'global', chave: 'max_tokens', valor: '8192' },
]

const mockPerAgentMatriculas = {
  sistema: 'matriculas',
  agentes: {
    analise: {
      descricao: 'Agent1 - Análise visual de matrículas',
      modelo: 'gemini-3.7-flash',
      modelo_fonte: 'default',
      temperatura: 0.3,
      temperatura_fonte: 'default',
      max_tokens: null,
      max_tokens_fonte: 'default',
      thinking_level: 'low',
      thinking_level_fonte: 'default',
    },
    relatorio: {
      descricao: 'Agent2 - Gera relatório técnico',
      modelo: 'gemini-3.7-flash',
      modelo_fonte: 'system',
      temperatura: 0.7,
      temperatura_fonte: 'agent',
      max_tokens: 4096,
      max_tokens_fonte: 'agent',
      thinking_level: 'low',
      thinking_level_fonte: 'global',
    },
  },
}

const mockPerAgentGerador = {
  sistema: 'gerador_pecas',
  agentes: {
    coletor: {
      descricao: 'Agent1 - Coleta e resume documentos do TJ-MS',
      modelo: 'gemini-3.7-flash',
      modelo_fonte: 'default',
      temperatura: 0.3,
      temperatura_fonte: 'default',
      max_tokens: null,
      max_tokens_fonte: 'default',
      thinking_level: 'low',
      thinking_level_fonte: 'default',
    },
    deteccao: {
      descricao: 'Agent2 - Detecta módulos de conteúdo relevantes',
      modelo: 'gemini-3.7-flash',
      modelo_fonte: 'system',
      temperatura: 0.1,
      temperatura_fonte: 'agent',
      max_tokens: null,
      max_tokens_fonte: 'default',
      thinking_level: 'medium',
      thinking_level_fonte: 'agent',
    },
    geracao: {
      descricao: 'Agent3 - Gera a peça jurídica final',
      modelo: 'gemini-3.7-flash',
      modelo_fonte: 'system',
      temperatura: 0.3,
      temperatura_fonte: 'default',
      max_tokens: null,
      max_tokens_fonte: 'default',
      thinking_level: 'low',
      thinking_level_fonte: 'agent',
    },
  },
}

const mockPrompts = {
  prompts: [
    {
      id: 1,
      sistema: 'matriculas',
      tipo: 'system',
      nome: 'Prompt Sistema Matrículas',
      descricao: 'Prompt principal do sistema',
      conteudo: 'Você é um assistente especializado em análise de matrículas.',
      is_active: true,
      updated_at: '2026-01-15T10:30:00',
      updated_by: 'admin',
    },
    {
      id: 2,
      sistema: 'gerador_pecas',
      tipo: 'analise',
      nome: 'Análise de Documentos',
      descricao: 'Prompt para análise de documentos processuais',
      conteudo: 'Analise o seguinte documento e extraia informações relevantes...',
      is_active: true,
      updated_at: '2026-01-20T14:45:00',
      updated_by: 'user123',
    },
    {
      id: 3,
      sistema: 'relatorio_cumprimento',
      tipo: 'relatorio',
      nome: 'Geração de Relatório',
      descricao: 'Prompt para geração de relatórios',
      conteudo: 'Gere um relatório detalhado baseado nos dados fornecidos...',
      is_active: false,
      updated_at: '2026-01-10T09:15:00',
    },
  ],
  total: 3,
}

function setupMocks() {
  vi.mocked(adminApi.get).mockImplementation((url) => {
    if (url === '/admin/config-ia') return Promise.resolve(mockConfigsIA)
    if (url === '/admin/api/prompts') return Promise.resolve(mockPrompts)
    if (url === '/admin/config-ia/per-agent/matriculas') return Promise.resolve(mockPerAgentMatriculas)
    if (url === '/admin/config-ia/per-agent/gerador_pecas') return Promise.resolve(mockPerAgentGerador)
    // Per-agent para outros sistemas (retorna vazio)
    if ((url as string).startsWith('/admin/config-ia/per-agent/')) {
      return Promise.resolve({ sistema: (url as string).split('/').pop(), agentes: {} })
    }
    return Promise.reject(new Error(`Endpoint não mockado: ${url}`))
  })
}

describe('PromptsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve carregar e exibir abas de sistemas', async () => {
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: /Matrículas/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Gerador de Peças/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Global/i })).toBeInTheDocument()
  })

  it('deve exibir seções colapsáveis para Matrículas', async () => {
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    // Seção de agentes deve estar visível (defaultOpen=true)
    expect(screen.getByTestId('section-agentes-matriculas')).toBeInTheDocument()

    // Aguardar carregamento de agentes
    await waitFor(() => {
      expect(screen.getByTestId('agent-card-analise')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-relatorio')).toBeInTheDocument()
    })
  })

  it('deve mostrar cards de agente com descrição e source badges', async () => {
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('agent-card-analise')).toBeInTheDocument()
    })

    const analiseCard = screen.getByTestId('agent-card-analise')
    expect(within(analiseCard).getByText('analise')).toBeInTheDocument()
    expect(within(analiseCard).getByText('Agent1 - Análise visual de matrículas')).toBeInTheDocument()

    // Source badges (default para analise)
    const defaultBadges = within(analiseCard).getAllByText('padrão')
    expect(defaultBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('deve exibir hierarquia de fontes para agente relatorio', async () => {
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('agent-card-relatorio')).toBeInTheDocument()
    })

    const relatorioCard = screen.getByTestId('agent-card-relatorio')
    // modelo_fonte: system, temperatura_fonte: agent, max_tokens_fonte: agent, thinking_level_fonte: global
    expect(within(relatorioCard).getByText('sistema')).toBeInTheDocument()
    expect(within(relatorioCard).getAllByText('agente').length).toBeGreaterThanOrEqual(1)
    expect(within(relatorioCard).getByText('global')).toBeInTheDocument()
  })

  it('deve carregar e exibir prompts na seção de Prompts', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    // Expandir seção de Prompts
    const promptsSection = screen.getByTestId('section-prompts-matriculas')
    const toggleButton = within(promptsSection).getByRole('button')
    await user.click(toggleButton)

    // Aguardar prompts visíveis
    await waitFor(() => {
      expect(screen.getByText('Prompt Sistema Matrículas')).toBeInTheDocument()
    })

    // Verificar badges
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })

  it('deve alternar para aba Gerador de Peças e carregar agentes', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    const geradorTab = screen.getByRole('tab', { name: /Gerador de Peças/i })
    await user.click(geradorTab)

    // Aguardar 3 agentes do gerador
    await waitFor(() => {
      expect(screen.getByTestId('agent-card-coletor')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-deteccao')).toBeInTheDocument()
      expect(screen.getByTestId('agent-card-geracao')).toBeInTheDocument()
    })

    // Verificar chamada per-agent
    expect(adminApi.get).toHaveBeenCalledWith('/admin/config-ia/per-agent/gerador_pecas')
  })

  it('não deve exibir seção de agentes na aba Global', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    const globalTab = screen.getByRole('tab', { name: /Global/i })
    await user.click(globalTab)

    await waitFor(() => {
      // Global agora renderiza GlobalConfigSection com SLA Fallback
      expect(screen.getByText('SLA Fallback Automatico')).toBeInTheDocument()
    })

    // Seção de agentes não deve existir para Global
    expect(screen.queryByTestId('section-agentes-global')).not.toBeInTheDocument()
    // Seções colapsáveis genéricas também não devem existir
    expect(screen.queryByTestId('section-extras-global')).not.toBeInTheDocument()
  })

  it('deve abrir dialog de edição de prompt', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    // Expandir seção de prompts
    const promptsSection = screen.getByTestId('section-prompts-matriculas')
    await user.click(within(promptsSection).getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Prompt Sistema Matrículas')).toBeInTheDocument()
    })

    // Clicar em Editar
    const editButtons = screen.getAllByRole('button', { name: /Editar/i })
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Editar Prompt')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Nome')).toHaveValue('Prompt Sistema Matrículas')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Prompt principal do sistema')
  })

  it('deve salvar alterações de prompt', async () => {
    const user = userEvent.setup()
    setupMocks()
    vi.mocked(adminApi.put).mockResolvedValue({ success: true })

    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    // Expandir seção de prompts e abrir edição
    const promptsSection = screen.getByTestId('section-prompts-matriculas')
    await user.click(within(promptsSection).getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Prompt Sistema Matrículas')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /Editar/i })
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const nomeInput = screen.getByLabelText('Nome')
    await user.clear(nomeInput)
    await user.type(nomeInput, 'Novo Nome do Prompt')

    const saveButton = screen.getByRole('button', { name: /Salvar/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(adminApi.put).toHaveBeenCalledWith('/admin/api/prompts/1', expect.objectContaining({
        nome: 'Novo Nome do Prompt',
      }))
    })
  })

  it('deve exibir mensagem quando não há prompts', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') return Promise.resolve([])
      if (url === '/admin/api/prompts') return Promise.resolve({ prompts: [], total: 0 })
      if ((url as string).startsWith('/admin/config-ia/per-agent/')) {
        return Promise.resolve({ sistema: (url as string).split('/').pop(), agentes: {} })
      }
      return Promise.reject(new Error(`Endpoint não mockado: ${url}`))
    })

    const user = userEvent.setup()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    // Expandir seção de prompts
    const promptsSection = screen.getByTestId('section-prompts-matriculas')
    await user.click(within(promptsSection).getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Nenhum prompt encontrado')).toBeInTheDocument()
    })
  })

  it('deve ter botões de expandir e recolher tudo', async () => {
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Expandir tudo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recolher tudo/i })).toBeInTheDocument()
  })

  it('deve expandir tudo ao clicar no botão', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<PromptsPage />)

    await waitFor(() => {
      expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Expandir tudo/i }))

    // Todas as seções devem estar abertas — verificar que extras mostra conteúdo
    await waitFor(() => {
      expect(screen.getByText('Filtrar por sistema:')).toBeInTheDocument()
    })
  })
})
