import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HistoricoPrestacaoContasPage } from '../HistoricoPrestacaoContasPage'
import * as apiModule from '@/lib/api'

// Mock do módulo de API
vi.mock('@/lib/api', () => ({
  createApiClient: vi.fn(),
  getToken: vi.fn(() => null),
}))

// Mock do useMarkdown
vi.mock('@/hooks/useMarkdown', () => ({
  useMarkdown: vi.fn((content: string) => content)
}))

// Mock do useToast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

describe('HistoricoPrestacaoContasPage', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock do createApiClient retornando um objeto com método get
    vi.mocked(apiModule.createApiClient).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    } as any)
  })

  it('deve renderizar título e descrição da página', async () => {
    mockGet.mockResolvedValueOnce([])

    render(<HistoricoPrestacaoContasPage />)

    // BreadcrumbBar title sem acentos
    expect(screen.getByText('Historico - Prestacao de Contas')).toBeInTheDocument()
  })

  it('deve carregar e exibir lista de gerações', async () => {
    const mockGeracoes = [
      {
        id: 1,
        numero_cnj: '0001234-56.2023.8.12.0001',
        numero_cnj_formatado: '0001234-56.2023.8.12.0001',
        status: 'success',
        parecer: 'Favorável',
        modelo_usado: 'gemini-1.5-pro',
        tempo_processamento_ms: 5000,
        criado_em: '2024-01-15T10:30:00Z'
      },
      {
        id: 2,
        numero_cnj: '0002345-67.2023.8.12.0002',
        numero_cnj_formatado: '0002345-67.2023.8.12.0002',
        status: 'error',
        parecer: 'Desfavorável',
        erro: 'Erro ao processar',
        criado_em: '2024-01-16T14:20:00Z'
      }
    ]

    mockGet.mockResolvedValueOnce(mockGeracoes)

    render(<HistoricoPrestacaoContasPage />)

    // Aguardar o carregamento
    await waitFor(() => {
      expect(screen.getByText('0001234-56.2023.8.12.0001')).toBeInTheDocument()
    })

    // Verificar se os dados estão na tela
    expect(screen.getByText('0001234-56.2023.8.12.0001')).toBeInTheDocument()
    expect(screen.getByText('0002345-67.2023.8.12.0002')).toBeInTheDocument()
    expect(screen.getByText('Favorável')).toBeInTheDocument()
    expect(screen.getByText('Desfavorável')).toBeInTheDocument()
    expect(screen.getByText('gemini-1.5-pro')).toBeInTheDocument()

    // Verificar chamada à API com query params na URL
    expect(mockGet).toHaveBeenCalledWith('/geracoes?limit=200&offset=0')
  })

  it('deve exibir toast de erro quando falhar ao carregar gerações', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'))

    render(<HistoricoPrestacaoContasPage />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico',
        variant: 'destructive'
      })
    })
  })

  it('deve abrir dialog com detalhes ao clicar em uma linha', async () => {
    const mockGeracoes = [
      {
        id: 1,
        numero_cnj: '0001234-56.2023.8.12.0001',
        numero_cnj_formatado: '0001234-56.2023.8.12.0001',
        status: 'success',
        parecer: 'Favorável',
        criado_em: '2024-01-15T10:30:00Z'
      }
    ]

    const mockDetalhes = {
      id: 1,
      numero_cnj: '0001234-56.2023.8.12.0001',
      numero_cnj_formatado: '0001234-56.2023.8.12.0001',
      status: 'success',
      parecer: 'Favorável',
      fundamentacao: '## Fundamentação\n\nParecer favorável',
      criado_em: '2024-01-15T10:30:00Z',
      logs_ia: [
        {
          id: 1,
          etapa: 'analise_documentos',
          descricao: 'Análise dos documentos',
          modelo_usado: 'gemini-1.5-pro',
          tokens_entrada: 1000,
          tokens_saida: 500,
          tempo_ms: 2000,
          sucesso: true,
          criado_em: '2024-01-15T10:30:00Z'
        }
      ],
      irregularidades: ['Falta documento X'],
      documentos_faltantes: ['Certidão Y']
    }

    mockGet
      .mockResolvedValueOnce(mockGeracoes)
      .mockResolvedValueOnce(mockDetalhes)

    const user = userEvent.setup()
    render(<HistoricoPrestacaoContasPage />)

    // Aguardar carregamento da lista
    await waitFor(() => {
      expect(screen.getByText('0001234-56.2023.8.12.0001')).toBeInTheDocument()
    })

    // Clicar na linha da tabela
    const row = screen.getByText('0001234-56.2023.8.12.0001').closest('tr')
    if (row) {
      await user.click(row)
    }

    // Aguardar carregamento dos detalhes
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/geracoes/1')
    })

    // Verificar se dialog foi aberto com detalhes
    await waitFor(() => {
      expect(screen.getByText('Detalhes da Geração #1')).toBeInTheDocument()
    })

    // Verificar abas
    expect(screen.getByRole('tab', { name: /Parecer/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Dados/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Logs IA/i })).toBeInTheDocument()
  })

  it('deve exibir skeleton durante carregamento', () => {
    mockGet.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<HistoricoPrestacaoContasPage />)

    // Verificar presença de skeleton
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('deve formatar corretamente badges de parecer', async () => {
    const mockGeracoes = [
      {
        id: 1,
        numero_cnj: '0001234-56.2023.8.12.0001',
        status: 'success',
        parecer: 'Favorável',
        criado_em: '2024-01-15T10:30:00Z'
      },
      {
        id: 2,
        numero_cnj: '0002345-67.2023.8.12.0002',
        status: 'success',
        parecer: 'Desfavorável',
        criado_em: '2024-01-15T10:30:00Z'
      },
      {
        id: 3,
        numero_cnj: '0003456-78.2023.8.12.0003',
        status: 'success',
        parecer: 'Com dúvida',
        criado_em: '2024-01-15T10:30:00Z'
      }
    ]

    mockGet.mockResolvedValueOnce(mockGeracoes)

    render(<HistoricoPrestacaoContasPage />)

    await waitFor(() => {
      expect(screen.getByText('Favorável')).toBeInTheDocument()
    })

    // Verificar diferentes pareceres
    expect(screen.getByText('Favorável')).toBeInTheDocument()
    expect(screen.getByText('Desfavorável')).toBeInTheDocument()
    expect(screen.getByText('Com dúvida')).toBeInTheDocument()
  })

  it('deve exibir logs IA colapsáveis no dialog', async () => {
    const mockGeracoes = [
      {
        id: 1,
        numero_cnj: '0001234-56.2023.8.12.0001',
        status: 'success',
        parecer: 'Favorável',
        criado_em: '2024-01-15T10:30:00Z'
      }
    ]

    const mockDetalhes = {
      id: 1,
      numero_cnj: '0001234-56.2023.8.12.0001',
      status: 'success',
      parecer: 'Favorável',
      criado_em: '2024-01-15T10:30:00Z',
      logs_ia: [
        {
          id: 1,
          etapa: 'analise_inicial',
          descricao: 'Análise inicial dos documentos',
          modelo_usado: 'gemini-1.5-pro',
          tokens_entrada: 1000,
          tokens_saida: 500,
          tempo_ms: 2000,
          sucesso: true,
          criado_em: '2024-01-15T10:30:00Z',
          prompt_enviado: 'Analise os documentos',
          resposta_ia: 'Documentos analisados'
        }
      ]
    }

    mockGet
      .mockResolvedValueOnce(mockGeracoes)
      .mockResolvedValueOnce(mockDetalhes)

    const user = userEvent.setup()
    render(<HistoricoPrestacaoContasPage />)

    // Aguardar carregamento da lista e clicar na linha
    await waitFor(() => {
      expect(screen.getByText('0001234-56.2023.8.12.0001')).toBeInTheDocument()
    })

    const row = screen.getByText('0001234-56.2023.8.12.0001').closest('tr')
    if (row) {
      await user.click(row)
    }

    // Aguardar abertura do dialog e clicar na aba Logs IA
    await waitFor(() => {
      expect(screen.getByText('Detalhes da Geração #1')).toBeInTheDocument()
    })

    const logsTab = screen.getByRole('tab', { name: /Logs IA/i })
    await user.click(logsTab)

    // Verificar presença do log
    await waitFor(() => {
      expect(screen.getByText('analise_inicial')).toBeInTheDocument()
    })

    expect(screen.getByText('Análise inicial dos documentos')).toBeInTheDocument()
    expect(screen.getByText('gemini-1.5-pro')).toBeInTheDocument()
  })
})
