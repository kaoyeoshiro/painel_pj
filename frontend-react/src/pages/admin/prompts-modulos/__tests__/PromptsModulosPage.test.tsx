import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptsModulosPage } from '../PromptsModulosPage'
import * as api from '@/lib/api'

// Mock do TanStack Router (usado por PageHeader e AdminSubNav)
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: () => '/admin/prompts-modulos',
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => <a href={props.to}>{children}</a>,
}))

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
  },
  getToken: vi.fn(() => null),
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
    nome: 'modulo_1',
    conteudo: 'Conteúdo do módulo 1',
    categoria: 'Categoria A',
    subcategoria: null,
    subcategoria_ids: [],
    subcategorias_nomes: [],
    group_id: 1,
    subgroup_id: null,
    tags: ['tag1', 'tag2'],
    tipo: 'conteudo' as const,
    ordem: 1,
    ativo: true,
    modo_ativacao: 'llm' as const,
    effective_activation_mode: 'llm',
    versao: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    updated_by: 'admin'
  },
  {
    id: 2,
    titulo: 'Módulo 2',
    nome: 'modulo_2',
    conteudo: 'Conteúdo do módulo 2',
    categoria: 'Categoria B',
    subcategoria: null,
    subcategoria_ids: [],
    subcategorias_nomes: [],
    group_id: 1,
    subgroup_id: null,
    tags: ['tag3'],
    tipo: 'base' as const,
    ordem: 2,
    ativo: true,
    modo_ativacao: 'deterministic' as const,
    effective_activation_mode: 'deterministic',
    versao: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    updated_by: 'admin'
  },
  {
    id: 3,
    titulo: 'Módulo 3',
    nome: 'modulo_3',
    conteudo: 'Conteúdo do módulo 3',
    categoria: 'Categoria A',
    subcategoria: null,
    subcategoria_ids: [],
    subcategorias_nomes: [],
    group_id: 1,
    subgroup_id: null,
    tags: [],
    tipo: 'peca' as const,
    ordem: 3,
    ativo: true,
    modo_ativacao: 'llm' as const,
    effective_activation_mode: 'llm',
    versao: 1,
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

function setupApiMocks() {
  vi.mocked(api.adminApi.get).mockImplementation(async (url: string) => {
    if (url === '/admin/api/prompts-modulos/grupos') {
      return mockGrupos
    }
    if (url.startsWith('/admin/api/prompts-modulos?')) {
      return mockModulos
    }
    if (url.match(/\/admin\/api\/prompts-modulos\/grupos\/\d+\/subgrupos/)) {
      return mockSubgrupos
    }
    if (url.match(/\/admin\/api\/prompts-modulos\/grupos\/\d+\/subcategorias/)) {
      return []
    }
    return []
  })
}

describe('PromptsModulosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar a página e carregar grupos e módulos', async () => {
    setupApiMocks()

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

    // Verifica que a API foi chamada corretamente
    expect(api.adminApi.get).toHaveBeenCalledWith('/admin/api/prompts-modulos/grupos')
    expect(api.adminApi.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/api/prompts-modulos?')
    )
  })

  it('deve organizar módulos por tipo: Base, Peça, Conteúdo', async () => {
    setupApiMocks()

    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Verifica seções de tipo
    expect(screen.getByText('Base (Prompt do Sistema)')).toBeInTheDocument()
    expect(screen.getByText('Peças (Estrutura/Template)')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo (Teses e Argumentos)')).toBeInTheDocument()
  })

  it('deve filtrar módulos por tipo', async () => {
    setupApiMocks()

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

    // Seleciona "Peça" no dropdown de tipo
    const tipoSelect = screen.getByDisplayValue('Todos os tipos')
    await user.selectOptions(tipoSelect, 'peca')

    // Apenas o Módulo 3 (tipo peca) deve estar visível
    await waitFor(() => {
      expect(screen.queryByText('Módulo 1')).not.toBeInTheDocument()
      expect(screen.getByText('Módulo 3')).toBeInTheDocument()
    })
  })

  it('deve abrir dialog de criação ao clicar em Novo Módulo', async () => {
    setupApiMocks()

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
    expect(screen.getByLabelText('Nome (código identificador)')).toBeInTheDocument()

    // Verifica que dropdown de tipo tem as opções corretas
    const tipoSelect = screen.getByLabelText('Tipo')
    expect(tipoSelect).toBeInTheDocument()
    // Verifica opções Base, Peça, Conteúdo (não instrucao/exemplo)
    const options = tipoSelect.querySelectorAll('option')
    const optionValues = Array.from(options).map(o => o.value)
    expect(optionValues).toContain('base')
    expect(optionValues).toContain('peca')
    expect(optionValues).toContain('conteudo')
    expect(optionValues).not.toContain('instrucao')
    expect(optionValues).not.toContain('exemplo')
  })

  it('deve criar um novo módulo com sucesso', async () => {
    setupApiMocks()

    vi.mocked(api.adminApi.post).mockResolvedValue({
      id: 4,
      titulo: 'Novo Módulo',
      nome: 'novo_modulo',
      conteudo: 'Conteúdo teste',
      categoria: 'Categoria C',
      group_id: 1,
      subgroup_id: null,
      tags: ['teste'],
      tipo: 'conteudo',
      ordem: 4,
      ativo: true,
      modo_ativacao: 'llm',
      versao: 1,
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
    setupApiMocks()

    const user = userEvent.setup()
    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Busca por "Módulo 3"
    const campoBusca = screen.getByPlaceholderText('Buscar por título ou conteúdo...')
    await user.type(campoBusca, 'Módulo 3')

    // Apenas o Módulo 3 deve estar visível
    await waitFor(() => {
      expect(screen.queryByText('Módulo 1')).not.toBeInTheDocument()
      expect(screen.getByText('Módulo 3')).toBeInTheDocument()
    })
  })

  it('deve alternar status ativo de um módulo', async () => {
    setupApiMocks()

    vi.mocked(api.adminApi.patch).mockResolvedValue({})

    const user = userEvent.setup()
    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Clica no primeiro botão de toggle (ToggleRight/ToggleLeft)
    const toggleButtons = screen.getAllByTitle(/Desativar|Ativar/)
    expect(toggleButtons.length).toBeGreaterThan(0)
    await user.click(toggleButtons[0])

    // Verifica que a API foi chamada
    await waitFor(() => {
      expect(api.adminApi.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/api\/prompts-modulos\/\d+\/toggle/)
      )
    })
  })

  it('deve mostrar filtros de tipo corretos (Base, Peça, Conteúdo)', async () => {
    setupApiMocks()

    render(<PromptsModulosPage />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Módulo 1')).toBeInTheDocument()
    })

    // Verifica opções no dropdown de tipo do filtro
    const tipoFilter = screen.getByDisplayValue('Todos os tipos')
    const filterOptions = tipoFilter.querySelectorAll('option')
    const filterValues = Array.from(filterOptions).map(o => o.value)

    expect(filterValues).toContain('')  // "Todos os tipos"
    expect(filterValues).toContain('base')
    expect(filterValues).toContain('peca')
    expect(filterValues).toContain('conteudo')
    expect(filterValues).not.toContain('instrucao')
    expect(filterValues).not.toContain('exemplo')
  })
})
