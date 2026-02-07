import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClassificadorPage } from '../ClassificadorPage'

// Mock do modulo de API
vi.mock('@/lib/api', () => ({
  classificadorApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    blob: vi.fn(),
  },
  getToken: vi.fn(() => 'fake-token'),
}))

// Mock do toast - precisa exportar ToastContext pois use-toast.ts importa dele
vi.mock('@/components/ui/toast', () => {
  const { createContext } = require('react')
  const mockToast = vi.fn()
  const ctx = createContext({
    toasts: [],
    toast: mockToast,
    dismiss: vi.fn(),
  })
  return {
    ToastContext: ctx,
    useToast: () => ({
      toast: mockToast,
      dismiss: vi.fn(),
    }),
  }
})

// Import API mockada para configurar retornos
import { classificadorApi } from '@/lib/api'

// Dados de mock
const mockPrompts = [
  {
    id: 1,
    nome: 'Prompt Padrao',
    descricao: 'Prompt de classificacao padrao',
    conteudo: 'Classifique o documento...',
    ativo: true,
    criado_em: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    nome: 'Prompt Especifico',
    conteudo: 'Classifique especificamente...',
    ativo: true,
    criado_em: '2026-01-20T10:00:00Z',
  },
]

const mockProjetos = [
  {
    id: 1,
    nome: 'Lote Janeiro',
    descricao: 'Documentos de janeiro',
    modelo: 'google/gemini-2.5-flash-lite',
    modo_processamento: 'chunk' as const,
    posicao_chunk: 'inicio' as const,
    tamanho_chunk: 1000,
    max_concurrent: 3,
    criado_em: '2026-01-15T10:00:00Z',
    atualizado_em: '2026-01-15T10:00:00Z',
    total_codigos: 10,
    total_execucoes: 2,
  },
]

describe('ClassificadorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Por padrao, retorna arrays vazios para chamadas GET
    vi.mocked(classificadorApi.get).mockImplementation((path: string) => {
      if (path === '/prompts') return Promise.resolve(mockPrompts)
      if (path === '/projetos') return Promise.resolve(mockProjetos)
      if (path === '/execucoes-em-andamento') return Promise.resolve([])
      return Promise.resolve([])
    })
  })

  it('deve renderizar o titulo da pagina', async () => {
    render(<ClassificadorPage />)

    expect(screen.getByText('Classificador de Documentos')).toBeInTheDocument()
  })

  it('deve renderizar a pagina com as 4 abas', async () => {
    render(<ClassificadorPage />)

    expect(screen.getByRole('tab', { name: /novo lote/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /meus lotes/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /prompts/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /teste rapido/i })).toBeInTheDocument()
  })

  it('deve mostrar conteudo da aba Novo Lote por padrao', async () => {
    render(<ClassificadorPage />)

    await waitFor(() => {
      expect(screen.getByText('Novo Lote de Classificacao')).toBeInTheDocument()
    })
  })

  it('deve mostrar area de upload de arquivos na aba Novo Lote', async () => {
    render(<ClassificadorPage />)

    await waitFor(() => {
      expect(screen.getByText(/arraste arquivos aqui ou clique para selecionar/i)).toBeInTheDocument()
    })
  })

  it('deve mostrar secao de configuracao com seletor de prompt', async () => {
    render(<ClassificadorPage />)

    await waitFor(() => {
      expect(screen.getByText('Configuracao')).toBeInTheDocument()
      expect(screen.getByText('Prompt')).toBeInTheDocument()
    })
  })

  it('deve ter botao Iniciar Classificacao desabilitado sem arquivos', async () => {
    render(<ClassificadorPage />)

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /iniciar classificacao/i })
      expect(btn).toBeDisabled()
    })
  })

  it('deve mostrar aba Meus Lotes quando clicada', async () => {
    const user = userEvent.setup()
    render(<ClassificadorPage />)

    const meusLotesTab = screen.getByRole('tab', { name: /meus lotes/i })
    await user.click(meusLotesTab)

    await waitFor(() => {
      // O heading h3 "Meus Lotes" aparece dentro do conteudo da aba
      expect(screen.getByRole('heading', { name: /meus lotes/i })).toBeInTheDocument()
      // Tambem verifica que o botao "Novo Lote" aparece nessa aba
      expect(screen.getByRole('button', { name: /novo lote/i })).toBeInTheDocument()
    })
  })

  it('deve mostrar aba Prompts com botao Novo Prompt quando clicada', async () => {
    const user = userEvent.setup()
    render(<ClassificadorPage />)

    const promptsTab = screen.getByRole('tab', { name: /prompts/i })
    await user.click(promptsTab)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /novo prompt/i })).toBeInTheDocument()
    })
  })

  it('deve mostrar aba Teste Rapido com botao Classificar quando clicada', async () => {
    const user = userEvent.setup()
    render(<ClassificadorPage />)

    const testeTab = screen.getByRole('tab', { name: /teste rapido/i })
    await user.click(testeTab)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /classificar/i })).toBeInTheDocument()
      expect(screen.getByText('Resultado')).toBeInTheDocument()
    })
  })

  it('deve chamar API de prompts ao montar', async () => {
    render(<ClassificadorPage />)

    await waitFor(() => {
      expect(classificadorApi.get).toHaveBeenCalledWith('/prompts')
    })
  })
})
