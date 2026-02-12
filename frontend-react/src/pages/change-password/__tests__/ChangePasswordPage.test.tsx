import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { ChangePasswordPage } from '../ChangePasswordPage'
import * as api from '@/lib/api'

// Mock do navigate
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory e hoisted
    const { createElement } = require('react') as typeof import('react')
    return createElement('a', { href: to, ...props }, children)
  },
}))

// Mock da API
vi.mock('@/lib/api', () => ({
  authApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getToken: vi.fn(() => 'fake-token'),
}))

// Mock do toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deve renderizar formulario com os tres campos de senha', () => {
    render(<ChangePasswordPage />)

    expect(screen.getByLabelText('Senha Atual')).toBeInTheDocument()
    expect(screen.getByLabelText('Nova Senha')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar Nova Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /alterar senha/i })).toBeInTheDocument()
  })

  it('deve exibir titulo "Alterar Senha" e logo PGE', () => {
    render(<ChangePasswordPage />)

    // h1 e botao tem "Alterar Senha" — verificar que ambos existem
    const elements = screen.getAllByText('Alterar Senha')
    expect(elements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByAltText('PGE-MS')).toBeInTheDocument()
  })

  it('deve exibir link de cancelar apontando para /dashboard', () => {
    render(<ChangePasswordPage />)

    const cancelLink = screen.getByText('Cancelar')
    expect(cancelLink).toBeInTheDocument()
    expect(cancelLink.closest('a')).toHaveAttribute('href', '/dashboard')
  })

  it('deve exibir requisitos de senha', () => {
    render(<ChangePasswordPage />)

    expect(screen.getByText('A senha deve conter:')).toBeInTheDocument()
    expect(screen.getByText('Mínimo de 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Uma letra maiúscula')).toBeInTheDocument()
    expect(screen.getByText('Uma letra minúscula')).toBeInTheDocument()
    expect(screen.getByText('Um número')).toBeInTheDocument()
    expect(screen.getByText('Um caractere especial (!@#$%^&*)')).toBeInTheDocument()
  })

  it('deve exibir erro quando senhas nao coincidem', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'senhaAtual123')
    await user.type(screen.getByLabelText('Nova Senha'), 'NovaSenha@1')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'Diferente@1')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument()
    })
  })

  it('deve exibir erro quando senha nao tem 8 caracteres', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'atual')
    await user.type(screen.getByLabelText('Nova Senha'), 'Ab1@')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'Ab1@')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(screen.getByText('A nova senha deve ter pelo menos 8 caracteres')).toBeInTheDocument()
    })
  })

  it('deve exibir erro quando senha nao tem letra maiuscula', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'atual')
    await user.type(screen.getByLabelText('Nova Senha'), 'abcdefg1@')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'abcdefg1@')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(screen.getByText('A nova senha deve conter pelo menos uma letra maiúscula')).toBeInTheDocument()
    })
  })

  it('deve exibir erro quando senha nao tem numero', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'atual')
    await user.type(screen.getByLabelText('Nova Senha'), 'AbcDefgh@')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'AbcDefgh@')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(screen.getByText('A nova senha deve conter pelo menos um número')).toBeInTheDocument()
    })
  })

  it('deve exibir erro quando senha nao tem caractere especial', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'atual')
    await user.type(screen.getByLabelText('Nova Senha'), 'AbcDefg1h')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'AbcDefg1h')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(screen.getByText(/A nova senha deve conter pelo menos um caractere especial/)).toBeInTheDocument()
    })
  })

  it('deve chamar API e exibir sucesso quando senha valida e submetida', async () => {
    vi.mocked(api.authApi.post).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'senhaAtual123')
    await user.type(screen.getByLabelText('Nova Senha'), 'NovaSenha@1')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'NovaSenha@1')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(api.authApi.post).toHaveBeenCalledWith('/change-password', {
        current_password: 'senhaAtual123',
        new_password: 'NovaSenha@1',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Senha alterada com sucesso! Redirecionando...')).toBeInTheDocument()
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Senha alterada com sucesso',
      description: 'Sua senha foi atualizada.',
    })
  })

  it('deve exibir erro quando API falha', async () => {
    vi.mocked(api.authApi.post).mockRejectedValue(new Error('Senha atual incorreta'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'errada')
    await user.type(screen.getByLabelText('Nova Senha'), 'NovaSenha@1')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'NovaSenha@1')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(screen.getByText('Senha atual incorreta')).toBeInTheDocument()
    })
  })

  it('deve alternar visibilidade da nova senha', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    const newPasswordInput = screen.getByLabelText('Nova Senha')
    expect(newPasswordInput).toHaveAttribute('type', 'password')

    // O botao de toggle e o unico button com type="button"
    const toggleButton = document.querySelector('button[type="button"]')!
    await user.click(toggleButton)

    expect(newPasswordInput).toHaveAttribute('type', 'text')
  })

  it('deve exibir indicador de forca da senha ao digitar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Nova Senha'), 'a')

    await waitFor(() => {
      expect(screen.getByText(/Força:/)).toBeInTheDocument()
    })
  })

  it('deve exibir "Alterando..." durante o carregamento', async () => {
    vi.mocked(api.authApi.post).mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('Senha Atual'), 'senhaAtual123')
    await user.type(screen.getByLabelText('Nova Senha'), 'NovaSenha@1')
    await user.type(screen.getByLabelText('Confirmar Nova Senha'), 'NovaSenha@1')
    await user.click(screen.getByRole('button', { name: /alterar senha/i }))

    await waitFor(() => {
      expect(screen.getByText('Alterando...')).toBeInTheDocument()
    })
  })
})
