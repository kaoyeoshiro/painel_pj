import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptsPage } from '../PromptsPage'
import { adminApi } from '@/lib/api'

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockConfigsIA = [
  { sistema: 'matriculas', chave: 'modelo', valor: 'gemini-pro' },
  { sistema: 'matriculas', chave: 'temperatura', valor: '0.7' },
  { sistema: 'gerador_pecas', chave: 'modelo', valor: 'gemini-1.5-pro' },
  { sistema: 'global', chave: 'max_tokens', valor: '8192' },
]

const mockPrompts = {
  prompts: [
    {
      id: 1,
      sistema: 'matriculas',
      tipo: 'system',
      nome: 'Prompt Sistema Matrículas',
      descricao: 'Prompt principal do sistema',
      conteudo: 'Você é um assistente especializado em análise de matrículas.',
      is_active: true,
      updated_at: '2026-01-15T10:30:00',
      updated_by: 'admin',
    },
    {
      id: 2,
      sistema: 'gerador_pecas',
      tipo: 'analise',
      nome: 'Análise de Documentos',
      descricao: 'Prompt para análise de documentos processuais',
      conteudo: 'Analise o seguinte documento e extraia informações relevantes...',
      is_active: true,
      updated_at: '2026-01-20T14:45:00',
      updated_by: 'user123',
    },
    {
      id: 3,
      sistema: 'relatorio_cumprimento',
      tipo: 'relatorio',
      nome: 'Geração de Relatório',
      descricao: 'Prompt para geração de relatórios',
      conteudo: 'Gere um relatório detalhado baseado nos dados fornecidos...',
      is_active: false,
      updated_at: '2026-01-10T09:15:00',
    },
  ],
  total: 3,
}

