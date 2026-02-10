import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MatriculasPage from '../MatriculasPage'
import { matriculasApi } from '@/lib/api'

// Mock do router (SystemTopbar uses Link + useNavigate)
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => <a href={props.to}>{children}</a>,
}))

// Mock do auth store (SystemTopbar uses logout)
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    logout: vi.fn(),
  }),
}))

// Mock da API
vi.mock('@/lib/api', () => ({
  matriculasApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do useToast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

describe('MatriculasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock de dados vazios por padrao
    vi.mocked(matriculasApi.get).mockResolvedValue([])
  })

  it('deve renderizar sem erros', async () => {
    // Mock das chamadas iniciais da API
    vi.mocked(matriculasApi.get).mockImplementation(async (path: string) => {
      if (path === '/files') return []
      if (path === '/config')
        return {
          version: '1.0.0',
          model: 'test-model',
          hasApiKey: true,
          has_api_key: true,
          analysis_available: true,
        }
      if (path === '/logs') return []
      return []
    })

    render(<MatriculasPage />)

    // Verifica se o titulo principal esta presente (SystemTopbar)
    await waitFor(() => {
      expect(screen.getByText('Matrículas Confrontantes')).toBeInTheDocument()
    })

    // Verifica se o subtitulo esta presente
    expect(screen.getByText('Sistema de Análise Documental')).toBeInTheDocument()

    // Verifica se o campo de matricula principal esta presente
    expect(screen.getByPlaceholderText('Ex: 12345')).toBeInTheDocument()

    // Verifica se os botoes principais estao presentes
    expect(screen.getByRole('button', { name: /analisar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /importar/i })).toBeInTheDocument()
  })

  it('deve exibir dados quando a API retorna sucesso', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        name: 'matricula-123.pdf',
        path: '/uploads/file-1',
        type: 'pdf' as const,
        size: '1.2 MB',
        date: '2024-02-07',
        analyzed: true,
      },
      {
        id: 'file-2',
        name: 'matricula-456.pdf',
        path: '/uploads/file-2',
        type: 'pdf' as const,
        size: '800 KB',
        date: '2024-02-06',
        analyzed: false,
      },
    ]

    vi.mocked(matriculasApi.get).mockImplementation(async (path: string) => {
      if (path === '/files') return mockFiles
      if (path === '/config')
        return {
          version: '1.0.0',
          model: 'test-model',
          hasApiKey: true,
          has_api_key: true,
          analysis_available: true,
        }
      if (path === '/logs') return []
      return []
    })

    render(<MatriculasPage />)

    // Aguarda os arquivos aparecerem na tela
    await waitFor(() => {
      expect(screen.getByText('matricula-123.pdf')).toBeInTheDocument()
    })

    expect(screen.getByText('matricula-456.pdf')).toBeInTheDocument()

    // Verifica se o badge "Analisado" aparece apenas no primeiro arquivo
    const analyzedBadges = screen.getAllByText('Analisado')
    expect(analyzedBadges).toHaveLength(1)

    // Verifica informacoes de tamanho e data
    expect(screen.getByText('1.2 MB - 2024-02-07')).toBeInTheDocument()
    expect(screen.getByText('800 KB - 2024-02-06')).toBeInTheDocument()
  })

  it('deve exibir lista vazia quando nao ha arquivos', async () => {
    vi.mocked(matriculasApi.get).mockImplementation(async (path: string) => {
      if (path === '/files') return []
      if (path === '/config')
        return {
          version: '1.0.0',
          model: 'test-model',
          hasApiKey: true,
          has_api_key: true,
          analysis_available: true,
        }
      if (path === '/logs') return []
      return []
    })

    render(<MatriculasPage />)

    // No legado, lista vazia permanece em branco (sem texto especial)
    await waitFor(() => {
      expect(screen.getByLabelText('lista-vazia-matriculas')).toBeInTheDocument()
    })
  })

  it('deve exibir relatorio vazio inicialmente', async () => {
    vi.mocked(matriculasApi.get).mockImplementation(async (path: string) => {
      if (path === '/files') return []
      if (path === '/config')
        return {
          version: '1.0.0',
          model: 'test-model',
          hasApiKey: true,
          has_api_key: true,
          analysis_available: true,
        }
      if (path === '/logs') return []
      return []
    })

    render(<MatriculasPage />)

    await waitFor(() => {
      expect(screen.getByText('Relatorio de Analise')).toBeInTheDocument()
    })

    expect(screen.getByText('Analise um documento para gerar o relatorio automaticamente')).toBeInTheDocument()
  })
})
