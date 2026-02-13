import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { DashboardPageV2 } from '../DashboardPageV2'
import { systemCards, adminCards } from '../constants'

// Mock do auth store com usuario configuravel
let mockUser: { id: number; full_name: string; username: string; role: string; is_admin: boolean } | null = null

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory e hoisted
    const { createElement } = require('react') as typeof import('react')
    return createElement('a', { href: to, ...props }, children)
  },
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      user: mockUser,
      logout: vi.fn(),
    }
    return selector(state)
  },
}))

describe('DashboardPageV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = null
  })

  it('deve renderizar saudacao com primeiro nome do usuario', () => {
    mockUser = { id: 1, full_name: 'Joao Silva', username: 'joao', role: 'user', is_admin: false }

    render(<DashboardPageV2 />)

    // A saudacao contem o primeiro nome
    expect(screen.getByText(/Joao$/)).toBeInTheDocument()
  })

  it('deve usar fallback para username quando full_name nao tem conteudo util', () => {
    // full_name = 'X' -> split(' ')[0] = 'X' (nao e vazio, usa X)
    mockUser = { id: 1, full_name: 'X', username: 'admin_user', role: 'admin', is_admin: true }

    render(<DashboardPageV2 />)

    // Deve exibir primeiro "nome" (X) na saudacao
    expect(screen.getByText(/, X$/)).toBeInTheDocument()
  })

  it('deve exibir "Usuario" quando nao ha usuario logado', () => {
    mockUser = null

    render(<DashboardPageV2 />)

    expect(screen.getByText(/Usuario$/)).toBeInTheDocument()
  })

  it('deve renderizar todos os cards de sistema com titulos e descricoes', () => {
    mockUser = { id: 1, full_name: 'Teste', username: 'teste', role: 'user', is_admin: false }

    render(<DashboardPageV2 />)

    for (const card of systemCards) {
      expect(screen.getByText(card.title)).toBeInTheDocument()
      expect(screen.getByText(card.description)).toBeInTheDocument()
    }
  })

  it('deve ter links corretos nos cards de sistema', () => {
    mockUser = { id: 1, full_name: 'Teste', username: 'teste', role: 'user', is_admin: false }

    render(<DashboardPageV2 />)

    for (const card of systemCards) {
      const link = screen.getByText(card.title).closest('a')
      expect(link).toHaveAttribute('href', card.to)
    }
  })

  it('nao deve exibir secao de administracao para usuario comum', () => {
    mockUser = { id: 1, full_name: 'Teste', username: 'teste', role: 'user', is_admin: false }

    render(<DashboardPageV2 />)

    expect(screen.queryByText('Administracao')).not.toBeInTheDocument()
  })

  it('deve exibir secao de administracao para usuario admin', () => {
    mockUser = { id: 1, full_name: 'Admin', username: 'admin', role: 'admin', is_admin: true }

    render(<DashboardPageV2 />)

    expect(screen.getByText('Administracao')).toBeInTheDocument()
  })

  it('deve renderizar todos os cards admin quando secao esta aberta', () => {
    mockUser = { id: 1, full_name: 'Admin', username: 'admin', role: 'admin', is_admin: true }

    render(<DashboardPageV2 />)

    for (const card of adminCards) {
      expect(screen.getByText(card.title)).toBeInTheDocument()
    }

    // Verifica subtitulos (alguns podem ser duplicados, ex: "Logs de chamadas IA")
    const uniqueSubtitles = new Set(adminCards.map((c) => c.subtitle))
    for (const subtitle of uniqueSubtitles) {
      const count = adminCards.filter((c) => c.subtitle === subtitle).length
      expect(screen.getAllByText(subtitle)).toHaveLength(count)
    }
  })

  it('deve ter links corretos nos cards admin', () => {
    mockUser = { id: 1, full_name: 'Admin', username: 'admin', role: 'admin', is_admin: true }

    render(<DashboardPageV2 />)

    for (const card of adminCards) {
      const link = screen.getByText(card.title).closest('a')
      expect(link).toHaveAttribute('href', card.to)
    }
  })

  it('deve ocultar cards admin ao clicar no botao de toggle', async () => {
    mockUser = { id: 1, full_name: 'Admin', username: 'admin', role: 'admin', is_admin: true }
    const user = userEvent.setup()

    render(<DashboardPageV2 />)

    // Verifica que cards admin estao visiveis inicialmente
    expect(screen.getByText(adminCards[0].title)).toBeInTheDocument()

    // Clica no botao de toggle (contem texto "Administracao")
    const toggleButton = screen.getByText('Administracao').closest('button')!
    await user.click(toggleButton)

    // Subtitulos dos cards admin devem sumir
    expect(screen.queryByText(adminCards[0].subtitle)).not.toBeInTheDocument()
  })

  it('deve exibir texto "Acessar" em cada card de sistema', () => {
    mockUser = { id: 1, full_name: 'Teste', username: 'teste', role: 'user', is_admin: false }

    render(<DashboardPageV2 />)

    const accessTexts = screen.getAllByText('Acessar')
    expect(accessTexts).toHaveLength(systemCards.length)
  })

  it('deve exibir data formatada com dia e mes', () => {
    mockUser = { id: 1, full_name: 'Teste', username: 'teste', role: 'user', is_admin: false }

    render(<DashboardPageV2 />)

    // A data formatada em pt-BR contem "de" (ex: "12 de fevereiro")
    const dateElement = screen.getByText(/\d+ de \w+/i)
    expect(dateElement).toBeInTheDocument()
  })
})
