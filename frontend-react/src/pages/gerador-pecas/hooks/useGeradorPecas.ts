/**
 * Hook principal do Gerador de Pecas.
 *
 * Centraliza todo o estado (useState), efeitos (useEffect), refs e callbacks.
 * O componente de pagina consome este hook e distribui props para subcomponentes.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import {
  useTiposPeca,
  useHistoricoGerador,
  useGruposDisponiveis,
  useSubcategorias,
  useExcluirGeracao,
  useVersoesGeracao,
  useRestaurarVersao,
  useEnviarFeedback,
  useUploadParecer,
  useExportarDocx,
  useInvalidateQueries,
} from '@/hooks/useQueries'
import { useMarkdown } from '@/hooks/useMarkdown'
import { geradorApi, getToken } from '@/lib/api'
import { useStreamingFetch, fetchSSEStream } from '@/services/api/streaming'
import type {
  GeracaoDetalhe,
  SSEEvent,
  ModuloPreview,
  CuradoriaPreviewResponse,
  EditorChatMessage,
  PageState,
  AgentStatus,
} from '@/types/gerador-pecas'
import type { VersionItem } from '../types'
import { formatCNJ } from '../types'

// ============================================================================
// Hook
// ============================================================================

export function useGeradorPecas() {
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

  // Ref para despachar eventos SSE para o handler correto (auto, PDF, curadoria)
  const sseEventHandlerRef = useRef<((event: SSEEvent) => void) | null>(null)

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
  const [versionList, setVersionList] = useState<VersionItem[]>([])

  // --- Parecer NATJus dialog ---
  const [showParecerDialog, setShowParecerDialog] = useState(false)
  const [parecerFile, setParecerFile] = useState<File | null>(null)
  const [isUploadingParecer, setIsUploadingParecer] = useState(false)
  const parecerResolveRef = useRef<((choice: 'uploaded' | 'continue_without') => void) | null>(null)
  const [parecerUploadId, setParecerUploadId] = useState<string | null>(null)
  const parecerUserChoiceRef = useRef<string | null>(null)

  // --- Sidebar ---
  const [showSidebar, setShowSidebar] = useState(false)

  // ==========================================================================
  // Data loading (TanStack Query)
  // ==========================================================================

  const {
    data: tiposPecaData,
    isLoading: isLoadingTipos,
  } = useTiposPeca()

  const {
    data: historico,
    isLoading: isLoadingHistorico,
  } = useHistoricoGerador()

  const { data: gruposData } = useGruposDisponiveis()

  const { data: subcategoriasData } = useSubcategorias(selectedGroupId)

  // --- Mutations ---
  const { invalidateGeradorHistorico } = useInvalidateQueries()
  const excluirGeracaoMutation = useExcluirGeracao()
  const enviarFeedbackMutation = useEnviarFeedback()
  const uploadParecerMutation = useUploadParecer()
  const exportarDocxMutation = useExportarDocx()
  const restaurarVersaoMutation = useRestaurarVersao()
  const { data: versoesData, refetch: refetchVersoes } = useVersoesGeracao(geracaoId)

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Sync version list when data changes
  useEffect(() => {
    if (versoesData?.versoes) {
      setVersionList(versoesData.versoes)
    }
  }, [versoesData])

  // Rendered markdown
  const { html: minutaHtml } = useMarkdown(
    pageState === 'streaming' ? streamingContent : minutaMarkdown
  )

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  // Update subcategorias when query data changes
  useEffect(() => {
    if (subcategoriasData) {
      setSubcategorias(subcategoriasData)
    } else if (!selectedGroupId) {
      setSubcategorias([])
    }
    setSelectedSubcategorias([])
  }, [subcategoriasData, selectedGroupId])

  // ==========================================================================
  // Hook compartilhado de streaming SSE (POST-based)
  // ==========================================================================

  const { start: startSSE, startFormData: startSSEFormData, abort: abortSSE } = useStreamingFetch<SSEEvent>({
    onEvent: (event) => sseEventHandlerRef.current?.(event),
    onError: (err) => {
      const msg = err.message || 'Erro desconhecido'
      setErrorMessage(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    },
  })

  // ==========================================================================
  // Processar - Modo Automatico
  // ==========================================================================

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

    // Define handler de eventos SSE para modo automatico
    sseEventHandlerRef.current = (event) => {
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
          invalidateGeradorHistorico()
          toast({ title: 'Sucesso', description: 'Peca juridica gerada com sucesso!' })
          break
        case 'erro':
          setErrorMessage(event.mensagem)
          setPageState('erro')
          toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
          break
      }
    }

    await startSSE('/gerador-pecas/api/processar-stream', {
      numero_cnj: numeroCNJ,
      tipo_peca: tipoPeca || undefined,
      observacao_usuario: observacao || undefined,
      group_id: selectedGroupId || undefined,
      subcategoria_ids: selectedSubcategorias.length > 0 ? selectedSubcategorias : undefined,
      parecer_upload_id: parecerUploadId || undefined,
      parecer_user_choice_when_missing: parecerUserChoiceRef.current || undefined,
    }).then(() => {
      setPageState((prev) => prev === 'streaming' ? 'idle' : prev)
    }).catch(() => {
      // Erro ja tratado pelo onError do hook
    })
  }, [numeroCNJ, tipoPeca, observacao, selectedGroupId, selectedSubcategorias, parecerUploadId, toast, startSSE, invalidateGeradorHistorico])

  // ==========================================================================
  // Processar - Modo PDF Upload
  // ==========================================================================

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

    const formData = new FormData()
    pdfFiles.forEach(file => formData.append('arquivos', file))
    if (tipoPeca) formData.append('tipo_peca', tipoPeca)
    if (observacao) formData.append('observacao_usuario', observacao)
    if (selectedGroupId) formData.append('group_id', String(selectedGroupId))
    if (selectedSubcategorias.length > 0) formData.append('subcategoria_ids', JSON.stringify(selectedSubcategorias))
    if (parecerUploadId) formData.append('parecer_upload_id', parecerUploadId)
    if (parecerUserChoiceRef.current) formData.append('parecer_user_choice_when_missing', parecerUserChoiceRef.current)

    // Define handler de eventos SSE para modo PDF
    sseEventHandlerRef.current = (event) => {
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
          invalidateGeradorHistorico()
          toast({ title: 'Sucesso', description: 'Peca juridica gerada com sucesso!' })
          break
        case 'erro':
          setErrorMessage(event.mensagem)
          setPageState('erro')
          toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
          break
      }
    }

    await startSSEFormData('/gerador-pecas/api/processar-pdfs-stream', formData)
      .then(() => {
        setPageState((prev) => prev === 'streaming' ? 'idle' : prev)
      })
      .catch(() => {
        // Erro ja tratado pelo onError do hook
      })
  }, [pdfFiles, tipoPeca, observacao, selectedGroupId, selectedSubcategorias, parecerUploadId, toast, startSSEFormData, invalidateGeradorHistorico])

  // ==========================================================================
  // Processar - Modo Semi-Automatico (Curadoria)
  // ==========================================================================

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

  // ==========================================================================
  // Curadoria - Gerar com selecionados
  // ==========================================================================

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

    const previewIds = curadoriaModulos.map((m) => m.id)
    const manuaisIds = selectedIds.filter((id) => !previewIds.includes(id))

    // Define handler de eventos SSE para curadoria
    sseEventHandlerRef.current = (event) => {
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
          invalidateGeradorHistorico()
          toast({ title: 'Sucesso', description: 'Peca gerada com sucesso!' })
          break
        case 'erro':
          setErrorMessage(event.mensagem)
          setPageState('erro')
          toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
          break
      }
    }

    await startSSE('/gerador-pecas/api/curadoria/gerar-stream', {
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
    }).catch(() => {
      // Erro ja tratado pelo onError do hook
    })
  }, [
    curadoriaSelected, curadoriaModulos, numeroCNJ, tipoPeca, observacao,
    curadoriaResumo, curadoriaDados, curadoriaTraces, curadoriaVariaveis,
    curadoriaParecer, toast, startSSE, invalidateGeradorHistorico,
  ])

  // ==========================================================================
  // Parecer NATJus upload
  // ==========================================================================

  const handleParecerUpload = useCallback(async () => {
    if (!parecerFile) return
    setIsUploadingParecer(true)

    const formData = new FormData()
    formData.append('arquivo', parecerFile)
    formData.append('numero_cnj', numeroCNJ)
    if (tipoPeca) formData.append('tipo_peca', tipoPeca)

    uploadParecerMutation.mutate(formData, {
      onSuccess: (result) => {
        setParecerUploadId(result.upload_id)
        setShowParecerDialog(false)
        setParecerFile(null)
        toast({ title: 'Sucesso', description: 'Parecer NATJus anexado com sucesso' })
        parecerResolveRef.current?.('uploaded')
        setIsUploadingParecer(false)
      },
      onError: (error) => {
        toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
        setIsUploadingParecer(false)
      },
    })
  }, [parecerFile, numeroCNJ, tipoPeca, toast, uploadParecerMutation])

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

  // ==========================================================================
  // Editor - Chat
  // ==========================================================================

  const enviarMensagemChat = useCallback(async () => {
    if (!chatInput.trim() || isSendingChat) return

    const mensagem = chatInput.trim()
    setChatInput('')
    setIsSendingChat(true)

    const novoHistorico: EditorChatMessage[] = [...chatMessages, { role: 'user', content: mensagem }]
    setChatMessages(novoHistorico)

    try {
      let updatedContent = ''
      const token = getToken()

      await fetchSSEStream<{ content?: string }>({
        url: '/gerador-pecas/api/editar-minuta-stream',
        body: JSON.stringify({
          minuta_atual: minutaMarkdown,
          mensagem: mensagem,
          historico: chatMessages.map((m) => ({ role: m.role, content: m.content })),
          tipo_peca: tipoPecaResultado || tipoPeca || undefined,
        }),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        onEvent: (data) => {
          if (data.content) {
            updatedContent += data.content
          }
        },
      })

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

  // ==========================================================================
  // Export DOCX
  // ==========================================================================

  const exportarDocx = useCallback(() => {
    if (!minutaMarkdown) return

    exportarDocxMutation.mutate({
      markdown: minutaMarkdown,
      numero_cnj: numeroCNJ || undefined,
      tipo_peca: tipoPecaResultado || tipoPeca || undefined,
    }, {
      onSuccess: (result) => {
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
      },
      onError: (error) => {
        toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
      },
    })
  }, [minutaMarkdown, numeroCNJ, tipoPecaResultado, tipoPeca, toast, exportarDocxMutation])

  // ==========================================================================
  // Copy to clipboard
  // ==========================================================================

  const copiarMinuta = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(minutaMarkdown)
      toast({ title: 'Sucesso', description: 'Minuta copiada para a area de transferencia!' })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao copiar', variant: 'destructive' })
    }
  }, [minutaMarkdown, toast])

  // ==========================================================================
  // Feedback
  // ==========================================================================

  const enviarFeedback = useCallback(() => {
    if (!geracaoId || !feedbackNota) return

    enviarFeedbackMutation.mutate({
      geracao_id: geracaoId,
      avaliacao: feedbackNota >= 4 ? 'correto' : feedbackNota >= 2 ? 'parcial' : 'incorreto',
      nota: feedbackNota,
      comentario: feedbackComentario || null,
    }, {
      onSuccess: () => {
        toast({ title: 'Sucesso', description: 'Feedback enviado! Obrigado!' })
      },
      onSettled: () => {
        setShowFeedback(false)
        setFeedbackNota(null)
        setFeedbackComentario('')
      },
    })
  }, [geracaoId, feedbackNota, feedbackComentario, toast, enviarFeedbackMutation])

  // ==========================================================================
  // Historico - carregar geracao
  // ==========================================================================

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
    excluirGeracaoMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: 'Sucesso', description: 'Geracao excluida do historico' })
      },
      onError: (error) => {
        toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
      },
    })
  }, [toast, excluirGeracaoMutation])

  const abrirHistoricoVersoes = useCallback(() => {
    if (!geracaoId) return
    refetchVersoes()
    setShowVersionHistory(true)
  }, [geracaoId, refetchVersoes])

  const restaurarVersao = useCallback((versaoId: number) => {
    if (!geracaoId) return
    if (!window.confirm('Restaurar esta versao? A versao atual sera preservada no historico.')) return

    restaurarVersaoMutation.mutate({ geracaoId, versaoId }, {
      onSuccess: (data) => {
        setMinutaMarkdown(data.minuta_markdown)
        setShowVersionHistory(false)
        toast({ title: 'Sucesso', description: 'Versao restaurada com sucesso' })
      },
      onError: (error) => {
        toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
      },
    })
  }, [geracaoId, toast, restaurarVersaoMutation])

  // ==========================================================================
  // Reset
  // ==========================================================================

  const voltarParaInicio = useCallback(() => {
    abortSSE()
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
  }, [abortSSE])

  // ==========================================================================
  // Toggle curadoria module selection
  // ==========================================================================

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

  // ==========================================================================
  // Derivados
  // ==========================================================================

  const isFormDisabled = pageState !== 'idle'
  const isStreaming = pageState === 'streaming' || pageState === 'curadoria_gerando'

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // Page state
    pageState,
    errorMessage,
    isFormDisabled,
    isStreaming,

    // Form
    inputMode,
    setInputMode,
    numeroCNJ,
    setNumeroCNJ: (v: string) => setNumeroCNJ(formatCNJ(v)),
    setNumeroCNJRaw: setNumeroCNJ,
    tipoPeca,
    setTipoPeca,
    observacao,
    setObservacao,
    pdfFiles,
    setPdfFiles,
    pdfInputRef,

    // Groups / Subcategorias
    selectedGroupId,
    setSelectedGroupId,
    subcategorias,
    selectedSubcategorias,
    setSelectedSubcategorias,

    // Agent progress
    agentStatuses,
    progressMessage,

    // Streaming
    streamingContent,
    minutaHtml,

    // Resultado
    geracaoId,
    minutaMarkdown,
    tipoPecaResultado,
    numeroCNJ_raw: numeroCNJ,

    // Curadoria
    curadoriaModulos,
    curadoriaSelected,
    isCuradoriaLoading,

    // Chat
    chatMessages,
    chatInput,
    setChatInput,
    isSendingChat,
    chatScrollRef,

    // Feedback
    showFeedback,
    setShowFeedback,
    feedbackNota,
    setFeedbackNota,
    feedbackComentario,
    setFeedbackComentario,

    // Version History
    showVersionHistory,
    setShowVersionHistory,
    versionList,

    // Parecer
    showParecerDialog,
    setShowParecerDialog,
    parecerFile,
    setParecerFile,
    isUploadingParecer,

    // Sidebar
    showSidebar,
    setShowSidebar,

    // Data loading
    tiposPecaData,
    isLoadingTipos,
    historico,
    isLoadingHistorico,
    gruposData,

    // Actions
    iniciarGeracaoAutomatica,
    iniciarGeracaoPdf,
    iniciarCuradoria,
    gerarComCuradoria,
    handleParecerUpload,
    handleContinuarSemParecer,
    enviarMensagemChat,
    exportarDocx,
    copiarMinuta,
    enviarFeedback,
    carregarDoHistorico,
    excluirDoHistorico,
    abrirHistoricoVersoes,
    restaurarVersao,
    voltarParaInicio,
    toggleModulo,
  }
}

/** Tipo de retorno do hook, para tipagem dos subcomponentes */
export type UseGeradorPecasReturn = ReturnType<typeof useGeradorPecas>
