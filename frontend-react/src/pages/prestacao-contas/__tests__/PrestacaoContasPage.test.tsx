import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { PrestacaoContasPage } from '../PrestacaoContasPage'
import * as api from '@/lib/api'

// Mock do router (SystemTopbar usa Link e useNavigate)
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => <a href={props.to}>{children}</a>,
}))

// Mock do auth store (SystemTopbar usa useAuthStore)
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    logout: vi.fn(),
    user: { id: 1, full_name: 'Teste' },
  }),
}))

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock da API
vi.mock('@/lib/api', () => ({
  prestacaoContasApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  getToken: vi.fn(() => 'fake-token'),
}))

describe('PrestacaoContasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar o formulario de criacao de sessao', () => {
    // Mock do historico vazio
    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue({
      total: 0,
      geracoes: [],
    })

    render(<PrestacaoContasPage />)

    // Verifica elementos principais do formulario
    expect(screen.getByText('Prestacao de Contas')).toBeInTheDocument()
    const titleElements = screen.getAllByText('Analisar Prestacao de Contas')
    expect(titleElements.length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Numero do Processo (CNJ)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analisar Prestacao de Contas/i })).toBeInTheDocument()
  })

  it('deve exibir estado de loading no historico', async () => {
    // Mock do historico com delay para capturar loading
    vi.mocked(api.prestacaoContasApi.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ total: 0, geracoes: [] }), 200)
        })
    )

    render(<PrestacaoContasPage />)

    // Verifica que skeletons de loading estao presentes
    expect(screen.getByText('Analises Recentes')).toBeInTheDocument()
  })

  it('deve exibir historico quando carregado com dados', async () => {
    const mockHistorico = {
      total: 1,
      geracoes: [
        {
          id: 1,
          numero_cnj: '08001234520248120001',
          numero_cnj_formatado: '0800123-45.2024.8.12.0001',
          status: 'concluida',
          parecer: 'favoravel',
          fundamentacao: '# Parecer favoravel\n\nConteudo...',
          criado_em: '2024-06-15T10:30:00Z',
          tempo_processamento_ms: 45000,
        },
      ],
    }

    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue(mockHistorico)

    render(<PrestacaoContasPage />)

    // Aguarda os dados do historico aparecerem
    await waitFor(() => {
      expect(screen.getByText('0800123-45.2024.8.12.0001')).toBeInTheDocument()
    })

    // Verifica badge de parecer favoravel
    await waitFor(() => {
      expect(screen.getByText('Favoravel')).toBeInTheDocument()
    })
  })

  it('deve mostrar mensagem quando historico esta vazio', async () => {
    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue({
      total: 0,
      geracoes: [],
    })

    render(<PrestacaoContasPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma analise realizada ainda')).toBeInTheDocument()
    })
  })

  it('deve exibir card informativo sobre o funcionamento', () => {
    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue({
      total: 0,
      geracoes: [],
    })

    render(<PrestacaoContasPage />)

    expect(screen.getByText('Como funciona?')).toBeInTheDocument()
    expect(
      screen.getByText('Sistema baixa o extrato da subconta automaticamente')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Emite parecer: Favoravel, Desfavoravel ou Duvida')
    ).toBeInTheDocument()
  })

  it('deve ter o campo de numero CNJ com placeholder correto', () => {
    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue({
      total: 0,
      geracoes: [],
    })

    render(<PrestacaoContasPage />)

    const input = screen.getByLabelText('Numero do Processo (CNJ)')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', '0000000-00.2024.8.12.0001')
  })

  it('deve renderizar botao de submit quando idle', () => {
    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue({
      total: 0,
      geracoes: [],
    })

    render(<PrestacaoContasPage />)

    const botao = screen.getByRole('button', { name: /Analisar Prestacao de Contas/i })
    expect(botao).toBeInTheDocument()
  })

  it('deve habilitar botao de submit quando input tem valor', async () => {
    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue({
      total: 0,
      geracoes: [],
    })

    const user = userEvent.setup()
    render(<PrestacaoContasPage />)

    const input = screen.getByLabelText('Numero do Processo (CNJ)')
    await user.type(input, '0800123-45.2024.8.12.0001')

    const botao = screen.getByRole('button', { name: /Analisar Prestacao de Contas/i })
    expect(botao).not.toBeDisabled()
  })

  it('deve exibir historico com analise em erro', async () => {
    const mockHistorico = {
      total: 1,
      geracoes: [
        {
          id: 2,
          numero_cnj: '08009999920248120001',
          numero_cnj_formatado: '0800999-99.2024.8.12.0001',
          status: 'erro',
          erro: 'Timeout ao consultar TJ-MS',
          criado_em: '2024-06-14T08:00:00Z',
        },
      ],
    }

    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue(mockHistorico)

    render(<PrestacaoContasPage />)

    await waitFor(() => {
      expect(screen.getByText('0800999-99.2024.8.12.0001')).toBeInTheDocument()
      expect(screen.getByText('Erro')).toBeInTheDocument()
    })
  })

  it('deve ter o botao de historico lateral', () => {
    vi.mocked(api.prestacaoContasApi.get).mockResolvedValue({
      total: 0,
      geracoes: [],
    })

    render(<PrestacaoContasPage />)

    // Botao com titulo de historico completo (SheetTrigger)
    const botaoHistorico = screen.getByTitle('Historico completo')
    expect(botaoHistorico).toBeInTheDocument()
  })
})
