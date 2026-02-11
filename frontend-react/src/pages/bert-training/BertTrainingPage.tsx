import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Brain,
  Play,
  Square,
  FlaskConical,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Upload,
  Trash2,
  Wifi,
  Cpu,
  Terminal,
  FileText,
  Zap,
  Settings,
  Layers,
  ChevronRight,
  ChevronLeft,
  Eye,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { bertApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type {
  Dataset,
  TrainingJob,
  TrainingMetrics,
  ModelInfo,
  PredictionResult,
  ComparisonResult,
  TrainingConfig,
} from '@/types/bert-training'
import { cn } from '@/lib/utils'

// ============================================================================
// Tipos locais auxiliares
// ============================================================================

/** Informacoes de GPU do worker */
interface GpuInfo {
  gpu_name: string
  gpu_memory_total: string
  gpu_memory_used: string
  gpu_memory_free: string
  gpu_utilization: string
  cuda_version: string
  driver_version: string
}

/** Status de conexao com o worker */
interface WorkerStatus {
  connected: boolean
  url: string
  latency_ms: number
  version: string
  uptime: string
  error?: string
}

/** Resultado de validacao do dataset (12.12) */
interface DatasetValidation {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  categories_count: Record<string, number>
  warnings: string[]
  errors: string[]
  sample_rows: Array<{ texto: string; categoria: string }>
}

/** Resultado de classificacao de PDF (12.7) */
interface PdfClassificationResult {
  filename: string
  total_pages: number
  chunks: Array<{ texto: string; categoria_predita: string; confianca: number }>
}

/** Entrada de log em tempo real (12.23) */
interface LogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
}

/** Filtro de status para runs (12.24) */
type RunStatusFilter = 'all' | 'running' | 'completed' | 'failed'

/** Passo do wizard de upload de dataset (12.26) */
type UploadStep = 1 | 2 | 3 | 4

// ============================================================================
// Constantes
// ============================================================================

/** Intervalo de polling para jobs em execucao (ms) */
const POLLING_INTERVAL = 5000

/** Intervalo de polling para logs em tempo real (ms) */
const LOG_POLLING_INTERVAL = 3000

/** Modelos base disponiveis para treinamento */
const MODELOS_BASE = [
  { value: 'neuralmind/bert-base-portuguese-cased', label: 'BERTimbau (Base)' },
  { value: 'neuralmind/bert-large-portuguese-cased', label: 'BERTimbau (Large)' },
  { value: 'bert-base-multilingual-cased', label: 'BERT Multilingual' },
]

/** Valores padrao de hiperparametros */
const DEFAULT_CONFIG: TrainingConfig = {
  modelo_base: 'neuralmind/bert-base-portuguese-cased',
  learning_rate: 2e-5,
  batch_size: 16,
  num_epochs: 5,
  max_length: 256,
}

/** Presets de treinamento (12.17) */
const TRAINING_PRESETS = [
  {
    id: 'padrao',
    label: 'Padrao',
    description: 'Configuracao balanceada para a maioria dos casos. Bom equilibrio entre velocidade e qualidade.',
    icon: Settings,
    config: { ...DEFAULT_CONFIG },
    color: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 'rapido',
    label: 'Rapido',
    description: 'Treinamento acelerado com menos epocas. Ideal para testes rapidos e prototipagem.',
    icon: Zap,
    config: {
      modelo_base: 'neuralmind/bert-base-portuguese-cased',
      learning_rate: 5e-5,
      batch_size: 32,
      num_epochs: 2,
      max_length: 128,
    },
    color: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    id: 'completo',
    label: 'Completo',
    description: 'Treinamento extensivo com mais epocas e maior max_length. Melhor qualidade final.',
    icon: Layers,
    config: {
      modelo_base: 'neuralmind/bert-large-portuguese-cased',
      learning_rate: 1e-5,
      batch_size: 8,
      num_epochs: 10,
      max_length: 512,
    },
    color: 'border-green-200 bg-green-50 hover:bg-green-100',
    iconColor: 'text-green-600',
  },
] as const

