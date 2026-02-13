import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useMarkdown } from '@/hooks/useMarkdown'
import { useFeedbackGate } from '@/hooks/useFeedbackGate'
import { matriculasApi } from '@/lib/api'
import type {
  FileInfo,
  ResultadoAnalise,
  AnaliseStatusResponse,
  RelatorioResponse,
  LogEntry,
  ConfigResponse,
  AnaliseLoteRequest,
  BatchStatusResponse,
} from '@/types/matriculas'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { C } from '@/lib/designTokens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { FeedbackStarsCard } from '@/components/shared/FeedbackStarsCard'
import { FeedbackGateModal } from '@/components/shared/FeedbackGateModal'
import {
  FileText,
  FileSignature,
  Upload,
  Brain,
  RefreshCw,
  Layers,
  Download,
  Printer,
  Copy,
  FileDown,
  Trash2,
  FolderOpen,
  CheckCircle,
  Loader2,
  Info,
  HelpCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

// ============================================================
// Helpers de confianca
// ============================================================

function getConfidencePercent(confidence: number | null | undefined): number {
  if (!confidence) return 0
  return Math.round(confidence <= 1 ? confidence * 100 : confidence)
}

function getConfidenceColor(confidence: number | null | undefined): string {
  const raw = confidence ?? 0
  if (raw >= 0.8 || raw >= 80) return C.statusSuccess
  if (raw >= 0.6 || raw >= 60) return C.statusWarning
  return C.statusError
}

export default function MatriculasPage() {
  const { toast } = useToast()

  // Estado
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [documentDetails, setDocumentDetails] = useState<ResultadoAnalise | null>(null)
  const [matriculaPrincipal, setMatriculaPrincipal] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [currentAnaliseId, setCurrentAnaliseId] = useState<number | null>(null)
  const [, setCurrentGrupoId] = useState<number | null>(null)
  const [reportText, setReportText] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const [showBatchHelp, setShowBatchHelp] = useState(false)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [isSubmittedFeedback, setIsSubmittedFeedback] = useState(false)

  // Feedback gate — guards download/export/copy until rated
  const {
    gateOpen,
    guardAction,
    onFeedbackDone,
    markAsRated,
  } = useFeedbackGate(currentAnaliseId)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const batchPollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Queries
  const { data: files, refetch: refetchFiles } = useQuery<FileInfo[]>({
    queryKey: queryKeys.matriculas.files(),
    queryFn: () => matriculasApi.get<FileInfo[]>('/files'),
  })
  useQuery<ConfigResponse>({
    queryKey: queryKeys.matriculas.config(),
    queryFn: () => matriculasApi.get<ConfigResponse>('/config'),
  })
  const { refetch: refetchLogs } = useQuery<LogEntry[]>({
    queryKey: queryKeys.matriculas.logs(),
    queryFn: () => matriculasApi.get<LogEntry[]>('/logs'),
  })

  // Limpa polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      if (batchPollingRef.current) clearInterval(batchPollingRef.current)
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current)
    }
  }, [])

  // Reset feedback state when analysis changes
  useEffect(() => {
    setIsSubmittedFeedback(false)
  }, [currentAnaliseId])

  // Revoga URL do PDF ao trocar
  useEffect(() => {
    return () => {
      if (pdfViewerUrl) URL.revokeObjectURL(pdfViewerUrl)
    }
  }, [pdfViewerUrl])

  // Carrega detalhes do documento
  const loadDocumentDetails = useCallback(
    async (fileId: string) => {
      try {
        const result = await matriculasApi.get<ResultadoAnalise>(`/resultado/${fileId}`)
        setDocumentDetails(result)
        setCurrentAnaliseId(result.analise_id || null)

        // Carrega PDF via cliente centralizado
        const blob = await matriculasApi.blob(`/files/${fileId}/view`)
        const url = URL.createObjectURL(blob)
        if (pdfViewerUrl) URL.revokeObjectURL(pdfViewerUrl)
        setPdfViewerUrl(url)

        // Gera relatorio
        await generateReport()
      } catch (error) {
        console.error('Erro ao carregar documento:', error)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generateReport é estável (não depende de estado reativo)
    [pdfViewerUrl]
  )

  // Seleciona arquivo
  const handleSelectFile = useCallback(
    (fileId: string, ctrlKey: boolean) => {
      if (ctrlKey) {
        setSelectedFileIds((prev) => {
          const index = prev.indexOf(fileId)
          if (index === -1) {
            return [...prev, fileId]
          } else {
            return prev.filter((id) => id !== fileId)
          }
        })
      } else {
        setSelectedFileIds([fileId])
        setSelectedFileId(fileId)
        loadDocumentDetails(fileId)
      }
    },
    [loadDocumentDetails]
  )

  // Upload de arquivo
  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    for (const file of Array.from(fileList)) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const result = await matriculasApi.post<{ success: boolean; error?: string; message?: string }>(
          '/files/upload',
          formData,
          { headers: {} }
        )

        if (result.success) {
          toast({ title: 'Arquivo importado', description: `${file.name} foi importado com sucesso` })
          refetchFiles()
        } else if (result.error === 'duplicate') {
          if (window.confirm(result.message || 'Arquivo ja existe. Substituir?')) {
            const replaceResult = await matriculasApi.post<{ success: boolean }>(
              '/files/upload?replace=true',
              formData,
              { headers: {} }
            )
            if (replaceResult.success) {
              toast({ title: 'Arquivo substituido', description: `${file.name} foi substituido` })
              refetchFiles()
            }
          }
        } else {
          toast({ title: 'Erro', description: result.error || 'Erro ao importar arquivo', variant: 'destructive' })
        }
      } catch (error) {
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Erro ao importar arquivo',
          variant: 'destructive',
        })
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Analise individual
  const handleAnalyze = async (force = false) => {
    if (!selectedFileId) {
      toast({ title: 'Aviso', description: 'Selecione um documento primeiro', variant: 'destructive' })
      return
    }

    if (!matriculaPrincipal.trim()) {
      toast({ title: 'Aviso', description: 'Informe a Matricula Principal', variant: 'destructive' })
      return
    }

    setIsAnalyzing(true)
    setShowProcessingModal(true)

    try {
      const url = force
        ? `/analisar/${selectedFileId}?force=true&matricula_principal=${encodeURIComponent(matriculaPrincipal)}`
        : `/analisar/${selectedFileId}?matricula_principal=${encodeURIComponent(matriculaPrincipal)}`

      const result = await matriculasApi.post<{ success: boolean; cached?: boolean; error?: string }>(url)

      if (result.success) {
        if (result.cached) {
          await loadDocumentDetails(selectedFileId)
          setShowProcessingModal(false)
          toast({ title: 'Sucesso', description: 'Analise ja realizada, carregando...' })
        } else {
          startPolling(selectedFileId)
        }
      } else {
        throw new Error(result.error || 'Erro ao iniciar analise')
      }
    } catch (error) {
      setIsAnalyzing(false)
      setShowProcessingModal(false)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao analisar documento',
        variant: 'destructive',
      })
    }
  }

  // Polling de analise individual
  const startPolling = (fileId: string) => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const status = await matriculasApi.get<AnaliseStatusResponse>(`/analisar/${fileId}/status`)

        if (!status.processing && status.has_result) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
          setIsAnalyzing(false)
          setShowProcessingModal(false)

          await loadDocumentDetails(fileId)
          refetchFiles()
          refetchLogs()

          toast({ title: 'Sucesso', description: 'Analise concluida com sucesso!' })
        }
      } catch (error) {
        console.error('Erro no polling:', error)
      }
    }, 2000)

    // Timeout de 5 minutos
    pollingTimeoutRef.current = setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        setIsAnalyzing(false)
        setShowProcessingModal(false)
        toast({ title: 'Timeout', description: 'Analise demorou muito. Verifique os logs.', variant: 'destructive' })
      }
    }, 300000)
  }

  // Analise em lote
  const handleBatchAnalyze = async () => {
    if (selectedFileIds.length < 2) {
      toast({ title: 'Aviso', description: 'Selecione pelo menos 2 documentos', variant: 'destructive' })
      return
    }

    if (!matriculaPrincipal.trim()) {
      toast({ title: 'Aviso', description: 'Informe a Matricula Principal', variant: 'destructive' })
      return
    }

    setIsBatchAnalyzing(true)

    try {
      const payload: AnaliseLoteRequest = {
        file_ids: selectedFileIds,
        nome_grupo: `Analise de ${selectedFileIds.length} matriculas`,
        matricula_principal: matriculaPrincipal,
      }

      const result = await matriculasApi.post<{ success: boolean; grupo_id?: number; detail?: string }>(
        '/analisar-lote',
        payload
      )

      if (result.success && result.grupo_id) {
        setCurrentGrupoId(result.grupo_id)
        toast({ title: 'Sucesso', description: 'Analise em lote iniciada!' })
        startBatchPolling(result.grupo_id)
      } else {
        throw new Error(result.detail || 'Erro ao iniciar analise em lote')
      }
    } catch (error) {
      setIsBatchAnalyzing(false)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao analisar em lote',
        variant: 'destructive',
      })
    }
  }

  // Polling de analise em lote
  const startBatchPolling = (grupoId: number) => {
    batchPollingRef.current = setInterval(async () => {
      try {
        const status = await matriculasApi.get<BatchStatusResponse>(`/grupo/${grupoId}/status`)

        if (status.status === 'concluido') {
          if (batchPollingRef.current) clearInterval(batchPollingRef.current)
          setIsBatchAnalyzing(false)

          const resultado = await matriculasApi.get<ResultadoAnalise>(`/grupo/${grupoId}/resultado`)
          setDocumentDetails(resultado)
          setCurrentAnaliseId(resultado.analise_id || null)

          await generateReport()
          refetchFiles()
          refetchLogs()

          toast({ title: 'Sucesso', description: 'Analise em lote concluida!' })
        } else if (status.status === 'erro') {
          if (batchPollingRef.current) clearInterval(batchPollingRef.current)
          setIsBatchAnalyzing(false)
          toast({ title: 'Erro', description: 'Erro na analise em lote', variant: 'destructive' })
        }
      } catch (error) {
        console.error('Erro no polling do lote:', error)
      }
    }, 3000)
  }

  // Gera relatorio
  const generateReport = async () => {
    setIsGeneratingReport(true)
    try {
      const result = await matriculasApi.post<RelatorioResponse>('/relatorio/gerar')
      if (result.success && result.report) {
        setReportText(result.report)
      } else {
        throw new Error(result.error || 'Erro ao gerar relatorio')
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao gerar relatorio',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Download DOCX
  const handleDownloadDocx = async () => {
    try {
      const url = currentAnaliseId
        ? `/relatorio/download?analise_id=${currentAnaliseId}`
        : '/relatorio/download'

      // Download via cliente centralizado (autenticacao automatica)
      const blob = await matriculasApi.blob(url)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = 'relatorio_matriculas_confrontantes.docx'
      a.click()
      URL.revokeObjectURL(downloadUrl)

      toast({ title: 'Sucesso', description: 'Download concluido!' })
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao baixar relatorio',
        variant: 'destructive',
      })
    }
  }

  // Copia relatorio para clipboard
  const handleCopyReport = async () => {
    if (!reportText) return

    try {
      await navigator.clipboard.writeText(reportText)
      toast({ title: 'Copiado', description: 'Relatorio copiado para a area de transferencia' })
    } catch {
      toast({ title: 'Erro', description: 'Nao foi possivel copiar o relatorio', variant: 'destructive' })
    }
  }

  // Exporta dados extraidos como JSON
  const handleExportJSON = () => {
    if (!documentDetails) return

    const json = JSON.stringify(documentDetails, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dados_extraidos_matriculas.json'
    a.click()
    URL.revokeObjectURL(url)

    toast({ title: 'Sucesso', description: 'Dados exportados como JSON' })
  }

  // Envia feedback (estrelas 1-5 + comentario)
  const handleStarFeedback = async (data: { nota: number; comentario: string | null }) => {
    if (!currentAnaliseId) {
      toast({ title: 'Aviso', description: 'Nenhuma analise para avaliar', variant: 'destructive' })
      return
    }

    setIsSubmittingFeedback(true)
    try {
      const result = await matriculasApi.post<{ success: boolean }>('/feedback', {
        analise_id: currentAnaliseId,
        nota: data.nota,
        comentario: data.comentario,
      })
      if (result.success) {
        setIsSubmittedFeedback(true)
        markAsRated()
        toast({ title: 'Sucesso', description: 'Feedback registrado!' })
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao enviar feedback', variant: 'destructive' })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  // Feedback handler for the gate modal
  const handleGateFeedback = async (data: { nota: number; comentario: string | null }) => {
    if (!currentAnaliseId) return

    setIsSubmittingFeedback(true)
    try {
      const result = await matriculasApi.post<{ success: boolean }>('/feedback', {
        analise_id: currentAnaliseId,
        nota: data.nota,
        comentario: data.comentario,
      })
      if (result.success) {
        onFeedbackDone()
        toast({ title: 'Sucesso', description: 'Feedback registrado!' })
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao enviar feedback', variant: 'destructive' })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  // Deleta arquivo
  const handleDeleteFile = async (fileId: string) => {
    const file = files?.find((f) => f.id === fileId)
    if (!file) return

    if (!window.confirm(`Deseja excluir o arquivo "${file.name}"?`)) return

    try {
      await matriculasApi.delete(`/files/${fileId}`)
      toast({ title: 'Sucesso', description: 'Arquivo excluido' })
      refetchFiles()
      refetchLogs()

      if (fileId === selectedFileId) {
        setSelectedFileId(null)
        setDocumentDetails(null)
        setReportText(null)
        setPdfViewerUrl(null)
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir arquivo', variant: 'destructive' })
    }
  }

  // Status da analise (texto informativo)
  function renderAnalysisStatus(): React.ReactNode {
    if (isAnalyzing || isBatchAnalyzing) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analisando...
        </span>
      )
    }
    if (selectedFileId) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Info className="h-4 w-4" />
          Pronto para analisar
        </span>
      )
    }
    return (
      <span className="flex items-center justify-center gap-2">
        <Info className="h-4 w-4" />
        Selecione um documento
      </span>
    )
  }

  // Confrontacao texto
  function renderConfrontacao(): React.ReactNode {
    if (documentDetails?.confrontacao_completa === true) {
      return <span style={{ color: C.statusSuccess, fontWeight: 500 }}>{'\u2713'} Completa</span>
    }
    if (documentDetails?.confrontacao_completa === false) {
      return <span style={{ color: C.statusError, fontWeight: 500 }}>{'\u2717'} Incompleta</span>
    }
    return <span style={{ color: C.text400 }}>N/A</span>
  }

  return (
    <>
      {/* Breadcrumb Bar */}
      <BreadcrumbBar
        title="Matriculas Confrontantes"
        icon={<FileSignature className="w-3.5 h-3.5" />}
        fullWidth
        actions={
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-white transition-colors"
              style={{ background: C.navy700, fontSize: 13 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.navy600 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.navy700 }}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button
              onClick={() => setShowBatchHelp(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
              style={{ color: C.text500, fontSize: 13 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ajuda</span>
            </button>
          </>
        }
      />

      {/* Layout principal: 3 paineis */}
      <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 112px)' }}>
        {/* Painel esquerdo: gerenciador de arquivos */}
        <aside className="flex w-64 flex-shrink-0 flex-col border-r" style={{ borderColor: C.gray200, background: 'white' }}>
          {/* Acoes de IA */}
          <div className="border-b p-3" style={{ borderColor: C.gray200, background: C.navy50 }}>
            <div className="h-1 -mx-3 -mt-3 mb-3 rounded-t" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium" style={{ color: C.text700 }}>
                Matricula Principal <span style={{ color: C.statusError }}>*</span>
              </label>
              <Input
                value={matriculaPrincipal}
                onChange={(e) => setMatriculaPrincipal(e.target.value)}
                placeholder="Ex: 12345"
                className="text-sm"
              />
            </div>

            <div className="mb-2 flex gap-2">
              <button
                onClick={() => handleAnalyze()}
                disabled={isAnalyzing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: C.navy950 }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = C.navy900 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.navy950 }}
              >
                <Brain className="h-4 w-4" />
                Analisar
              </button>
              <button
                onClick={() => handleAnalyze(true)}
                disabled={isAnalyzing}
                className="flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: C.orange100, color: C.orange600, border: `1px solid ${C.orange200}` }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = C.orange200 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.orange100 }}
                title="Forcar nova analise"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={handleBatchAnalyze}
                disabled={isBatchAnalyzing || selectedFileIds.length < 2}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: C.navy700 }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = C.navy600 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.navy700 }}
              >
                <Layers className="h-4 w-4" />
                Analise em Lote
              </button>
              <button
                onClick={() => setShowBatchHelp(true)}
                className="rounded-full p-2 transition-colors"
                style={{ color: C.text400 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.navy50; e.currentTarget.style.color = C.navy700 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text400 }}
                title="Ajuda"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="text-center text-xs" style={{ color: C.text500 }}>
              {renderAnalysisStatus()}
            </div>
          </div>

          {/* Cabecalho da lista de arquivos */}
          <div className="border-b p-3" style={{ borderColor: C.gray200 }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.text700 }}>
                <FolderOpen className="h-4 w-4" style={{ color: C.navy500 }} />
                Matriculas
              </h2>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-white transition-colors"
              style={{ background: C.navy700 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.navy600 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.navy700 }}
            >
              <Upload className="h-4 w-4" />
              Importar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            <p className="mt-2 text-center text-xs" style={{ color: C.text400 }}>Ctrl+Click para selecao multipla</p>
          </div>

          {/* Lista de arquivos */}
          <div className="flex-1 overflow-y-auto p-2">
            {!files || files.length === 0 ? (
              <div className="h-full" aria-label="lista-vazia-matriculas" />
            ) : (
              files.map((file) => {
                const isSelected = selectedFileIds.includes(file.id)
                const isMultiSelect = selectedFileIds.length > 1

                const cardStyle: React.CSSProperties = isSelected
                  ? isMultiSelect
                    ? { borderColor: C.navy700, background: C.navy50 }
                    : { borderColor: C.navy500, background: C.navy50 }
                  : { borderColor: 'transparent' }

                return (
                  <div
                    key={file.id}
                    onClick={(e) => handleSelectFile(file.id, e.ctrlKey)}
                    className="group mb-2 cursor-pointer rounded-lg border p-3 transition-all"
                    style={cardStyle}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = C.gray50
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ background: file.type === 'pdf' ? C.errorBg : C.navy50 }}
                      >
                        <FileText
                          className="h-5 w-5"
                          style={{ color: file.type === 'pdf' ? C.statusError : C.navy500 }}
                        />
                        {file.analyzed && (
                          <CheckCircle
                            className="absolute -right-1 -top-1 h-4 w-4 rounded-full"
                            style={{ color: C.statusSuccess, background: 'white' }}
                          />
                        )}
                        {isSelected && isMultiSelect && (
                          <Badge
                            className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full p-0 text-xs"
                            style={{ background: C.navy700 }}
                          >
                            {selectedFileIds.indexOf(file.id) + 1}
                          </Badge>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: C.text900 }}>{file.name}</p>
                        <p className="text-xs" style={{ color: C.text500 }}>
                          {file.size} - {file.date}
                        </p>
                        {file.analyzed && (
                          <span className="text-xs" style={{ color: C.statusSuccess }}>
                            <CheckCircle className="mr-1 inline h-3 w-3" />
                            Analisado
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFile(file.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" style={{ color: C.statusError }} />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* Painel central: relatorio e dados */}
        <main className="flex flex-1 flex-col overflow-hidden" style={{ width: '60%' }}>
          {/* Secao de relatorio */}
          <section className="flex flex-col border-b" style={{ height: '65%', background: 'white', borderColor: C.gray200 }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
            <div className="flex items-center justify-between border-b p-3" style={{ borderColor: C.gray200 }}>
              <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.text900 }}>
                <FileText className="h-4 w-4" style={{ color: C.navy500 }} />
                Relatorio da Analise
              </h2>
              {reportText && (
                <div className="flex gap-2">
                  <button
                    onClick={() => guardAction(() => handleDownloadDocx())}
                    className="flex items-center gap-1 rounded px-3 py-1.5 text-xs transition-colors"
                    style={{ background: C.navy50, color: C.navy700 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.navy100 }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = C.navy50 }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Word
                  </button>
                  <button
                    onClick={() => guardAction(() => window.print())}
                    className="flex items-center gap-1 rounded px-3 py-1.5 text-xs transition-colors"
                    style={{ background: C.errorBg, color: C.statusError }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.errorBgStrong }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = C.errorBg }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    PDF
                  </button>
                  <button
                    onClick={() => guardAction(() => handleCopyReport())}
                    className="flex items-center gap-1 rounded px-3 py-1.5 text-xs transition-colors"
                    style={{ background: C.gray50, color: C.text500 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = C.gray50 }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                  <button
                    onClick={() => guardAction(() => handleExportJSON())}
                    disabled={!documentDetails}
                    className="flex items-center gap-1 rounded px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                    style={{ background: C.navy50, color: C.navy700 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.navy100 }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = C.navy50 }}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    JSON
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="mb-4 h-10 w-10 animate-spin" style={{ color: C.navy500 }} />
                  <p className="text-lg" style={{ color: C.text700 }}>Gerando Relatorio...</p>
                  <p className="mt-2 text-sm" style={{ color: C.text500 }}>Aguarde enquanto a IA processa os dados</p>
                </div>
              ) : reportText ? (
                <div>
                  <MarkdownContent text={reportText} />

                  {/* Feedback com estrelas */}
                  <FeedbackStarsCard
                    onSubmit={handleStarFeedback}
                    isSubmitting={isSubmittingFeedback}
                    isSubmitted={isSubmittedFeedback}
                    className="mt-6"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12" style={{ color: C.text400 }}>
                  <FileText className="mb-4 h-16 w-16" />
                  <p className="text-lg">Relatorio de Analise</p>
                  <p className="mt-2 text-sm">Analise um documento para gerar o relatorio automaticamente</p>
                </div>
              )}
            </div>
          </section>

          {/* Secao de dados extraidos */}
          <section className="flex flex-col" style={{ height: '35%', background: 'white' }}>
            <div className="border-b p-2" style={{ borderColor: C.gray200 }}>
              <h2 className="flex items-center gap-2 text-xs font-semibold" style={{ color: C.text900 }}>
                <FileText className="h-4 w-4" style={{ color: C.navy700 }} />
                Dados Extraidos
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {!documentDetails || !documentDetails.matriculas_encontradas ? (
                <div className="flex flex-col items-center justify-center py-8" style={{ color: C.text400 }}>
                  <FileText className="mb-2 h-8 w-8" />
                  <p className="text-sm">Selecione e analise um documento para ver os dados extraidos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Resumo compacto */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span style={{ color: C.text500 }}>Matricula:</span>
                      <span className="font-semibold" style={{ color: C.navy700 }}>
                        {documentDetails.matricula_principal || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ color: C.text500 }}>Confianca:</span>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full" style={{ background: C.gray200 }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              background: getConfidenceColor(documentDetails.confidence),
                              width: `${getConfidencePercent(documentDetails.confidence)}%`,
                            }}
                          />
                        </div>
                        <span className="font-medium" style={{ color: getConfidenceColor(documentDetails.confidence) }}>
                          {getConfidencePercent(documentDetails.confidence)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ color: C.text500 }}>Confrontacao:</span>
                      {renderConfrontacao()}
                    </div>
                  </div>

                  {/* Tabelas lado a lado */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Matriculas */}
                    <div className="overflow-hidden rounded-lg" style={{ background: C.gray50 }}>
                      <div className="border-b px-2 py-1.5" style={{ borderColor: C.gray200, background: C.navy100 }}>
                        <h4 className="flex items-center gap-1 text-xs font-medium" style={{ color: C.text700 }}>
                          <FileText className="h-3 w-3" style={{ color: C.navy500 }} />
                          Matriculas ({documentDetails.matriculas_encontradas?.length || 0})
                        </h4>
                      </div>
                      <div className="max-h-32 overflow-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 text-xs" style={{ background: C.navy100, color: C.text700 }}>
                            <tr>
                              <th className="px-2 py-1 text-left font-medium">N</th>
                              <th className="px-2 py-1 text-left font-medium">Lote</th>
                              <th className="px-2 py-1 text-left font-medium">Quadra</th>
                              <th className="px-2 py-1 text-left font-medium">Proprietarios</th>
                            </tr>
                          </thead>
                          <tbody>
                            {documentDetails.matriculas_encontradas?.length ? (
                              documentDetails.matriculas_encontradas.map((mat, idx) => (
                                <tr
                                  key={idx}
                                  className="text-xs"
                                  style={{ borderBottom: `1px solid ${C.gray100}` }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  <td className="px-2 py-1.5 font-medium" style={{ color: C.navy700 }}>{mat.numero || 'N/A'}</td>
                                  <td className="px-2 py-1.5">{mat.lote || '-'}</td>
                                  <td className="px-2 py-1.5">{mat.quadra || '-'}</td>
                                  <td className="max-w-[150px] truncate px-2 py-1.5" title={mat.proprietarios?.join(', ') || ''}>
                                    {mat.proprietarios?.join(', ') || 'N/A'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-2 py-3 text-center text-xs" style={{ color: C.text400 }}>Nenhuma matricula</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Confrontantes */}
                    <div className="overflow-hidden rounded-lg" style={{ background: C.gray50 }}>
                      <div className="border-b px-2 py-1.5" style={{ borderColor: C.gray200, background: C.navy100 }}>
                        <h4 className="flex items-center gap-1 text-xs font-medium" style={{ color: C.text700 }}>
                          <FileText className="h-3 w-3" style={{ color: C.statusSuccess }} />
                          Confrontantes ({documentDetails.lotes_confrontantes?.length || 0})
                        </h4>
                      </div>
                      <div className="max-h-32 overflow-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 text-xs" style={{ background: C.navy100, color: C.text700 }}>
                            <tr>
                              <th className="px-2 py-1 text-left font-medium">Identificador</th>
                              <th className="px-2 py-1 text-left font-medium">Direcao</th>
                              <th className="px-2 py-1 text-left font-medium">Tipo</th>
                              <th className="px-2 py-1 text-left font-medium">Matricula</th>
                            </tr>
                          </thead>
                          <tbody>
                            {documentDetails.lotes_confrontantes?.length ? (
                              documentDetails.lotes_confrontantes.map((lote, idx) => (
                                <tr
                                  key={idx}
                                  className="text-xs"
                                  style={{ borderBottom: `1px solid ${C.gray100}` }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  <td className="px-2 py-1.5">{lote.identificador || 'N/A'}</td>
                                  <td className="px-2 py-1.5">{lote.direcao?.toUpperCase() || '-'}</td>
                                  <td className="px-2 py-1.5">{lote.tipo || '-'}</td>
                                  <td className="px-2 py-1.5">{lote.matricula_anexada || '-'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-2 py-3 text-center text-xs" style={{ color: C.text400 }}>Nenhum confrontante</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Painel direito: visualizador de PDF */}
        <aside className="flex flex-shrink-0 flex-col border-l" style={{ width: '40%', borderColor: C.gray200, background: C.gray100 }}>
          <div className="flex items-center justify-between border-b px-4 py-2" style={{ background: 'white', borderColor: C.gray200 }}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-medium" style={{ color: C.text700 }}>
                <FileText className="h-4 w-4" style={{ color: C.statusError }} />
                Visualizador
              </span>
              <span className="max-w-[200px] truncate text-xs" style={{ color: C.text500 }}>
                {selectedFileId && files?.find(f => f.id === selectedFileId)?.name || 'Nenhum documento'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded p-1.5 transition-colors"
                style={{ color: C.text500 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100; e.currentTarget.style.color = C.text700 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text500 }}
                title="Diminuir Zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs" style={{ color: C.text500 }}>100%</span>
              <button
                className="rounded p-1.5 transition-colors"
                style={{ color: C.text500 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100; e.currentTarget.style.color = C.text700 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text500 }}
                title="Aumentar Zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-4">
            {pdfViewerUrl ? (
              <object data={pdfViewerUrl} type="application/pdf" className="h-full w-full">
                <div className="flex flex-col items-center justify-center py-20" style={{ color: C.text400 }}>
                  <FileText className="mb-4 h-16 w-16" style={{ color: C.statusError }} />
                  <p className="mb-4 text-lg">Nao foi possivel exibir o PDF no navegador</p>
                  <Button onClick={() => window.open(pdfViewerUrl, '_blank')}>Abrir em nova aba</Button>
                </div>
              </object>
            ) : (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: C.text400 }}>
                <FileText className="mb-4 h-16 w-16" />
                <p className="text-lg">Visualizacao do Documento</p>
                <p className="mt-2 text-sm">Selecione um arquivo para visualizar</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal de processamento */}
      <Dialog open={showProcessingModal} onOpenChange={setShowProcessingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analise em Andamento</DialogTitle>
            <DialogDescription className="sr-only">
              Progresso do processamento do documento
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center text-center">
            <Loader2 className="mb-6 h-20 w-20 animate-spin" style={{ color: C.navy500 }} />
            <h3 className="mb-2 text-lg font-medium" style={{ color: C.text900 }}>Processando Documento</h3>
            <p className="mb-4 text-sm" style={{ color: C.text500 }}>Enviando para analise da IA...</p>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Este processo pode levar alguns segundos dependendo do tamanho do documento
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de ajuda do lote */}
      <Dialog open={showBatchHelp} onOpenChange={setShowBatchHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Analise em Lote
            </DialogTitle>
            <DialogDescription className="sr-only">
              Instrucoes sobre como usar a analise em lote de matriculas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: C.navy100 }}
              >
                <HelpCircle className="h-4 w-4" style={{ color: C.navy700 }} />
              </div>
              <div>
                <h4 className="font-semibold" style={{ color: C.text900 }}>Quando usar?</h4>
                <p className="mt-1 text-sm" style={{ color: C.text500 }}>
                  Use quando tiver <strong>multiplas matriculas</strong> que fazem parte do{' '}
                  <strong>mesmo processo de usucapiao</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: C.navy50 }}
              >
                <FileText className="h-4 w-4" style={{ color: C.navy600 }} />
              </div>
              <div>
                <h4 className="font-semibold" style={{ color: C.text900 }}>Exemplo</h4>
                <p className="mt-1 text-sm" style={{ color: C.text500 }}>
                  A matricula principal do imovel + matriculas dos confrontantes anexadas ao processo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: C.navy100 }}
              >
                <Brain className="h-4 w-4" style={{ color: C.navy700 }} />
              </div>
              <div>
                <h4 className="font-semibold" style={{ color: C.text900 }}>O que a IA faz?</h4>
                <p className="mt-1 text-sm" style={{ color: C.text500 }}>
                  Analisa todos os documentos em conjunto, cruzando informacoes para identificar a matricula principal e
                  validar as confrontacoes.
                </p>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Como selecionar multiplos arquivos:</strong>
                <br />
                Segure <kbd className="rounded px-2 py-1 text-xs font-mono" style={{ background: C.gray200 }}>Ctrl</kbd> e clique nos
                arquivos desejados.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de feedback gate — bloqueia download/export/copy ate avaliar */}
      <FeedbackGateModal
        open={gateOpen}
        onOpenChange={() => {/* controlado pelo hook */}}
        onFeedbackSubmit={handleGateFeedback}
        isSubmitting={isSubmittingFeedback}
        pendingActionLabel="executar esta acao"
      />
    </>
  )
}

function MarkdownContent({ text }: { text: string }) {
  const { html } = useMarkdown(text)
  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
