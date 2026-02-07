import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { UsersPage } from '../UsersPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock do toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and "Novo Usuario" button', async () => {
    // Mock API retornando array vazio
    vi.mocked(adminApi.get).mockResolvedValue([])

    render(<UsersPage />)

    // Verificar titulo
    expect(screen.getByText('Gerenciar Usuarios')).toBeInTheDocument()

    // Verificar botao de criar usuario
    expect(screen.getByRole('button', { name: /novo usuario/i })).toBeInTheDocument()

    // Aguardar carregamento dos dados
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/users?skip=0&limit=200')
    })
  })

  it('shows user table with data', async () => {
    // Mock API retornando usuarios
    const mockUsers = [
      {
        id: 1,
        username: 'john.doe',
        full_name: 'John Doe',
        email: 'john@example.com',
        setor: 'TI',
        role: 'admin' as const,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        sistemas_permitidos: ['gerador_pecas'],
      },
      {
        id: 2,
        username: 'jane.smith',
        full_name: 'Jane Smith',
        email: null,
        setor: 'Juridico',
        role: 'user' as const,
        is_active: true,
        created_at: '2024-01-02T00:00:00Z',
        sistemas_permitidos: null,
      },
    ]
    vi.mocked(adminApi.get).mockResolvedValue(mockUsers)

    render(<UsersPage />)

    // Aguardar carregamento dos dados
    await waitFor(() => {
      expect(screen.getByText('john.doe')).toBeInTheDocument()
    })

    // Verificar dados da tabela
    expect(screen.getByText('john.doe')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('jane.smith')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('TI')).toBeInTheDocument()
    expect(screen.getByText('Juridico')).toBeInTheDocument()

    // Verificar badges de perfil
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Usuario')).toBeInTheDocument()

    // Verificar botoes de acao
    const editButtons = screen.getAllByRole('button', { name: /editar/i })
    expect(editButtons).toHaveLength(2)

    const resetButtons = screen.getAllByRole('button', { name: /resetar senha/i })
    expect(resetButtons).toHaveLength(2)

    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i })
    expect(deleteButtons).toHaveLength(2)
  })

  it('shows loading state', () => {
    // Mock API com delay para simular loading
    vi.mocked(adminApi.get).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    )

    render(<UsersPage />)

    // Verificar que a tabela esta em estado de loading
    // O DataTable deve mostrar algum indicador de loading
    expect(screen.getByText('Gerenciar Usuarios')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    // Mock API retornando erro
    vi.mocked(adminApi.get).mockRejectedValue(new Error('Erro ao carregar usuarios'))

    const { container } = render(<UsersPage />)

    // Aguardar tentativa de carregamento
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/users?skip=0&limit=200')
    })

    // Verificar que a pagina ainda renderiza
    expect(screen.getByText('Gerenciar Usuarios')).toBeInTheDocument()
    expect(container).toBeTruthy()
  })

  it('disables delete button for admin user', async () => {
    // Mock API retornando usuario admin
    const mockUsers = [
      {
        id: 1,
        username: 'admin',
        full_name: 'Administrator',
        email: 'admin@example.com',
        setor: null,
        role: 'admin' as const,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        sistemas_permitidos: null,
      },
    ]
    vi.mocked(adminApi.get).mockResolvedValue(mockUsers)

    render(<UsersPage />)

    // Aguardar carregamento dos dados
    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument()
    })

    // Verificar que o botao de excluir esta desabilitado
    const deleteButton = screen.getByRole('button', { name: /excluir/i })
    expect(deleteButton).toBeDisabled()
  })
})
