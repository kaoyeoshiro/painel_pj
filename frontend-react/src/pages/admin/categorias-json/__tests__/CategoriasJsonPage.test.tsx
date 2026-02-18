import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoriasJsonPage } from '../CategoriasJsonPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

// Mock useGruposDisponiveis (usado pelo GroupSelector)
vi.mock('@/hooks/useQueries', () => ({
  useGruposDisponiveis: () => ({
    data: {
      grupos: [{ id: 1, nome: 'PS', slug: 'ps' }],
      default_group_id: 1,
      requires_selection: false,
    },
    isLoading: false,
  }),
}))

/** Dados de teste alinhados com os tipos corretos do backend */
const mockCategorias = [
  {
    id: 1,
    nome: 'peticoes',
    titulo: 'Peticoes Iniciais',
    descricao: 'Extracao de dados de peticoes',
    codigos_documento: [500, 9500],
    formato_json: '{"campo1": {"type": "string"}}',
    instrucoes_extracao: null,
    is_residual: false,
    ativo: true,
    ordem: 1,
    source_type: 'code' as const,
    source_special_type: null,
    usa_fonte_especial: false,
    json_gerado_por_ia: true,
    json_gerado_em: '2024-06-01T00:00:00',
    criado_em: '2024-01-01T00:00:00',
    atualizado_em: '2024-01-01T00:00:00',
  },
  {
    id: 2,
    nome: 'residual',
    titulo: 'Categoria Residual',
    descricao: 'Fallback para documentos sem categoria',
    codigos_documento: [],
    formato_json: '{"generico": {"type": "string"}}',
    instrucoes_extracao: null,
    is_residual: true,
    ativo: true,
    ordem: 99,
    source_type: 'code' as const,
    source_special_type: null,
    usa_fonte_especial: false,
    json_gerado_por_ia: false,
    json_gerado_em: null,
    criado_em: '2024-01-02T00:00:00',
    atualizado_em: '2024-01-02T00:00:00',
  },
  {
    id: 3,
    nome: 'inativos_teste',
    titulo: 'Categoria Inativa',
    descricao: null,
    codigos_documento: [60],
    formato_json: '{}',
    instrucoes_extracao: null,
    is_residual: false,
    ativo: false,
    ordem: 50,
    source_type: 'code' as const,
    source_special_type: null,
    usa_fonte_especial: false,
    json_gerado_por_ia: false,
    json_gerado_em: null,
    criado_em: '2024-01-03T00:00:00',
    atualizado_em: null,
  },
]

const mockBlacklist = { codigos: [9508, 61], descricao: 'Codigos ignorados' }

/** Configura mocks padrao para GET de categorias + blacklist */
function setupDefaultMocks() {
  vi.mocked(adminApi.get).mockImplementation((url: string) => {
    if (url.includes('config/codigos-ignorados')) return Promise.resolve(mockBlacklist)
    if (url.includes('apenas_ativos')) return Promise.resolve(mockCategorias)
    if (url.includes('codigos-disponiveis')) return Promise.resolve([])
    if (url.includes('fontes-especiais')) return Promise.resolve([])
    // GET por ID
    const idMatch = url.match(/categorias-resumo-json\/(\d+)$/)
    if (idMatch) {
      const id = parseInt(idMatch[1])
      const cat = mockCategorias.find(c => c.id === id)
      return cat ? Promise.resolve(cat) : Promise.reject(new Error('Not found'))
    }
    return Promise.resolve(mockCategorias)
  })
}

