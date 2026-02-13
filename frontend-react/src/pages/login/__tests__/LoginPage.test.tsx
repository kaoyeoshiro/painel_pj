import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { LoginPage } from '../LoginPage'

// Mock do navigate
const mockNavigate = vi.fn()

// Mock do auth store
const mockLogin = vi.fn()
let mockUser: { id: number; full_name: string; username: string; role: string; is_admin: boolean } | null = null

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
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
      login: mockLogin,
    }
    return selector(state)
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = null
  })

  it('deve renderizar formulario com campos de usuario e senha', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText('Usuário')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Digite seu usuário')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Digite sua senha')).toBeInTheDocument()
  })

  it('deve exibir titulo "Acessar Sistema" e logo PGE', () => {
    render(<LoginPage />)

    expect(screen.getByText('Acessar Sistema')).toBeInTheDocument()
    expect(screen.getByAltText('PGE-MS')).toBeInTheDocument()
  })

  it('deve chamar login com credenciais corretas ao submeter', async () => {
    mockLogin.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<LoginPage />)

    await user.type(screen.getByLabelText('Usuário'), 'admin')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(mockLogin).toHaveBeenCalledWith('admin', 'senha123')
  })

  it('deve navegar para /dashboard apos login com sucesso', async () => {
    mockLogin.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<LoginPage />)

    await user.type(screen.getByLabelText('Usuário'), 'admin')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' })
    })
  })

  it('deve exibir mensagem de erro quando login falha', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciais invalidas'))
    const user = userEvent.setup()

    render(<LoginPage />)

    await user.type(screen.getByLabelText('Usuário'), 'admin')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('Credenciais invalidas')).toBeInTheDocument()
    })
  })

  it('deve exibir mensagem generica quando erro nao e instancia de Error', async () => {
    mockLogin.mockRejectedValue('erro desconhecido')
    const user = userEvent.setup()

    render(<LoginPage />)

    await user.type(screen.getByLabelText('Usuário'), 'admin')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('Erro ao fazer login')).toBeInTheDocument()
    })
  })

  it('deve alternar visibilidade da senha ao clicar no botao de toggle', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const passwordInput = screen.getByLabelText('Senha')
    expect(passwordInput).toHaveAttribute('type', 'password')

    // O botao de toggle e o unico button com type="button"
    const toggleButton = document.querySelector('button[type="button"]')!
    await user.click(toggleButton)

    expect(passwordInput).toHaveAttribute('type', 'text')

    // Clica novamente para esconder
    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('deve exibir "Entrando..." durante o carregamento', async () => {
    // Mock que nunca resolve para manter o loading
    mockLogin.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()

    render(<LoginPage />)

    await user.type(screen.getByLabelText('Usuário'), 'admin')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('Entrando...')).toBeInTheDocument()
    })
  })

  it('deve redirecionar para dashboard se usuario ja esta logado', () => {
    mockUser = { id: 1, full_name: 'Teste', username: 'teste', role: 'user', is_admin: false }

    render(<LoginPage />)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' })
  })

  it('deve ter campos required para usuario e senha', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText('Usuário')).toBeRequired()
    expect(screen.getByLabelText('Senha')).toBeRequired()
  })
})
