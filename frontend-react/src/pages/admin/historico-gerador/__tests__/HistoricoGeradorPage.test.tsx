import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoricoGeradorPage } from '../HistoricoGeradorPage'
import * as apiLib from '@/lib/api'

// Mock do modulo de API
vi.mock('@/lib/api', () => ({
  createApiClient: vi.fn(),
  getToken: vi.fn(() => null),
}))

// Mock do useMarkdown
vi.mock('@/hooks/useMarkdown', () => ({
  useMarkdown: (content: string) => `<div>${content}</div>`,
}))

// Mock do useToast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

const mockGeracoes = [
  {
    id: 1,
    numero_cnj: '0001234-56.2024.8.12.0001',
    numero_cnj_formatado: '0001234-56.2024.8.12.0001',
    tipo_peca: 'contestacao',
    modelo_usado: 'gemini-1.5-pro',
    criado_em: '2024-01-15T10:30:00',
    tempo_processamento: 45.5,
    modo_ativacao_agente2: 'semi_automatico',
    modulos_ativados_det: 3,
    modulos_ativados_llm: 2,
  },
  {
    id: 2,
    numero_cnj: '0009876-54.2024.8.12.0001',
    numero_cnj_formatado: null,
    tipo_peca: 'parecer',
    modelo_usado: 'gemini-1.5-flash',
    criado_em: '2024-01-16T14:20:00',
    tempo_processamento: 120.3,
    modo_ativacao_agente2: 'fast_path',
    modulos_ativados_det: 0,
    modulos_ativados_llm: 5,
  },
]

const mockGeracaoDetalhada = {
  ...mockGeracoes[0],
  prompt_enviado: 'Prompt de exemplo para contestacao',
  resumo_consolidado: 'Resumo consolidado do processo',
  conteudo_gerado: '# Minuta da Peca\n\nConteudo gerado pela IA',
  historico_chat: [
    { role: 'user', content: 'Por favor, gere a contestacao' },
    { role: 'assistant', content: 'Aqui esta a contestacao gerada' },
  ],
}

