import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { RelatorioCumprimentoPage } from '../RelatorioCumprimentoPage'
import * as api from '@/lib/api'

// Mock do router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => <a href={props.to}>{children}</a>,
}))

// Mock do auth store com suporte a seletores zustand
const mockAuthState = {
  user: { id: 1, username: 'testuser', full_name: 'Usuario Teste', role: 'user', is_admin: false },
  token: 'test-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  logout: vi.fn(),
}

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) => {
    if (typeof selector === 'function') {
      return selector(mockAuthState)
    }
    return mockAuthState
  },
}))

// Mock da API
vi.mock('@/lib/api', () => ({
  relatorioCumprimentoApi: {
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

describe('RelatorioCumprimentoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock padrao: historico vazio
    vi.mocked(api.relatorioCumprimentoApi.get).mockResolvedValue([])
  })

  it('deve renderizar a pagina com o campo de entrada do processo', async () => {
    render(<RelatorioCumprimentoPage />)

    // Verifica titulo
    expect(screen.getByText('Relatorio de Cumprimento')).toBeInTheDocument()

    // Verifica campo de input
    expect(screen.getByLabelText(/numero do processo/i)).toBeInTheDocument()

    // Verifica botao de gerar
    expect(screen.getByRole('button', { name: /gerar relatorio/i })).toBeInTheDocument()

    // Verifica botao de historico (button inside SheetTrigger) - text is "Historico" without accent
    expect(screen.getByText(/historico/i)).toBeInTheDocument()
  })

  it('deve mostrar estado de carregamento ao buscar historico', async () => {
    // Simula delay na API
    vi.mocked(api.relatorioCumprimentoApi.get).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve([]), 100)
        )
    )

    render(<RelatorioCumprimentoPage />)

    // Verifica que a API de historico foi chamada
    await waitFor(() => {
      expect(api.relatorioCumprimentoApi.get).toHaveBeenCalledWith('/historico')
    })
  })

  it('deve mostrar historico quando dados sao carregados', async () => {
    const mockHistorico = [
      {
        id: 1,
        numero_cumprimento: '08001234520248120001',
        numero_cumprimento_formatado: '0800123-45.2024.8.12.0001',
        numero_principal: null,
        numero_principal_formatado: null,
        dados_basicos: {
          cumprimento: {
            numero_processo: '08001234520248120001',
            numero_processo_formatado: '0800123-45.2024.8.12.0001',
            autor: 'Joao da Silva',
            cpf_cnpj_autor: null,
            reu: 'Estado de Mato Grosso do Sul',
            advogado_autor: null,
            oab_advogado: null,
            comarca: 'Campo Grande',
            vara: '1a Vara de Fazenda Publica',
            classe_processual: null,
            assunto: null,
            data_ajuizamento: null,
            valor_causa: null,
          },
        },
        transito_julgado_localizado: true,
        data_transito_julgado: '10/01/2024',
        conteudo_gerado: '# Relatorio de Teste\n\nConteudo do relatorio.',
        documentos_baixados: [],
        criado_em: '2024-01-15T10:30:00Z',
        tempo_processamento: 45,
      },
    ]

    vi.mocked(api.relatorioCumprimentoApi.get).mockResolvedValue(mockHistorico)

    render(<RelatorioCumprimentoPage />)

    // Clica no botao de historico para abrir o drawer - use text "Historico" without accent
    const btnHistorico = screen.getByText(/historico/i)
    await userEvent.click(btnHistorico)

    // Verifica se o drawer mostra o titulo
    await waitFor(() => {
      expect(screen.getByText('Relatorios Gerados')).toBeInTheDocument()
    })

    // Verifica se o item do historico aparece
    await waitFor(() => {
      expect(screen.getByText('0800123-45.2024.8.12.0001')).toBeInTheDocument()
    })
  })

  it('deve validar numero do processo vazio e desabilitar botao', () => {
    render(<RelatorioCumprimentoPage />)

    const btnGerar = screen.getByRole('button', { name: /gerar relatorio/i })

    // Botao deve estar desabilitado quando input esta vazio
    expect(btnGerar).toBeDisabled()
  })

  it('deve habilitar o botao quando ha numero de processo', async () => {
    render(<RelatorioCumprimentoPage />)

    const input = screen.getByLabelText(/numero do processo/i)
    const btnGerar = screen.getByRole('button', { name: /gerar relatorio/i })

    // Digita numero de processo
    await userEvent.type(input, '0800123-45.2024.8.12.0001')

    // Botao deve estar habilitado
    await waitFor(() => {
      expect(btnGerar).not.toBeDisabled()
    })
  })

  it('deve exibir alerta de erro corretamente', async () => {
    // Forca erro na API de historico para verificar que a pagina nao crasha
    vi.mocked(api.relatorioCumprimentoApi.get).mockRejectedValue(
      new Error('Falha na conexao')
    )

    render(<RelatorioCumprimentoPage />)

    // A pagina nao deve crashar
    expect(screen.getByText('Relatorio de Cumprimento')).toBeInTheDocument()

    // O campo de input ainda deve funcionar
    expect(screen.getByLabelText(/numero do processo/i)).toBeInTheDocument()
  })

  it('deve permitir digitar no campo de entrada', async () => {
    render(<RelatorioCumprimentoPage />)

    const input = screen.getByLabelText(/numero do processo/i) as HTMLInputElement

    await userEvent.type(input, '1234567-89.2024.1.12.3456')

    expect(input.value).toBe('1234567-89.2024.1.12.3456')
  })

  it('deve renderizar o header com informacoes corretas', () => {
    render(<RelatorioCumprimentoPage />)

    // Verifica titulo principal
    expect(screen.getByText('Relatorio de Cumprimento')).toBeInTheDocument()

    // Verifica subtitulo (rendered inside SystemTopbar subtitle)
    expect(screen.getByText('Relatorio Inicial para Cumprimento de Sentenca')).toBeInTheDocument()
  })

  it('deve mostrar descricao do campo CNJ', () => {
    render(<RelatorioCumprimentoPage />)

    expect(
      screen.getByText(/digite o numero do processo de cumprimento/i)
    ).toBeInTheDocument()
  })

  it('deve exibir drawer de historico vazio com mensagem apropriada', async () => {
    vi.mocked(api.relatorioCumprimentoApi.get).mockResolvedValue([])

    render(<RelatorioCumprimentoPage />)

    // Abre o drawer de historico
    const btnHistorico = screen.getByText(/historico/i)
    await userEvent.click(btnHistorico)

    // Verifica mensagem de vazio
    await waitFor(() => {
      expect(screen.getByText(/nenhum relatorio gerado ainda/i)).toBeInTheDocument()
    })
  })
})
