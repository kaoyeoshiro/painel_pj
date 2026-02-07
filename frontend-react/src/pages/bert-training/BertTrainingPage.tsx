import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft,
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
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
// Constantes
// ============================================================================

/** Intervalo de polling para jobs em execucao (ms) */
const POLLING_INTERVAL = 5000

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

  // --- Aba 2: Monitorar Jobs ---
  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null)
  const [jobMetrics, setJobMetrics] = useState<TrainingMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [stoppingJobId, setStoppingJobId] = useState<number | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // --- Aba 4: Comparar BERT vs LLM ---
  const [compareText, setCompareText] = useState('')
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [loadingComparison, setLoadingComparison] = useState(false)

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

  // ========================================================================
  // Efeitos de carregamento por aba
  // ========================================================================

  useEffect(() => {
    if (activeTab === 'novo-treino') {
      fetchDatasets()
    } else if (activeTab === 'monitorar') {
      fetchJobs()
    } else if (activeTab === 'testar') {
      fetchModels()
    }
  }, [activeTab, fetchDatasets, fetchJobs, fetchModels])

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
      toast({ title: 'Predicao em lote concluida', description: `${result.length} textos classificados` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na predicao em lote'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingBatch(false)
    }
  }, [selectedModel, batchText, toast])

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
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => (window.location.href = '/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src="/logo/logo-pge.png" alt="PGE-MS" className="h-10 w-auto" />
          <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Treinamento BERT</h1>
              <span className="text-xs text-gray-500">Classificador de Documentos por ML</span>
            </div>
          </div>
        </div>
      </header>

      {/* Conteudo principal */}
      <main className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="novo-treino" className="gap-2">
              <Play className="h-4 w-4" />
              Novo Treino
            </TabsTrigger>
            <TabsTrigger value="monitorar" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Monitorar Jobs
            </TabsTrigger>
            <TabsTrigger value="testar" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Testar Modelo
            </TabsTrigger>
            <TabsTrigger value="comparar" className="gap-2">
              <GitCompareArrows className="h-4 w-4" />
              Comparar BERT vs LLM
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* ABA 1: Novo Treino                                           */}
          {/* ============================================================ */}
          <TabsContent value="novo-treino">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Selecao de dataset */}
              <Card>
                <CardHeader>
                  <CardTitle>Dataset</CardTitle>
                  <CardDescription>Selecione o dataset para treinamento</CardDescription>
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
                          <SelectTrigger id="dataset-select">
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
                          <div className="rounded-lg border bg-gray-50 p-3 text-sm">
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
              <Card>
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
                      <SelectTrigger id="modelo-base">
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
                      />
                    </div>
                  </div>

                  <Button
                    onClick={iniciarTreinamento}
                    disabled={startingTraining || !selectedDataset}
                    className="w-full"
                  >
                    {startingTraining ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Iniciar Treinamento
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 2: Monitorar Jobs                                        */}
          {/* ============================================================ */}
          <TabsContent value="monitorar">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Lista de jobs */}
              <Card className="lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Jobs de Treinamento</CardTitle>
                  <Button variant="ghost" size="icon" onClick={fetchJobs} disabled={loadingJobs}>
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
                  ) : jobs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum job encontrado
                    </p>
                  ) : (
                    <div className="max-h-[600px] space-y-2 overflow-y-auto">
                      {jobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => selecionarJob(job)}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50',
                            selectedJob?.id === job.id && 'border-primary bg-primary/5'
                          )}
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
                              <div className="h-1.5 w-full rounded-full bg-gray-200">
                                <div
                                  className="h-1.5 rounded-full bg-primary transition-all"
                                  style={{ width: `${job.progresso}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detalhes do job selecionado */}
              <Card className="lg:col-span-2">
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
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-xs text-muted-foreground">Accuracy</p>
                            <p className="text-lg font-bold text-green-600">
                              {formatarPct(jobMetrics.accuracy)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-xs text-muted-foreground">F1 Score</p>
                            <p className="text-lg font-bold text-blue-600">
                              {formatarPct(jobMetrics.f1_score)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-xs text-muted-foreground">Precision</p>
                            <p className="text-lg font-bold text-purple-600">
                              {formatarPct(jobMetrics.precision)}
                            </p>
                          </div>
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-xs text-muted-foreground">Recall</p>
                            <p className="text-lg font-bold text-orange-600">
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
                            <h4 className="mb-2 text-sm font-medium">Curva de Loss</h4>
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
                                  stroke="#ef4444"
                                  name="Loss (treino)"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                                {chartData[0]?.val_loss !== undefined && (
                                  <Line
                                    type="monotone"
                                    dataKey="val_loss"
                                    stroke="#f97316"
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
                            <h4 className="mb-2 text-sm font-medium">Curva de Accuracy</h4>
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
                                  stroke="#22c55e"
                                  name="Accuracy (treino)"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                                {chartData[0]?.val_accuracy !== undefined && (
                                  <Line
                                    type="monotone"
                                    dataKey="val_accuracy"
                                    stroke="#3b82f6"
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
                          <h4 className="mb-2 text-sm font-medium">Matriz de Confusao</h4>
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
            <div className="grid gap-6 md:grid-cols-2">
              {/* Predicao individual */}
              <Card>
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
                        <SelectTrigger id="model-select">
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
                    />
                  </div>

                  <Button
                    onClick={executarPredicao}
                    disabled={loadingPrediction || !selectedModel || !testText.trim()}
                    className="w-full"
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
                    <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Categoria predita:</span>
                        <Badge variant="default" className="text-sm">
                          {prediction.categoria_predita}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Confianca:</span>
                        <span className="text-sm font-bold text-green-600">
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
                              <span className="w-28 truncate text-xs">{cat.categoria}</span>
                              <div className="h-2 flex-1 rounded-full bg-gray-200">
                                <div
                                  className="h-2 rounded-full bg-primary"
                                  style={{ width: `${cat.probabilidade * 100}%` }}
                                />
                              </div>
                              <span className="w-14 text-right text-xs text-muted-foreground">
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
              <Card>
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
                    />
                  </div>

                  <Button
                    onClick={executarPredicaoLote}
                    disabled={loadingBatch || !selectedModel || !batchText.trim()}
                    className="w-full"
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
                    <div className="max-h-[400px] overflow-y-auto">
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
          </TabsContent>

          {/* ============================================================ */}
          {/* ABA 4: Comparar BERT vs LLM                                  */}
          {/* ============================================================ */}
          <TabsContent value="comparar">
            <Card>
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
                  />
                </div>

                <Button
                  onClick={executarComparacao}
                  disabled={loadingComparison || !compareText.trim()}
                  className="w-full"
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
                  <div className="space-y-4">
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
      </main>
    </div>
  )
}
