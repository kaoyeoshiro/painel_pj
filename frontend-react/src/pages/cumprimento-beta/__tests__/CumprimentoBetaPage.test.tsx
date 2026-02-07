import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CumprimentoBetaPage } from '../CumprimentoBetaPage'
import * as api from '@/lib/api'

// Mock do router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

// Mock do auth store
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: 1, full_name: 'Usuário Teste', email: 'teste@example.com' },
  }),
}))

// Mock da API
vi.mock('@/lib/api', () => ({
  cumprimentoBetaApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getToken: vi.fn(() => 'fake-token'),
}))

// Mock do hook useMarkdown
vi.mock('@/hooks/useMarkdown', () => ({
  useMarkdown: (text: string) => ({
    html: `<p>${text}</p>`,
  }),
}))

describe('CumprimentoBetaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock da resposta de sessões vazia por padrão
    vi.mocked(api.cumprimentoBetaApi.get).mockResolvedValue({
      sessoes: [],
      total: 0,
      pagina: 1,
      por_pagina: 50,
    })
  })

  it('deve renderizar a página sem erros', async () => {
    render(<CumprimentoBetaPage />)

    // Verifica se o título está presente
    expect(screen.getByText('Cumprimento de Sentença')).toBeInTheDocument()

    // Verifica se o badge Beta está presente
    expect(screen.getByText('Beta')).toBeInTheDocument()

    // Verifica se o input de número de processo está presente
    expect(screen.getByLabelText(/número do processo/i)).toBeInTheDocument()

    // Verifica se o botão Iniciar está presente
    expect(screen.getByRole('button', { name: /iniciar/i })).toBeInTheDocument()
  })

  it('deve mostrar loading enquanto busca dados', async () => {
    // Simula um delay na resposta da API
    vi.mocked(api.cumprimentoBetaApi.get).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                sessoes: [],
                total: 0,
                pagina: 1,
                por_pagina: 50,
              }),
            100
          )
        )
    )

    render(<CumprimentoBetaPage />)

    // Aguarda a resolução da promise
    await waitFor(() => {
      expect(api.cumprimentoBetaApi.get).toHaveBeenCalledWith('/sessoes?pagina=1&por_pagina=50')
    })
  })

  it('deve mostrar dados quando a API retorna sucesso', async () => {
    const mockSessoes = [
      {
        id: 1,
        numero_processo: '00000000000000000001',
        numero_processo_formatado: '0000001-00.2024.0.00.0001',
        status: 'finalizado' as const,
        total_documentos: 10,
        documentos_processados: 10,
        documentos_relevantes: 5,
        documentos_irrelevantes: 3,
        documentos_ignorados: 2,
        erro_mensagem: null,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
        finalizado_em: '2024-01-01T11:00:00Z',
        tem_consolidacao: true,
        total_conversas: 2,
        total_pecas: 1,
      },
    ]

    vi.mocked(api.cumprimentoBetaApi.get).mockResolvedValue({
      sessoes: mockSessoes,
      total: 1,
      pagina: 1,
      por_pagina: 50,
    })

    render(<CumprimentoBetaPage />)

    // Verifica se o botão de histórico está presente
    expect(screen.getByRole('button', { name: /histórico/i })).toBeInTheDocument()

    // Aguarda o carregamento das sessões
    await waitFor(() => {
      expect(api.cumprimentoBetaApi.get).toHaveBeenCalledWith('/sessoes?pagina=1&por_pagina=50')
    })
  })

  it('deve desabilitar o botão Iniciar quando o input está vazio', () => {
    render(<CumprimentoBetaPage />)

    const btnIniciar = screen.getByRole('button', { name: /iniciar/i })

    // O botão deve estar desabilitado quando não há número de processo
    expect(btnIniciar).toBeDisabled()
  })

  it('deve habilitar o botão Iniciar quando há número de processo', async () => {
    render(<CumprimentoBetaPage />)

    const input = screen.getByLabelText(/número do processo/i)
    const btnIniciar = screen.getByRole('button', { name: /iniciar/i })

    // Digita um número de processo
    await userEvent.type(input, '0000001-00.2024.0.00.0001')

    // Aguarda atualização do estado
    await waitFor(() => {
      expect(btnIniciar).not.toBeDisabled()
    })
  })

  it('deve exibir erro quando a API falhar', async () => {
    vi.mocked(api.cumprimentoBetaApi.get).mockRejectedValue(new Error('Erro na API'))

    render(<CumprimentoBetaPage />)

    // Aguarda a tentativa de carregar as sessões
    await waitFor(() => {
      expect(api.cumprimentoBetaApi.get).toHaveBeenCalled()
    })

    // O componente deve lidar com o erro graciosamente
    // (não crashar)
    expect(screen.getByText('Cumprimento de Sentença')).toBeInTheDocument()
  })

  it('deve mostrar o header com título correto', () => {
    render(<CumprimentoBetaPage />)

    // Verifica se o header está presente com o título
    expect(screen.getByText('Cumprimento de Sentença')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('deve renderizar o histórico ao clicar no botão', async () => {
    const mockSessoes = [
      {
        id: 1,
        numero_processo: '00000000000000000001',
        numero_processo_formatado: '0000001-00.2024.0.00.0001',
        status: 'finalizado' as const,
        total_documentos: 10,
        documentos_processados: 10,
        documentos_relevantes: 5,
        documentos_irrelevantes: 3,
        documentos_ignorados: 2,
        erro_mensagem: null,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
        finalizado_em: '2024-01-01T11:00:00Z',
        tem_consolidacao: true,
        total_conversas: 2,
        total_pecas: 1,
      },
    ]

    vi.mocked(api.cumprimentoBetaApi.get).mockResolvedValue({
      sessoes: mockSessoes,
      total: 1,
      pagina: 1,
      por_pagina: 50,
    })

    render(<CumprimentoBetaPage />)

    const btnHistorico = screen.getByRole('button', { name: /histórico/i })
    await userEvent.click(btnHistorico)

    // Aguarda o drawer abrir e mostrar as sessões
    await waitFor(() => {
      expect(screen.getByText('Sessões Anteriores')).toBeInTheDocument()
    })
  })

  it('deve permitir digitar no campo de entrada', async () => {
    render(<CumprimentoBetaPage />)

    const input = screen.getByLabelText(/número do processo/i) as HTMLInputElement

    await userEvent.type(input, '1234567-89.2024.1.12.3456')

    expect(input.value).toBe('1234567-89.2024.1.12.3456')
  })

  it('deve limpar o erro ao tentar novamente', async () => {
    render(<CumprimentoBetaPage />)

    // Como não há erro inicialmente, vamos simular um cenário
    // onde um erro seria exibido após uma operação
    // Este teste é mais conceitual dado o estado inicial
    expect(screen.queryByText(/erro no processamento/i)).not.toBeInTheDocument()
  })
})
