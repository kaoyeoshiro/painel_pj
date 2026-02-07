import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
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

/** Aplica mascara CNJ: NNNNNNN-NN.NNNN.N.NN.NNNN */
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

/** Formata data ISO para pt-BR */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

// ============================================================
// Sub-components
// ============================================================

/** Indicador de progresso de um agente */
function AgentProgressItem(props: {
  numero: number
  nome: string
  descricao: string
  status: AgentStatus
}) {
  const { nome, descricao, status } = props

  const bgClass =
    status === 'ativo'
      ? 'bg-blue-50 border-blue-200'
      : status === 'concluido'
        ? 'bg-green-50 border-green-200'
        : status === 'erro'
          ? 'bg-red-50 border-red-200'
          : 'bg-gray-50 border-gray-100'

  const iconBgClass =
    status === 'ativo'
      ? 'bg-blue-500'
      : status === 'concluido'
        ? 'bg-green-500'
        : status === 'erro'
          ? 'bg-red-500'
          : 'bg-gray-200'

  const iconContent =
    status === 'ativo'
      ? '\u23F3' // hourglass
      : status === 'concluido'
        ? '\u2713' // check
        : status === 'erro'
          ? '\u2717' // cross
          : '\u2022' // bullet

  const badgeText =
    status === 'ativo'
      ? 'Processando'
      : status === 'concluido'
        ? 'Concluido'
        : status === 'erro'
          ? 'Erro'
          : 'Aguardando'

  const badgeVariant =
    status === 'erro' ? 'destructive' as const : status === 'ativo' || status === 'concluido' ? 'default' as const : 'secondary' as const

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${bgClass}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${iconBgClass}`}>
        {status === 'ativo' ? (
          <span className="animate-spin inline-block">{iconContent}</span>
        ) : (
          <span>{iconContent}</span>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{nome}</p>
        <p className="text-xs text-gray-500">{descricao}</p>
      </div>
      <Badge variant={badgeVariant} className="text-xs">
        {badgeText}
      </Badge>
    </div>
  )
}

// ============================================================
// Main Page Component
// ============================================================

export function GeradorPecasPage() {
  const { toast } = useToast()

  // --- Page state machine ---
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // --- Form state ---
  const [numeroCNJ, setNumeroCNJ] = useState('')
  const [tipoPeca, setTipoPeca] = useState('')
  const [observacao, setObservacao] = useState('')

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

  // --- Parecer NATJus dialog ---
  const [showParecerDialog, setShowParecerDialog] = useState(false)
  const [parecerFile, setParecerFile] = useState<File | null>(null)
  const [isUploadingParecer, setIsUploadingParecer] = useState(false)
  const parecerResolveRef = useRef<((choice: 'uploaded' | 'continue_without') => void) | null>(null)
  const [parecerUploadId, setParecerUploadId] = useState<string | null>(null)

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
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      const msg = (error as Error).message || 'Erro desconhecido'
      setErrorMessage(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [numeroCNJ, tipoPeca, observacao, toast, readSSEStream, refetchHistorico])

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
      // Check for 409 - parecer ausente
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
  }, [numeroCNJ, tipoPeca, parecerUploadId, toast])

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

    // Separate preview IDs from manually added
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
    setShowParecerDialog(false)
    setParecerFile(null)
    parecerResolveRef.current?.('continue_without')
  }, [])

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
      // Use streaming editor endpoint via fetch
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

        // Auto-save
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
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
    }
  }, [toast])

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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="Voltar ao Dashboard">
                &larr;
              </a>
              <div className="border-l border-gray-300 pl-4">
                <h1 className="font-semibold text-gray-800">Gerador de Pecas Juridicas</h1>
                <p className="text-xs text-gray-500">Gere pecas com inteligencia artificial</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* History drawer trigger */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Historico">
                    Historico
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Historico de Geracoes</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-80px)] mt-4">
                    {isLoadingHistorico ? (
                      <div className="space-y-3 p-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : !historico || historico.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">Nenhuma geracao encontrada</p>
                      </div>
                    ) : (
                      <div className="space-y-2 pr-2">
                        {historico.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => carregarDoHistorico(item.id)}
                            className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') carregarDoHistorico(item.id) }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-800 truncate">{item.cnj}</span>
                              <span className="text-xs text-gray-400">{formatDate(item.data)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{item.tipo_peca || 'Peca'}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </SheetContent>
              </Sheet>

              <Button variant="ghost" asChild>
                <a href="/dashboard">Dashboard</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ============================================================ */}
        {/* IDLE STATE - Form */}
        {/* ============================================================ */}
        {(pageState === 'idle' || isFormDisabled) && pageState !== 'curadoria_preview' && pageState !== 'resultado' && pageState !== 'editando' && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    G
                  </div>
                  <div>
                    <CardTitle>Gerar Peca Juridica</CardTitle>
                    <CardDescription>Informe os dados do processo para iniciar a geracao</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* CNJ Input */}
                  <div>
                    <Label htmlFor="numero-cnj">Numero do Processo (CNJ)</Label>
                    <Input
                      id="numero-cnj"
                      value={numeroCNJ}
                      onChange={(e) => setNumeroCNJ(formatCNJ(e.target.value))}
                      placeholder="0000000-00.0000.0.00.0000"
                      className="mt-2"
                      disabled={isFormDisabled}
                    />
                  </div>

                  {/* Tipo de Peca */}
                  <div>
                    <Label htmlFor="tipo-peca">Tipo de Peca</Label>
                    {isLoadingTipos ? (
                      <Skeleton className="h-10 w-full mt-2" />
                    ) : (
                      <Select
                        value={tipoPeca}
                        onValueChange={setTipoPeca}
                        disabled={isFormDisabled}
                      >
                        <SelectTrigger className="mt-2" id="tipo-peca">
                          <SelectValue placeholder="Selecione o tipo de peca" />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposPecaData?.tipos.map((tipo) => (
                            <SelectItem key={tipo.valor} value={tipo.valor}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Observacao */}
                  <div>
                    <Label htmlFor="observacao">Observacoes (opcional)</Label>
                    <Textarea
                      id="observacao"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Observacoes adicionais para o agente gerador..."
                      rows={3}
                      className="mt-2"
                      disabled={isFormDisabled}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={iniciarGeracaoAutomatica}
                      className="flex-1"
                      disabled={isFormDisabled || !numeroCNJ.trim()}
                    >
                      {isStreaming ? 'Gerando...' : 'Gerar Automatico'}
                    </Button>
                    <Button
                      onClick={iniciarCuradoria}
                      variant="secondary"
                      className="flex-1"
                      disabled={isFormDisabled || !numeroCNJ.trim() || !tipoPeca || isCuradoriaLoading}
                    >
                      {isCuradoriaLoading ? 'Carregando...' : 'Modo Semi-Automatico'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agent Progress (visible during streaming) */}
            {isStreaming && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Progresso</CardTitle>
                  <CardDescription>{progressMessage}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <AgentProgressItem numero={1} nome="Agente 1: Coletor" descricao="Coleta documentos do TJ-MS" status={agentStatuses[1]} />
                    <AgentProgressItem numero={2} nome="Agente 2: Ativador" descricao="Detecta argumentos relevantes" status={agentStatuses[2]} />
                    <AgentProgressItem numero={3} nome="Agente 3: Gerador" descricao="Gera a peca juridica" status={agentStatuses[3]} />
                  </div>

                  {/* Streaming preview */}
                  {streamingContent && (
                    <>
                      <Separator className="my-4" />
                      <div className="bg-white rounded-lg border p-4 max-h-64 overflow-y-auto">
                        <div className="flex items-center gap-2 text-blue-600 mb-3">
                          <span className="animate-pulse text-sm font-medium">Gerando peca em tempo real...</span>
                        </div>
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: minutaHtml }}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Error state */}
            {pageState === 'erro' && (
              <Card className="mb-6 border-red-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-red-600 font-medium mb-2">Erro na geracao</p>
                    <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
                    <Button onClick={voltarParaInicio} variant="secondary">
                      Tentar novamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Como funciona info card */}
            {pageState === 'idle' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Como funciona?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 font-bold">
                        1
                      </div>
                      <h3 className="font-medium text-gray-800 mb-1">Coleta</h3>
                      <p className="text-xs text-gray-500">O Agente 1 busca os documentos do processo no TJ-MS</p>
                    </div>
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600 font-bold">
                        2
                      </div>
                      <h3 className="font-medium text-gray-800 mb-1">Analise</h3>
                      <p className="text-xs text-gray-500">O Agente 2 identifica argumentos e teses aplicaveis</p>
                    </div>
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600 font-bold">
                        3
                      </div>
                      <h3 className="font-medium text-gray-800 mb-1">Geracao</h3>
                      <p className="text-xs text-gray-500">O Agente 3 gera a peca juridica completa</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Historico recente inline */}
            {pageState === 'idle' && (
              <Card className="mt-6">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Geracoes Recentes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingHistorico ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : !historico || historico.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Nenhuma geracao encontrada</p>
                      <p className="text-xs mt-1">Use o formulario acima para gerar sua primeira peca</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {historico.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => carregarDoHistorico(item.id)}
                          className="flex items-center gap-4 p-4 border rounded-xl hover:bg-sky-50 hover:border-sky-300 transition-all cursor-pointer group"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') carregarDoHistorico(item.id) }}
                        >
                          <div className="w-12 h-12 bg-gradient-to-br from-sky-100 to-blue-100 rounded-xl flex items-center justify-center group-hover:from-sky-200 group-hover:to-blue-200 transition-colors text-sky-600 font-bold">
                            P
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate group-hover:text-sky-700">{item.cnj}</p>
                            <Badge variant="outline" className="text-xs">{item.tipo_peca || 'Peca'}</Badge>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-gray-400">{formatDate(item.data)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* CURADORIA PREVIEW STATE */}
        {/* ============================================================ */}
        {pageState === 'curadoria_preview' && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Curadoria de Modulos</CardTitle>
                  <CardDescription>
                    Revise e selecione os modulos que serao incluidos na peca. {curadoriaModulos.length} modulo(s) detectado(s).
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={voltarParaInicio}>
                  Cancelar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Group modules by category */}
              {(() => {
                const categorias = new Map<string, ModuloPreview[]>()
                for (const modulo of curadoriaModulos) {
                  const cat = modulo.categoria || 'Geral'
                  if (!categorias.has(cat)) categorias.set(cat, [])
                  categorias.get(cat)!.push(modulo)
                }

                return Array.from(categorias.entries()).map(([categoria, modulos]) => (
                  <div key={categoria} className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">{categoria}</h3>
                    <div className="space-y-2">
                      {modulos.map((modulo) => {
                        const isSelected = curadoriaSelected.has(modulo.id)
                        return (
                          <div
                            key={modulo.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                            onClick={() => toggleModulo(modulo.id)}
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModulo(modulo.id) } }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                              }`}>
                                {isSelected && <span className="text-xs">{'\u2713'}</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-gray-800">{modulo.titulo}</span>
                                  {modulo.tag && <Badge variant="outline" className="text-xs">{modulo.tag}</Badge>}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">{modulo.conteudo}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              })()}

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {curadoriaSelected.size} de {curadoriaModulos.length} modulo(s) selecionado(s)
                </p>
                <Button
                  onClick={gerarComCuradoria}
                  disabled={curadoriaSelected.size === 0}
                >
                  Gerar com Selecionados
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* RESULTADO STATE */}
        {/* ============================================================ */}
        {pageState === 'resultado' && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Peca Gerada</CardTitle>
                    <CardDescription>
                      {tipoPecaResultado && <Badge variant="outline" className="mr-2">{tipoPecaResultado}</Badge>}
                      Processo {numeroCNJ}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={exportarDocx} variant="secondary" size="sm">
                      Baixar DOCX
                    </Button>
                    <Button onClick={copiarMinuta} variant="secondary" size="sm">
                      Copiar
                    </Button>
                    <Button onClick={() => setPageState('editando')} size="sm">
                      Editar com Chat
                    </Button>
                    <Button onClick={voltarParaInicio} variant="ghost" size="sm">
                      Nova Geracao
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh]">
                  <div className="bg-white rounded-lg border p-8">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: minutaHtml }}
                    />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Feedback section */}
            {!showFeedback && geracaoId && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-3">Como voce avalia esta geracao?</p>
                    <div className="flex justify-center gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((nota) => (
                        <button
                          key={nota}
                          onClick={() => { setFeedbackNota(nota); setShowFeedback(true) }}
                          className={`w-10 h-10 rounded-full border-2 transition-colors text-sm font-medium ${
                            feedbackNota && nota <= feedbackNota
                              ? 'bg-yellow-400 border-yellow-400 text-white'
                              : 'border-gray-200 text-gray-400 hover:border-yellow-300'
                          }`}
                        >
                          {nota}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* EDITANDO STATE - Chat + Preview */}
        {/* ============================================================ */}
        {pageState === 'editando' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview column */}
            <Card className="lg:h-[80vh] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Visualizacao</CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={exportarDocx} variant="secondary" size="sm">DOCX</Button>
                    <Button onClick={copiarMinuta} variant="secondary" size="sm">Copiar</Button>
                    <Button onClick={() => setPageState('resultado')} variant="ghost" size="sm">Fechar Editor</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="bg-white rounded-lg border p-6">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: minutaHtml }}
                    />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat column */}
            <Card className="lg:h-[80vh] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="text-lg">Assistente de Edicao</CardTitle>
                <CardDescription>Peca alteracoes na minuta</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 mb-4" ref={chatScrollRef}>
                  <div className="space-y-4 pr-2">
                    {/* Initial assistant message */}
                    {chatMessages.length === 0 && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                          IA
                        </div>
                        <div className="bg-gray-100 px-4 py-3 rounded-lg max-w-[85%]">
                          <p className="text-sm text-gray-700">
                            Ola! Sou o assistente de edicao. Voce pode me pedir alteracoes como:
                          </p>
                          <ul className="text-xs text-gray-500 mt-2 space-y-1 list-disc list-inside">
                            <li>&quot;Adicione um argumento sobre prescrição&quot;</li>
                            <li>&quot;Reescreva o topico sobre competência&quot;</li>
                            <li>&quot;Remova a secao de preliminares&quot;</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                            IA
                          </div>
                        )}
                        <div className={`px-4 py-3 rounded-lg max-w-[85%] ${
                          msg.role === 'user'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-gray-500">U</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Typing indicator */}
                    {isSendingChat && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                          IA
                        </div>
                        <div className="bg-gray-100 px-4 py-3 rounded-lg">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Chat input */}
                <div className="flex gap-2 pt-2 border-t">
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
                    className="flex-1"
                  />
                  <Button onClick={enviarMensagemChat} disabled={isSendingChat || !chatInput.trim()} size="sm">
                    Enviar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* PARECER NATJUS DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showParecerDialog} onOpenChange={setShowParecerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parecer NATJus nao encontrado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Nao foi encontrado parecer NATJus no processo. Ele e essencial para a geracao adequada desta peca.
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="parecer-file">Anexar Parecer (PDF)</Label>
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
                className="w-full"
              >
                {isUploadingParecer ? 'Enviando...' : 'Upload Parecer PDF'}
              </Button>

              <Separator />

              <Button
                onClick={handleContinuarSemParecer}
                variant="ghost"
                className="w-full"
              >
                Continuar sem Parecer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* FEEDBACK DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Como foi a experiencia?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((nota) => (
                <button
                  key={nota}
                  onClick={() => setFeedbackNota(nota)}
                  className={`w-10 h-10 rounded-full border-2 transition-colors text-sm font-medium ${
                    feedbackNota && nota <= feedbackNota
                      ? 'bg-yellow-400 border-yellow-400 text-white'
                      : 'border-gray-200 text-gray-400 hover:border-yellow-300'
                  }`}
                >
                  {nota}
                </button>
              ))}
            </div>

            <Textarea
              value={feedbackComentario}
              onChange={(e) => setFeedbackComentario(e.target.value)}
              placeholder="Comentarios adicionais (opcional)"
              rows={3}
            />

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowFeedback(false)}>
                Pular
              </Button>
              <Button onClick={enviarFeedback} disabled={!feedbackNota}>
                Enviar Feedback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