/** Opcoes de filtro de status (12.24) */
const STATUS_FILTER_OPTIONS: Array<{ value: RunStatusFilter; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = [
  { value: 'all', label: 'Todos', variant: 'secondary' },
  { value: 'running', label: 'Em progresso', variant: 'default' },
  { value: 'completed', label: 'Concluido', variant: 'outline' },
  { value: 'failed', label: 'Erro', variant: 'destructive' },
]

// ============================================================================
// Helpers
// ============================================================================

/** Retorna badge colorido de acordo com o status do job */
function StatusBadge({ status }: { status: TrainingJob['status'] }) {
  const config: Record<
    TrainingJob['status'],
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
  > = {
    queued: {
      label: 'Na fila',
      variant: 'secondary',
      icon: <Clock className="mr-1 h-3 w-3" />,
    },
    running: {
      label: 'Executando',
      variant: 'default',
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    completed: {
      label: 'Concluido',
      variant: 'outline',
      icon: <CheckCircle2 className="mr-1 h-3 w-3 text-green-600" />,
    },
    failed: {
      label: 'Falhou',
      variant: 'destructive',
      icon: <XCircle className="mr-1 h-3 w-3" />,
    },
    stopping: {
      label: 'Parando',
      variant: 'secondary',
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" />,
    },
    stopped: {
      label: 'Parado',
      variant: 'secondary',
      icon: <Square className="mr-1 h-3 w-3" />,
    },
  }

  const cfg = config[status]
  return (
    <Badge variant={cfg.variant} className="gap-0">
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

/** Formata data ISO para formato brasileiro */
function formatarData(dataStr: string): string {
  try {
    return new Date(dataStr).toLocaleString('pt-BR')
  } catch {
    return dataStr
  }
}

/** Formata numero como porcentagem */
function formatarPct(valor: number): string {
  return `${(valor * 100).toFixed(2)}%`
}

/** Retorna cor do nivel de log para o terminal */
function logLevelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-400'
    case 'warning':
      return 'text-yellow-400'
    case 'debug':
      return 'text-gray-500'
    default:
      return 'text-green-400'
  }
}

// ============================================================================
// Componente principal
// ============================================================================

export function BertTrainingPage() {
  const { toast } = useToast()

  // --- Estado global ---
  const [activeTab, setActiveTab] = useState('novo-treino')

  // --- Aba 1: Novo Treino ---
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState('')
  const [config, setConfig] = useState<TrainingConfig>({ ...DEFAULT_CONFIG })
  const [startingTraining, setStartingTraining] = useState(false)
  const [activePreset, setActivePreset] = useState<string>('padrao')

  // --- Aba 2: Monitorar Jobs ---
  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null)
  const [jobMetrics, setJobMetrics] = useState<TrainingMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [stoppingJobId, setStoppingJobId] = useState<number | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 12.24 - Filtro de status para runs
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>('all')

  // 12.23 - Logs em tempo real
  const [realtimeLogs, setRealtimeLogs] = useState<LogEntry[]>([])
  const [logsAutoScroll, setLogsAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const logPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Aba 3: Testar Modelo ---
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [testText, setTestText] = useState('')
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [loadingPrediction, setLoadingPrediction] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [batchResults, setBatchResults] = useState<PredictionResult[]>([])
  const [loadingBatch, setLoadingBatch] = useState(false)

  // 12.7 - Classificar PDF (teste)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfResult, setPdfResult] = useState<PdfClassificationResult | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // 12.8 - Historico de testes
  const [testHistory, setTestHistory] = useState<PredictionResult[]>([])

  // --- Aba 4: Comparar BERT vs LLM ---
  const [compareText, setCompareText] = useState('')
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [loadingComparison, setLoadingComparison] = useState(false)

  // --- Modais globais ---
  // 12.10 - Debug conexao worker
  const [showDebugModal, setShowDebugModal] = useState(false)
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null)
  const [loadingWorkerStatus, setLoadingWorkerStatus] = useState(false)

  // 12.11 - Ajuda/Onboarding
  const [showHelpDialog, setShowHelpDialog] = useState(false)

  // 12.22 - Worker GPU info
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null)
  const [loadingGpuInfo, setLoadingGpuInfo] = useState(false)

  // 12.26 - Modal upload dataset com 4 passos
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadStep, setUploadStep] = useState<UploadStep>(1)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string[][]>([])
  const [uploadValidation, setUploadValidation] = useState<DatasetValidation | null>(null)
  const [loadingUploadValidation, setLoadingUploadValidation] = useState(false)
  const [uploadDatasetName, setUploadDatasetName] = useState('')
  const [uploadDatasetDescription, setUploadDatasetDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // 12.30 - Chunk modal (comparacao)
  const [showChunkModal, setShowChunkModal] = useState(false)
  const [selectedChunkJobId, setSelectedChunkJobId] = useState<number | null>(null)

  // ========================================================================
  // Carregamento de dados
  // ========================================================================

  /** Carrega lista de datasets */
  const fetchDatasets = useCallback(async () => {
    setLoadingDatasets(true)
    try {
      const data = await bertApi.get<Dataset[]>('/datasets')
      setDatasets(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar datasets'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingDatasets(false)
    }
  }, [toast])

  /** Carrega lista de jobs de treinamento */
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true)
    try {
      const data = await bertApi.get<TrainingJob[]>('/training/jobs')
      setJobs(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar jobs'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingJobs(false)
    }
  }, [toast])

  /** Carrega lista de modelos disponiveis para inferencia */
  const fetchModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const data = await bertApi.get<ModelInfo[]>('/inference/models')
      setModels(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar modelos'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingModels(false)
    }
  }, [toast])

  /** Carrega metricas detalhadas de um job */
  const fetchJobMetrics = useCallback(
    async (jobId: number) => {
      setLoadingMetrics(true)
      try {
        const data = await bertApi.get<TrainingMetrics>(`/training/jobs/${jobId}/metrics`)
        setJobMetrics(data)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar metricas'
        toast({ title: 'Erro', description: msg, variant: 'destructive' })
      } finally {
        setLoadingMetrics(false)
      }
    },
    [toast]
  )

  /** 12.22 - Carrega informacoes de GPU do worker */
  const fetchGpuInfo = useCallback(async () => {
    setLoadingGpuInfo(true)
    try {
      const data = await bertApi.get<GpuInfo>('/worker/gpu-info')
      setGpuInfo(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar info de GPU'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingGpuInfo(false)
    }
  }, [toast])

  /** 12.10 - Busca status de conexao do worker */
  const fetchWorkerStatus = useCallback(async () => {
    setLoadingWorkerStatus(true)
    try {
      const data = await bertApi.get<WorkerStatus>('/worker/status')
      setWorkerStatus(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao verificar conexao'
      setWorkerStatus({
        connected: false,
        url: 'N/A',
        latency_ms: 0,
        version: 'N/A',
        uptime: 'N/A',
        error: msg,
      })
    } finally {
      setLoadingWorkerStatus(false)
    }
  }, [])

  /** 12.23 - Busca logs em tempo real de um job */
  const fetchRealtimeLogs = useCallback(
    async (jobId: number) => {
      try {
        const data = await bertApi.get<LogEntry[]>(`/runs/${jobId}/logs`)
        setRealtimeLogs(data)
      } catch {
        // Silencia erros de polling de logs
      }
    },
    []
  )

  // ========================================================================
  // Efeitos de carregamento por aba
  // ========================================================================

  useEffect(() => {
    if (activeTab === 'novo-treino') {
      fetchDatasets()
      fetchGpuInfo()
    } else if (activeTab === 'monitorar') {
      fetchJobs()
    } else if (activeTab === 'testar') {
      fetchModels()
    }
  }, [activeTab, fetchDatasets, fetchJobs, fetchModels, fetchGpuInfo])

  // Polling automatico para jobs em execucao
  useEffect(() => {
    if (activeTab !== 'monitorar') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    const hasRunningJobs = jobs.some((j) => j.status === 'running' || j.status === 'queued' || j.status === 'stopping')

    if (hasRunningJobs) {
      pollingRef.current = setInterval(async () => {
        try {
          const data = await bertApi.get<TrainingJob[]>('/training/jobs')
          setJobs(data)

          // Atualiza job selecionado se estiver em execucao
          if (selectedJob) {
            const updated = data.find((j) => j.id === selectedJob.id)
            if (updated) {
              setSelectedJob(updated)
              if (updated.status === 'running' || updated.status === 'completed') {
                fetchJobMetrics(updated.id)
              }
            }
          }
        } catch {
          // Silencia erros de polling para nao poluir a tela
        }
      }, POLLING_INTERVAL)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [activeTab, jobs, selectedJob, fetchJobMetrics])

  // 12.23 - Polling de logs em tempo real para o job selecionado
  useEffect(() => {
    if (!selectedJob || selectedJob.status !== 'running') {
      if (logPollingRef.current) {
        clearInterval(logPollingRef.current)
        logPollingRef.current = null
      }
      return
    }

    // Carrega logs iniciais
    fetchRealtimeLogs(selectedJob.id)

    logPollingRef.current = setInterval(() => {
      fetchRealtimeLogs(selectedJob.id)
    }, LOG_POLLING_INTERVAL)

    return () => {
      if (logPollingRef.current) {
        clearInterval(logPollingRef.current)
        logPollingRef.current = null
      }
    }
  }, [selectedJob, fetchRealtimeLogs])

  // Auto-scroll do terminal de logs
  useEffect(() => {
    if (logsAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [realtimeLogs, logsAutoScroll])

  // ========================================================================
  // 12.24 - Jobs filtrados por status
  // ========================================================================

  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return jobs
    if (statusFilter === 'running') return jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'stopping')
    if (statusFilter === 'completed') return jobs.filter((j) => j.status === 'completed')
    if (statusFilter === 'failed') return jobs.filter((j) => j.status === 'failed' || j.status === 'stopped')
    return jobs
  }, [jobs, statusFilter])

  // ========================================================================
  // Acoes
  // ========================================================================

  /** Inicia um novo treinamento */
  const iniciarTreinamento = useCallback(async () => {
    if (!selectedDataset) {
      toast({ title: 'Campo obrigatorio', description: 'Selecione um dataset', variant: 'destructive' })
      return
    }

    setStartingTraining(true)
    try {
      await bertApi.post('/training/start', {
        dataset_id: Number(selectedDataset),
        ...config,
      })
      toast({ title: 'Treinamento iniciado', description: 'O job foi enfileirado com sucesso' })
      setActiveTab('monitorar')
      fetchJobs()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar treinamento'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setStartingTraining(false)
    }
  }, [selectedDataset, config, toast, fetchJobs])

  /** Para um job em execucao */
  const pararJob = useCallback(
    async (jobId: number) => {
      setStoppingJobId(jobId)
      try {
        await bertApi.post(`/training/jobs/${jobId}/stop`)
        toast({ title: 'Solicitacao enviada', description: 'O job sera parado em breve' })
        fetchJobs()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao parar job'
        toast({ title: 'Erro', description: msg, variant: 'destructive' })
      } finally {
        setStoppingJobId(null)
      }
    },
    [toast, fetchJobs]
  )

  /** Seleciona um job para ver detalhes */
  const selecionarJob = useCallback(
    (job: TrainingJob) => {
      setSelectedJob(job)
      setJobMetrics(job.metricas ?? null)
      setRealtimeLogs([])
      if (job.status === 'running' || job.status === 'completed') {
        fetchJobMetrics(job.id)
      }
    },
    [fetchJobMetrics]
  )

  /** Executa predicao individual */
  const executarPredicao = useCallback(async () => {
    if (!selectedModel) {
      toast({ title: 'Campo obrigatorio', description: 'Selecione um modelo', variant: 'destructive' })
      return
    }
    if (!testText.trim()) {
      toast({ title: 'Campo obrigatorio', description: 'Digite um texto para classificar', variant: 'destructive' })
      return
    }

    setLoadingPrediction(true)
    setPrediction(null)
    try {
      const result = await bertApi.post<PredictionResult>('/inference/predict', {
        model_id: Number(selectedModel),
        texto: testText.trim(),
      })
      setPrediction(result)
      // 12.8 - Adiciona ao historico de testes
      setTestHistory((prev) => [result, ...prev].slice(0, 50))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na predicao'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingPrediction(false)
    }
  }, [selectedModel, testText, toast])

  /** Executa predicao em lote */
  const executarPredicaoLote = useCallback(async () => {
    if (!selectedModel) {
      toast({ title: 'Campo obrigatorio', description: 'Selecione um modelo', variant: 'destructive' })
      return
    }
    const linhas = batchText.split('\n').filter((l) => l.trim())
    if (linhas.length === 0) {
      toast({ title: 'Campo obrigatorio', description: 'Digite textos para classificar (um por linha)', variant: 'destructive' })
      return
    }

    setLoadingBatch(true)
    setBatchResults([])
    try {
      const result = await bertApi.post<PredictionResult[]>('/inference/batch-predict', {
        model_id: Number(selectedModel),
        textos: linhas,
      })
      setBatchResults(result)
      // 12.8 - Adiciona resultados em lote ao historico
      setTestHistory((prev) => [...result, ...prev].slice(0, 50))
      toast({ title: 'Predicao em lote concluida', description: `${result.length} textos classificados` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na predicao em lote'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingBatch(false)
    }
  }, [selectedModel, batchText, toast])

  /** 12.7 - Classifica PDF de teste */
  const classificarPdf = useCallback(async () => {
    if (!selectedModel) {
      toast({ title: 'Campo obrigatorio', description: 'Selecione um modelo primeiro', variant: 'destructive' })
      return
    }
    if (!pdfFile) {
      toast({ title: 'Campo obrigatorio', description: 'Selecione um arquivo PDF', variant: 'destructive' })
      return
    }

    setLoadingPdf(true)
    setPdfResult(null)
    try {
      const formData = new FormData()
      formData.append('file', pdfFile)
      formData.append('model_id', selectedModel)
      const result = await bertApi.post<PdfClassificationResult>('/inference/classify-pdf', formData)
      setPdfResult(result)
      toast({ title: 'PDF classificado', description: `${result.chunks.length} chunks processados` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao classificar PDF'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingPdf(false)
    }
  }, [selectedModel, pdfFile, toast])

  /** 12.8 - Limpa historico de testes */
  const limparHistoricoTestes = useCallback(() => {
    setTestHistory([])
    setPrediction(null)
    setBatchResults([])
    setPdfResult(null)
    toast({ title: 'Historico limpo', description: 'O historico de testes foi removido' })
  }, [toast])

  /** Compara BERT vs LLM */
  const executarComparacao = useCallback(async () => {
    if (!compareText.trim()) {
      toast({ title: 'Campo obrigatorio', description: 'Digite um texto para comparar', variant: 'destructive' })
      return
    }

    setLoadingComparison(true)
    setComparison(null)
    try {
      const result = await bertApi.post<ComparisonResult>('/compare/bert-vs-llm', {
        texto: compareText.trim(),
      })
      setComparison(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na comparacao'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingComparison(false)
    }
  }, [compareText, toast])

  /** 12.17 - Aplica preset de treinamento */
  const aplicarPreset = useCallback((presetId: string) => {
    const preset = TRAINING_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setConfig({ ...preset.config })
      setActivePreset(presetId)
    }
  }, [])

  // ========================================================================
  // 12.26 - Acoes do wizard de upload de dataset
  // ========================================================================

  /** Passo 1: Selecao de arquivo */
  const handleUploadFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      // Le preview das primeiras linhas
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        const lines = text.split('\n').slice(0, 6)
        const rows = lines.map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))
        setUploadPreview(rows)
      }
      reader.readAsText(file)
      setUploadStep(2)
    }
  }, [])

  /** Passo 3: Validacao do dataset (12.12) */
  const validarDatasetUpload = useCallback(async () => {
    if (!uploadFile) return
    setLoadingUploadValidation(true)
    setUploadValidation(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const result = await bertApi.post<DatasetValidation>('/datasets/validate', formData)
      setUploadValidation(result)
      setUploadStep(3)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao validar dataset'
      toast({ title: 'Erro na validacao', description: msg, variant: 'destructive' })
    } finally {
      setLoadingUploadValidation(false)
    }
  }, [uploadFile, toast])

  /** Passo 4: Upload efetivo do dataset */
  const executarUploadDataset = useCallback(async () => {
    if (!uploadFile || !uploadDatasetName.trim()) {
      toast({ title: 'Campo obrigatorio', description: 'Preencha o nome do dataset', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('nome', uploadDatasetName.trim())
      if (uploadDatasetDescription.trim()) {
        formData.append('descricao', uploadDatasetDescription.trim())
      }
      await bertApi.post('/datasets/upload', formData)
      toast({ title: 'Dataset enviado', description: 'O dataset foi enviado e esta sendo processado' })
      setShowUploadDialog(false)
      resetUploadWizard()
      fetchDatasets()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar dataset'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }, [uploadFile, uploadDatasetName, uploadDatasetDescription, toast, fetchDatasets])

  /** Reseta estado do wizard de upload */
  const resetUploadWizard = useCallback(() => {
    setUploadStep(1)
    setUploadFile(null)
    setUploadPreview([])
    setUploadValidation(null)
    setUploadDatasetName('')
    setUploadDatasetDescription('')
    setLoadingUploadValidation(false)
    setUploading(false)
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }, [])

  // ========================================================================
  // Dados para graficos (recharts)
  // ========================================================================

  /** Transforma historico de metricas em dados para o recharts */
  const chartData = jobMetrics
    ? jobMetrics.historico_loss.map((loss, idx) => ({
        epoca: idx + 1,
        loss,
        accuracy: jobMetrics.historico_accuracy[idx] ?? 0,
        val_loss: jobMetrics.historico_val_loss?.[idx],
        val_accuracy: jobMetrics.historico_val_accuracy?.[idx],
      }))
    : []

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      <BreadcrumbBar
        title="Treinamento de IA"
        icon={<Brain style={{ width: 14, height: 14 }} />}
        actions={
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
            style={{ color: C.text400 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.gray100
              e.currentTarget.style.color = C.text700
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = C.text400
            }}
            onClick={() => setShowHelpDialog(true)}
            title="Ajuda"
            data-testid="btn-ajuda-onboarding"
          >
            <HelpCircle style={{ width: 16, height: 16 }} />
          </button>
        }
      />

      <ContentArea>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="novo-treino" className="gap-2" data-testid="tab-novo-treino">
              <Play className="h-4 w-4" />
              Novo Treino
            </TabsTrigger>
            <TabsTrigger value="monitorar" className="gap-2" data-testid="tab-monitorar">
              <RefreshCw className="h-4 w-4" />
              Monitorar Jobs
            </TabsTrigger>
            <TabsTrigger value="testar" className="gap-2" data-testid="tab-testar">
              <FlaskConical className="h-4 w-4" />
              Testar Modelo
            </TabsTrigger>
            <TabsTrigger value="comparar" className="gap-2" data-testid="tab-comparar">
              <GitCompareArrows className="h-4 w-4" />
              Comparar BERT vs LLM
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* ABA 1: Novo Treino                                           */}
          {/* ============================================================ */}
          <TabsContent value="novo-treino">
            {/* 12.17 - Preset cards (modos de treinamento) */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Modo de Treinamento</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="preset-cards-container">
                {TRAINING_PRESETS.map((preset) => {
                  const Icon = preset.icon
                  return (
                    <button
                      key={preset.id}
                      onClick={() => aplicarPreset(preset.id)}
                      className={cn(
                        'rounded-lg border-2 p-4 text-left transition-all',
                        preset.color,
                        activePreset === preset.id
                          ? 'ring-2 ring-primary ring-offset-2'
                          : 'opacity-80 hover:opacity-100'
                      )}
                      data-testid={`preset-card-${preset.id}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn('h-5 w-5', preset.iconColor)} />
                        <span className="font-semibold">{preset.label}</span>
                        {activePreset === preset.id && (
                          <Badge variant="default" className="ml-auto text-xs">Ativo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Selecao de dataset com botao de upload (12.26) */}
              <Card className="overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Dataset</CardTitle>
                      <CardDescription>Selecione o dataset para treinamento</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        resetUploadWizard()
                        setShowUploadDialog(true)
                      }}
                      data-testid="btn-upload-dataset"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Dataset
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingDatasets ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : datasets.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum dataset disponivel. Crie um dataset antes de iniciar o treinamento.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="dataset-select">Dataset</Label>
                        <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                          <SelectTrigger id="dataset-select" data-testid="select-dataset">
                            <SelectValue placeholder="Selecione um dataset..." />
                          </SelectTrigger>
                          <SelectContent>
                            {datasets
                              .filter((d) => d.status === 'ready')
                              .map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                  {d.nome} ({d.total_exemplos} exemplos)
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Info do dataset selecionado */}
                      {selectedDataset && (() => {
                        const ds = datasets.find((d) => d.id === Number(selectedDataset))
                        if (!ds) return null
                        return (
                          <div className="rounded-lg border p-3 text-sm" style={{ background: C.gray50, borderColor: C.gray200 }}>
                            <p><strong>Nome:</strong> {ds.nome}</p>
                            {ds.descricao && <p><strong>Descricao:</strong> {ds.descricao}</p>}
                            <p><strong>Exemplos:</strong> {ds.total_exemplos}</p>
                            <p><strong>Categorias:</strong> {ds.categorias.join(', ')}</p>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Hiperparametros */}
              <Card className="overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
                <CardHeader>
                  <CardTitle>Hiperparametros</CardTitle>
                  <CardDescription>Configure os parametros de treinamento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="modelo-base">Modelo Base</Label>
                    <Select
                      value={config.modelo_base}
                      onValueChange={(v) => setConfig((c) => ({ ...c, modelo_base: v }))}
                    >
                      <SelectTrigger id="modelo-base" data-testid="select-modelo-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODELOS_BASE.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="learning-rate">Learning Rate</Label>
                      <Input
                        id="learning-rate"
                        type="number"
                        step="0.00001"
                        min="0.000001"
                        max="0.01"
                        value={config.learning_rate}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, learning_rate: Number(e.target.value) }))
                        }
                        data-testid="input-learning-rate"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-size">Batch Size</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        min={1}
                        max={128}
                        value={config.batch_size}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, batch_size: Number(e.target.value) }))
                        }
                        data-testid="input-batch-size"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="num-epochs">Epocas</Label>
                      <Input
                        id="num-epochs"
                        type="number"
                        min={1}
                        max={100}
                        value={config.num_epochs}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, num_epochs: Number(e.target.value) }))
                        }
                        data-testid="input-num-epochs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-length">Max Length</Label>
                      <Input
                        id="max-length"
                        type="number"
                        min={32}
                        max={512}
                        value={config.max_length}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, max_length: Number(e.target.value) }))
                        }
                        data-testid="input-max-length"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={iniciarTreinamento}
                    disabled={startingTraining || !selectedDataset}
                    className="w-full h-12 text-base text-white"
                    style={{ background: C.navy950 }}
                    data-testid="btn-iniciar-treinamento"
                  >
                    {startingTraining ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-5 w-5" />
                        Iniciar Treinamento
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 12.22 - Secao de informacoes de GPU do Worker */}
            <Card className="mt-6 overflow-hidden" data-testid="worker-gpu-info-card">
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Informacoes do Worker (GPU)</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchGpuInfo} disabled={loadingGpuInfo} data-testid="btn-refresh-gpu">
                    <RefreshCw className={cn('h-4 w-4', loadingGpuInfo && 'animate-spin')} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingGpuInfo ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : gpuInfo ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid="gpu-name">
                      <p className="text-xs" style={{ color: C.text500 }}>GPU</p>
                      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{gpuInfo.gpu_name}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid="gpu-memory-total">
                      <p className="text-xs" style={{ color: C.text500 }}>Memoria Total</p>
                      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{gpuInfo.gpu_memory_total}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid="gpu-memory-used">
                      <p className="text-xs" style={{ color: C.text500 }}>Memoria em Uso</p>
                      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{gpuInfo.gpu_memory_used}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid="gpu-utilization">
                      <p className="text-xs" style={{ color: C.text500 }}>Utilizacao GPU</p>
                      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{gpuInfo.gpu_utilization}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid="gpu-memory-free">
                      <p className="text-xs" style={{ color: C.text500 }}>Memoria Livre</p>
                      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{gpuInfo.gpu_memory_free}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid="gpu-cuda-version">
                      <p className="text-xs" style={{ color: C.text500 }}>CUDA</p>
                      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{gpuInfo.cuda_version}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid="gpu-driver-version">
                      <p className="text-xs" style={{ color: C.text500 }}>Driver</p>
                      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{gpuInfo.driver_version}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nao foi possivel carregar informacoes de GPU. Verifique a conexao com o worker.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 2: Monitorar Jobs                                        */}
          {/* ============================================================ */}
          <TabsContent value="monitorar">
            {/* 12.24 - Filtro de status (pills) */}
            <div className="mb-4 flex flex-wrap gap-2" data-testid="status-filter-pills">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={statusFilter === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(option.value)}
                  data-testid={`filter-status-${option.value}`}
                  className={cn(
                    statusFilter === option.value && option.value === 'failed' && 'bg-destructive text-destructive-foreground'
                  )}
                >
                  {option.label}
                  {option.value !== 'all' && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 text-xs">
                      {option.value === 'running'
                        ? jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'stopping').length
                        : option.value === 'completed'
                          ? jobs.filter((j) => j.status === 'completed').length
                          : jobs.filter((j) => j.status === 'failed' || j.status === 'stopped').length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Lista de jobs */}
              <Card className="lg:col-span-1 overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Jobs de Treinamento</CardTitle>
                  <Button variant="ghost" size="icon" onClick={fetchJobs} disabled={loadingJobs} data-testid="btn-refresh-jobs">
                    <RefreshCw className={cn('h-4 w-4', loadingJobs && 'animate-spin')} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingJobs && jobs.length === 0 ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredJobs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum job encontrado
                    </p>
                  ) : (
                    <div className="max-h-[600px] space-y-2 overflow-y-auto">
                      {filteredJobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => selecionarJob(job)}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition-colors',
                            selectedJob?.id === job.id && 'border-primary bg-primary/5'
                          )}
                          style={{ borderColor: selectedJob?.id === job.id ? undefined : C.gray200 }}
                          onMouseEnter={(e) => {
                            if (selectedJob?.id !== job.id) e.currentTarget.style.background = C.gray50
                          }}
                          onMouseLeave={(e) => {
                            if (selectedJob?.id !== job.id) e.currentTarget.style.background = 'transparent'
                          }}
                          data-testid={`job-item-${job.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Job #{job.id}</span>
                            <StatusBadge status={job.status} />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {job.dataset_nome}
                          </p>
                          {job.status === 'running' && (
                            <div className="mt-2">
                              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                <span>Epoca {job.epoca_atual}/{job.total_epocas}</span>
                                <span>{job.progresso}%</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full" style={{ background: C.gray200 }}>
                                <div
                                  className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${job.progresso}%`, background: C.navy700 }}
                                />
                              </div>
                            </div>
                          )}
                          {/* 12.30 - Botao de ver chunks ao lado do job concluido */}
                          {job.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedChunkJobId(job.id)
                                setShowChunkModal(true)
                              }}
                              data-testid={`btn-chunks-job-${job.id}`}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Ver Chunks
                            </Button>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detalhes do job selecionado */}
              <Card className="lg:col-span-2 overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
                <CardHeader>
                  <CardTitle>
                    {selectedJob ? `Detalhes - Job #${selectedJob.id}` : 'Detalhes do Job'}
                  </CardTitle>
                  <CardDescription>
                    {selectedJob
                      ? `Dataset: ${selectedJob.dataset_nome} | Modelo: ${selectedJob.modelo_base}`
                      : 'Selecione um job para ver os detalhes'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedJob ? (
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                      <p>Selecione um job na lista ao lado</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Informacoes basicas e acoes */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <StatusBadge status={selectedJob.status} />
                          <span className="text-sm text-muted-foreground">
                            Criado em {formatarData(selectedJob.created_at)}
                          </span>
                        </div>
                        {(selectedJob.status === 'running' || selectedJob.status === 'queued') && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => pararJob(selectedJob.id)}
                            disabled={stoppingJobId === selectedJob.id}
                            data-testid="btn-parar-job"
                          >
                            {stoppingJobId === selectedJob.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="mr-2 h-4 w-4" />
                            )}
                            Parar
                          </Button>
                        )}
                      </div>

                      {/* Erro, se houver */}
                      {selectedJob.erro && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{selectedJob.erro}</AlertDescription>
                        </Alert>
                      )}

                      {/* Metricas numericas */}
                      {jobMetrics && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }}>
                            <p className="text-xs" style={{ color: C.text500 }}>Accuracy</p>
                            <p className="text-lg font-bold" style={{ color: C.statusSuccess }}>
                              {formatarPct(jobMetrics.accuracy)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }}>
                            <p className="text-xs" style={{ color: C.text500 }}>F1 Score</p>
                            <p className="text-lg font-bold" style={{ color: C.statusInfo }}>
                              {formatarPct(jobMetrics.f1_score)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }}>
                            <p className="text-xs" style={{ color: C.text500 }}>Precision</p>
                            <p className="text-lg font-bold" style={{ color: C.navy700 }}>
                              {formatarPct(jobMetrics.precision)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }}>
                            <p className="text-xs" style={{ color: C.text500 }}>Recall</p>
                            <p className="text-lg font-bold" style={{ color: C.orange600 }}>
                              {formatarPct(jobMetrics.recall)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Graficos de treinamento */}
                      {loadingMetrics ? (
                        <Skeleton className="h-64 w-full" />
                      ) : chartData.length > 0 ? (
                        <div className="space-y-4">
                          {/* Grafico de Loss */}
                          <div>
                            <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Curva de Loss</h4>
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoca" label={{ value: 'Epoca', position: 'insideBottom', offset: -5 }} />
                                <YAxis label={{ value: 'Loss', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="loss"
                                  stroke={C.statusError}
                                  name="Loss (treino)"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                                {chartData[0]?.val_loss !== undefined && (
                                  <Line
                                    type="monotone"
                                    dataKey="val_loss"
                                    stroke={C.orange500}
                                    name="Loss (validacao)"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ r: 3 }}
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Grafico de Accuracy */}
                          <div>
                            <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Curva de Accuracy</h4>
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoca" label={{ value: 'Epoca', position: 'insideBottom', offset: -5 }} />
                                <YAxis label={{ value: 'Accuracy', angle: -90, position: 'insideLeft' }} domain={[0, 1]} />
                                <Tooltip />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="accuracy"
                                  stroke={C.statusSuccess}
                                  name="Accuracy (treino)"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                                {chartData[0]?.val_accuracy !== undefined && (
                                  <Line
                                    type="monotone"
                                    dataKey="val_accuracy"
                                    stroke={C.statusInfo}
                                    name="Accuracy (validacao)"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ r: 3 }}
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : selectedJob.status === 'running' ? (
                        <div className="flex h-32 items-center justify-center text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Aguardando metricas...
                        </div>
                      ) : null}

                      {/* Matriz de confusao */}
                      {jobMetrics?.confusion_matrix && jobMetrics.labels && (
                        <div>
                          <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Matriz de Confusao</h4>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Real \ Previsto</TableHead>
                                  {jobMetrics.labels.map((label) => (
                                    <TableHead key={label} className="text-center text-xs">
                                      {label}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {jobMetrics.confusion_matrix.map((row, i) => {
                                  const maxVal = Math.max(...row)
                                  return (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs font-medium">
                                        {jobMetrics.labels?.[i]}
                                      </TableCell>
                                      {row.map((val, j) => {
                                        const intensity = maxVal > 0 ? val / maxVal : 0
                                        const isCorrect = i === j
                                        return (
                                          <TableCell
                                            key={j}
                                            className={cn(
                                              'text-center text-xs font-mono',
                                              isCorrect && intensity > 0.5
                                                ? 'bg-green-100 text-green-800'
                                                : !isCorrect && val > 0
                                                  ? 'bg-red-50 text-red-700'
                                                  : ''
                                            )}
                                          >
                                            {val}
                                          </TableCell>
                                        )
                                      })}
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* 12.23 - Terminal de logs em tempo real */}
                      {selectedJob.status === 'running' && (
                        <div data-testid="realtime-logs-terminal">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Terminal className="h-4 w-4 text-muted-foreground" />
                              <h4 className="text-sm font-medium" style={{ color: C.text900 }}>Logs em Tempo Real</h4>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLogsAutoScroll(!logsAutoScroll)}
                              data-testid="btn-toggle-autoscroll"
                            >
                              {logsAutoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
                            </Button>
                          </div>
                          <div
                            ref={logContainerRef}
                            className="h-64 overflow-y-auto rounded-lg border p-3 font-mono text-xs"
                            style={{ background: '#111827', borderColor: C.gray200 }}
                            data-testid="logs-container"
                          >
                            {realtimeLogs.length === 0 ? (
                              <p className="text-gray-500">Aguardando logs...</p>
                            ) : (
                              realtimeLogs.map((log, idx) => (
                                <div key={idx} className="leading-5">
                                  <span className="text-gray-500">{log.timestamp}</span>
                                  {' '}
                                  <span className={logLevelColor(log.level)}>
                                    [{log.level.toUpperCase()}]
                                  </span>
                                  {' '}
                                  <span className="text-gray-200">{log.message}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 3: Testar Modelo                                         */}
          {/* ============================================================ */}
          <TabsContent value="testar">
            {/* 12.8 - Barra de acoes do teste com botao Limpar Historico */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: C.text900 }}>Testes de Classificacao</h3>
              <div className="flex items-center gap-2">
                {testHistory.length > 0 && (
                  <Badge variant="secondary" data-testid="badge-historico-count">
                    {testHistory.length} teste{testHistory.length !== 1 ? 's' : ''} no historico
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={limparHistoricoTestes}
                  disabled={testHistory.length === 0}
                  data-testid="btn-limpar-historico-testes"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar Historico
                </Button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Predicao individual */}
              <Card className="overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
                <CardHeader>
                  <CardTitle>Predicao Individual</CardTitle>
                  <CardDescription>Classifique um texto usando o modelo treinado</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model-select">Modelo</Label>
                    {loadingModels ? (
                      <Skeleton className="h-10 w-full" />
                    ) : models.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Nenhum modelo treinado disponivel</AlertDescription>
                      </Alert>
                    ) : (
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger id="model-select" data-testid="select-modelo-teste">
                          <SelectValue placeholder="Selecione um modelo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.nome} (Acc: {formatarPct(m.accuracy)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="test-text">Texto para classificar</Label>
                    <Textarea
                      id="test-text"
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      placeholder="Digite o texto que deseja classificar..."
                      rows={4}
                      data-testid="textarea-texto-teste"
                    />
                  </div>

                  <Button
                    onClick={executarPredicao}
                    disabled={loadingPrediction || !selectedModel || !testText.trim()}
                    className="w-full"
                    data-testid="btn-classificar-texto"
                  >
                    {loadingPrediction ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Classificando...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="mr-2 h-4 w-4" />
                        Classificar
                      </>
                    )}
                  </Button>

                  {/* Resultado da predicao */}
                  {prediction && (
                    <div className="space-y-3 rounded-lg border p-4" style={{ background: C.gray50, borderColor: C.gray200 }} data-testid="resultado-predicao">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: C.text700 }}>Categoria predita:</span>
                        <Badge variant="default" className="text-sm">
                          {prediction.categoria_predita}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: C.text700 }}>Confianca:</span>
                        <span className="text-sm font-bold" style={{ color: C.statusSuccess }}>
                          {formatarPct(prediction.confianca)}
                        </span>
                      </div>

                      {/* Distribuicao de probabilidades */}
                      <div className="space-y-1.5 pt-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Distribuicao de probabilidades:
                        </p>
                        {prediction.todas_categorias
                          .sort((a, b) => b.probabilidade - a.probabilidade)
                          .slice(0, 5)
                          .map((cat) => (
                            <div key={cat.categoria} className="flex items-center gap-2">
                              <span className="w-28 truncate text-xs" style={{ color: C.text700 }}>{cat.categoria}</span>
                              <div className="h-2 flex-1 rounded-full" style={{ background: C.gray200 }}>
                                <div
                                  className="h-2 rounded-full"
                                  style={{ width: `${cat.probabilidade * 100}%`, background: C.navy700 }}
                                />
                              </div>
                              <span className="w-14 text-right text-xs" style={{ color: C.text500 }}>
                                {formatarPct(cat.probabilidade)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Predicao em lote */}
              <Card className="overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
                <CardHeader>
                  <CardTitle>Predicao em Lote</CardTitle>
                  <CardDescription>Classifique multiplos textos de uma vez (um por linha)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="batch-text">Textos (um por linha)</Label>
                    <Textarea
                      id="batch-text"
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      placeholder={"Texto 1 para classificar\nTexto 2 para classificar\nTexto 3 para classificar"}
                      rows={6}
                      data-testid="textarea-batch-texto"
                    />
                  </div>

                  <Button
                    onClick={executarPredicaoLote}
                    disabled={loadingBatch || !selectedModel || !batchText.trim()}
                    className="w-full"
                    data-testid="btn-classificar-lote"
                  >
                    {loadingBatch ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Classificando lote...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="mr-2 h-4 w-4" />
                        Classificar Lote
                      </>
                    )}
                  </Button>

                  {/* Resultados em lote */}
                  {batchResults.length > 0 && (
                    <div className="max-h-[400px] overflow-y-auto" data-testid="resultados-lote">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Texto</TableHead>
                            <TableHead className="text-xs">Categoria</TableHead>
                            <TableHead className="text-right text-xs">Confianca</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchResults.map((r, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="max-w-[200px] truncate text-xs">
                                {r.texto}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {r.categoria_predita}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono">
                                {formatarPct(r.confianca)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 12.7 - Classificar PDF (teste) */}
            <Card className="mt-6 overflow-hidden" data-testid="classificar-pdf-card">
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Classificar PDF (teste)</CardTitle>
                    <CardDescription>
                      Envie um arquivo PDF para classificar seus chunks com o modelo selecionado
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {/* Zona de upload de PDF */}
                  <div
                    className={cn(
                      'flex-1 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                      pdfFile ? 'border-green-300 bg-green-50' : 'hover:border-primary'
                    )}
                    style={pdfFile ? undefined : { borderColor: C.gray300 }}
                    onMouseEnter={(e) => {
                      if (!pdfFile) e.currentTarget.style.background = C.gray50
                    }}
                    onMouseLeave={(e) => {
                      if (!pdfFile) e.currentTarget.style.background = 'transparent'
                    }}
                    onClick={() => pdfInputRef.current?.click()}
                    data-testid="pdf-upload-zone"
                  >
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setPdfFile(file)
                      }}
                      data-testid="pdf-file-input"
                    />
                    {pdfFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-green-700">{pdfFile.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6 px-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPdfFile(null)
                            setPdfResult(null)
                            if (pdfInputRef.current) pdfInputRef.current.value = ''
                          }}
                          data-testid="btn-remover-pdf"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="mx-auto mb-2 h-8 w-8" style={{ color: C.text400 }} />
                        <p className="text-sm" style={{ color: C.text500 }}>
                          Clique para selecionar um arquivo PDF
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={classificarPdf}
                    disabled={loadingPdf || !selectedModel || !pdfFile}
                    data-testid="btn-classificar-pdf"
                  >
                    {loadingPdf ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="mr-2 h-4 w-4" />
                        Classificar PDF
                      </>
                    )}
                  </Button>
                </div>

                {/* Resultado da classificacao de PDF */}
                {pdfResult && (
                  <div className="space-y-3" data-testid="pdf-resultado">
                    <div className="flex items-center gap-4 text-sm">
                      <span><strong>Arquivo:</strong> {pdfResult.filename}</span>
                      <span><strong>Paginas:</strong> {pdfResult.total_pages}</span>
                      <span><strong>Chunks:</strong> {pdfResult.chunks.length}</span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">#</TableHead>
                            <TableHead className="text-xs">Trecho</TableHead>
                            <TableHead className="text-xs">Categoria</TableHead>
                            <TableHead className="text-right text-xs">Confianca</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pdfResult.chunks.map((chunk, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs font-mono">{idx + 1}</TableCell>
                              <TableCell className="max-w-[300px] truncate text-xs">
                                {chunk.texto}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {chunk.categoria_predita}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono">
                                {formatarPct(chunk.confianca)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 4: Comparar BERT vs LLM                                  */}
          {/* ============================================================ */}
          <TabsContent value="comparar">
            <Card className="overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
              <CardHeader>
                <CardTitle>Comparacao BERT vs LLM</CardTitle>
                <CardDescription>
                  Compare os resultados de classificacao entre o modelo BERT treinado e uma LLM generativa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="compare-text">Texto para comparar</Label>
                  <Textarea
                    id="compare-text"
                    value={compareText}
                    onChange={(e) => setCompareText(e.target.value)}
                    placeholder="Digite o texto que deseja classificar com ambos os modelos..."
                    rows={4}
                    data-testid="textarea-comparar"
                  />
                </div>

                <Button
                  onClick={executarComparacao}
                  disabled={loadingComparison || !compareText.trim()}
                  className="w-full"
                  data-testid="btn-comparar"
                >
                  {loadingComparison ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Comparando...
                    </>
                  ) : (
                    <>
                      <GitCompareArrows className="mr-2 h-4 w-4" />
                      Comparar
                    </>
                  )}
                </Button>

                {/* Resultado da comparacao */}
                {comparison && (
                  <div className="space-y-4" data-testid="resultado-comparacao">
                    {/* Indicador de concordancia */}
                    <Alert variant={comparison.concordam ? 'default' : 'destructive'}>
                      {comparison.concordam ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {comparison.concordam
                          ? 'Os modelos concordam na classificacao!'
                          : 'Os modelos divergem na classificacao.'}
                      </AlertDescription>
                    </Alert>

                    {/* Comparacao lado a lado */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Resultado BERT */}
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Brain className="h-5 w-5 text-blue-600" />
                          <h4 className="font-semibold text-blue-800">BERT</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">Categoria:</span>
                            <Badge className="bg-blue-600">{comparison.bert_resultado.categoria}</Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">Confianca:</span>
                            <span className="font-mono font-bold text-blue-800">
                              {formatarPct(comparison.bert_resultado.confianca)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Resultado LLM */}
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <FlaskConical className="h-5 w-5 text-purple-600" />
                          <h4 className="font-semibold text-purple-800">LLM</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-purple-700">Categoria:</span>
                            <Badge className="bg-purple-600">{comparison.llm_resultado.categoria}</Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-purple-700">Confianca:</span>
                            <span className="font-mono font-bold text-purple-800">
                              {formatarPct(comparison.llm_resultado.confianca)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      {/* ================================================================ */}
      {/* MODAIS GLOBAIS                                                   */}
      {/* ================================================================ */}

      {/* 12.10 - Modal Debug Conexao Worker */}
      <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
        <DialogContent className="max-w-md" data-testid="modal-debug-conexao">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Debug Conexao Worker
            </DialogTitle>
            <DialogDescription>
              Informacoes detalhadas sobre a conexao com o worker de treinamento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingWorkerStatus ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : workerStatus ? (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                  <span className="text-sm font-medium" style={{ color: C.text700 }}>Status</span>
                  <Badge variant={workerStatus.connected ? 'success' : 'destructive'}>
                    {workerStatus.connected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                  <span className="text-sm font-medium" style={{ color: C.text700 }}>URL</span>
                  <span className="text-sm font-mono" style={{ color: C.text500 }}>{workerStatus.url}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                  <span className="text-sm font-medium" style={{ color: C.text700 }}>Latencia</span>
                  <span className="text-sm font-mono" style={{ color: C.text900 }}>{workerStatus.latency_ms}ms</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                  <span className="text-sm font-medium" style={{ color: C.text700 }}>Versao</span>
                  <span className="text-sm font-mono" style={{ color: C.text900 }}>{workerStatus.version}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                  <span className="text-sm font-medium" style={{ color: C.text700 }}>Uptime</span>
                  <span className="text-sm font-mono" style={{ color: C.text900 }}>{workerStatus.uptime}</span>
                </div>
                {workerStatus.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{workerStatus.error}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nao foi possivel obter informacoes do worker
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fetchWorkerStatus} disabled={loadingWorkerStatus} data-testid="btn-retry-debug">
              <RefreshCw className={cn('mr-2 h-4 w-4', loadingWorkerStatus && 'animate-spin')} />
              Tentar Novamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 12.11 - Dialog de Ajuda/Onboarding */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="modal-ajuda-onboarding">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Ajuda - Sistema de Treinamento BERT
            </DialogTitle>
            <DialogDescription>
              Guia completo para utilizar o sistema de treinamento de modelos BERT
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Visao geral */}
              <div>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>O que e este sistema?</h3>
                <p className="text-sm text-muted-foreground">
                  O sistema de Treinamento BERT permite treinar modelos de classificacao de documentos
                  juridicos usando aprendizado de maquina. Voce pode criar datasets, treinar modelos
                  BERT e testar os resultados diretamente nesta interface.
                </p>
              </div>

              {/* Fluxo de trabalho */}
              <div>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>Fluxo de Trabalho</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                    <Badge className="mt-0.5 shrink-0">1</Badge>
                    <div>
                      <p className="text-sm font-medium" style={{ color: C.text900 }}>Preparar Dataset</p>
                      <p className="text-xs text-muted-foreground">
                        Faca upload de um CSV com colunas 'texto' e 'categoria'. O sistema validara
                        automaticamente o formato e a distribuicao das categorias.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                    <Badge className="mt-0.5 shrink-0">2</Badge>
                    <div>
                      <p className="text-sm font-medium" style={{ color: C.text900 }}>Configurar e Iniciar Treinamento</p>
                      <p className="text-xs text-muted-foreground">
                        Escolha um preset (Rapido, Padrao ou Completo) ou ajuste os hiperparametros
                        manualmente. Selecione o dataset e inicie o treinamento.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                    <Badge className="mt-0.5 shrink-0">3</Badge>
                    <div>
                      <p className="text-sm font-medium" style={{ color: C.text900 }}>Monitorar</p>
                      <p className="text-xs text-muted-foreground">
                        Acompanhe o progresso na aba Monitorar. Veja metricas em tempo real,
                        graficos de loss/accuracy e logs do treinamento.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
                    <Badge className="mt-0.5 shrink-0">4</Badge>
                    <div>
                      <p className="text-sm font-medium" style={{ color: C.text900 }}>Testar e Comparar</p>
                      <p className="text-xs text-muted-foreground">
                        Teste o modelo treinado com textos individuais, em lote ou com PDFs.
                        Compare os resultados com a LLM para validar a qualidade.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dicas */}
              <div>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>Dicas Importantes</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    Use o modelo BERTimbau (Base) para datasets menores e BERTimbau (Large) para resultados melhores.
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    Datasets com pelo menos 100 exemplos por categoria produzem modelos mais confiaveis.
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    Verifique a conexao com o worker antes de iniciar treinamentos longos.
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    O modelo Large requer mais memoria GPU. Verifique a disponibilidade no painel de GPU.
                  </li>
                </ul>
              </div>

              {/* Presets */}
              <div>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>Presets de Treinamento</h3>
                <div className="space-y-2">
                  <div className="rounded-lg border bg-blue-50 p-3">
                    <p className="text-sm font-medium text-blue-800">Padrao</p>
                    <p className="text-xs text-blue-600">LR: 2e-5 | Batch: 16 | Epocas: 5 | MaxLen: 256</p>
                  </div>
                  <div className="rounded-lg border bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">Rapido</p>
                    <p className="text-xs text-amber-600">LR: 5e-5 | Batch: 32 | Epocas: 2 | MaxLen: 128</p>
                  </div>
                  <div className="rounded-lg border bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-800">Completo</p>
                    <p className="text-xs text-green-600">LR: 1e-5 | Batch: 8 | Epocas: 10 | MaxLen: 512</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="btn-fechar-ajuda">Entendi</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 12.26 - Modal Upload Dataset (4 passos) */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        setShowUploadDialog(open)
        if (!open) resetUploadWizard()
      }}>
        <DialogContent className="max-w-2xl" data-testid="modal-upload-dataset">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Dataset
            </DialogTitle>
            <DialogDescription>
              Passo {uploadStep} de 4 - {
                uploadStep === 1 ? 'Selecionar arquivo' :
                uploadStep === 2 ? 'Pre-visualizar dados' :
                uploadStep === 3 ? 'Configurar dataset' :
                'Enviar dataset'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Indicador de progresso dos passos */}
          <div className="flex items-center gap-2" data-testid="upload-steps-indicator">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    step === uploadStep
                      ? 'text-white'
                      : step < uploadStep
                        ? 'text-green-700'
                        : ''
                  )}
                  style={{
                    background: step === uploadStep
                      ? C.navy950
                      : step < uploadStep
                        ? '#dcfce7'
                        : C.gray100,
                    color: step > uploadStep ? C.text400 : undefined,
                  }}
                >
                  {step < uploadStep ? <CheckCircle2 className="h-4 w-4" /> : step}
                </div>
                {step < 4 && (
                  <div className="h-0.5 w-8" style={{ background: step < uploadStep ? '#86efac' : C.gray200 }} />
                )}
              </div>
            ))}
          </div>

          {/* Passo 1: Selecionar Arquivo */}
          {uploadStep === 1 && (
            <div className="space-y-4 py-4" data-testid="upload-step-1">
              <div
                className={cn(
                  'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                  uploadFile ? 'border-green-300 bg-green-50' : 'hover:border-primary'
                )}
                style={uploadFile ? undefined : { borderColor: C.gray300 }}
                onMouseEnter={(e) => {
                  if (!uploadFile) e.currentTarget.style.background = C.gray50
                }}
                onMouseLeave={(e) => {
                  if (!uploadFile) e.currentTarget.style.background = 'transparent'
                }}
                onClick={() => uploadInputRef.current?.click()}
              >
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleUploadFileSelect}
                  data-testid="upload-file-input"
                />
                <Upload className="mx-auto mb-3 h-10 w-10" style={{ color: C.text400 }} />
                <p className="text-sm font-medium" style={{ color: C.text700 }}>Clique para selecionar um arquivo</p>
                <p className="mt-1 text-xs" style={{ color: C.text500 }}>
                  Formatos aceitos: CSV, Excel (.xlsx, .xls)
                </p>
              </div>
            </div>
          )}

          {/* Passo 2: Pre-visualizar dados */}
          {uploadStep === 2 && (
            <div className="space-y-4 py-4" data-testid="upload-step-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{uploadFile?.name}</span>
                <span className="text-muted-foreground">
                  ({((uploadFile?.size ?? 0) / 1024).toFixed(1)} KB)
                </span>
              </div>
              {uploadPreview.length > 0 && (
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.gray200 }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ background: C.gray50 }}>
                        {uploadPreview[0]?.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreview.slice(1, 6).map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="max-w-[200px] truncate px-3 py-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Mostrando as primeiras 5 linhas do arquivo. Clique em "Proximo" para validar o dataset.
              </p>
            </div>
          )}

          {/* Passo 3: Configurar (com validacao 12.12) */}
          {uploadStep === 3 && (
            <div className="space-y-4 py-4" data-testid="upload-step-3">
              {/* Campos de configuracao */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="upload-nome">Nome do Dataset *</Label>
                  <Input
                    id="upload-nome"
                    value={uploadDatasetName}
                    onChange={(e) => setUploadDatasetName(e.target.value)}
                    placeholder="Ex: Documentos Tributarios 2024"
                    data-testid="input-upload-nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-descricao">Descricao (opcional)</Label>
                  <Textarea
                    id="upload-descricao"
                    value={uploadDatasetDescription}
                    onChange={(e) => setUploadDatasetDescription(e.target.value)}
                    placeholder="Breve descricao do conteudo do dataset..."
                    rows={2}
                    data-testid="input-upload-descricao"
                  />
                </div>
              </div>

              {/* 12.12 - Resultado da validacao */}
              {loadingUploadValidation ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : uploadValidation ? (
                <div className="space-y-3" data-testid="dataset-validation-result">
                  {/* Estatisticas */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-2 text-center">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">{uploadValidation.total_rows}</p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-center">
                      <p className="text-xs text-green-600">Validos</p>
                      <p className="text-lg font-bold text-green-700">{uploadValidation.valid_rows}</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center">
                      <p className="text-xs text-red-600">Invalidos</p>
                      <p className="text-lg font-bold text-red-700">{uploadValidation.invalid_rows}</p>
                    </div>
                  </div>

                  {/* Distribuicao de categorias */}
                  {uploadValidation.categories_count && Object.keys(uploadValidation.categories_count).length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Categorias encontradas:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(uploadValidation.categories_count).map(([cat, count]) => (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {cat}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {uploadValidation.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-sm">Avisos</AlertTitle>
                      <AlertDescription>
                        <ul className="mt-1 space-y-1">
                          {uploadValidation.warnings.map((w, i) => (
                            <li key={i} className="text-xs">{w}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Erros */}
                  {uploadValidation.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-sm">Erros</AlertTitle>
                      <AlertDescription>
                        <ul className="mt-1 space-y-1">
                          {uploadValidation.errors.map((err, i) => (
                            <li key={i} className="text-xs">{err}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Passo 4: Confirmar e enviar */}
          {uploadStep === 4 && (
            <div className="space-y-4 py-4" data-testid="upload-step-4">
              <div className="rounded-lg border p-4" style={{ background: C.gray50, borderColor: C.gray200 }}>
                <h4 className="mb-3 text-sm font-medium" style={{ color: C.text900 }}>Resumo do Upload</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arquivo:</span>
                    <span className="font-medium">{uploadFile?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="font-medium">{uploadDatasetName}</span>
                  </div>
                  {uploadDatasetDescription && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descricao:</span>
                      <span className="font-medium truncate max-w-[250px]">{uploadDatasetDescription}</span>
                    </div>
                  )}
                  {uploadValidation && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Registros validos:</span>
                        <span className="font-medium">{uploadValidation.valid_rows}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categorias:</span>
                        <span className="font-medium">{Object.keys(uploadValidation.categories_count).length}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Enviando dataset...</span>
                </div>
              )}
            </div>
          )}

          {/* Navegacao entre passos */}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div>
              {uploadStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setUploadStep((s) => Math.max(1, s - 1) as UploadStep)}
                  disabled={uploading}
                  data-testid="btn-upload-anterior"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="ghost" disabled={uploading} data-testid="btn-upload-cancelar">
                  Cancelar
                </Button>
              </DialogClose>
              {uploadStep < 4 ? (
                <Button
                  onClick={() => {
                    if (uploadStep === 2) {
                      // Ao ir do passo 2 para o 3, valida o dataset
                      validarDatasetUpload()
                    } else {
                      setUploadStep((s) => Math.min(4, s + 1) as UploadStep)
                    }
                  }}
                  disabled={
                    (uploadStep === 1 && !uploadFile) ||
                    (uploadStep === 2 && loadingUploadValidation) ||
                    (uploadStep === 3 && !uploadDatasetName.trim())
                  }
                  data-testid="btn-upload-proximo"
                >
                  Proximo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={executarUploadDataset}
                  disabled={uploading || !uploadDatasetName.trim()}
                  data-testid="btn-upload-enviar"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Enviar Dataset
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 12.30 - Modal de comparacao de chunks */}
      <Dialog open={showChunkModal} onOpenChange={setShowChunkModal}>
        <DialogContent className="max-w-3xl max-h-[80vh]" data-testid="modal-chunks-comparacao">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Chunks do Job #{selectedChunkJobId}
            </DialogTitle>
            <DialogDescription>
              Visualize e compare os chunks processados durante o treinamento
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedChunkJobId && (() => {
              const job = jobs.find((j) => j.id === selectedChunkJobId)
              if (!job) return <p className="text-sm text-muted-foreground">Job nao encontrado</p>

              return (
                <div className="space-y-4">
                  {/* Informacoes do job */}
                  <div className="flex items-center gap-4 rounded-lg border p-3" style={{ background: C.gray50, borderColor: C.gray200 }}>
                    <StatusBadge status={job.status} />
                    <div className="text-sm">
                      <span className="font-medium">{job.dataset_nome}</span>
                      <span className="ml-2 text-muted-foreground">
                        {job.total_epocas} epocas | {job.modelo_base.split('/').pop()}
                      </span>
                    </div>
                  </div>

                  {/* Metricas resumidas */}
                  {job.metricas && (
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded border p-2 text-center" style={{ borderColor: C.gray200 }}>
                        <p className="text-xs" style={{ color: C.text500 }}>Accuracy</p>
                        <p className="text-sm font-bold" style={{ color: C.statusSuccess }}>{formatarPct(job.metricas.accuracy)}</p>
                      </div>
                      <div className="rounded border p-2 text-center" style={{ borderColor: C.gray200 }}>
                        <p className="text-xs" style={{ color: C.text500 }}>F1</p>
                        <p className="text-sm font-bold" style={{ color: C.statusInfo }}>{formatarPct(job.metricas.f1_score)}</p>
                      </div>
                      <div className="rounded border p-2 text-center" style={{ borderColor: C.gray200 }}>
                        <p className="text-xs" style={{ color: C.text500 }}>Precision</p>
                        <p className="text-sm font-bold" style={{ color: C.navy700 }}>{formatarPct(job.metricas.precision)}</p>
                      </div>
                      <div className="rounded border p-2 text-center" style={{ borderColor: C.gray200 }}>
                        <p className="text-xs" style={{ color: C.text500 }}>Recall</p>
                        <p className="text-sm font-bold" style={{ color: C.orange600 }}>{formatarPct(job.metricas.recall)}</p>
                      </div>
                    </div>
                  )}

                  {/* Historico de loss por epoca (como chunks) */}
                  {job.metricas?.historico_loss && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Progresso por Epoca</h4>
                      <div className="space-y-2">
                        {job.metricas.historico_loss.map((loss, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-4 rounded-lg border p-3 transition-colors"
                            style={{ borderColor: C.gray200 }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                            data-testid={`chunk-epoca-${idx + 1}`}
                          >
                            <Badge variant="outline" className="shrink-0">
                              Epoca {idx + 1}
                            </Badge>
                            <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Loss:</span>
                                <span className="font-mono text-red-600">{loss.toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Accuracy:</span>
                                <span className="font-mono text-green-600">
                                  {job.metricas?.historico_accuracy[idx]
                                    ? formatarPct(job.metricas.historico_accuracy[idx])
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                            {/* Comparacao visual de melhoria */}
                            {idx > 0 && (
                              <div className="shrink-0">
                                {loss < job.metricas!.historico_loss[idx - 1] ? (
                                  <Badge variant="success" className="text-xs">Melhorou</Badge>
                                ) : (
                                  <Badge variant="warning" className="text-xs">Piorou</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Datas */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Criado: {formatarData(job.created_at)}</span>
                    <span>Atualizado: {formatarData(job.updated_at)}</span>
                  </div>
                </div>
              )
            })()}
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="btn-fechar-chunks">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </ContentArea>
    </>
  )
}
