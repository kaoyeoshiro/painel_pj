import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useMarkdown } from '@/hooks/useMarkdown'
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
  FeedbackRequest,
} from '@/types/matriculas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  FileText,
  Upload,
  Brain,
  RefreshCw,
  Layers,
  Download,
  Printer,
  Copy,
  FileDown,
  Trash2,
  FileUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react'

export default function MatriculasPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  // Estado
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [documentDetails, setDocumentDetails] = useState<ResultadoAnalise | null>(null)
  const [matriculaPrincipal, setMatriculaPrincipal] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [currentAnaliseId, setCurrentAnaliseId] = useState<number | null>(null)
  const [currentGrupoId, setCurrentGrupoId] = useState<number | null>(null)
  const [reportText, setReportText] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const [showBatchHelp, setShowBatchHelp] = useState(false)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const batchPollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Queries
  const { data: files, refetch: refetchFiles } = useApiQuery(() => matriculasApi.get<FileInfo[]>('/files'))
  const { data: config } = useApiQuery(() => matriculasApi.get<ConfigResponse>('/config'))
  const { data: logs, refetch: refetchLogs } = useApiQuery(() => matriculasApi.get<LogEntry[]>('/logs'))

  // Limpa polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      if (batchPollingRef.current) clearInterval(batchPollingRef.current)
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current)
    }
  }, [])

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

        // Carrega PDF
        const token = localStorage.getItem('access_token')
        const response = await fetch(`/matriculas/api/files/${fileId}/view`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          if (pdfViewerUrl) URL.revokeObjectURL(pdfViewerUrl)
          setPdfViewerUrl(url)
        }

        // Gera relatorio
        await generateReport()
      } catch (error) {
        console.error('Erro ao carregar documento:', error)
      }
    },
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
            const newIds = prev.filter((id) => id !== fileId)
            return newIds
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
          // Confirma substituicao
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

      const token = localStorage.getItem('access_token')
      const response = await fetch(`/matriculas/api${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Erro ao baixar relatorio')

      const blob = await response.blob()
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

  // Envia feedback
  const handleFeedback = async (avaliacao: 'correto' | 'parcial' | 'incorreto' | 'erro_ia') => {
    if (!currentAnaliseId) {
      toast({ title: 'Aviso', description: 'Nenhuma analise para avaliar', variant: 'destructive' })
      return
    }

    let comentario: string | null = null
    if (avaliacao === 'incorreto' || avaliacao === 'parcial') {
      comentario = prompt('Descreva brevemente o que estava incorreto (opcional):')
    }

    try {
      const payload: FeedbackRequest = {
        analise_id: currentAnaliseId,
        avaliacao,
        comentario: comentario || undefined,
      }

      const result = await matriculasApi.post<{ success: boolean }>('/feedback', payload)
      if (result.success) {
        toast({ title: 'Sucesso', description: 'Feedback registrado!' })
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao enviar feedback', variant: 'destructive' })
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
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir arquivo', variant: 'destructive' })
    }
  }

  // renderMarkdown removido — usar componente MarkdownContent com sanitização

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/dashboard' })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="border-l pl-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-semibold">Matriculas Confrontantes</h1>
                <span className="text-xs text-gray-500">Sistema de Analise Documental</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - File Manager */}
        <aside className="flex w-64 flex-shrink-0 flex-col border-r bg-white">
          {/* AI Actions */}
          <div className="border-b bg-gradient-to-r from-primary/10 to-green-50 p-3">
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Matricula Principal <span className="text-red-500">*</span>
              </label>
              <Input
                value={matriculaPrincipal}
                onChange={(e) => setMatriculaPrincipal(e.target.value)}
                placeholder="Ex: 12345"
                className="text-sm"
              />
            </div>

            <div className="mb-2 flex gap-2">
              <Button onClick={() => handleAnalyze()} disabled={isAnalyzing} className="flex-1" size="sm">
                <Brain className="mr-2 h-4 w-4" />
                Analisar
              </Button>
              <Button
                onClick={() => handleAnalyze(true)}
                disabled={isAnalyzing}
                variant="outline"
                size="sm"
                title="Forcar nova analise"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <Button
                onClick={handleBatchAnalyze}
                disabled={isBatchAnalyzing || selectedFileIds.length < 2}
                className="flex-1"
                variant="secondary"
                size="sm"
              >
                <Layers className="mr-2 h-4 w-4" />
                Analise em Lote
              </Button>
              <Button onClick={() => setShowBatchHelp(true)} variant="ghost" size="icon">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center text-xs text-gray-600">
              {isAnalyzing || isBatchAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </span>
              ) : selectedFileId ? (
                <span className="flex items-center justify-center gap-2">
                  <Info className="h-4 w-4" />
                  Pronto para analisar
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Info className="h-4 w-4" />
                  Selecione um documento
                </span>
              )}
            </div>
          </div>

          {/* Files Header */}
          <div className="border-b p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileUp className="h-4 w-4 text-primary" />
                Matriculas
              </h2>
            </div>

            <Button onClick={() => fileInputRef.current?.click()} className="w-full" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            <p className="mt-2 text-center text-xs text-gray-400">Ctrl+Click para selecao multipla</p>
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto p-2">
            {!files || files.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <FileUp className="mx-auto mb-2 h-10 w-10" />
                <p className="text-sm">Nenhum arquivo importado</p>
                <p className="mt-1 text-xs">Clique em "Importar"</p>
              </div>
            ) : (
              files.map((file) => {
                const isSelected = selectedFileIds.includes(file.id)
                const isMultiSelect = selectedFileIds.length > 1

                return (
                  <div
                    key={file.id}
                    onClick={(e) => handleSelectFile(file.id, e.ctrlKey)}
                    className={`group mb-2 cursor-pointer rounded-lg border p-3 transition-all ${
                      isSelected
                        ? isMultiSelect
                          ? 'border-purple-200 bg-purple-50'
                          : 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                          file.type === 'pdf' ? 'bg-red-100' : 'bg-blue-100'
                        }`}
                      >
                        <FileText
                          className={`h-5 w-5 ${file.type === 'pdf' ? 'text-red-500' : 'text-blue-500'}`}
                        />
                        {file.analyzed && (
                          <CheckCircle className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-green-500" />
                        )}
                        {isSelected && isMultiSelect && (
                          <Badge className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full p-0 text-xs">
                            {selectedFileIds.indexOf(file.id) + 1}
                          </Badge>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {file.size} - {file.date}
                        </p>
                        {file.analyzed && (
                          <span className="text-xs text-green-600">
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
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* Center - Report & Data */}
        <main className="flex flex-1 flex-col overflow-hidden" style={{ width: '60%' }}>
          {/* Report Section */}
          <section className="flex flex-col border-b bg-white" style={{ height: '65%' }}>
            <div className="flex items-center justify-between border-b p-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <FileText className="h-4 w-4 text-green-500" />
                Relatorio da Analise
              </h2>
              {reportText && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadDocx}>
                    <Download className="mr-2 h-4 w-4" />
                    Word
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyReport}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={!documentDetails}>
                    <FileDown className="mr-2 h-4 w-4" />
                    JSON
                  </Button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
                  <p className="text-lg">Gerando Relatorio...</p>
                  <p className="mt-2 text-sm text-gray-500">Aguarde enquanto a IA processa os dados</p>
                </div>
              ) : reportText ? (
                <div>
                  <MarkdownContent text={reportText} />

                  {/* Feedback Section */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="text-sm">Avalie a Analise da IA</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 text-sm text-gray-600">Sua avaliacao nos ajuda a melhorar o sistema.</p>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Button variant="outline" onClick={() => handleFeedback('correto')} className="flex-col py-3">
                          <CheckCircle className="mb-1 h-5 w-5 text-green-600" />
                          <span className="text-xs">Correta</span>
                        </Button>
                        <Button variant="outline" onClick={() => handleFeedback('parcial')} className="flex-col py-3">
                          <AlertCircle className="mb-1 h-5 w-5 text-yellow-600" />
                          <span className="text-xs">Parcialmente</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleFeedback('incorreto')}
                          className="flex-col py-3"
                        >
                          <AlertCircle className="mb-1 h-5 w-5 text-red-600" />
                          <span className="text-xs">Incorreta</span>
                        </Button>
                        <Button variant="outline" onClick={() => handleFeedback('erro_ia')} className="flex-col py-3">
                          <AlertCircle className="mb-1 h-5 w-5 text-gray-600" />
                          <span className="text-xs">Erro/Nao gerou</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <FileText className="mb-4 h-16 w-16" />
                  <p className="text-lg">Relatorio de Analise</p>
                  <p className="mt-2 text-sm">Analise um documento para gerar o relatorio automaticamente</p>
                </div>
              )}
            </div>
          </section>

          {/* Extracted Data Section */}
          <section className="flex flex-col bg-white" style={{ height: '35%' }}>
            <div className="border-b p-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <FileText className="h-4 w-4 text-purple-500" />
                Dados Extraidos
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {!documentDetails || !documentDetails.matriculas_encontradas ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <FileText className="mb-2 h-8 w-8" />
                  <p className="text-sm">Selecione e analise um documento para ver os dados extraidos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Resumo */}
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Matricula: </span>
                      <span className="font-semibold text-primary">
                        {documentDetails.matricula_principal || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Confianca: </span>
                      <Badge variant="outline">
                        {documentDetails.confidence
                          ? Math.round(
                              documentDetails.confidence <= 1 ? documentDetails.confidence * 100 : documentDetails.confidence
                            )
                          : 0}
                        %
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-500">Confrontacao: </span>
                      <Badge
                        variant={
                          documentDetails.confrontacao_completa === true
                            ? 'default'
                            : documentDetails.confrontacao_completa === false
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {documentDetails.confrontacao_completa === true
                          ? 'Completa'
                          : documentDetails.confrontacao_completa === false
                            ? 'Incompleta'
                            : 'N/A'}
                      </Badge>
                    </div>
                  </div>

                  {/* Tabelas */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Matriculas */}
                    <Card>
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs">
                          Matriculas ({documentDetails.matriculas_encontradas?.length || 0})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="max-h-32 overflow-auto p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">N</TableHead>
                              <TableHead className="text-xs">Lote</TableHead>
                              <TableHead className="text-xs">Proprietarios</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {documentDetails.matriculas_encontradas?.map((mat, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs font-medium text-primary">
                                  {mat.numero || 'N/A'}
                                </TableCell>
                                <TableCell className="text-xs">{mat.lote || '-'}</TableCell>
                                <TableCell className="max-w-[150px] truncate text-xs">
                                  {mat.proprietarios?.join(', ') || 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    {/* Confrontantes */}
                    <Card>
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs">
                          Confrontantes ({documentDetails.lotes_confrontantes?.length || 0})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="max-h-32 overflow-auto p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Identificador</TableHead>
                              <TableHead className="text-xs">Direcao</TableHead>
                              <TableHead className="text-xs">Matricula</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {documentDetails.lotes_confrontantes?.map((lote, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs">{lote.identificador || 'N/A'}</TableCell>
                                <TableCell className="text-xs">
                                  {lote.direcao?.toUpperCase() || '-'}
                                </TableCell>
                                <TableCell className="text-xs">{lote.matricula_anexada || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Right Sidebar - PDF Viewer */}
        <aside className="flex flex-shrink-0 flex-col border-l bg-gray-100" style={{ width: '40%' }}>
          <div className="flex items-center justify-between border-b bg-white px-4 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4 text-red-500" />
              Visualizador
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-4">
            {pdfViewerUrl ? (
              <object data={pdfViewerUrl} type="application/pdf" className="h-full w-full">
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <FileText className="mb-4 h-16 w-16 text-red-400" />
                  <p className="mb-4 text-lg">Nao foi possivel exibir o PDF no navegador</p>
                  <Button onClick={() => window.open(pdfViewerUrl, '_blank')}>Abrir em nova aba</Button>
                </div>
              </object>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <FileText className="mb-4 h-16 w-16" />
                <p className="text-lg">Visualizacao do Documento</p>
                <p className="mt-2 text-sm">Selecione um arquivo para visualizar</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Processing Modal */}
      <Dialog open={showProcessingModal} onOpenChange={setShowProcessingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analise em Andamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center text-center">
            <Loader2 className="mb-6 h-20 w-20 animate-spin text-primary" />
            <h3 className="mb-2 text-lg font-medium text-gray-800">Processando Documento</h3>
            <p className="mb-4 text-sm text-gray-500">Enviando para analise da IA...</p>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Este processo pode levar alguns segundos dependendo do tamanho do documento
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Help Modal */}
      <Dialog open={showBatchHelp} onOpenChange={setShowBatchHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Analise em Lote
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                <HelpCircle className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Quando usar?</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Use quando tiver <strong>multiplas matriculas</strong> que fazem parte do{' '}
                  <strong>mesmo processo de usucapiao</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Exemplo</h4>
                <p className="mt-1 text-sm text-gray-600">
                  A matricula principal do imovel + matriculas dos confrontantes anexadas ao processo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                <Brain className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">O que a IA faz?</h4>
                <p className="mt-1 text-sm text-gray-600">
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
                Segure <kbd className="rounded bg-gray-200 px-2 py-1 text-xs font-mono">Ctrl</kbd> e clique nos
                arquivos desejados.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