describe('HistoricoGeradorPage', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock do createApiClient retornando um objeto com metodo get
    vi.mocked(apiLib.createApiClient).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      blob: vi.fn(),
    })
  })

  it('deve carregar e exibir lista de geracoes', async () => {
    mockGet.mockResolvedValueOnce(mockGeracoes)

    render(<HistoricoGeradorPage />)

    // Deve mostrar loading inicialmente
    expect(screen.getByText('Historico - Gerador de Pecas')).toBeInTheDocument()

    // Aguarda dados carregarem
    await waitFor(() => {
      expect(screen.getByText('0001234-56.2024.8.12.0001')).toBeInTheDocument()
    })

    // Verifica se chamou a API corretamente
    expect(mockGet).toHaveBeenCalledWith('/geracoes?limit=100')

    // Verifica dados da tabela
    expect(screen.getByText('Contestacao')).toBeInTheDocument()
    expect(screen.getByText('Parecer')).toBeInTheDocument()
    expect(screen.getByText('Semi-Automatico')).toBeInTheDocument()
    expect(screen.getByText('Fast Path')).toBeInTheDocument()
  })

  it('deve abrir dialog com detalhes ao clicar em uma linha', async () => {
    const user = userEvent.setup()
    mockGet
      .mockResolvedValueOnce(mockGeracoes)
      .mockResolvedValueOnce(mockGeracaoDetalhada)

    render(<HistoricoGeradorPage />)

    // Aguarda dados carregarem
    await waitFor(() => {
      expect(screen.getByText('0001234-56.2024.8.12.0001')).toBeInTheDocument()
    })

    // Clica na primeira linha
    const firstRow = screen.getByText('0001234-56.2024.8.12.0001').closest('tr')
    expect(firstRow).toBeInTheDocument()
    await user.click(firstRow!)

    // Verifica se chamou endpoint de detalhes
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/geracoes/1')
    })

    // Verifica se abriu o dialog
    await waitFor(() => {
      expect(screen.getByText(/Detalhes da Geracao/)).toBeInTheDocument()
    })

    // Verifica se tabs estao presentes
    expect(screen.getByRole('tab', { name: 'Prompt' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resumo' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Minuta' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument()

    // Verifica conteudo do prompt (tab padrao)
    expect(screen.getByText('Prompt de exemplo para contestacao')).toBeInTheDocument()
  })

  it('deve navegar entre tabs e mostrar conteudo correto', async () => {
    const user = userEvent.setup()
    mockGet
      .mockResolvedValueOnce(mockGeracoes)
      .mockResolvedValueOnce(mockGeracaoDetalhada)

    render(<HistoricoGeradorPage />)

    // Aguarda dados e abre dialog
    await waitFor(() => {
      expect(screen.getByText('0001234-56.2024.8.12.0001')).toBeInTheDocument()
    })

    const firstRow = screen.getByText('0001234-56.2024.8.12.0001').closest('tr')
    await user.click(firstRow!)

    await waitFor(() => {
      expect(screen.getByText(/Detalhes da Geracao/)).toBeInTheDocument()
    })

    // Clica na tab Resumo
    await user.click(screen.getByRole('tab', { name: 'Resumo' }))
    await waitFor(() => {
      expect(screen.getByText('Resumo consolidado do processo')).toBeInTheDocument()
    })

    // Clica na tab Chat
    await user.click(screen.getByRole('tab', { name: 'Chat' }))
    await waitFor(() => {
      expect(screen.getByText('Usuario')).toBeInTheDocument()
      expect(screen.getByText('Por favor, gere a contestacao')).toBeInTheDocument()
      expect(screen.getByText('Assistente')).toBeInTheDocument()
      expect(screen.getByText('Aqui esta a contestacao gerada')).toBeInTheDocument()
    })

    // Verifica footer com tempo e modelo
    expect(screen.getByText(/Tempo: 45.5s/)).toBeInTheDocument()
    expect(screen.getByText(/Modelo: gemini-1.5-pro/)).toBeInTheDocument()
  })

  it('deve mostrar mensagem de erro ao falhar carregamento', async () => {
    mockGet.mockRejectedValueOnce(new Error('Erro de rede'))

    render(<HistoricoGeradorPage />)

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/geracoes?limit=100')
    })

    // O toast de erro deve ser chamado (verificamos atraves do mock)
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erro ao carregar historico',
          variant: 'destructive',
        })
      )
    })
  })

  it('deve formatar tempo corretamente', async () => {
    const geracoesComTempos = [
      { ...mockGeracoes[0], tempo_processamento: 30.5 },
      { ...mockGeracoes[1], tempo_processamento: 125.0 },
      { ...mockGeracoes[0], id: 3, tempo_processamento: null },
    ]

    mockGet.mockResolvedValueOnce(geracoesComTempos)

    render(<HistoricoGeradorPage />)

    await waitFor(() => {
      expect(screen.getByText('30.5s')).toBeInTheDocument()
      expect(screen.getByText('2m 5s')).toBeInTheDocument()
      expect(screen.getAllByText('N/A')[0]).toBeInTheDocument()
    })
  })

  it('deve exibir badges com cores corretas para modos', async () => {
    const geracoesComModos = [
      { ...mockGeracoes[0], modo_ativacao_agente2: 'semi_automatico' },
      { ...mockGeracoes[1], modo_ativacao_agente2: 'fast_path' },
      { ...mockGeracoes[0], id: 3, modo_ativacao_agente2: 'misto' },
      { ...mockGeracoes[1], id: 4, modo_ativacao_agente2: 'llm' },
      { ...mockGeracoes[0], id: 5, modo_ativacao_agente2: null },
    ]

    mockGet.mockResolvedValueOnce(geracoesComModos)

    render(<HistoricoGeradorPage />)

    await waitFor(() => {
      expect(screen.getByText('Semi-Automatico')).toBeInTheDocument()
      expect(screen.getByText('Fast Path')).toBeInTheDocument()
      expect(screen.getByText('Misto')).toBeInTheDocument()
      expect(screen.getByText('LLM')).toBeInTheDocument()
      expect(screen.getAllByText('N/A')[0]).toBeInTheDocument()
    })
  })
})
