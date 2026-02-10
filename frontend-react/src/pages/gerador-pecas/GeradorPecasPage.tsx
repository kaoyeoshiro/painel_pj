import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FileText,
  Upload,
  Download,
  Copy,
  History,
  Send,
  X,
  Check,
  Loader2,
  Star,
  Eye,
  MessageSquare,
  RotateCcw,
  AlertTriangle,
  Trash2,
  ArrowLeft,
  ChevronRight,
  Zap,
  Search,
  Clock,
  Layers,
  Pen,
  Scale,
  Bot,
  Sparkles,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useMarkdown } from '@/hooks/useMarkdown'
import { geradorApi, getToken } from '@/lib/api'
import type {
  TipoPecaResponse,
  HistoricoItem,
  GeracaoDetalhe,
  SSEEvent,
  ModuloPreview,
  CuradoriaPreviewResponse,
  EditorChatMessage,
  PageState,
  AgentStatus,
} from '@/types/gerador-pecas'

// ============================================================
// Helpers
// ============================================================

function formatCNJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 20)
  let result = ''
  for (let i = 0; i < digits.length; i++) {
    if (i === 7) result += '-'
    if (i === 9) result += '.'
    if (i === 13) result += '.'
    if (i === 14) result += '.'
    if (i === 16) result += '.'
    result += digits[i]
  }
  return result
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

// ============================================================
// Agent progress step info
// ============================================================

const AGENT_META = [
  { numero: 1, nome: 'Coletor', descricao: 'Busca documentos no TJ-MS', icon: Search },
  { numero: 2, nome: 'Analisador', descricao: 'Identifica argumentos', icon: Layers },
  { numero: 3, nome: 'Redator', descricao: 'Gera a peca juridica', icon: Pen },
] as const

// ============================================================
// Main Page Component
// ============================================================

