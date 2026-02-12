/**
 * Hook principal do modulo de Treinamento BERT.
 *
 * Centraliza todo o estado (useState, useRef), efeitos (useEffect),
 * callbacks (useCallback) e dados derivados (useMemo) da pagina.
 * Os componentes visuais consomem apenas o que precisam via props.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import type {
  GpuInfo,
  WorkerStatus,
  DatasetValidation,
  PdfClassificationResult,
  LogEntry,
  RunStatusFilter,
  UploadStep,
} from '../types'
import {
  POLLING_INTERVAL,
  LOG_POLLING_INTERVAL,
  DEFAULT_CONFIG,
  TRAINING_PRESETS,
} from '../types'

// ============================================================================
// Hook principal
// ============================================================================

export function useBertTraining() {
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

  // Filtro de status para runs
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>('all')

  // Logs em tempo real
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

  // Classificar PDF (teste)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfResult, setPdfResult] = useState<PdfClassificationResult | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Historico de testes
  const [testHistory, setTestHistory] = useState<PredictionResult[]>([])

  // --- Aba 4: Comparar BERT vs LLM ---
  const [compareText, setCompareText] = useState('')
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [loadingComparison, setLoadingComparison] = useState(false)

  // --- Modais globais ---
  // Debug conexao worker
  const [showDebugModal, setShowDebugModal] = useState(false)
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null)
  const [loadingWorkerStatus, setLoadingWorkerStatus] = useState(false)

  // Ajuda/Onboarding
  const [showHelpDialog, setShowHelpDialog] = useState(false)

  // Worker GPU info
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null)
  const [loadingGpuInfo, setLoadingGpuInfo] = useState(false)

  // Modal upload dataset com 4 passos
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

  // Chunk modal (comparacao)
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

  /** Carrega informacoes de GPU do worker */
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

  /** Busca status de conexao do worker */
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

  /** Busca logs em tempo real de um job */
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

  // Polling de logs em tempo real para o job selecionado
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
  // Dados derivados
  // ========================================================================

  /** Jobs filtrados por status */
  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return jobs
    if (statusFilter === 'running') return jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'stopping')
    if (statusFilter === 'completed') return jobs.filter((j) => j.status === 'completed')
    if (statusFilter === 'failed') return jobs.filter((j) => j.status === 'failed' || j.status === 'stopped')
    return jobs
  }, [jobs, statusFilter])

  /** Dados para graficos (recharts) */
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
      // Adiciona ao historico de testes
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
      // Adiciona resultados em lote ao historico
      setTestHistory((prev) => [...result, ...prev].slice(0, 50))
      toast({ title: 'Predicao em lote concluida', description: `${result.length} textos classificados` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na predicao em lote'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoadingBatch(false)
    }
  }, [selectedModel, batchText, toast])

  /** Classifica PDF de teste */
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

  /** Limpa historico de testes */
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

  /** Aplica preset de treinamento */
  const aplicarPreset = useCallback((presetId: string) => {
    const preset = TRAINING_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setConfig({ ...preset.config })
      setActivePreset(presetId)
    }
  }, [])

  // ========================================================================
  // Acoes do wizard de upload de dataset
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

  /** Passo 3: Validacao do dataset */
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
  }, [uploadFile, uploadDatasetName, uploadDatasetDescription, toast, fetchDatasets, resetUploadWizard])

  // ========================================================================
  // Retorno
  // ========================================================================

  return {
    // Estado global
    activeTab,
    setActiveTab,

    // Aba 1: Novo Treino
    datasets,
    loadingDatasets,
    selectedDataset,
    setSelectedDataset,
    config,
    setConfig,
    startingTraining,
    activePreset,
    aplicarPreset,
    iniciarTreinamento,
    fetchDatasets,

    // Aba 2: Monitorar Jobs
    jobs,
    loadingJobs,
    selectedJob,
    jobMetrics,
    loadingMetrics,
    stoppingJobId,
    statusFilter,
    setStatusFilter,
    filteredJobs,
    realtimeLogs,
    logsAutoScroll,
    setLogsAutoScroll,
    logContainerRef,
    chartData,
    fetchJobs,
    selecionarJob,
    pararJob,

    // Aba 3: Testar Modelo
    models,
    loadingModels,
    selectedModel,
    setSelectedModel,
    testText,
    setTestText,
    prediction,
    loadingPrediction,
    batchText,
    setBatchText,
    batchResults,
    loadingBatch,
    pdfFile,
    setPdfFile,
    pdfResult,
    setPdfResult,
    loadingPdf,
    pdfInputRef,
    testHistory,
    executarPredicao,
    executarPredicaoLote,
    classificarPdf,
    limparHistoricoTestes,

    // Aba 4: Comparar BERT vs LLM
    compareText,
    setCompareText,
    comparison,
    loadingComparison,
    executarComparacao,

    // Modais
    showDebugModal,
    setShowDebugModal,
    workerStatus,
    loadingWorkerStatus,
    fetchWorkerStatus,

    showHelpDialog,
    setShowHelpDialog,

    gpuInfo,
    loadingGpuInfo,
    fetchGpuInfo,

    showUploadDialog,
    setShowUploadDialog,
    uploadStep,
    setUploadStep,
    uploadFile,
    uploadPreview,
    uploadValidation,
    loadingUploadValidation,
    uploadDatasetName,
    setUploadDatasetName,
    uploadDatasetDescription,
    setUploadDatasetDescription,
    uploading,
    uploadInputRef,
    handleUploadFileSelect,
    validarDatasetUpload,
    resetUploadWizard,
    executarUploadDataset,

    showChunkModal,
    setShowChunkModal,
    selectedChunkJobId,
    setSelectedChunkJobId,
  }
}

/** Tipo de retorno do hook para tipagem de props em subcomponentes */
export type UseBertTrainingReturn = ReturnType<typeof useBertTraining>
