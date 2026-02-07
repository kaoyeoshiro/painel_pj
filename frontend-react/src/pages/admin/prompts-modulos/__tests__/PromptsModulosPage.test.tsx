import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptsModulosPage } from '../PromptsModulosPage'
import * as api from '@/lib/api'

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock da API
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn()
  }
}))

const mockGrupos = [
  {
    id: 1,
    nome: 'Grupo Teste',
    descricao: 'Descrição do grupo',
    ordem: 1,
    ativo: true
  },
  {
    id: 2,
    nome: 'Grupo 2',
    descricao: null,
    ordem: 2,
    ativo: true
  }
]

const mockModulos = [
  {
    id: 1,
    titulo: 'Módulo 1',
    conteudo: 'Conteúdo do módulo 1',
    categoria: 'Categoria A',
    group_id: 1,
    subgroup_id: null,
    tags: ['tag1', 'tag2'],
    tipo: 'conteudo' as const,
    ordem: 1,
    ativo: true,
    modo_ativacao: 'llm' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    updated_by: 'admin'
  },
  {
    id: 2,
    titulo: 'Módulo 2',
    conteudo: 'Conteúdo do módulo 2',
    categoria: 'Categoria B',
    group_id: 1,
    subgroup_id: null,
    tags: ['tag3'],
    tipo: 'instrucao' as const,
    ordem: 2,
    ativo: false,
    modo_ativacao: 'deterministic' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    updated_by: 'admin'
  },
  {
    id: 3,
    titulo: 'Módulo 3',
    conteudo: 'Conteúdo do módulo 3',
    categoria: 'Categoria A',
    group_id: 1,
    subgroup_id: null,
    tags: [],
    tipo: 'exemplo' as const,
    ordem: 3,
    ativo: true,
    modo_ativacao: 'llm' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-04T00:00:00Z',
    updated_by: null
  }
]

const mockSubgrupos = [
  {
    id: 1,
    group_id: 1,
    nome: 'Subgrupo 1',
    descricao: 'Descrição do subgrupo',
    ordem: 1,
    ativo: true
  }
]