export function GeradorPecasPage() {
  const { toast } = useToast()

  // --- Page state machine ---
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // --- Form state ---
  const [inputMode, setInputMode] = useState<'cnj' | 'pdf'>('cnj')
  const [numeroCNJ, setNumeroCNJ] = useState('')
  const [tipoPeca, setTipoPeca] = useState('')
  const [observacao, setObservacao] = useState('')
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // --- Group/Subcategory filtering ---
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [subcategorias, setSubcategorias] = useState<Array<{ id: number; nome: string }>>([])
  const [selectedSubcategorias, setSelectedSubcategorias] = useState<number[]>([])

  // --- Agent progress ---
  const [agentStatuses, setAgentStatuses] = useState<Record<number, AgentStatus>>({
    1: 'aguardando',
    2: 'aguardando',
    3: 'aguardando',
  })
  const [progressMessage, setProgressMessage] = useState('')

  // --- Streaming content ---
  const [streamingContent, setStreamingContent] = useState('')
  const streamingContentRef = useRef('')
  const abortControllerRef = useRef<AbortController | null>(null)

  // --- Resultado ---
  const [geracaoId, setGeracaoId] = useState<number | null>(null)
  const [minutaMarkdown, setMinutaMarkdown] = useState('')
  const [tipoPecaResultado, setTipoPecaResultado] = useState('')

  // --- Curadoria ---
  const [curadoriaModulos, setCuradoriaModulos] = useState<ModuloPreview[]>([])
  const [curadoriaSelected, setCuradoriaSelected] = useState<Set<number>>(new Set())
  const [curadoriaResumo, setCuradoriaResumo] = useState('')
  const [curadoriaDados, setCuradoriaDados] = useState<Record<string, unknown>>({})
  const [curadoriaTraces, setCuradoriaTraces] = useState<Record<string, unknown>>({})
  const [curadoriaVariaveis, setCuradoriaVariaveis] = useState<Record<string, unknown>>({})
  const [curadoriaParecer, setCuradoriaParecer] = useState<Record<string, unknown>>({})
  const [isCuradoriaLoading, setIsCuradoriaLoading] = useState(false)

  // --- Editor/Chat ---
  const [chatMessages, setChatMessages] = useState<EditorChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // --- Feedback ---
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackNota, setFeedbackNota] = useState<number | null>(null)
  const [feedbackComentario, setFeedbackComentario] = useState('')

  // --- Version History ---
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versionList, setVersionList] = useState<Array<{ versao_id: number; numero_versao: number; linhas_adicionadas: number; linhas_removidas: number; descricao_alteracao: string; created_at: string }>>([])

  // --- Parecer NATJus dialog ---
  const [showParecerDialog, setShowParecerDialog] = useState(false)
  const [parecerFile, setParecerFile] = useState<File | null>(null)
  const [isUploadingParecer, setIsUploadingParecer] = useState(false)
  const parecerResolveRef = useRef<((choice: 'uploaded' | 'continue_without') => void) | null>(null)
  const [parecerUploadId, setParecerUploadId] = useState<string | null>(null)
  const parecerUserChoiceRef = useRef<string | null>(null)

  // --- Sidebar ---
  const [showSidebar, setShowSidebar] = useState(false)

  // --- Data loading ---
  const {
    data: tiposPecaData,
    isLoading: isLoadingTipos,
  } = useApiQuery<TipoPecaResponse>(
    () => geradorApi.get<TipoPecaResponse>('/tipos-peca'),
    { enabled: true }
  )

  const {
    data: historico,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useApiQuery<HistoricoItem[]>(
    () => geradorApi.get<HistoricoItem[]>('/historico'),
    { enabled: true }
  )

  const { data: gruposData } = useApiQuery<{ grupos: Array<{ id: number; nome: string; slug: string }> }>(
    () => geradorApi.get('/grupos-disponiveis'),
    { enabled: true }
  )

  // --- Rendered markdown ---
  const { html: minutaHtml } = useMarkdown(
    pageState === 'streaming' ? streamingContent : minutaMarkdown
  )

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Load subcategorias when group changes
  useEffect(() => {
    if (selectedGroupId) {
      geradorApi.get<Array<{ id: number; nome: string }>>(`/grupos/${selectedGroupId}/subcategorias`)
        .then(setSubcategorias)
        .catch(() => setSubcategorias([]))
    } else {
      setSubcategorias([])
    }
    setSelectedSubcategorias([])
  }, [selectedGroupId])

  // ============================================================
  // SSE Stream Reader (POST-based)
  // ============================================================

  const readSSEStream = useCallback(async (
    url: string,
    body: Record<string, unknown>,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `Erro ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Erro ao iniciar streaming')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const segments = buffer.split('\n\n')
      buffer = segments.pop() || ''

      for (const segment of segments) {
        const lines = segment.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as SSEEvent
              onEvent(data)
            } catch {
              // Ignora linhas nao-JSON (heartbeats, etc)
            }
          }
        }
      }
    }
  }, [])

  // ============================================================
  // SSE Stream Reader (FormData-based, for PDF upload)
  // ============================================================

  const readSSEStreamFormData = useCallback(async (
    url: string,
    formData: FormData,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
      body: formData,
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errorData.detail || `Erro ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Erro ao iniciar streaming')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const segments = buffer.split('\n\n')
      buffer = segments.pop() || ''

      for (const segment of segments) {
        const lines = segment.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as SSEEvent
              onEvent(data)
            } catch {
              // Ignora linhas nao-JSON
            }
          }
        }
      }
    }
  }, [])

  // ============================================================
  // Processar - Modo Automatico
  // ============================================================

  const iniciarGeracaoAutomatica = useCallback(async () => {
    if (!numeroCNJ.trim()) {
      toast({ title: 'Atencao', description: 'Informe o numero do processo', variant: 'destructive' })
      return
    }

    setPageState('streaming')
    setStreamingContent('')
    streamingContentRef.current = ''
    setProgressMessage('Conectando...')
    setAgentStatuses({ 1: 'aguardando', 2: 'aguardando', 3: 'aguardando' })
    setParecerUploadId(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await readSSEStream(
        '/gerador-pecas/api/processar-stream',
        {
          numero_cnj: numeroCNJ,
          tipo_peca: tipoPeca || undefined,
          observacao_usuario: observacao || undefined,
          group_id: selectedGroupId || undefined,
          subcategoria_ids: selectedSubcategorias.length > 0 ? selectedSubcategorias : undefined,
          parecer_upload_id: parecerUploadId || undefined,
          parecer_user_choice_when_missing: parecerUserChoiceRef.current || undefined,
        },
        (event) => {
          switch (event.tipo) {
            case 'inicio':
              setProgressMessage(event.mensagem)
              break

            case 'info':
              setProgressMessage(event.mensagem)
              break

            case 'agente':
              setAgentStatuses((prev) => ({ ...prev, [event.agente]: event.status }))
              setProgressMessage(event.mensagem)
              break

            case 'geracao_chunk':
              streamingContentRef.current += event.content
              setStreamingContent(streamingContentRef.current)
              break

            case 'parecer_natjus_ausente':
              setShowParecerDialog(true)
              setPageState('idle')
              break

            case 'sucesso':
              setGeracaoId(event.geracao_id)
              setMinutaMarkdown(event.minuta_markdown || streamingContentRef.current)
              setTipoPecaResultado(event.tipo_peca)
              setPageState('resultado')
              refetchHistorico()
              toast({ title: 'Sucesso', description: 'Peca juridica gerada com sucesso!' })
              break

            case 'erro':
              setErrorMessage(event.mensagem)
              setPageState('erro')
              toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
              break
          }
        },
        controller.signal
      )
      setPageState((prev) => prev === 'streaming' ? 'idle' : prev)
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      const msg = (error as Error).message || 'Erro desconhecido'
      setErrorMessage(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [numeroCNJ, tipoPeca, observacao, selectedGroupId, selectedSubcategorias, parecerUploadId, toast, readSSEStream, refetchHistorico])

  // ============================================================
  // Processar - Modo PDF Upload
  // ============================================================

  const iniciarGeracaoPdf = useCallback(async () => {
    if (pdfFiles.length === 0) {
      toast({ title: 'Atencao', description: 'Selecione ao menos um arquivo PDF', variant: 'destructive' })
      return
    }

    setPageState('streaming')
    setStreamingContent('')
    streamingContentRef.current = ''
    setProgressMessage('Enviando PDFs...')
    setAgentStatuses({ 1: 'aguardando', 2: 'aguardando', 3: 'aguardando' })
    setParecerUploadId(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const formData = new FormData()
    pdfFiles.forEach(file => formData.append('arquivos', file))
    if (tipoPeca) formData.append('tipo_peca', tipoPeca)
    if (observacao) formData.append('observacao_usuario', observacao)
    if (selectedGroupId) formData.append('group_id', String(selectedGroupId))
    if (selectedSubcategorias.length > 0) formData.append('subcategoria_ids', JSON.stringify(selectedSubcategorias))
    if (parecerUploadId) formData.append('parecer_upload_id', parecerUploadId)
    if (parecerUserChoiceRef.current) formData.append('parecer_user_choice_when_missing', parecerUserChoiceRef.current)

    try {
      await readSSEStreamFormData(
        '/gerador-pecas/api/processar-pdfs-stream',
        formData,
        (event) => {
          switch (event.tipo) {
            case 'inicio':
            case 'info':
              setProgressMessage(event.mensagem)
              break
            case 'agente':
              setAgentStatuses((prev) => ({ ...prev, [event.agente]: event.status }))
              setProgressMessage(event.mensagem)
              break
            case 'geracao_chunk':
              streamingContentRef.current += event.content
              setStreamingContent(streamingContentRef.current)
              break
            case 'parecer_natjus_ausente':
              setShowParecerDialog(true)
              setPageState('idle')
              break
            case 'sucesso':
              setGeracaoId(event.geracao_id)
              setMinutaMarkdown(event.minuta_markdown || streamingContentRef.current)
              setTipoPecaResultado(event.tipo_peca)
              setPageState('resultado')
              refetchHistorico()
              toast({ title: 'Sucesso', description: 'Peca juridica gerada com sucesso!' })
              break
            case 'erro':
              setErrorMessage(event.mensagem)
              setPageState('erro')
              toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
              break
          }
        },
        controller.signal
      )
      setPageState((prev) => prev === 'streaming' ? 'idle' : prev)
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      const msg = (error as Error).message || 'Erro desconhecido'
      setErrorMessage(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [pdfFiles, tipoPeca, observacao, selectedGroupId, selectedSubcategorias, parecerUploadId, toast, readSSEStreamFormData, refetchHistorico])

  // ============================================================
  // Processar - Modo Semi-Automatico (Curadoria)
  // ============================================================

  const iniciarCuradoria = useCallback(async () => {
    if (!numeroCNJ.trim()) {
      toast({ title: 'Atencao', description: 'Informe o numero do processo', variant: 'destructive' })
      return
    }
    if (!tipoPeca) {
      toast({ title: 'Atencao', description: 'Selecione o tipo de peca para modo semi-automatico', variant: 'destructive' })
      return
    }

    setIsCuradoriaLoading(true)
    setPageState('streaming')
    setProgressMessage('Executando Agentes 1 e 2...')
    setAgentStatuses({ 1: 'ativo', 2: 'aguardando', 3: 'aguardando' })

    try {
      const result = await geradorApi.post<CuradoriaPreviewResponse>('/curadoria/preview', {
        numero_cnj: numeroCNJ,
        tipo_peca: tipoPeca,
        parecer_upload_id: parecerUploadId || undefined,
        group_id: selectedGroupId || undefined,
        subcategoria_ids: selectedSubcategorias.length > 0 ? selectedSubcategorias : undefined,
      })

      setCuradoriaModulos(result.modulos)
      setCuradoriaSelected(new Set(result.modulos.map((m) => m.id)))
      setCuradoriaResumo(result.resumo_consolidado || '')
      setCuradoriaDados(result.dados_extracao || {})
      setCuradoriaTraces(result.decision_traces || {})
      setCuradoriaVariaveis(result.variaveis_snapshot || {})
      setCuradoriaParecer(result.parecer_context || {})
      setAgentStatuses({ 1: 'concluido', 2: 'concluido', 3: 'aguardando' })
      setPageState('curadoria_preview')
    } catch (error) {
      const err = error as Error
      if (err.message.includes('PARECER_NATJUS_MISSING') || err.message.includes('Parecer NATJus')) {
        setShowParecerDialog(true)
        setPageState('idle')
      } else {
        setErrorMessage(err.message)
        setPageState('erro')
        toast({ title: 'Erro', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsCuradoriaLoading(false)
    }
  }, [numeroCNJ, tipoPeca, parecerUploadId, selectedGroupId, selectedSubcategorias, toast])

  // ============================================================
  // Curadoria - Gerar com selecionados
  // ============================================================

  const gerarComCuradoria = useCallback(async () => {
    const selectedIds = Array.from(curadoriaSelected)
    if (selectedIds.length === 0) {
      toast({ title: 'Atencao', description: 'Selecione ao menos um modulo', variant: 'destructive' })
      return
    }

    setPageState('curadoria_gerando')
    setStreamingContent('')
    streamingContentRef.current = ''
    setProgressMessage('Gerando peca com modulos curados...')
    setAgentStatuses({ 1: 'concluido', 2: 'concluido', 3: 'ativo' })

    const controller = new AbortController()
    abortControllerRef.current = controller

    const previewIds = curadoriaModulos.map((m) => m.id)
    const manuaisIds = selectedIds.filter((id) => !previewIds.includes(id))

    try {
      await readSSEStream(
        '/gerador-pecas/api/curadoria/gerar-stream',
        {
          numero_cnj: numeroCNJ,
          tipo_peca: tipoPeca,
          modulos_ids_curados: selectedIds,
          modulos_manuais_ids: manuaisIds.length > 0 ? manuaisIds : undefined,
          modulos_preview_ids: previewIds,
          resumo_consolidado: curadoriaResumo || undefined,
          dados_extracao: Object.keys(curadoriaDados).length > 0 ? curadoriaDados : undefined,
          decision_traces: Object.keys(curadoriaTraces).length > 0 ? curadoriaTraces : undefined,
          variaveis_snapshot: Object.keys(curadoriaVariaveis).length > 0 ? curadoriaVariaveis : undefined,
          parecer_context: Object.keys(curadoriaParecer).length > 0 ? curadoriaParecer : undefined,
          observacao_usuario: observacao || undefined,
        },
        (event) => {
          switch (event.tipo) {
            case 'inicio':
            case 'info':
              setProgressMessage(event.mensagem)
              break
            case 'agente':
              setAgentStatuses((prev) => ({ ...prev, [event.agente]: event.status }))
              setProgressMessage(event.mensagem)
              break
            case 'geracao_chunk':
              streamingContentRef.current += event.content
              setStreamingContent(streamingContentRef.current)
              break
            case 'sucesso':
              setGeracaoId(event.geracao_id)
              setMinutaMarkdown(event.minuta_markdown || streamingContentRef.current)
              setTipoPecaResultado(event.tipo_peca)
              setAgentStatuses({ 1: 'concluido', 2: 'concluido', 3: 'concluido' })
              setPageState('resultado')
              refetchHistorico()
              toast({ title: 'Sucesso', description: 'Peca gerada com sucesso!' })
              break
            case 'erro':
              setErrorMessage(event.mensagem)
              setPageState('erro')
              toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
              break
          }
        },
        controller.signal
      )
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      const msg = (error as Error).message || 'Erro desconhecido'
      setErrorMessage(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [
    curadoriaSelected, curadoriaModulos, numeroCNJ, tipoPeca, observacao,
    curadoriaResumo, curadoriaDados, curadoriaTraces, curadoriaVariaveis,
    curadoriaParecer, toast, readSSEStream, refetchHistorico,
  ])

  // ============================================================
  // Parecer NATJus upload
  // ============================================================

  const handleParecerUpload = useCallback(async () => {
    if (!parecerFile) return
    setIsUploadingParecer(true)

    try {
      const formData = new FormData()
      formData.append('arquivo', parecerFile)
      formData.append('numero_cnj', numeroCNJ)
      if (tipoPeca) formData.append('tipo_peca', tipoPeca)

      const result = await geradorApi.post<{ upload_id: string }>('/parecer/upload', formData)
      setParecerUploadId(result.upload_id)
      setShowParecerDialog(false)
      setParecerFile(null)
      toast({ title: 'Sucesso', description: 'Parecer NATJus anexado com sucesso' })
      parecerResolveRef.current?.('uploaded')
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
    } finally {
      setIsUploadingParecer(false)
    }
  }, [parecerFile, numeroCNJ, tipoPeca, toast])

  const handleContinuarSemParecer = useCallback(() => {
    if (!window.confirm('Confirmar continuidade sem parecer NATJus? A ausencia sera registrada em auditoria.')) return
    setShowParecerDialog(false)
    setParecerFile(null)
    parecerUserChoiceRef.current = 'continue_without'
    if (inputMode === 'cnj') {
      iniciarGeracaoAutomatica()
    } else {
      iniciarGeracaoPdf()
    }
  }, [inputMode, iniciarGeracaoAutomatica, iniciarGeracaoPdf])

  // ============================================================
  // Editor - Chat
  // ============================================================

  const enviarMensagemChat = useCallback(async () => {
    if (!chatInput.trim() || isSendingChat) return

    const mensagem = chatInput.trim()
    setChatInput('')
    setIsSendingChat(true)

    const novoHistorico: EditorChatMessage[] = [...chatMessages, { role: 'user', content: mensagem }]
    setChatMessages(novoHistorico)

    try {
      const response = await fetch('/gerador-pecas/api/editar-minuta-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          minuta_atual: minutaMarkdown,
          mensagem: mensagem,
          historico: chatMessages.map((m) => ({ role: m.role, content: m.content })),
          tipo_peca: tipoPecaResultado || tipoPeca || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(errorData.detail || `Erro ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Erro ao iniciar streaming')

      const decoder = new TextDecoder()
      let buffer = ''
      let updatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const segments = buffer.split('\n\n')
        buffer = segments.pop() || ''

        for (const segment of segments) {
          const lines = segment.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as { content?: string }
                if (data.content) {
                  updatedContent += data.content
                }
              } catch {
                // heartbeat or non-JSON
              }
            } else if (line.startsWith('event: done')) {
              // Stream finished
            }
          }
        }
      }

      if (updatedContent) {
        setMinutaMarkdown(updatedContent)
        setChatMessages([...novoHistorico, { role: 'assistant', content: 'Pronto! Atualizei a minuta conforme solicitado.' }])

        if (geracaoId) {
          try {
            await geradorApi.put(`/historico/${geracaoId}`, {
              minuta_markdown: updatedContent,
              historico_chat: [...novoHistorico, { role: 'assistant', content: 'Minuta atualizada.' }],
              descricao_alteracao: mensagem,
            })
          } catch {
            // silently ignore auto-save errors
          }
        }
      } else {
        setChatMessages([...novoHistorico, { role: 'assistant', content: 'Nao consegui processar a alteracao. Tente novamente.' }])
      }
    } catch (error) {
      const err = error as Error
      setChatMessages([...novoHistorico, { role: 'assistant', content: `Erro: ${err.message}` }])
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setIsSendingChat(false)
    }
  }, [chatInput, isSendingChat, chatMessages, minutaMarkdown, tipoPecaResultado, tipoPeca, geracaoId, toast])

  // ============================================================
  // Export DOCX
  // ============================================================

  const exportarDocx = useCallback(async () => {
    if (!minutaMarkdown) return

    try {
      const result = await geradorApi.post<{ status: string; url_download?: string; filename?: string }>('/exportar-docx', {
        markdown: minutaMarkdown,
        numero_cnj: numeroCNJ || undefined,
        tipo_peca: tipoPecaResultado || tipoPeca || undefined,
      })

      if (result.status === 'sucesso' && result.url_download) {
        const downloadUrl = `${result.url_download}?token=${encodeURIComponent(getToken() || '')}`
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = result.filename || 'peca_juridica.docx'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast({ title: 'Sucesso', description: 'Download iniciado!' })
      }
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
    }
  }, [minutaMarkdown, numeroCNJ, tipoPecaResultado, tipoPeca, toast])

  // ============================================================
  // Copy to clipboard
  // ============================================================

  const copiarMinuta = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(minutaMarkdown)
      toast({ title: 'Sucesso', description: 'Minuta copiada para a area de transferencia!' })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao copiar', variant: 'destructive' })
    }
  }, [minutaMarkdown, toast])

  // ============================================================
  // Feedback
  // ============================================================

  const enviarFeedback = useCallback(async () => {
    if (!geracaoId || !feedbackNota) return

    try {
      await geradorApi.post('/feedback', {
        geracao_id: geracaoId,
        avaliacao: feedbackNota >= 4 ? 'correto' : feedbackNota >= 2 ? 'parcial' : 'incorreto',
        nota: feedbackNota,
        comentario: feedbackComentario || null,
      })
      toast({ title: 'Sucesso', description: 'Feedback enviado! Obrigado!' })
    } catch {
      // silently ignore
    } finally {
      setShowFeedback(false)
      setFeedbackNota(null)
      setFeedbackComentario('')
    }
  }, [geracaoId, feedbackNota, feedbackComentario, toast])

  // ============================================================
  // Historico - carregar geracao
  // ============================================================

  const carregarDoHistorico = useCallback(async (id: number) => {
    try {
      const data = await geradorApi.get<GeracaoDetalhe>(`/historico/${id}`)
      setGeracaoId(data.id)
      setNumeroCNJ(data.cnj || '')
      setTipoPecaResultado(data.tipo_peca || '')

      if (data.has_markdown && data.minuta_markdown) {
        setMinutaMarkdown(data.minuta_markdown)
      } else {
        setMinutaMarkdown('')
      }

      if (data.historico_chat) {
        setChatMessages(data.historico_chat)
      } else {
        setChatMessages([])
      }

      setPageState('resultado')
      setShowSidebar(false)
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
    }
  }, [toast])

  const excluirDoHistorico = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Deseja excluir esta geracao do historico?')) return
    try {
      await geradorApi.delete(`/historico/${id}`)
      toast({ title: 'Sucesso', description: 'Geracao excluida do historico' })
      refetchHistorico()
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
    }
  }, [toast, refetchHistorico])

  const abrirHistoricoVersoes = useCallback(async () => {
    if (!geracaoId) return
    try {
      const data = await geradorApi.get<{ versoes: Array<{ versao_id: number; numero_versao: number; linhas_adicionadas: number; linhas_removidas: number; descricao_alteracao: string; created_at: string }> }>(`/historico/${geracaoId}/versoes`)
      setVersionList(data.versoes)
      setShowVersionHistory(true)
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
    }
  }, [geracaoId, toast])

  const restaurarVersao = useCallback(async (versaoId: number) => {
    if (!geracaoId) return
    if (!window.confirm('Restaurar esta versao? A versao atual sera preservada no historico.')) return
    try {
      const data = await geradorApi.post<{ minuta_markdown: string }>(`/historico/${geracaoId}/versoes/${versaoId}/restaurar`)
      setMinutaMarkdown(data.minuta_markdown)
      setShowVersionHistory(false)
      toast({ title: 'Sucesso', description: 'Versao restaurada com sucesso' })
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
    }
  }, [geracaoId, toast])

  // ============================================================
  // Reset
  // ============================================================

  const voltarParaInicio = useCallback(() => {
    abortControllerRef.current?.abort()
    setPageState('idle')
    setStreamingContent('')
    streamingContentRef.current = ''
    setErrorMessage('')
    setMinutaMarkdown('')
    setGeracaoId(null)
    setChatMessages([])
    setAgentStatuses({ 1: 'aguardando', 2: 'aguardando', 3: 'aguardando' })
    setProgressMessage('')
    setCuradoriaModulos([])
    setCuradoriaSelected(new Set())
    parecerUserChoiceRef.current = null
  }, [])

  // ============================================================
  // Toggle curadoria module selection
  // ============================================================

  const toggleModulo = useCallback((id: number) => {
    setCuradoriaSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // ============================================================
  // Render
  // ============================================================

  const isFormDisabled = pageState !== 'idle'
  const isStreaming = pageState === 'streaming' || pageState === 'curadoria_gerando'

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-stone-50">

        {/* ============================================================ */}
        {/* TOP BAR                                                      */}
        {/* ============================================================ */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-stone-200/80 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              aria-label="Voltar ao Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-5 w-px bg-stone-200" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900 shadow-sm">
                <Scale className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold leading-none text-stone-900 tracking-tight">Gerador de Pecas</h1>
                <p className="mt-0.5 text-[11px] leading-none text-stone-400">Assistente de redacao juridica</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {pageState === 'resultado' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={voltarParaInicio}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Nova</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Nova geracao</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
                    showSidebar
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700',
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Historico</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Historico de geracoes</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ============================================================ */}
        {/* MAIN CONTENT AREA                                            */}
        {/* ============================================================ */}
        <div className="flex flex-1 overflow-hidden">

          {/* MAIN PANEL */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

              {/* ============================================================ */}
              {/* IDLE + FORM STATE                                            */}
              {/* ============================================================ */}
              {(pageState === 'idle' || isFormDisabled) && pageState !== 'curadoria_preview' && pageState !== 'resultado' && pageState !== 'editando' && (
                <>
                  {/* Error banner */}
                  {pageState === 'erro' && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-red-800">Erro na geracao</p>
                        <p className="mt-0.5 text-sm text-red-600">{errorMessage}</p>
                      </div>
                      <button
                        onClick={voltarParaInicio}
                        className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}

                  {/* Form card */}
                  <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm">
                    {/* Input mode tabs */}
                    <div className="flex border-b border-stone-100">
                      <button
                        type="button"
                        className={cn(
                          'relative flex-1 px-5 py-3.5 text-sm font-medium transition-colors',
                          inputMode === 'cnj'
                            ? 'text-stone-900'
                            : 'text-stone-400 hover:text-stone-600',
                        )}
                        onClick={() => setInputMode('cnj')}
                        disabled={isFormDisabled}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Search className="h-3.5 w-3.5" />
                          Por Processo (CNJ)
                        </span>
                        {inputMode === 'cnj' && (
                          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-stone-900" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'relative flex-1 px-5 py-3.5 text-sm font-medium transition-colors',
                          inputMode === 'pdf'
                            ? 'text-stone-900'
                            : 'text-stone-400 hover:text-stone-600',
                        )}
                        onClick={() => setInputMode('pdf')}
                        disabled={isFormDisabled}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Upload className="h-3.5 w-3.5" />
                          Upload de PDF
                        </span>
                        {inputMode === 'pdf' && (
                          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-stone-900" />
                        )}
                      </button>
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="space-y-5">
                        {/* CNJ Input */}
                        {inputMode === 'cnj' && (
                          <div>
                            <Label htmlFor="numero-cnj" className="text-xs font-medium uppercase tracking-wider text-stone-500">
                              Numero do Processo
                            </Label>
                            <Input
                              id="numero-cnj"
                              value={numeroCNJ}
                              onChange={(e) => setNumeroCNJ(formatCNJ(e.target.value))}
                              placeholder="0000000-00.0000.0.00.0000"
                              className="mt-2 h-11 rounded-xl border-stone-200 bg-stone-50/50 font-mono text-base tracking-wide placeholder:text-stone-300 focus:border-stone-400 focus:bg-white focus:ring-stone-400/20"
                              disabled={isFormDisabled}
                            />
                          </div>
                        )}

                        {/* PDF Upload */}
                        {inputMode === 'pdf' && (
                          <div>
                            <Label className="text-xs font-medium uppercase tracking-wider text-stone-500">
                              Arquivos PDF
                            </Label>
                            <div
                              className="mt-2 cursor-pointer rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/30 p-8 text-center transition-all hover:border-stone-300 hover:bg-stone-50"
                              onClick={() => pdfInputRef.current?.click()}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') pdfInputRef.current?.click() }}
                            >
                              <input
                                ref={pdfInputRef}
                                type="file"
                                accept=".pdf"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || [])
                                  setPdfFiles(prev => [...prev, ...files])
                                  e.target.value = ''
                                }}
                                disabled={isFormDisabled}
                              />
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
                                <Upload className="h-5 w-5 text-stone-400" />
                              </div>
                              <p className="mt-3 text-sm font-medium text-stone-600">
                                Arraste PDFs aqui ou clique para selecionar
                              </p>
                              <p className="mt-1 text-xs text-stone-400">
                                Documentos do processo em formato PDF
                              </p>
                            </div>
                            {pdfFiles.length > 0 && (
                              <div className="mt-3 space-y-1.5">
                                {pdfFiles.map((file, idx) => (
                                  <div key={idx} className="flex items-center justify-between rounded-lg border border-stone-150 bg-white px-3 py-2.5">
                                    <div className="flex items-center gap-2.5 truncate">
                                      <FileText className="h-4 w-4 flex-shrink-0 text-red-500" />
                                      <span className="truncate text-sm text-stone-700">{file.name}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setPdfFiles(prev => prev.filter((_, i) => i !== idx))}
                                      className="ml-2 flex-shrink-0 rounded p-0.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500"
                                      aria-label={`Remover ${file.name}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tipo de Peca */}
                        <div>
                          <Label htmlFor="tipo-peca" className="text-xs font-medium uppercase tracking-wider text-stone-500">
                            Tipo de Peca
                          </Label>
                          {isLoadingTipos ? (
                            <Skeleton className="mt-2 h-11 w-full rounded-xl" />
                          ) : (
                            <Select
                              value={tipoPeca || (tiposPecaData?.permite_auto ? '__auto__' : '')}
                              onValueChange={(v) => setTipoPeca(v === '__auto__' ? '' : v)}
                              disabled={isFormDisabled}
                            >
                              <SelectTrigger className="mt-2 h-11 rounded-xl border-stone-200 bg-stone-50/50 focus:border-stone-400 focus:ring-stone-400/20" id="tipo-peca">
                                <SelectValue placeholder="Selecione o tipo de peca" />
                              </SelectTrigger>
                              <SelectContent>
                                {tiposPecaData?.permite_auto && (
                                  <SelectItem value="__auto__">Deteccao automatica (IA decide)</SelectItem>
                                )}
                                {tiposPecaData?.tipos.map((tipo) => (
                                  <SelectItem key={tipo.valor} value={tipo.valor}>
                                    {tipo.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {tiposPecaData && !tiposPecaData.permite_auto && (
                            <p className="mt-1.5 text-xs text-stone-400">Selecao obrigatoria &mdash; deteccao automatica desabilitada</p>
                          )}
                        </div>

                        {/* Grupo (opcional) */}
                        {gruposData && gruposData.grupos.length > 0 && (
                          <div>
                            <Label htmlFor="grupo" className="text-xs font-medium uppercase tracking-wider text-stone-500">
                              Grupo de Argumentos
                            </Label>
                            <Select
                              value={selectedGroupId ? String(selectedGroupId) : '__all__'}
                              onValueChange={(v) => setSelectedGroupId(v === '__all__' ? null : Number(v))}
                              disabled={isFormDisabled}
                            >
                              <SelectTrigger className="mt-2 h-11 rounded-xl border-stone-200 bg-stone-50/50 focus:border-stone-400 focus:ring-stone-400/20" id="grupo">
                                <SelectValue placeholder="Todos os grupos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Todos os grupos</SelectItem>
                                {gruposData.grupos.map((g) => (
                                  <SelectItem key={g.id} value={String(g.id)}>{g.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Subcategorias */}
                        {subcategorias.length > 0 && (
                          <div>
                            <Label className="text-xs font-medium uppercase tracking-wider text-stone-500">Subcategorias</Label>
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              {subcategorias.map((sub) => {
                                const isSelected = selectedSubcategorias.includes(sub.id)
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => setSelectedSubcategorias(prev =>
                                      isSelected ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                                    )}
                                    className={cn(
                                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                                      isSelected
                                        ? 'border-stone-900 bg-stone-900 text-white'
                                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
                                    )}
                                    disabled={isFormDisabled}
                                  >
                                    {isSelected && <Check className="mr-1 inline h-3 w-3" />}
                                    {sub.nome}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Observacao */}
                        <div>
                          <Label htmlFor="observacao" className="text-xs font-medium uppercase tracking-wider text-stone-500">
                            Observacoes
                            <span className="ml-1 font-normal normal-case tracking-normal text-stone-400">(opcional)</span>
                          </Label>
                          <Textarea
                            id="observacao"
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Instrucoes adicionais para a geracao..."
                            rows={3}
                            className="mt-2 rounded-xl border-stone-200 bg-stone-50/50 placeholder:text-stone-300 focus:border-stone-400 focus:ring-stone-400/20"
                            disabled={isFormDisabled}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-6 flex gap-3">
                        <Button
                          onClick={inputMode === 'cnj' ? iniciarGeracaoAutomatica : iniciarGeracaoPdf}
                          className="h-11 flex-1 gap-2 rounded-xl bg-stone-900 text-sm font-medium text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.98]"
                          disabled={isFormDisabled || (inputMode === 'cnj' ? !numeroCNJ.trim() : pdfFiles.length === 0) || (!tipoPeca && !tiposPecaData?.permite_auto)}
                        >
                          <Zap className="h-4 w-4" />
                          {isStreaming ? 'Gerando...' : 'Gerar Automatico'}
                        </Button>
                        {inputMode === 'cnj' && (
                          <Button
                            onClick={iniciarCuradoria}
                            variant="outline"
                            className="h-11 flex-1 gap-2 rounded-xl border-stone-200 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 active:scale-[0.98]"
                            disabled={isFormDisabled || !numeroCNJ.trim() || !tipoPeca || isCuradoriaLoading}
                          >
                            <Eye className="h-4 w-4" />
                            {isCuradoriaLoading ? 'Carregando...' : 'Semi-Automatico'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* "Como funciona" — pipeline visual */}
                  {pageState === 'idle' && (
                    <div className="mt-8">
                      <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-stone-400">Pipeline de geracao</h3>
                      <div className="flex items-center gap-0">
                        {AGENT_META.map((agent, i) => {
                          const Icon = agent.icon
                          return (
                            <div key={agent.numero} className="flex flex-1 items-center">
                              <div className="flex flex-1 flex-col items-center text-center">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-stone-200 shadow-sm">
                                  <Icon className="h-4.5 w-4.5 text-stone-500" />
                                </div>
                                <p className="mt-2.5 text-xs font-semibold text-stone-700">{agent.nome}</p>
                                <p className="mt-0.5 text-[11px] leading-tight text-stone-400">{agent.descricao}</p>
                              </div>
                              {i < AGENT_META.length - 1 && (
                                <ChevronRight className="mx-1 h-4 w-4 flex-shrink-0 text-stone-300" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recent history */}
                  {pageState === 'idle' && historico && historico.length > 0 && (
                    <div className="mt-8">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-stone-400">Recentes</h3>
                        <button
                          onClick={() => setShowSidebar(true)}
                          className="text-xs font-medium text-stone-400 transition-colors hover:text-stone-600"
                        >
                          Ver todos
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {historico.slice(0, 4).map((item) => (
                          <div
                            key={item.id}
                            onClick={() => carregarDoHistorico(item.id)}
                            className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white p-3.5 transition-all hover:border-stone-200 hover:shadow-sm"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') carregarDoHistorico(item.id) }}
                          >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 transition-colors group-hover:bg-stone-900 group-hover:text-white">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-stone-700">{item.cnj}</p>
                              <p className="mt-0.5 text-xs text-stone-400">{item.tipo_peca || 'Peca'} &middot; {formatDate(item.data)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => excluirDoHistorico(item.id, e)}
                              className="flex-shrink-0 rounded p-1 text-stone-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                              aria-label="Excluir geracao"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {pageState === 'idle' && (!historico || historico.length === 0) && !isLoadingHistorico && (
                    <div className="mt-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
                        <Scale className="h-6 w-6 text-stone-400" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-stone-500">Nenhuma geracao ainda</p>
                      <p className="mt-1 text-xs text-stone-400">Preencha o formulario acima para gerar sua primeira peca</p>
                    </div>
                  )}
                </>
              )}

              {/* ============================================================ */}
              {/* CURADORIA PREVIEW STATE                                      */}
              {/* ============================================================ */}
              {pageState === 'curadoria_preview' && (
                <div>
                  {/* Header */}
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-900">Curadoria de Modulos</h2>
                      <p className="mt-0.5 text-sm text-stone-500">
                        {curadoriaModulos.length} modulo(s) detectado(s) &mdash; selecione os que deseja incluir
                      </p>
                    </div>
                    <button
                      onClick={voltarParaInicio}
                      className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                  </div>

                  {/* Module groups */}
                  {(() => {
                    const categorias = new Map<string, ModuloPreview[]>()
                    for (const modulo of curadoriaModulos) {
                      const cat = modulo.categoria || 'Geral'
                      if (!categorias.has(cat)) categorias.set(cat, [])
                      categorias.get(cat)!.push(modulo)
                    }

                    return Array.from(categorias.entries()).map(([categoria, modulos]) => (
                      <div key={categoria} className="mb-6">
                        <div className="mb-2.5 flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">{categoria}</span>
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200 px-1.5 text-[10px] font-bold text-stone-600">
                            {modulos.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {modulos.map((modulo) => {
                            const isSelected = curadoriaSelected.has(modulo.id)
                            return (
                              <div
                                key={modulo.id}
                                className={cn(
                                  'cursor-pointer rounded-xl border p-4 transition-all',
                                  isSelected
                                    ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900/5'
                                    : 'border-stone-200 bg-white hover:border-stone-300',
                                )}
                                onClick={() => toggleModulo(modulo.id)}
                                role="checkbox"
                                aria-checked={isSelected}
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModulo(modulo.id) } }}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all',
                                      isSelected
                                        ? 'border-stone-900 bg-stone-900 text-white'
                                        : 'border-stone-300 bg-white',
                                    )}
                                  >
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-stone-800">{modulo.titulo}</span>
                                      {modulo.tag && (
                                        <span className="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                                          {modulo.tag}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-500">{modulo.conteudo}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}

                  {/* Footer actions */}
                  <div className="sticky bottom-0 -mx-4 mt-4 border-t border-stone-200 bg-stone-50 px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-stone-500">
                        <span className="font-semibold text-stone-900">{curadoriaSelected.size}</span> de {curadoriaModulos.length} selecionado(s)
                      </p>
                      <Button
                        onClick={gerarComCuradoria}
                        disabled={curadoriaSelected.size === 0}
                        className="h-10 gap-2 rounded-xl bg-stone-900 px-5 text-sm font-medium shadow-sm hover:bg-stone-800"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Gerar com Selecionados
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* RESULTADO STATE                                              */}
              {/* ============================================================ */}
              {pageState === 'resultado' && (
                <>
                  {/* Result toolbar */}
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-stone-900">Peca Gerada</h2>
                        <div className="flex items-center gap-1.5">
                          {tipoPecaResultado && (
                            <span className="text-xs text-stone-400">{tipoPecaResultado}</span>
                          )}
                          {tipoPecaResultado && numeroCNJ && <span className="text-xs text-stone-300">&middot;</span>}
                          {numeroCNJ && <span className="text-xs font-mono text-stone-400">{numeroCNJ}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={exportarDocx}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">DOCX</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Exportar como Word</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={copiarMinuta}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Copiar</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar texto</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={abrirHistoricoVersoes}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Versoes</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Historico de versoes</TooltipContent>
                      </Tooltip>
                      <button
                        onClick={() => setPageState('editando')}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-stone-800"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Editar com IA
                      </button>
                    </div>
                  </div>

                  {/* Document content */}
                  <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm">
                    <ScrollArea className="h-[65vh]">
                      <article className="px-8 py-10 sm:px-12">
                        <div
                          className="prose max-w-none"
                          dangerouslySetInnerHTML={{ __html: minutaHtml }}
                        />
                      </article>
                    </ScrollArea>
                  </div>

                  {/* Feedback inline */}
                  {!showFeedback && geracaoId && (
                    <div className="mt-6 flex items-center justify-center gap-4 rounded-xl bg-white border border-stone-200/80 p-4">
                      <span className="text-xs text-stone-400">Avaliar geracao</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((nota) => (
                          <button
                            key={nota}
                            onClick={() => { setFeedbackNota(nota); setShowFeedback(true) }}
                            className="rounded-md p-1 transition-transform hover:scale-110"
                            aria-label={`Nota ${nota}`}
                          >
                            <Star
                              className={cn(
                                'h-5 w-5 transition-colors',
                                feedbackNota && nota <= feedbackNota
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-stone-300 hover:text-amber-300',
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ============================================================ */}
              {/* EDITANDO STATE — Split view                                  */}
              {/* ============================================================ */}
              {pageState === 'editando' && (
                <div className="-mx-4 -mt-8 sm:-mx-6 lg:-mx-8">
                  <div className="flex h-[calc(100vh-3.5rem)]">
                    {/* Preview column */}
                    <div className="flex flex-1 flex-col border-r border-stone-200">
                      <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-stone-100 bg-white px-4">
                        <span className="text-xs font-medium text-stone-500">Visualizacao</span>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={exportarDocx} className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Exportar DOCX</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={copiarMinuta} className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar texto</TooltipContent>
                          </Tooltip>
                          <button
                            onClick={() => setPageState('resultado')}
                            className="ml-1 rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <ScrollArea className="flex-1">
                        <article className="px-8 py-8">
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: minutaHtml }}
                          />
                        </article>
                      </ScrollArea>
                    </div>

                    {/* Chat column */}
                    <div className="flex w-full max-w-md flex-col bg-white">
                      <div className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-stone-100 px-4">
                        <Bot className="h-4 w-4 text-stone-400" />
                        <span className="text-xs font-medium text-stone-700">Assistente de Edicao</span>
                      </div>

                      <ScrollArea className="flex-1 px-4 py-4" ref={chatScrollRef}>
                        <div className="space-y-4">
                          {chatMessages.length === 0 && (
                            <div className="rounded-xl bg-stone-50 p-4">
                              <p className="text-sm text-stone-600">
                                Peca alteracoes na minuta. Por exemplo:
                              </p>
                              <div className="mt-3 space-y-2">
                                {[
                                  'Adicione um argumento sobre prescricao',
                                  'Reescreva o topico sobre competencia',
                                  'Remova a secao de preliminares',
                                ].map((sugestao) => (
                                  <button
                                    key={sugestao}
                                    onClick={() => { setChatInput(sugestao) }}
                                    className="block w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-xs text-stone-600 transition-colors hover:bg-stone-50"
                                  >
                                    &ldquo;{sugestao}&rdquo;
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {chatMessages.map((msg, idx) => (
                            <div key={idx} className={cn('flex gap-2.5', msg.role === 'user' && 'justify-end')}>
                              {msg.role === 'assistant' && (
                                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-stone-100">
                                  <Bot className="h-3 w-3 text-stone-500" />
                                </div>
                              )}
                              <div
                                className={cn(
                                  'max-w-[85%] rounded-2xl px-3.5 py-2.5',
                                  msg.role === 'user'
                                    ? 'rounded-br-md bg-stone-900 text-white'
                                    : 'rounded-bl-md bg-stone-100 text-stone-700',
                                )}
                              >
                                <p className="text-sm leading-relaxed">{msg.content}</p>
                              </div>
                            </div>
                          ))}

                          {isSendingChat && (
                            <div className="flex gap-2.5">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-stone-100">
                                <Bot className="h-3 w-3 text-stone-500" />
                              </div>
                              <div className="rounded-2xl rounded-bl-md bg-stone-100 px-4 py-3">
                                <div className="flex gap-1">
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0.15s]" />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0.3s]" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      {/* Chat input */}
                      <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2.5">
                        <Input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              enviarMensagemChat()
                            }
                          }}
                          placeholder="Peca uma alteracao..."
                          disabled={isSendingChat}
                          className="h-9 flex-1 rounded-lg border-stone-200 bg-stone-50/50 text-sm placeholder:text-stone-300"
                        />
                        <button
                          onClick={enviarMensagemChat}
                          disabled={isSendingChat || !chatInput.trim()}
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white shadow-sm transition-colors hover:bg-stone-800 disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* ============================================================ */}
          {/* HISTORY SIDEBAR                                              */}
          {/* ============================================================ */}
          {showSidebar && (
            <>
              {/* Overlay on mobile */}
              <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
                onClick={() => setShowSidebar(false)}
              />
              <aside className="fixed right-0 top-14 z-50 flex h-[calc(100vh-3.5rem)] w-80 flex-col border-l border-stone-200 bg-white lg:static lg:z-auto">
                <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-stone-100 px-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Historico</span>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ScrollArea className="flex-1">
                  {isLoadingHistorico ? (
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                  ) : !historico || historico.length === 0 ? (
                    <div className="py-16 text-center">
                      <History className="mx-auto h-8 w-8 text-stone-300" />
                      <p className="mt-3 text-xs text-stone-400">Nenhuma geracao</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5 p-2">
                      {historico.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => carregarDoHistorico(item.id)}
                          className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-stone-50"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') carregarDoHistorico(item.id) }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-stone-700">{item.cnj}</p>
                            <p className="mt-0.5 text-[11px] text-stone-400">
                              {item.tipo_peca || 'Peca'} &middot; {formatDate(item.data)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => excluirDoHistorico(item.id, e)}
                            className="flex-shrink-0 rounded p-1 text-stone-300 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </aside>
            </>
          )}
        </div>

        {/* ============================================================ */}
        {/* PROGRESS MODAL                                               */}
        {/* ============================================================ */}
        <Dialog open={isStreaming} onOpenChange={(open) => { if (!open) voltarParaInicio() }}>
          <DialogContent
            className="max-w-md rounded-2xl border-stone-200 p-0 shadow-xl"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <div className="px-6 pt-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-base">
                  <Loader2 className="h-4 w-4 animate-spin text-stone-500" />
                  Gerando Peca
                </DialogTitle>
                <DialogDescription className="sr-only">Progresso da geracao da peca juridica</DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 pb-6">
              <p className="mt-3 text-sm text-stone-500">{progressMessage || 'Iniciando...'}</p>

              {/* Agent pipeline */}
              <div className="mt-5 space-y-2">
                {AGENT_META.map((agent) => {
                  const status = agentStatuses[agent.numero]
                  const Icon = agent.icon
                  return (
                    <div
                      key={agent.numero}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 transition-all',
                        status === 'ativo' && 'border-stone-300 bg-stone-50',
                        status === 'concluido' && 'border-emerald-200 bg-emerald-50/50',
                        status === 'erro' && 'border-red-200 bg-red-50/50',
                        status === 'aguardando' && 'border-stone-100 bg-stone-50/50',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all',
                          status === 'ativo' && 'bg-stone-900 text-white',
                          status === 'concluido' && 'bg-emerald-500 text-white',
                          status === 'erro' && 'bg-red-500 text-white',
                          status === 'aguardando' && 'bg-stone-200 text-stone-400',
                        )}
                      >
                        {status === 'ativo' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : status === 'concluido' ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : status === 'erro' ? (
                          <X className="h-3.5 w-3.5" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700">{agent.nome}</p>
                        <p className="text-[11px] text-stone-400">{agent.descricao}</p>
                      </div>
                      {status === 'ativo' && (
                        <span className="flex-shrink-0 text-[11px] font-medium text-stone-500">Ativo</span>
                      )}
                      {status === 'concluido' && (
                        <span className="flex-shrink-0 text-[11px] font-medium text-emerald-600">OK</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Streaming preview */}
              {streamingContent && (
                <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50/80 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-stone-400" />
                    <span className="text-[11px] font-medium text-stone-500">Preview em tempo real</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: minutaHtml }}
                    />
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              <button
                onClick={voltarParaInicio}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* PARECER NATJUS DIALOG                                        */}
        {/* ============================================================ */}
        <Dialog open={showParecerDialog} onOpenChange={setShowParecerDialog}>
          <DialogContent className="max-w-md rounded-2xl border-stone-200">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Parecer NATJus ausente
              </DialogTitle>
              <DialogDescription className="sr-only">Opcoes para anexar parecer NATJus</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-stone-500">
                Nao foi encontrado parecer NATJus no processo. Ele e essencial para a geracao adequada desta peca.
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="parecer-file" className="text-xs font-medium uppercase tracking-wider text-stone-500">
                    Anexar Parecer (PDF)
                  </Label>
                  <Input
                    id="parecer-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setParecerFile(e.target.files?.[0] || null)}
                    className="mt-2"
                  />
                </div>
                <Button
                  onClick={handleParecerUpload}
                  disabled={!parecerFile || isUploadingParecer}
                  className="w-full gap-2 rounded-xl bg-stone-900 hover:bg-stone-800"
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingParecer ? 'Enviando...' : 'Enviar Parecer'}
                </Button>
                <Separator />
                <button
                  onClick={handleContinuarSemParecer}
                  className="w-full rounded-xl py-2.5 text-sm text-stone-400 transition-colors hover:text-stone-600"
                >
                  Continuar sem Parecer
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* FEEDBACK DIALOG                                              */}
        {/* ============================================================ */}
        <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
          <DialogContent className="max-w-sm rounded-2xl border-stone-200">
            <DialogHeader>
              <DialogTitle className="text-center text-base">Como foi a experiencia?</DialogTitle>
              <DialogDescription className="sr-only">Avalie a qualidade da geracao</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((nota) => (
                  <button
                    key={nota}
                    onClick={() => setFeedbackNota(nota)}
                    className="rounded-lg p-1.5 transition-transform hover:scale-110"
                    aria-label={`Nota ${nota}`}
                  >
                    <Star
                      className={cn(
                        'h-7 w-7 transition-colors',
                        feedbackNota && nota <= feedbackNota
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-stone-300 hover:text-amber-300',
                      )}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={feedbackComentario}
                onChange={(e) => setFeedbackComentario(e.target.value)}
                placeholder="Comentarios (opcional)"
                rows={3}
                className="rounded-xl border-stone-200"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowFeedback(false)}
                  className="rounded-lg px-4 py-2 text-sm text-stone-400 transition-colors hover:text-stone-600"
                >
                  Pular
                </button>
                <Button
                  onClick={enviarFeedback}
                  disabled={!feedbackNota}
                  className="gap-1.5 rounded-xl bg-stone-900 px-4 hover:bg-stone-800"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* VERSION HISTORY DIALOG                                       */}
        {/* ============================================================ */}
        <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
          <DialogContent className="max-w-lg rounded-2xl border-stone-200">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <RotateCcw className="h-4 w-4 text-stone-400" />
                Historico de Versoes
              </DialogTitle>
              <DialogDescription className="sr-only">Lista de versoes anteriores da peca</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {versionList.length === 0 ? (
                <div className="py-12 text-center">
                  <History className="mx-auto h-8 w-8 text-stone-300" />
                  <p className="mt-3 text-sm text-stone-400">Nenhuma versao anterior</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versionList.map((v) => (
                    <div key={v.versao_id} className="rounded-xl border border-stone-100 p-4 transition-colors hover:bg-stone-50/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-stone-700">v{v.numero_versao}</span>
                        <span className="text-[11px] text-stone-400">{formatDateTime(v.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">{v.descricao_alteracao || 'Sem descricao'}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          +{v.linhas_adicionadas}
                        </span>
                        <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          -{v.linhas_removidas}
                        </span>
                        <button
                          onClick={() => restaurarVersao(v.versao_id)}
                          className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restaurar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  )
}
