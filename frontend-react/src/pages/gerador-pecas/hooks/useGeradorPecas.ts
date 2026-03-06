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
  useExcluirGeracao,
  useVersoesGeracao,
  useRestaurarVersao,
  useEnviarFeedback,
  useUploadParecer,
  useExportarDocx,
  useInvalidateQueries,
} from '@/hooks/useQueries'
import { useMarkdown } from '@/hooks/useMarkdown'
import { geradorApi, apiRequest, getToken } from '@/lib/api'
import { useStreamingFetch, fetchSSEStream } from '@/services/api/streaming'
import type {
  GeracaoDetalhe,
  SSEEvent,
  ModuloPreview,
  CuradoriaPreviewResponse,
  ModuloCuradoBackend,
  ModuloDisponivel,
  BuscaModulosResponse,
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
  // Subcategorias — campo legado, desabilitado na UI (backend mantido)
  const subcategorias: Array<{ id: number; nome: string }> = []
  const selectedSubcategorias: number[] = []
  const setSelectedSubcategorias = () => {}

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
  const [isStreamingContent, setIsStreamingContent] = useState(false)

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
  const [curadoriaManualIds, setCuradoriaManualIds] = useState<Set<number>>(new Set())
  const [curadoriaPreviewIds, setCuradoriaPreviewIds] = useState<number[]>([])
  const [curadoriaAvailableModulos, setCuradoriaAvailableModulos] = useState<ModuloDisponivel[]>([])
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false)
  const [curadoriaSearchResults, setCuradoriaSearchResults] = useState<ModuloPreview[]>([])
  const [isSearching, setIsSearching] = useState(false)

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
  const [parecerUploadId, setParecerUploadId] = useState<string | null>(null)
  const parecerUploadIdRef = useRef<string | null>(null)
  const parecerUserChoiceRef = useRef<string | null>(null)
  const parecerTriggerModeRef = useRef<'automatico' | 'semi_automatico'>('automatico')
  const parecerForcedToSemiAutoRef = useRef(false)

  // --- Sidebar ---
  const [showSidebar, setShowSidebar] = useState(false)

  // ==========================================================================
  // Data loading (TanStack Query)
  // ==========================================================================

  const {
    data: tiposPecaData,
    isLoading: isLoadingTipos,
  } = useTiposPeca(selectedGroupId)

  const {
    data: historico,
    isLoading: isLoadingHistorico,
  } = useHistoricoGerador()

  const { data: gruposData } = useGruposDisponiveis()

  // useSubcategorias — desabilitado (campo legado)

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

  // Rendered markdown — uses streaming content while tokens are arriving.
  // Fallback: if minutaMarkdown is empty (stream ended without 'sucesso'),
  // use accumulated streamingContent to avoid blank page.
  const { html: minutaHtml } = useMarkdown(
    isStreamingContent ? streamingContent : (minutaMarkdown || streamingContent)
  )

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  // Effect de subcategorias removido — campo legado desabilitado

  // Auto-select default group
  useEffect(() => {
    if (gruposData && selectedGroupId === null) {
      if (gruposData.default_group_id) {
        setSelectedGroupId(gruposData.default_group_id)
      } else if (gruposData.grupos.length === 1) {
        setSelectedGroupId(gruposData.grupos[0].id)
      }
    }
  }, [gruposData, selectedGroupId])

  // Reset tipo de peça when group changes
  useEffect(() => {
    setTipoPeca('')
  }, [selectedGroupId])

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
        case 'geracao_chunk': {
          const isFirst = streamingContentRef.current === ''
          streamingContentRef.current += event.content
          setStreamingContent(streamingContentRef.current)
          if (isFirst) {
            setIsStreamingContent(true)
            setPageState('resultado')
          }
          break
        }
        case 'parecer_natjus_ausente':
          parecerTriggerModeRef.current = 'automatico'
          setShowParecerDialog(true)
          setPageState('idle')
          break
        case 'sucesso':
          setGeracaoId(event.geracao_id)
          setMinutaMarkdown(event.minuta_markdown || streamingContentRef.current)
          setTipoPecaResultado(event.tipo_peca)
          setIsStreamingContent(false)
          setPageState('resultado')
          invalidateGeradorHistorico()
          toast({ title: 'Sucesso', description: 'Peca juridica gerada com sucesso!' })
          break
        case 'erro':
          setErrorMessage(event.mensagem)
          setIsStreamingContent(false)
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
      parecer_upload_id: parecerUploadIdRef.current || undefined,
      parecer_user_choice_when_missing: parecerUserChoiceRef.current || undefined,
    }).then(() => {
      // Fallback: if stream ended without 'sucesso', preserve accumulated content
      if (streamingContentRef.current) {
        setMinutaMarkdown((prev) => prev || streamingContentRef.current)
      }
      setIsStreamingContent(false)
      setPageState((prev) => prev === 'streaming' ? 'idle' : prev)
    }).catch(() => {
      // Erro ja tratado pelo onError do hook
    })
  }, [numeroCNJ, tipoPeca, observacao, selectedGroupId, toast, startSSE, invalidateGeradorHistorico])

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

    const formData = new FormData()
    pdfFiles.forEach(file => formData.append('arquivos', file))
    if (tipoPeca) formData.append('tipo_peca', tipoPeca)
    if (observacao) formData.append('observacao_usuario', observacao)
    if (selectedGroupId) formData.append('group_id', String(selectedGroupId))
    if (parecerUploadIdRef.current) formData.append('parecer_upload_id', parecerUploadIdRef.current)
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
        case 'geracao_chunk': {
          const isFirst = streamingContentRef.current === ''
          streamingContentRef.current += event.content
          setStreamingContent(streamingContentRef.current)
          if (isFirst) {
            setIsStreamingContent(true)
            setPageState('resultado')
          }
          break
        }
        case 'parecer_natjus_ausente':
          parecerTriggerModeRef.current = 'automatico'
          setShowParecerDialog(true)
          setPageState('idle')
          break
        case 'sucesso':
          setGeracaoId(event.geracao_id)
          setMinutaMarkdown(event.minuta_markdown || streamingContentRef.current)
          setTipoPecaResultado(event.tipo_peca)
          setIsStreamingContent(false)
          setPageState('resultado')
          invalidateGeradorHistorico()
          toast({ title: 'Sucesso', description: 'Peca juridica gerada com sucesso!' })
          break
        case 'erro':
          setErrorMessage(event.mensagem)
          setIsStreamingContent(false)
          setPageState('erro')
          toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
          break
      }
    }

    await startSSEFormData('/gerador-pecas/api/processar-pdfs-stream', formData)
      .then(() => {
        // Fallback: if stream ended without 'sucesso', preserve accumulated content
        if (streamingContentRef.current) {
          setMinutaMarkdown((prev) => prev || streamingContentRef.current)
        }
        setIsStreamingContent(false)
        setPageState((prev) => prev === 'streaming' ? 'idle' : prev)
      })
      .catch(() => {
        // Erro ja tratado pelo onError do hook
      })
  }, [pdfFiles, tipoPeca, observacao, selectedGroupId, toast, startSSEFormData, invalidateGeradorHistorico])

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
        parecer_upload_id: parecerUploadIdRef.current || undefined,
        parecer_user_choice_when_missing: parecerUserChoiceRef.current || undefined,
        parecer_forced_to_semi_auto: parecerForcedToSemiAutoRef.current || undefined,
        group_id: selectedGroupId || undefined,
      })

      // Flatten modulos_por_secao dict into a flat ModuloPreview[]
      const modulosPorSecao = result.curadoria?.modulos_por_secao ?? {}
      const modulos: ModuloPreview[] = Object.values(modulosPorSecao)
        .flat()
        .map((m: ModuloCuradoBackend) => ({
          id: m.id,
          titulo: m.titulo,
          categoria: m.categoria,
          conteudo: m.conteudo,
          tag: m.origem_ativacao ?? '',
        }))

      const previewIds = modulos.map((m) => m.id)
      setCuradoriaModulos(modulos)
      setCuradoriaSelected(new Set(previewIds))
      setCuradoriaPreviewIds(previewIds)
      setCuradoriaManualIds(new Set())
      setCuradoriaResumo(result.curadoria?.resumo_consolidado || '')
      setCuradoriaDados(result.curadoria?.dados_extracao || {})
      setCuradoriaTraces(result.decision_traces || {})
      setCuradoriaVariaveis(result.variaveis_snapshot || {})
      setCuradoriaParecer(result.parecer_context || {})
      setAgentStatuses({ 1: 'concluido', 2: 'concluido', 3: 'aguardando' })
      setPageState('curadoria_preview')

      // Fetch available modules in background (non-blocking)
      const gId = selectedGroupId
      if (gId) {
        setIsLoadingAvailable(true)
        apiRequest<ModuloDisponivel[]>(
          `/admin/api/prompts-modulos?group_id=${gId}&tipo=conteudo&apenas_ativos=true`
        )
          .then((available) => setCuradoriaAvailableModulos(available))
          .catch(() => { /* silently ignore — user can still use preview modules */ })
          .finally(() => setIsLoadingAvailable(false))
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const errLower = errMsg.toLowerCase()
      if (errLower.includes('parecer_natjus_missing') || errLower.includes('parecer natjus')) {
        parecerTriggerModeRef.current = 'semi_automatico'
        setShowParecerDialog(true)
        setPageState('idle')
      } else {
        setErrorMessage(errMsg)
        setPageState('erro')
        toast({ title: 'Erro', description: errMsg, variant: 'destructive' })
      }
    } finally {
      setIsCuradoriaLoading(false)
    }
  }, [numeroCNJ, tipoPeca, selectedGroupId, toast])

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

    const manuaisIds = Array.from(curadoriaManualIds)
    const excludedIds = curadoriaPreviewIds.filter((id) => !curadoriaSelected.has(id))

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
        case 'geracao_chunk': {
          const isFirst = streamingContentRef.current === ''
          streamingContentRef.current += event.content
          setStreamingContent(streamingContentRef.current)
          if (isFirst) {
            setIsStreamingContent(true)
            setPageState('resultado')
          }
          break
        }
        case 'sucesso':
          setGeracaoId(event.geracao_id)
          setMinutaMarkdown(event.minuta_markdown || streamingContentRef.current)
          setTipoPecaResultado(event.tipo_peca)
          setAgentStatuses({ 1: 'concluido', 2: 'concluido', 3: 'concluido' })
          setIsStreamingContent(false)
          setPageState('resultado')
          invalidateGeradorHistorico()
          toast({ title: 'Sucesso', description: 'Peca gerada com sucesso!' })
          break
        case 'erro':
          setErrorMessage(event.mensagem)
          setIsStreamingContent(false)
          setPageState('erro')
          toast({ title: 'Erro', description: event.mensagem, variant: 'destructive' })
          break
      }
    }

    await startSSE('/gerador-pecas/api/curadoria/gerar-stream', {
      numero_cnj: numeroCNJ,
      tipo_peca: tipoPeca,
      modulos_ids_curados: selectedIds,
      modulos_manuais_ids: manuaisIds.length > 0 ? manuaisIds : [],
      modulos_preview_ids: curadoriaPreviewIds,
      modulos_excluidos_ids: excludedIds.length > 0 ? excludedIds : [],
      resumo_consolidado: curadoriaResumo || undefined,
      dados_extracao: Object.keys(curadoriaDados).length > 0 ? curadoriaDados : undefined,
      decision_traces: Object.keys(curadoriaTraces).length > 0 ? curadoriaTraces : undefined,
      variaveis_snapshot: Object.keys(curadoriaVariaveis).length > 0 ? curadoriaVariaveis : undefined,
      parecer_context: Object.keys(curadoriaParecer).length > 0 ? curadoriaParecer : undefined,
      observacao_usuario: observacao || undefined,
    }).then(() => {
      // Fallback: if stream ended without 'sucesso', preserve accumulated content
      if (streamingContentRef.current) {
        setMinutaMarkdown((prev) => prev || streamingContentRef.current)
      }
      setIsStreamingContent(false)
    }).catch(() => {
      // Erro ja tratado pelo onError do hook
    })
  }, [
    curadoriaSelected, curadoriaManualIds, curadoriaPreviewIds, numeroCNJ, tipoPeca, observacao,
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
        parecerUploadIdRef.current = result.upload_id
        setShowParecerDialog(false)
        setParecerFile(null)
        toast({ title: 'Sucesso', description: 'Parecer NATJus anexado. Retomando geração...' })
        setIsUploadingParecer(false)
        // Auto-resume: retoma a geração no modo que disparou o dialog
        if (parecerTriggerModeRef.current === 'semi_automatico') {
          iniciarCuradoria()
        } else if (inputMode === 'cnj') {
          iniciarGeracaoAutomatica()
        } else {
          iniciarGeracaoPdf()
        }
      },
      onError: (error) => {
        toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' })
        setIsUploadingParecer(false)
      },
    })
  }, [parecerFile, numeroCNJ, tipoPeca, toast, uploadParecerMutation, inputMode, iniciarGeracaoAutomatica, iniciarGeracaoPdf, iniciarCuradoria])

  const handleContinuarSemParecer = useCallback(() => {
    if (!window.confirm('Confirmar continuidade sem parecer NATJus? A ausencia sera registrada em auditoria.')) return
    setShowParecerDialog(false)
    setParecerFile(null)
    parecerUserChoiceRef.current = 'continue_without'
    if (parecerTriggerModeRef.current === 'automatico') {
      // Regra de negócio: sem parecer no modo automático → migra para semi-automático
      parecerForcedToSemiAutoRef.current = true
      toast({ title: 'Modo Semi-Automatico', description: 'Sem parecer NATJus, a geracao sera feita no modo semi-automatico para selecao manual dos modulos.' })
      iniciarCuradoria()
    } else {
      iniciarCuradoria()
    }
  }, [iniciarCuradoria, toast])

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

      await fetchSSEStream<{ text?: string }>({
        url: '/gerador-pecas/api/editar-minuta-stream',
        body: JSON.stringify({
          minuta_atual: minutaMarkdown,
          mensagem: mensagem,
          historico: chatMessages.map((m) => ({ role: m.role, content: m.content })),
          tipo_peca: tipoPecaResultado || tipoPeca || undefined,
          group_id: selectedGroupId || undefined,
        }),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        onEvent: (data) => {
          if (data.text) {
            updatedContent += data.text
          }
        },
      })

      if (updatedContent) {
        const trimmed = updatedContent.trimStart()

        if (trimmed.startsWith('[PERGUNTA]')) {
          // Resposta é uma pergunta de esclarecimento — exibe SOMENTE no chat
          const questionText = trimmed.replace(/^\[PERGUNTA\]\s*/, '').trim()
          setChatMessages([...novoHistorico, { role: 'assistant', content: questionText }])
        } else {
          // Resposta é a minuta editada — aplica no documento
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
  }, [chatInput, isSendingChat, chatMessages, minutaMarkdown, tipoPecaResultado, tipoPeca, geracaoId, toast, selectedGroupId])

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
    setIsStreamingContent(false)
    setErrorMessage('')
    setMinutaMarkdown('')
    setGeracaoId(null)
    setChatMessages([])
    setAgentStatuses({ 1: 'aguardando', 2: 'aguardando', 3: 'aguardando' })
    setProgressMessage('')
    setCuradoriaModulos([])
    setCuradoriaSelected(new Set())
    setCuradoriaManualIds(new Set())
    setCuradoriaPreviewIds([])
    setCuradoriaAvailableModulos([])
    setCuradoriaSearchResults([])
    parecerUploadIdRef.current = null
    setParecerUploadId(null)
    parecerUserChoiceRef.current = null
  }, [abortSSE])

  /** Fecha o dialog de resultado e limpa o campo de número do processo */
  const fecharResultDialog = useCallback(() => {
    voltarParaInicio()
    setNumeroCNJ('')
  }, [voltarParaInicio])

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

  /** Add a module manually (from available list or search results) */
  const addManualModulo = useCallback((modulo: ModuloPreview) => {
    setCuradoriaModulos((prev) => {
      if (prev.some((m) => m.id === modulo.id)) return prev
      return [...prev, modulo]
    })
    setCuradoriaSelected((prev) => new Set(prev).add(modulo.id))
    setCuradoriaManualIds((prev) => new Set(prev).add(modulo.id))
    // Clear from search results
    setCuradoriaSearchResults((prev) => prev.filter((m) => m.id !== modulo.id))
  }, [])

  /** Remove a module from selection (and from list if manual) */
  const removeModulo = useCallback((id: number) => {
    setCuradoriaSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setCuradoriaManualIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    // If it was manually added, also remove from the modules list
    setCuradoriaModulos((prev) => {
      if (!curadoriaPreviewIds.includes(id)) {
        return prev.filter((m) => m.id !== id)
      }
      return prev
    })
  }, [curadoriaPreviewIds])

  /** Search for additional modules via backend */
  const searchModulos = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCuradoriaSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const selectedIds = Array.from(curadoriaSelected)
      const result = await geradorApi.post<BuscaModulosResponse>('/curadoria/buscar', {
        query,
        tipo_peca: tipoPeca || undefined,
        modulos_excluir: selectedIds,
        limit: 15,
        metodo: 'hibrido',
      })
      const mapped: ModuloPreview[] = (result.argumentos || []).map((a) => ({
        id: a.id,
        titulo: a.titulo,
        categoria: a.categoria,
        conteudo: a.conteudo,
        tag: 'busca',
      }))
      setCuradoriaSearchResults(mapped)
    } catch {
      setCuradoriaSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [curadoriaSelected, tipoPeca])

  // ==========================================================================
  // Derivados
  // ==========================================================================

  const isFormDisabled = pageState !== 'idle'
  const isStreaming = pageState === 'streaming' || pageState === 'curadoria_gerando'
  const showResultDialog = pageState === 'resultado' || pageState === 'editando'

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // Page state
    pageState,
    errorMessage,
    isFormDisabled,
    isStreaming,
    showResultDialog,

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
    isStreamingContent,

    // Resultado
    geracaoId,
    minutaMarkdown,
    tipoPecaResultado,
    numeroCNJ_raw: numeroCNJ,

    // Curadoria
    curadoriaModulos,
    curadoriaSelected,
    curadoriaManualIds,
    curadoriaPreviewIds,
    curadoriaAvailableModulos,
    isLoadingAvailable,
    curadoriaSearchResults,
    isSearching,
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
    fecharResultDialog,
    toggleModulo,
    addManualModulo,
    removeModulo,
    searchModulos,
  }
}

/** Tipo de retorno do hook, para tipagem dos subcomponentes */
export type UseGeradorPecasReturn = ReturnType<typeof useGeradorPecas>
