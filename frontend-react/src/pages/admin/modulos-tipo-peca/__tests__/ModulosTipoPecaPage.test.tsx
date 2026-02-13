import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ModulosTipoPecaPage } from '../ModulosTipoPecaPage'

// Mock da API
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Import após os mocks
import { adminApi } from '@/lib/api'

describe('ModulosTipoPecaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock padrão para grupos
    vi.mocked(adminApi.get).mockImplementation((url: string) => {
      if (url === '/admin/api/prompts-modulos/grupos') {
        return Promise.resolve([
          { id: 1, nome: 'Grupo Padrão' },
          { id: 2, nome: 'Grupo Teste' },
        ])
      }

      if (url.includes('/admin/api/prompts-modulos/tipos-peca')) {
        return Promise.resolve([
          { id: 1, titulo: 'Petição Inicial', nome: 'peticao_inicial' },
          { id: 2, titulo: 'Contestação', nome: 'contestacao' },
        ])
      }

      if (url.includes('/admin/api/prompts-modulos/resumo-configuracao-tipos-peca')) {
        return Promise.resolve({
          total_modulos_conteudo: 50,
          tipos_peca: [
            {
              tipo_peca: 'peticao_inicial',
              titulo: 'Petição Inicial',
              modulos_ativos: 10,
              modulos_inativos: 5,
              total_modulos: 50,
            },
            {
              tipo_peca: 'contestacao',
              titulo: 'Contestação',
              modulos_ativos: 8,
              modulos_inativos: 7,
              total_modulos: 50,
            },
          ],
        })
      }

      return Promise.resolve([])
    })
  })

  it('should render page title', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      expect(screen.getByText('Módulos por Tipo de Peça')).toBeInTheDocument()
    })
  })

  it('should show group selector', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })
  })

  it('should show save button', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /salvar alterações/i })
      expect(saveButton).toBeInTheDocument()
    })
  })

  it('should load and display grupos', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/prompts-modulos/grupos')
    })

    await waitFor(() => {
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })
  })

  it('should display statistics cards', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      expect(screen.getByText('Tipos de Peça')).toBeInTheDocument()
      expect(screen.getByText('Módulos Disponíveis')).toBeInTheDocument()
      expect(screen.getByText('Configurações Ativas')).toBeInTheDocument()
      expect(screen.getByText('Alterações Pendentes')).toBeInTheDocument()
    })
  })

  it('should display tipos de peca after loading', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      expect(screen.getByText('Petição Inicial')).toBeInTheDocument()
      expect(screen.getByText('Contestação')).toBeInTheDocument()
    })
  })

  it('should show active and inactive badges', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      expect(screen.getByText('10 ativos')).toBeInTheDocument()
      expect(screen.getByText('5 inativos')).toBeInTheDocument()
    })
  })

  it('should display info alert', async () => {
    render(<ModulosTipoPecaPage />)

    await waitFor(() => {
      expect(screen.getByText(/Como usar:/)).toBeInTheDocument()
    })
  })
})
