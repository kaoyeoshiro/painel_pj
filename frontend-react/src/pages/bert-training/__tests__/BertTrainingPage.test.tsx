import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BertTrainingPage } from '../BertTrainingPage'

// Mock do router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => <a href={props.to}>{children}</a>,
}))

// Mock do auth store (SystemTopbar usa useAuthStore)
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    logout: vi.fn(),
    user: { id: 1, full_name: 'Teste' },
  }),
}))

// Mock do modulo de API
vi.mock('@/lib/api', () => ({
  bertApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    blob: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

// Mock do toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock do recharts - nao renderiza bem no jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Import API mockada para configurar retornos
import { bertApi } from '@/lib/api'

// Dados de mock (espelham schemas do backend: DatasetListItem, RunListItem, etc.)
const mockDatasets = [
  {
    id: 1,
    filename: 'dataset_teste.csv',
    sha256_hash: 'abc123',
    task_type: 'text_classification',
    total_rows: 500,
    total_labels: 3,
    uploaded_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    filename: 'dataset_grande.csv',
    sha256_hash: 'def456',
    task_type: 'text_classification',
    total_rows: 2000,
    total_labels: 2,
    uploaded_at: '2026-01-20T14:00:00Z',
  },
]

const mockJobs = [
  {
    id: 1,
    name: 'Treino Saude v1',
    task_type: 'text_classification',
    base_model: 'neuralmind/bert-base-portuguese-cased',
    status: 'completed' as const,
    final_accuracy: 0.92,
    final_macro_f1: 0.89,
    created_at: '2026-01-20T10:00:00Z',
    completed_at: '2026-01-20T12:00:00Z',
  },
  {
    id: 2,
    name: 'Treino Saude v2',
    task_type: 'text_classification',
    base_model: 'neuralmind/bert-base-portuguese-cased',
    status: 'running' as const,
    final_accuracy: null,
    final_macro_f1: null,
    created_at: '2026-01-21T08:00:00Z',
    completed_at: null,
  },
]

const mockModels = [
  {
    id: 1,
    name: 'Modelo Saude v1',
    description: null,
    base_model: 'neuralmind/bert-base-portuguese-cased',
    final_accuracy: 0.92,
    f1_score: 0.89,
    completed_at: '2026-01-20T12:00:00Z',
    dataset_name: 'dataset_teste.csv',
    total_labels: 3,
    labels: ['Saude', 'Educacao', 'Meio Ambiente'],
  },
]

// Mock do status dos workers
const mockWorkersStatus = {
  training_worker: { running: false, status: 'stopped', pid: null, has_token: false },
  inference_server: { running: false, status: 'stopped', pid: null, url: 'http://localhost:8001' },
}

describe('BertTrainingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Por padrao, retorna arrays vazios para todas as chamadas GET
    vi.mocked(bertApi.get).mockResolvedValue([])
  })

  it('deve renderizar a pagina com as 4 abas', async () => {
    render(<BertTrainingPage />)

    expect(screen.getByText('Treinamento de IA')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /novo treino/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /monitorar jobs/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /testar modelo/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /comparar bert vs llm/i })).toBeInTheDocument()
  })

  it('deve mostrar lista de datasets na aba Novo Treino', async () => {
    vi.mocked(bertApi.get).mockResolvedValue(mockDatasets)

    render(<BertTrainingPage />)

    // A aba Novo Treino ja esta ativa por padrao
    await waitFor(() => {
      expect(screen.getByText('Hiperparametros')).toBeInTheDocument()
    })

    // Verifica que chamou a API de datasets
    expect(bertApi.get).toHaveBeenCalledWith('/datasets')
  })

  it('deve mostrar tabela de jobs na aba Monitorar', async () => {
    vi.mocked(bertApi.get).mockImplementation((path: string) => {
      if (path === '/datasets') return Promise.resolve(mockDatasets)
      if (path === '/workers/status') return Promise.resolve(mockWorkersStatus)
      if (path === '/runs') return Promise.resolve(mockJobs)
      return Promise.resolve([])
    })

    const user = userEvent.setup()
    render(<BertTrainingPage />)

    // Navega para aba Monitorar
    const monitorTab = screen.getByRole('tab', { name: /monitorar jobs/i })
    await user.click(monitorTab)

    await waitFor(() => {
      expect(screen.getByText('Jobs de Treinamento')).toBeInTheDocument()
    })

    // Verifica que chamou a API de runs
    await waitFor(() => {
      expect(bertApi.get).toHaveBeenCalledWith('/runs')
    })
  })

  it('deve mostrar interface de teste de modelo na aba Testar', async () => {
    vi.mocked(bertApi.get).mockImplementation((path: string) => {
      if (path === '/datasets') return Promise.resolve(mockDatasets)
      if (path === '/workers/status') return Promise.resolve(mockWorkersStatus)
      if (path === '/models/completed') return Promise.resolve(mockModels)
      return Promise.resolve([])
    })

    const user = userEvent.setup()
    render(<BertTrainingPage />)

    // Navega para aba Testar
    const testTab = screen.getByRole('tab', { name: /testar modelo/i })
    await user.click(testTab)

    await waitFor(() => {
      expect(screen.getByText('Predicao Individual')).toBeInTheDocument()
      expect(screen.getByText('Predicao em Lote')).toBeInTheDocument()
    })

    // Verifica que chamou a API de modelos
    await waitFor(() => {
      expect(bertApi.get).toHaveBeenCalledWith('/models/completed')
    })
  })

  it('deve mostrar interface de comparacao na aba Comparar', async () => {
    vi.mocked(bertApi.get).mockResolvedValue([])

    const user = userEvent.setup()
    render(<BertTrainingPage />)

    // Navega para aba Comparar
    const compareTab = screen.getByRole('tab', { name: /comparar bert vs llm/i })
    await user.click(compareTab)

    await waitFor(() => {
      expect(screen.getByText('Comparacao BERT vs LLM')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText(/digite o texto que deseja classificar com ambos/i)
      ).toBeInTheDocument()
    })
  })

  it('deve mostrar botao de iniciar treinamento desabilitado sem dataset', async () => {
    vi.mocked(bertApi.get).mockResolvedValue(mockDatasets)

    render(<BertTrainingPage />)

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /iniciar treinamento/i })
      expect(btn).toBeDisabled()
    })
  })

  it('deve chamar API de datasets e mostrar estado correto quando vazio', async () => {
    vi.mocked(bertApi.get).mockResolvedValue([])

    render(<BertTrainingPage />)

    // Verifica que a API de datasets foi chamada
    await waitFor(() => {
      expect(bertApi.get).toHaveBeenCalledWith('/datasets')
    })

    // Verifica que mostra o card de Dataset na aba Novo Treino
    expect(screen.getByText('Dataset')).toBeInTheDocument()
    expect(screen.getByText('Hiperparametros')).toBeInTheDocument()

    // Verifica que o botao de iniciar esta desabilitado (sem dataset selecionado)
    const startBtn = screen.getByRole('button', { name: /iniciar treinamento/i })
    expect(startBtn).toBeDisabled()
  })

  it('deve exibir mensagem quando nao ha jobs', async () => {
    vi.mocked(bertApi.get).mockImplementation((path: string) => {
      if (path === '/datasets') return Promise.resolve(mockDatasets)
      if (path === '/workers/status') return Promise.resolve(mockWorkersStatus)
      if (path === '/runs') return Promise.resolve([])
      return Promise.resolve([])
    })

    const user = userEvent.setup()
    render(<BertTrainingPage />)

    const monitorTab = screen.getByRole('tab', { name: /monitorar jobs/i })
    await user.click(monitorTab)

    await waitFor(() => {
      expect(screen.getByText(/nenhum job encontrado/i)).toBeInTheDocument()
    })
  })
})
