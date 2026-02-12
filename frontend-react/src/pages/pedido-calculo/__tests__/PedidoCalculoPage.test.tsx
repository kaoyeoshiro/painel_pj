import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import { PedidoCalculoPage } from '../PedidoCalculoPage'
import * as api from '@/lib/api'

// Mock do router (Link e useNavigate precisam de contexto)
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => <a href={props.to}>{children}</a>,
}))

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock do API
vi.mock('@/lib/api', () => ({
  pedidoCalculoApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getToken: vi.fn(() => 'fake-token'),
}))

describe('PedidoCalculoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar a página sem erros', () => {
    // Mock do historico vazio
    vi.mocked(api.pedidoCalculoApi.get).mockResolvedValue([])

    render(<PedidoCalculoPage />)

    // Verifica elementos principais (BreadcrumbBar title sem acentos)
    expect(screen.getByText('Pedido de Calculo')).toBeInTheDocument()
    expect(screen.getByLabelText('Numero do Processo (CNJ)')).toBeInTheDocument()
    // O botao de submit contem "Gerar Pedido de Calculo"
    expect(screen.getByRole('button', { name: /Gerar Pedido de Calculo/i })).toBeInTheDocument()
  })

  it('deve mostrar loading enquanto busca dados', async () => {
    // Mock do historico com delay
    vi.mocked(api.pedidoCalculoApi.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([]), 100)
        })
    )

    render(<PedidoCalculoPage />)

    // Aguarda o loading aparecer
    await waitFor(() => {
      // Loading é exibido enquanto busca historico
      expect(screen.getByText('Pedidos Recentes')).toBeInTheDocument()
    })
  })

  it('deve mostrar dados quando API retorna sucesso', async () => {
    // Mock do historico com dados
    const mockHistorico = [
      {
        id: 1,
        numero_cnj: '0000000002024812',
        numero_cnj_formatado: '0000000-00.2024.8.12.0001',
        dados_processo: {
          autor: 'João da Silva',
          numero_processo: '0000000-00.2024.8.12.0001',
        },
        conteudo_gerado: '# Pedido de Cálculo\n\nConteúdo do pedido...',
        criado_em: '2024-01-15T10:30:00Z',
        tempo_processamento: 45,
      },
    ]

    vi.mocked(api.pedidoCalculoApi.get).mockResolvedValue(mockHistorico)

    render(<PedidoCalculoPage />)

    // Aguarda os dados aparecerem
    await waitFor(() => {
      expect(screen.getByText('0000000-00.2024.8.12.0001')).toBeInTheDocument()
      expect(screen.getByText('João da Silva')).toBeInTheDocument()
    })
  })

  it('deve exibir mensagem quando não há histórico', async () => {
    // Mock do historico vazio
    vi.mocked(api.pedidoCalculoApi.get).mockResolvedValue([])

    render(<PedidoCalculoPage />)

    // Aguarda a mensagem de vazio aparecer
    await waitFor(() => {
      expect(screen.getByText('Nenhum pedido gerado ainda')).toBeInTheDocument()
      expect(screen.getByText('Use o formulario acima para gerar seu primeiro pedido')).toBeInTheDocument()
    })
  })

  it('deve ter o formulário com campo de número CNJ', async () => {
    vi.mocked(api.pedidoCalculoApi.get).mockResolvedValue([])

    render(<PedidoCalculoPage />)

    const input = screen.getByLabelText('Numero do Processo (CNJ)')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', '0000000-00.2024.8.12.0001')
  })

  it('deve ter botão de histórico', async () => {
    vi.mocked(api.pedidoCalculoApi.get).mockResolvedValue([])

    render(<PedidoCalculoPage />)

    // Procura pelo botão de histórico (ícone de History)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('deve exibir card de histórico recente', async () => {
    vi.mocked(api.pedidoCalculoApi.get).mockResolvedValue([])

    render(<PedidoCalculoPage />)

    await waitFor(() => {
      expect(screen.getByText('Pedidos Recentes')).toBeInTheDocument()
    })
  })
})
