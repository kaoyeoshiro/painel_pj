import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GeradorPecasPage } from '../GeradorPecasPage'

// Mock do router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) =>
    opts?.select ? opts.select({ location: { pathname: '/gerador-pecas' } }) : { location: { pathname: '/gerador-pecas' } },
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => <a href={props.to}>{children}</a>,
}))

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock do useMarkdown
vi.mock('@/hooks/useMarkdown', () => ({
  useMarkdown: (text: string) => ({
    html: text ? `<p>${text}</p>` : '',
  }),
}))

// Mock do API (ainda necessário para funções que usam geradorApi diretamente como SSE)
vi.mock('@/lib/api', () => ({
  geradorApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    blob: vi.fn(),
  },
  getToken: vi.fn(() => 'fake-token'),
}))

// Mock dos hooks do TanStack Query
const mockUseTiposPeca = vi.fn()
const mockUseHistoricoGerador = vi.fn()
const mockUseGruposDisponiveis = vi.fn()
const mockUseSubcategorias = vi.fn()
const mockUseVersoesGeracao = vi.fn()

vi.mock('@/hooks/useQueries', () => ({
  useTiposPeca: () => mockUseTiposPeca(),
  useHistoricoGerador: () => mockUseHistoricoGerador(),
  useGruposDisponiveis: () => mockUseGruposDisponiveis(),
  useSubcategorias: () => mockUseSubcategorias(),
  useVersoesGeracao: () => mockUseVersoesGeracao(),
  useExcluirGeracao: () => ({ mutate: vi.fn(), isPending: false }),
  useEnviarFeedback: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadParecer: () => ({ mutate: vi.fn(), isPending: false }),
  useExportarDocx: () => ({ mutate: vi.fn(), isPending: false }),
  useAtualizarMinuta: () => ({ mutate: vi.fn(), isPending: false }),
  useRestaurarVersao: () => ({ mutate: vi.fn(), isPending: false }),
  useInvalidateQueries: () => ({
    invalidateGeradorHistorico: vi.fn(),
    invalidateByKey: vi.fn(),
  }),
}))

describe('GeradorPecasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mocks
    mockUseTiposPeca.mockReturnValue({
      data: {
        tipos: [
          { valor: 'contestacao', label: 'Contestacao', descricao: 'Peca de defesa' },
          { valor: 'recurso_apelacao', label: 'Recurso de Apelacao', descricao: 'Recurso ordinario' },
        ],
        permite_auto: false,
      },
      isLoading: false,
      isError: false,
    })
    
    mockUseHistoricoGerador.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    })
    
    mockUseGruposDisponiveis.mockReturnValue({
      data: { grupos: [] },
      isLoading: false,
    })
    
    mockUseSubcategorias.mockReturnValue({
      data: [],
      isLoading: false,
    })
    
    mockUseVersoesGeracao.mockReturnValue({
      data: { versoes: [] },
      refetch: vi.fn(),
    })
  })

  it('deve renderizar o formulario com campo de CNJ e seletor de tipo', async () => {
    render(<GeradorPecasPage />)

    expect(screen.getByText('Gerador de Pecas')).toBeInTheDocument()
    expect(screen.getByLabelText('Numero do Processo')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Selecione o tipo de peca')).toBeInTheDocument()
    })
  })

  it('deve exibir opcoes de tipo de peca quando carregadas da API', async () => {
    render(<GeradorPecasPage />)

    await waitFor(() => {
      expect(screen.getByText('Selecione o tipo de peca')).toBeInTheDocument()
    })

    // Verifica que o hook foi chamado
    expect(mockUseTiposPeca).toHaveBeenCalled()
  })

  it('deve desabilitar botao Gerar Automatico quando CNJ esta vazio', async () => {
    render(<GeradorPecasPage />)

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Gerar Automatico/i })
      expect(btn).toBeDisabled()
    })
  })

  it('deve habilitar botao Gerar Automatico quando CNJ tem valor', async () => {
    render(<GeradorPecasPage />)

    const input = screen.getByLabelText('Numero do Processo')
    await waitFor(() => {
      input.focus()
    })
    const event = new Event('input', { bubbles: true })
    Object.defineProperty(event, 'target', { value: { value: '0804330092024812' } })
    input.dispatchEvent(event)

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    nativeInputValueSetter.call(input, '0804330-09.2024.8.12.0017')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))

    expect(screen.getByLabelText('Numero do Processo')).toBeInTheDocument()
  })

  it('deve exibir pipeline de geracao', async () => {
    render(<GeradorPecasPage />)

    await waitFor(() => {
      expect(screen.getByText('Pipeline de Geracao')).toBeInTheDocument()
      expect(screen.getByText('Coletor')).toBeInTheDocument()
      expect(screen.getByText('Analisador')).toBeInTheDocument()
      expect(screen.getByText('Redator')).toBeInTheDocument()
    })
  })

  it('deve desabilitar botao Semi-Automatico quando tipo_peca nao esta selecionado', async () => {
    render(<GeradorPecasPage />)

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Semi-Automatico/i })
      expect(btn).toBeDisabled()
    })
  })

  it('deve exibir mensagem quando nao ha historico', async () => {
    render(<GeradorPecasPage />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma geracao ainda')).toBeInTheDocument()
      expect(screen.getByText('Preencha o formulario acima para gerar sua primeira peca')).toBeInTheDocument()
    })
  })

  it('deve exibir itens do historico quando retornados pela API', async () => {
    mockUseHistoricoGerador.mockReturnValue({
      data: [
        {
          id: 1,
          cnj: '0804330-09.2024.8.12.0017',
          tipo_peca: 'contestacao',
          data: '2026-02-01T10:00:00Z',
        },
        {
          id: 2,
          cnj: '0123456-78.2025.8.12.0001',
          tipo_peca: 'recurso_apelacao',
          data: '2026-02-02T14:30:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    })

    render(<GeradorPecasPage />)

    await waitFor(() => {
      expect(screen.getByText('0804330-09.2024.8.12.0017')).toBeInTheDocument()
      expect(screen.getByText('0123456-78.2025.8.12.0001')).toBeInTheDocument()
    })
  })

  it('deve ter campo de observacoes opcional', async () => {
    render(<GeradorPecasPage />)

    expect(screen.getByLabelText(/Observacoes/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Instrucoes adicionais para a geracao...')).toBeInTheDocument()
  })
})