describe('PromptsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve carregar e exibir configurações de IA', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve(mockConfigsIA)
      }
      if (url === '/admin/prompts') {
        return Promise.resolve(mockPrompts)
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando configurações...')).not.toBeInTheDocument()
    })

    // Verificar que a aba de Matrículas está visível
    expect(screen.getByRole('tab', { name: /Matrículas/i })).toBeInTheDocument()

    // Verificar que as configurações de matrículas são exibidas
    await waitFor(() => {
      expect(screen.getByLabelText('modelo')).toHaveValue('gemini-pro')
      expect(screen.getByLabelText('temperatura')).toHaveValue('0.7')
    })
  })

  it('deve carregar e exibir prompts', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve(mockConfigsIA)
      }
      if (url === '/admin/prompts') {
        return Promise.resolve(mockPrompts)
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando prompts...')).not.toBeInTheDocument()
    })

    // Verificar que os prompts são exibidos
    expect(screen.getByText('Prompt Sistema Matrículas')).toBeInTheDocument()
    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByText('Geração de Relatório')).toBeInTheDocument()

    // Verificar badges de tipo
    expect(screen.getByText('Sistema')).toBeInTheDocument()
    expect(screen.getByText('Análise')).toBeInTheDocument()
    expect(screen.getByText('Relatório')).toBeInTheDocument()

    // Verificar badges de status
    const ativoBadges = screen.getAllByText('Ativo')
    expect(ativoBadges).toHaveLength(2)
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('deve exibir select de filtro por sistema', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve(mockConfigsIA)
      }
      if (url === '/admin/prompts') {
        return Promise.resolve(mockPrompts)
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando prompts...')).not.toBeInTheDocument()
    })

    // Verificar que o filtro está presente
    expect(screen.getByText('Filtrar por sistema:')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Inicialmente todos os prompts devem estar visíveis
    expect(screen.getByText('Prompt Sistema Matrículas')).toBeInTheDocument()
    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByText('Geração de Relatório')).toBeInTheDocument()
  })

  it('deve salvar configurações de IA', async () => {
    const user = userEvent.setup()

    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve(mockConfigsIA)
      }
      if (url === '/admin/prompts') {
        return Promise.resolve(mockPrompts)
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    vi.mocked(adminApi.post).mockResolvedValue({ success: true })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando configurações...')).not.toBeInTheDocument()
    })

    // Alterar valor de uma configuração
    const modeloInput = screen.getByLabelText('modelo')
    await user.clear(modeloInput)
    await user.type(modeloInput, 'gemini-1.5-flash')

    // Clicar no botão Salvar
    const saveButtons = screen.getAllByRole('button', { name: /Salvar/i })
    await user.click(saveButtons[0])

    // Verificar que a API foi chamada corretamente
    await waitFor(() => {
      expect(adminApi.post).toHaveBeenCalledWith('/admin/config-ia/upsert', {
        configs: expect.arrayContaining([
          expect.objectContaining({
            sistema: 'matriculas',
            chave: 'modelo',
            valor: 'gemini-1.5-flash',
          }),
        ]),
      })
    })
  })

  it('deve abrir dialog de edição de prompt', async () => {
    const user = userEvent.setup()

    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve(mockConfigsIA)
      }
      if (url === '/admin/prompts') {
        return Promise.resolve(mockPrompts)
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando prompts...')).not.toBeInTheDocument()
    })

    // Clicar no botão Editar do primeiro prompt
    const editButtons = screen.getAllByRole('button', { name: /Editar/i })
    await user.click(editButtons[0])

    // Verificar que o dialog foi aberto
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Editar Prompt')).toBeInTheDocument()
    })

    // Verificar que os campos do dialog estão preenchidos
    const nomeInput = screen.getByLabelText('Nome')
    expect(nomeInput).toHaveValue('Prompt Sistema Matrículas')

    const descricaoInput = screen.getByLabelText('Descrição')
    expect(descricaoInput).toHaveValue('Prompt principal do sistema')

    const conteudoTextarea = screen.getByLabelText('Conteúdo')
    expect(conteudoTextarea).toHaveValue('Você é um assistente especializado em análise de matrículas.')

    const ativoCheckbox = screen.getByLabelText('Ativo')
    expect(ativoCheckbox).toBeChecked()
  })

  it('deve salvar alterações de prompt', async () => {
    const user = userEvent.setup()

    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve(mockConfigsIA)
      }
      if (url === '/admin/prompts') {
        return Promise.resolve(mockPrompts)
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    vi.mocked(adminApi.put).mockResolvedValue({ success: true })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando prompts...')).not.toBeInTheDocument()
    })

    // Abrir dialog de edição
    const editButtons = screen.getAllByRole('button', { name: /Editar/i })
    await user.click(editButtons[0])

    // Aguardar dialog abrir
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Alterar o nome
    const nomeInput = screen.getByLabelText('Nome')
    await user.clear(nomeInput)
    await user.type(nomeInput, 'Novo Nome do Prompt')

    // Desmarcar checkbox Ativo
    const ativoCheckbox = screen.getByLabelText('Ativo')
    await user.click(ativoCheckbox)

    // Clicar em Salvar no dialog
    const saveButton = screen.getByRole('button', { name: /Salvar/i })
    await user.click(saveButton)

    // Verificar que a API foi chamada
    await waitFor(() => {
      expect(adminApi.put).toHaveBeenCalledWith('/admin/prompts/1', {
        nome: 'Novo Nome do Prompt',
        descricao: 'Prompt principal do sistema',
        conteudo: 'Você é um assistente especializado em análise de matrículas.',
        is_active: false,
      })
    })

    // Verificar que o dialog foi fechado
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('deve exibir mensagem quando não há prompts', async () => {
    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve([])
      }
      if (url === '/admin/prompts') {
        return Promise.resolve({ prompts: [], total: 0 })
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando prompts...')).not.toBeInTheDocument()
    })

    // Verificar mensagem de lista vazia
    expect(screen.getByText('Nenhum prompt encontrado')).toBeInTheDocument()
  })

  it('deve alternar entre abas de sistemas', async () => {
    const user = userEvent.setup()

    vi.mocked(adminApi.get).mockImplementation((url) => {
      if (url === '/admin/config-ia') {
        return Promise.resolve(mockConfigsIA)
      }
      if (url === '/admin/prompts') {
        return Promise.resolve(mockPrompts)
      }
      return Promise.reject(new Error('Endpoint não mockado'))
    })

    render(<PromptsPage />)

    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.queryByText('Carregando configurações...')).not.toBeInTheDocument()
    })

    // Verificar que está na aba Matrículas (padrão)
    await waitFor(() => {
      const modeloInput = screen.getByLabelText('modelo')
      expect(modeloInput).toHaveValue('gemini-pro')
    })

    // Clicar na aba Gerador de Peças
    const geradorTab = screen.getByRole('tab', { name: /Gerador de Peças/i })
    await user.click(geradorTab)

    // Verificar que as configurações mudaram
    await waitFor(() => {
      const modeloInput = screen.getByLabelText('modelo')
      expect(modeloInput).toHaveValue('gemini-1.5-pro')
    })

    // Clicar na aba Global
    const globalTab = screen.getByRole('tab', { name: /Global/i })
    await user.click(globalTab)

    // Verificar que as configurações de Global são exibidas
    await waitFor(() => {
      expect(screen.getByLabelText('max_tokens')).toHaveValue('8192')
    })
  })
})