describe('CategoriasJsonPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve renderizar lista com badges corretos (titulo, IA, RESIDUAL, INATIVO)', async () => {
    setupDefaultMocks()

    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Titulos como headings (nao nome tecnico)
    expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    expect(screen.getByText('Categoria Residual')).toBeInTheDocument()
    expect(screen.getByText('Categoria Inativa')).toBeInTheDocument()

    // Nomes tecnicos
    expect(screen.getByText('peticoes')).toBeInTheDocument()
    expect(screen.getByText('residual')).toBeInTheDocument()

    // Badges
    expect(screen.getByText('GERADO POR IA')).toBeInTheDocument()
    expect(screen.getByText('RESIDUAL')).toBeInTheDocument()
    expect(screen.getByText('INATIVO')).toBeInTheDocument()
  })

  it('deve carregar com apenas_ativos=false (inclui inativos)', async () => {
    setupDefaultMocks()

    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Verifica que chamou com apenas_ativos=false
    expect(adminApi.get).toHaveBeenCalledWith(
      expect.stringContaining('apenas_ativos=false')
    )
  })

  it('deve exibir code pills com overflow (+X mais)', async () => {
    // Categoria com muitos codigos
    const catMuitosCodigos = {
      ...mockCategorias[0],
      codigos_documento: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }

    vi.mocked(adminApi.get).mockImplementation((url: string) => {
      if (url.includes('config/codigos-ignorados')) return Promise.resolve(mockBlacklist)
      return Promise.resolve([catMuitosCodigos])
    })

    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Deve exibir overflow
    expect(screen.getByText('+2 mais')).toBeInTheDocument()
  })

  it('deve abrir editor para criar (campos vazios, sem motivo)', async () => {
    setupDefaultMocks()

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Clicar em Nova Categoria
    await user.click(screen.getByTestId('btn-nova-categoria'))

    // Dialog aberto
    await waitFor(() => {
      expect(screen.getByTestId('editor-dialog')).toBeInTheDocument()
    })

    // Titulo do dialog (aparece no botao e no h2 do dialog)
    expect(screen.getAllByText('Nova Categoria').length).toBeGreaterThanOrEqual(2)

    // Campo motivo NAO deve aparecer (somente edicao)
    expect(screen.queryByTestId('input-motivo')).not.toBeInTheDocument()
  })

  it('deve abrir editor para editar (campos populados, motivo visivel)', async () => {
    setupDefaultMocks()

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Clicar em Editar da primeira categoria
    await user.click(screen.getByTestId('btn-editar-1'))

    // Dialog aberto com titulo de edicao
    await waitFor(() => {
      expect(screen.getByText('Editar Categoria')).toBeInTheDocument()
    })

    // Campos populados
    await waitFor(() => {
      const nomeInput = screen.getByTestId('input-nome') as HTMLInputElement
      expect(nomeInput.value).toBe('peticoes')
      expect(nomeInput.disabled).toBe(true) // Nome e readonly em edicao
    })

    // Campo motivo deve aparecer
    expect(screen.getByTestId('input-motivo')).toBeInTheDocument()
  })

  it('deve validar campos obrigatorios (nome + titulo)', async () => {
    setupDefaultMocks()

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Abrir dialog de criacao
    await user.click(screen.getByTestId('btn-nova-categoria'))

    await waitFor(() => {
      expect(screen.getByTestId('editor-dialog')).toBeInTheDocument()
    })

    // Tentar salvar sem preencher
    await user.click(screen.getByTestId('btn-save'))

    // Deve mostrar erro inline
    await waitFor(() => {
      expect(screen.getByTestId('save-error')).toBeInTheDocument()
    })

    // API nao deve ter sido chamada
    expect(adminApi.post).not.toHaveBeenCalled()
  })

  it('deve salvar criacao com payload correto (number[], string)', async () => {
    setupDefaultMocks()
    vi.mocked(adminApi.post).mockResolvedValueOnce({
      id: 10,
      nome: 'nova_cat',
      titulo: 'Nova Cat',
    })

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Abrir dialog de criacao
    await user.click(screen.getByTestId('btn-nova-categoria'))

    await waitFor(() => {
      expect(screen.getByTestId('editor-dialog')).toBeInTheDocument()
    })

    // Preencher campos
    await user.type(screen.getByTestId('input-nome'), 'nova_cat')
    await user.type(screen.getByTestId('input-titulo'), 'Nova Cat')

    // Preencher JSON
    const formatoInput = screen.getByTestId('textarea-formato')
    await user.clear(formatoInput)
    await user.paste('{"campo": "valor"}')

    // Salvar
    await user.click(screen.getByTestId('btn-save'))

    // Verificar payload
    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith(
        '/admin/api/categorias-resumo-json',
        expect.objectContaining({
          nome: 'nova_cat',
          titulo: 'Nova Cat',
          codigos_documento: [],
          formato_json: '{"campo": "valor"}',
          ativo: true,
          source_type: 'code',
        })
      )
    })

    // Toast de sucesso
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sucesso' })
    )
  })

  it('deve desativar (nao excluir) e ocultar botao para residual', async () => {
    setupDefaultMocks()
    vi.mocked(adminApi.delete).mockResolvedValueOnce({ message: 'ok' })

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Botao Desativar presente para categoria normal
    expect(screen.getByTestId('btn-desativar-1')).toBeInTheDocument()

    // Botao Desativar AUSENTE para residual
    expect(screen.queryByTestId('btn-desativar-2')).not.toBeInTheDocument()

    // Clicar em Desativar
    await user.click(screen.getByTestId('btn-desativar-1'))

    // Dialog de confirmacao com texto "desativar"
    await waitFor(() => {
      expect(screen.getByText(/deseja desativar/i)).toBeInTheDocument()
    })

    // Confirmar
    await user.click(screen.getByTestId('btn-confirm-deactivate'))

    // Chamou DELETE (soft delete)
    await waitFor(() => {
      expect(adminApi.delete).toHaveBeenCalledWith('/admin/api/categorias-resumo-json/1')
    })

    // Toast correto
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Categoria desativada com sucesso' })
    )
  })

  it('deve exibir blacklist separada no topo com codigos numericos', async () => {
    setupDefaultMocks()

    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByTestId('blacklist-card')).toBeInTheDocument()
    })

    // Codigos da blacklist
    await waitFor(() => {
      expect(screen.getByText('9508')).toBeInTheDocument()
      expect(screen.getByText('61')).toBeInTheDocument()
    })
  })

  it('deve exibir mensagem quando nao ha categorias', async () => {
    vi.mocked(adminApi.get).mockImplementation((url: string) => {
      if (url.includes('config/codigos-ignorados')) return Promise.resolve({ codigos: [] })
      return Promise.resolve([])
    })

    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText(/nenhuma categoria cadastrada/i)).toBeInTheDocument()
    })
  })

  it('deve exibir erro ao falhar no carregamento', async () => {
    vi.mocked(adminApi.get).mockRejectedValue(new Error('Erro de rede'))

    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erro',
          variant: 'destructive'
        })
      )
    })
  })

  it('deve alternar source_type entre codigos e fonte especial', async () => {
    setupDefaultMocks()

    const user = userEvent.setup()
    render(<CategoriasJsonPage />)

    await waitFor(() => {
      expect(screen.getByText('Peticoes Iniciais')).toBeInTheDocument()
    })

    // Abrir editor
    await user.click(screen.getByTestId('btn-nova-categoria'))

    await waitFor(() => {
      expect(screen.getByTestId('editor-dialog')).toBeInTheDocument()
    })

    // Por padrao, source_type = code
    expect(screen.getByTestId('radio-source-code')).toBeChecked()
    expect(screen.getByTestId('secao-codigos-documento')).toBeInTheDocument()

    // Mudar para special
    await user.click(screen.getByTestId('radio-source-special'))

    // Secao de codigos some, fonte especial aparece
    expect(screen.queryByTestId('secao-codigos-documento')).not.toBeInTheDocument()
    expect(screen.getByTestId('secao-fonte-especial')).toBeInTheDocument()
  })
})