describe('PromptsModulosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar a página e carregar grupos e módulos', async () => {
    vi.mocked(api.adminApi.get).mockImplementation(async (url: string) => {
      if (url === '/admin/api/prompts-modulos/grupos') {
        return mockGrupos
      }
      if (url.startsWith('/admin/api/prompts-modulos?group_id=')) {
        return mockModulos
      }
      return []
    })

    render(<PromptsModulosPage />)

    // Verifica título
    expect(screen.getByText('Módulos de Prompts')).toBeInTheDocument()

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Verifica que os módulos foram carregados
    expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    expect(screen.getByText('Módulo 2')).toBeInTheDocument()
    expect(screen.getByText('Módulo 3')).toBeInTheDocument()

    // Verifica agrupamento por categoria
    expect(screen.getByText('Categoria A')).toBeInTheDocument()
    expect(screen.getByText('Categoria B')).toBeInTheDocument()

    // Verifica que a API foi chamada corretamente
    expect(api.adminApi.get).toHaveBeenCalledWith('/admin/api/prompts-modulos/grupos')
    expect(api.adminApi.get).toHaveBeenCalledWith('/admin/api/prompts-modulos?group_id=1')
  })

  it('deve filtrar módulos por tipo', async () => {
    vi.mocked(api.adminApi.get).mockImplementation(async (url: string) => {
      if (url === '/admin/api/prompts-modulos/grupos') {
        return mockGrupos
      }
      if (url.startsWith('/admin/api/prompts-modulos?group_id=')) {
        return mockModulos
      }
      return []
    })

    const user = userEvent.setup()
    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Todos os módulos devem estar visíveis inicialmente
    expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    expect(screen.getByText('Módulo 2')).toBeInTheDocument()
    expect(screen.getByText('Módulo 3')).toBeInTheDocument()

    // Clica no filtro de tipo "Instrução" (pega todos e usa o primeiro, que é o badge de filtro)
    const filtroInstrucao = screen.getAllByText('Instrução')[0]
    await user.click(filtroInstrucao)

    // Apenas o Módulo 2 (tipo instrucao) deve estar visível
    await waitFor(() => {
      expect(screen.queryByText('Módulo 1')).not.toBeInTheDocument()
      expect(screen.getByText('Módulo 2')).toBeInTheDocument()
      expect(screen.queryByText('Módulo 3')).not.toBeInTheDocument()
    })
  })

  it('deve abrir dialog de criação ao clicar em Novo Módulo', async () => {
    vi.mocked(api.adminApi.get).mockImplementation(async (url: string) => {
      if (url === '/admin/api/prompts-modulos/grupos') {
        return mockGrupos
      }
      if (url.startsWith('/admin/api/prompts-modulos?group_id=')) {
        return mockModulos
      }
      return []
    })

    const user = userEvent.setup()
    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Clica no botão Novo Módulo
    const botaoNovo = screen.getByRole('button', { name: 'Novo Módulo' })
    await user.click(botaoNovo)

    // Verifica que o dialog foi aberto (agora teremos 2 "Novo Módulo": botão + título)
    await waitFor(() => {
      expect(screen.getAllByText('Novo Módulo').length).toBeGreaterThan(1)
    })

    // Verifica campos do formulário
    expect(screen.getByLabelText('Título')).toBeInTheDocument()
    expect(screen.getByLabelText('Conteúdo')).toBeInTheDocument()
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument()
  })

  it('deve criar um novo módulo com sucesso', async () => {
    vi.mocked(api.adminApi.get).mockImplementation(async (url: string) => {
      if (url === '/admin/api/prompts-modulos/grupos') {
        return mockGrupos
      }
      if (url.startsWith('/admin/api/prompts-modulos?group_id=')) {
        return mockModulos
      }
      if (url.startsWith('/admin/api/prompts-modulos/grupos/')) {
        return mockSubgrupos
      }
      return []
    })

    vi.mocked(api.adminApi.post).mockResolvedValue({
      id: 4,
      titulo: 'Novo Módulo',
      conteudo: 'Conteúdo teste',
      categoria: 'Categoria C',
      group_id: 1,
      subgroup_id: null,
      tags: ['teste'],
      tipo: 'conteudo',
      ordem: 4,
      ativo: true,
      modo_ativacao: 'llm',
      created_at: '2024-01-05T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
      updated_by: 'admin'
    })

    const user = userEvent.setup()
    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Abre dialog de criação (pega o botão, não o texto do título do dialog)
    await user.click(screen.getByRole('button', { name: 'Novo Módulo' }))

    // Preenche formulário
    await user.type(screen.getByLabelText('Título'), 'Novo Módulo')
    await user.type(screen.getByLabelText('Conteúdo'), 'Conteúdo teste')
    await user.type(screen.getByLabelText('Categoria'), 'Categoria C')
    await user.type(screen.getByLabelText('Tags (separadas por vírgula)'), 'teste')

    // Clica em Criar
    const botaoCriar = screen.getByRole('button', { name: 'Criar' })
    await user.click(botaoCriar)

    // Verifica que a API foi chamada corretamente
    await waitFor(() => {
      expect(api.adminApi.post).toHaveBeenCalledWith(
        '/admin/api/prompts-modulos',
        expect.objectContaining({
          titulo: 'Novo Módulo',
          conteudo: 'Conteúdo teste',
          categoria: 'Categoria C',
          tags: ['teste']
        })
      )
    })
  })

  it('deve buscar módulos por texto', async () => {
    vi.mocked(api.adminApi.get).mockImplementation(async (url: string) => {
      if (url === '/admin/api/prompts-modulos/grupos') {
        return mockGrupos
      }
      if (url.startsWith('/admin/api/prompts-modulos?group_id=')) {
        return mockModulos
      }
      return []
    })

    const user = userEvent.setup()
    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Todos os módulos devem estar visíveis
    expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    expect(screen.getByText('Módulo 2')).toBeInTheDocument()
    expect(screen.getByText('Módulo 3')).toBeInTheDocument()

    // Busca por "Módulo 2"
    const campoBusca = screen.getByPlaceholderText('Buscar por título ou conteúdo...')
    await user.type(campoBusca, 'Módulo 2')

    // Apenas o Módulo 2 deve estar visível
    await waitFor(() => {
      expect(screen.queryByText('Módulo 1')).not.toBeInTheDocument()
      expect(screen.getByText('Módulo 2')).toBeInTheDocument()
      expect(screen.queryByText('Módulo 3')).not.toBeInTheDocument()
    })
  })

  it('deve alternar status ativo de um módulo', async () => {
    vi.mocked(api.adminApi.get).mockImplementation(async (url: string) => {
      if (url === '/admin/api/prompts-modulos/grupos') {
        return mockGrupos
      }
      if (url.startsWith('/admin/api/prompts-modulos?group_id=')) {
        return mockModulos
      }
      return []
    })

    vi.mocked(api.adminApi.patch).mockResolvedValue({})

    const user = userEvent.setup()
    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Encontra o checkbox "Ativo" do primeiro módulo
    const checkboxes = screen.getAllByRole('checkbox')
    const primeiroCheckbox = checkboxes.find(cb => {
      const label = cb.parentElement
      return label?.textContent?.includes('Ativo')
    })

    expect(primeiroCheckbox).toBeDefined()
    await user.click(primeiroCheckbox!)

    // Verifica que a API foi chamada
    await waitFor(() => {
      expect(api.adminApi.patch).toHaveBeenCalledWith(
        '/admin/api/prompts-modulos/1/toggle'
      )
    })
  })
})
