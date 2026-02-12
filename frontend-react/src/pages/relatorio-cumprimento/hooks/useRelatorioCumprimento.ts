import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { relatorioCumprimentoApi, getToken } from '@/lib/api'
import { useStreamingFetch } from '@/services/api/streaming'
import type { ChatMessage } from '@/components/layout/ChatPanel'
import type {
  HistoricoItem,
  SSEEvent,
  EtapaPipeline,
  PageState,
  DadosProcesso,
  DocumentoClassificado,
  InfoTransitoJulgado,
  FeedbackPayload,
  FeedbackResponse,
  ExportarResponse,
  EditarResponse,
  VerificacaoExistente,
  AvaliacaoFeedback,
} from '@/types/relatorio-cumprimento'

// Base da API para chamadas SSE (fetch direto)
const API_BASE = '/relatorio-cumprimento/api'

// Definicao das 5 etapas do pipeline
export const ETAPAS_INICIAIS: EtapaPipeline[] = [
  { numero: 1, titulo: 'Consulta ao TJ-MS', status: 'pendente' },
  { numero: 2, titulo: 'Identificar Processo Principal', status: 'pendente' },
  { numero: 3, titulo: 'Download de Documentos', status: 'pendente' },
  { numero: 4, titulo: 'Transito em Julgado', status: 'pendente' },
  { numero: 5, titulo: 'Geracao do Relatorio', status: 'pendente' },
]

/**
 * Hook principal que concentra todo o estado e logica da pagina
 * de Relatorio de Cumprimento de Sentenca.
 */
export function useRelatorioCumprimento() {
  // Estado principal da pagina (maquina de estados)
  const [pageState, setPageState] = useState<PageState>('idle')

  // Dados de entrada
  const [numeroCnj, setNumeroCnj] = useState('')

  // Estado do streaming
  const [etapas, setEtapas] = useState<EtapaPipeline[]>(ETAPAS_INICIAIS)
  const [mensagensLog, setMensagensLog] = useState<string[]>([])
  const [relatorioMarkdown, setRelatorioMarkdown] = useState('')
  const [streamingContent, setStreamingContent] = useState('')

  // Dados do resultado
  const [geracaoId, setGeracaoId] = useState<number | null>(null)
  const [dadosCumprimento, setDadosCumprimento] = useState<DadosProcesso | null>(null)
  const [dadosPrincipal, setDadosPrincipal] = useState<DadosProcesso | null>(null)
  const [documentosBaixados, setDocumentosBaixados] = useState<DocumentoClassificado[]>([])
  const [transitoJulgado, setTransitoJulgado] = useState<InfoTransitoJulgado | null>(null)

  // Estado do chat de edicao
  const [chatInput, setChatInput] = useState('')
  const [chatEditando, setChatEditando] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  // Estado de exportacao
  const [exportando, setExportando] = useState<'docx' | 'pdf' | null>(null)

  // Estado de feedback
  const [feedbackNota, setFeedbackNota] = useState<number>(0)
  const [feedbackAvaliacao, setFeedbackAvaliacao] = useState<AvaliacaoFeedback | null>(null)
  const [feedbackComentario, setFeedbackComentario] = useState('')
  const [feedbackEnviado, setFeedbackEnviado] = useState(false)
  const [enviandoFeedback, setEnviandoFeedback] = useState(false)

  // Estado de verificacao de processo existente
  const [processoExistente, setProcessoExistente] = useState<VerificacaoExistente | null>(null)
  const [sobrescrever, setSobrescrever] = useState(false)

  // Estado de erro
  const [erro, setErro] = useState<string | null>(null)

  // ContentDialog
  const [showEditor, setShowEditor] = useState(false)

  // Refs
  const logScrollRef = useRef<HTMLDivElement>(null)

  // ============================================================
  // Queries
  // ============================================================

  const { data: historico, refetch: refetchHistorico } = useQuery<HistoricoItem[]>({
    queryKey: queryKeys.relatorioCumprimento.historico(),
    queryFn: () => relatorioCumprimentoApi.get<HistoricoItem[]>('/historico'),
  })

  // ============================================================
  // Effects
  // ============================================================

  // Auto-scroll dos logs
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
    }
  }, [mensagensLog])

  // Verificar se o processo ja existe quando o usuario termina de digitar
  const verificarProcessoExistente = useCallback(async (numero: string) => {
    if (!numero.trim()) {
      setProcessoExistente(null)
      return
    }

    try {
      const resultado = await relatorioCumprimentoApi.get<VerificacaoExistente>(
        `/verificar-existente?numero_cnj=${encodeURIComponent(numero.trim())}`
      )
      setProcessoExistente(resultado)
    } catch {
      // Nao bloqueia fluxo se verificacao falhar
      setProcessoExistente(null)
    }
  }, [])

  // Debounce na verificacao de processo existente
  useEffect(() => {
    if (numeroCnj.length < 10) {
      setProcessoExistente(null)
      return
    }

    const timer = setTimeout(() => {
      verificarProcessoExistente(numeroCnj)
    }, 500)

    return () => clearTimeout(timer)
  }, [numeroCnj, verificarProcessoExistente])

  // Carregar feedback existente quando geracao muda
  useEffect(() => {
    if (!geracaoId) return

    const carregarFeedback = async () => {
      try {
        const resp = await relatorioCumprimentoApi.get<FeedbackResponse>(
          `/feedback/${geracaoId}`
        )
        if (resp.has_feedback) {
          setFeedbackEnviado(true)
          if (resp.nota) setFeedbackNota(resp.nota)
          if (resp.avaliacao) setFeedbackAvaliacao(resp.avaliacao)
          if (resp.comentario) setFeedbackComentario(resp.comentario)
        }
      } catch {
        // Ignora erro silenciosamente
      }
    }

    carregarFeedback()
  }, [geracaoId])

  // ============================================================
  // Processamento SSE
  // ============================================================

  const processarEventoSSE = useCallback((evento: SSEEvent) => {
    switch (evento.tipo) {
      case 'inicio':
        setMensagensLog((prev) => [...prev, evento.mensagem])
        break

      case 'etapa':
        setEtapas((prev) =>
          prev.map((e) => {
            if (e.numero === evento.etapa) {
              return {
                ...e,
                status: evento.status === 'concluido' ? 'concluido' : 'ativo',
                mensagem: evento.mensagem,
              }
            }
            // Se a etapa atual ficou ativa, as anteriores que estavam ativas ficam concluidas
            if (evento.status === 'ativo' && e.numero < evento.etapa && e.status === 'ativo') {
              return { ...e, status: 'concluido' }
            }
            return e
          })
        )
        setMensagensLog((prev) => [...prev, evento.mensagem])
        break

      case 'info':
        setMensagensLog((prev) => [...prev, evento.mensagem])
        break

      case 'geracao_chunk':
        setStreamingContent((prev) => prev + evento.content)
        break

      case 'erro':
        setErro(evento.mensagem)
        setPageState('error')
        break

      case 'sucesso':
        setGeracaoId(evento.geracao_id)
        setDadosCumprimento(evento.dados_cumprimento)
        setDadosPrincipal(evento.dados_principal)
        setRelatorioMarkdown(evento.relatorio_markdown)
        setDocumentosBaixados(evento.documentos_baixados)
        setTransitoJulgado(evento.transito_julgado)
        setStreamingContent('')
        setPageState('completed')
        setShowEditor(true)
        refetchHistorico()
        break
    }
  }, [refetchHistorico])

  // Hook de streaming SSE compartilhado
  const { start: startSSE, abort: abortSSE } = useStreamingFetch<SSEEvent>({
    onEvent: (evento) => processarEventoSSE(evento),
    onError: (error) => {
      const msg = error.message || 'Erro inesperado'
      setErro(msg)
      setPageState('error')
    },
  })

  // ============================================================
  // Handlers / Acoes
  // ============================================================

  /** Iniciar geracao do relatorio via SSE */
  const handleIniciarGeracao = async () => {
    const numero = numeroCnj.trim()
    if (!numero) {
      setErro('Informe o numero do processo (CNJ)')
      return
    }

    // Se processo existe e usuario nao marcou sobrescrever, mostrar aviso
    if (processoExistente?.existe && !sobrescrever) {
      return
    }

    // Limpar estado anterior
    setErro(null)
    setPageState('streaming')
    setEtapas(ETAPAS_INICIAIS)
    setMensagensLog([])
    setStreamingContent('')
    setRelatorioMarkdown('')
    setGeracaoId(null)
    setDadosCumprimento(null)
    setDadosPrincipal(null)
    setDocumentosBaixados([])
    setTransitoJulgado(null)
    setFeedbackEnviado(false)
    setFeedbackNota(0)
    setFeedbackAvaliacao(null)
    setFeedbackComentario('')
    setSobrescrever(false)
    setChatMessages([])

    // Streaming SSE via hook compartilhado
    await startSSE(`${API_BASE}/processar-stream`, {
      numero_cnj: numero,
      sobrescrever_existente: sobrescrever,
    }).catch(() => {
      // Erro ja tratado pelo onError do useStreamingFetch
    })
  }

  /** Editar relatorio via chat */
  const handleEditarRelatorio = async () => {
    if (!chatInput.trim() || !geracaoId) return

    const mensagem = chatInput.trim()
    setChatInput('')
    setChatEditando(true)

    // Adiciona mensagem do usuario ao historico
    const novoHistorico: ChatMessage[] = [...chatMessages, { role: 'user', content: mensagem }]
    setChatMessages(novoHistorico)

    try {
      const resp = await relatorioCumprimentoApi.post<EditarResponse>('/editar', {
        geracao_id: geracaoId,
        mensagem_usuario: mensagem,
      })

      if (resp.status === 'sucesso' && resp.relatorio_markdown) {
        setRelatorioMarkdown(resp.relatorio_markdown)
        setChatMessages([
          ...novoHistorico,
          { role: 'assistant', content: 'Pronto! Atualizei o relatorio conforme solicitado.' },
        ])
      } else {
        setErro(resp.mensagem || 'Erro ao editar relatorio')
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao editar relatorio'
      setErro(msg)
      setChatMessages([
        ...novoHistorico,
        { role: 'assistant', content: `Erro: ${msg}` },
      ])
    } finally {
      setChatEditando(false)
    }
  }

  /** Exportar para DOCX */
  const handleExportarDocx = async () => {
    if (!relatorioMarkdown) return

    setExportando('docx')
    try {
      const resp = await relatorioCumprimentoApi.post<ExportarResponse>('/exportar-docx', {
        markdown: relatorioMarkdown,
        numero_processo: dadosCumprimento?.numero_processo_formatado || numeroCnj,
      })

      if (resp.status === 'sucesso' && resp.url_download) {
        const token = getToken()
        const separator = resp.url_download.includes('?') ? '&' : '?'
        window.open(`${resp.url_download}${separator}token=${token}`, '_blank')
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao exportar DOCX'
      setErro(msg)
    } finally {
      setExportando(null)
    }
  }

  /** Exportar para PDF */
  const handleExportarPdf = async () => {
    if (!relatorioMarkdown) return

    setExportando('pdf')
    try {
      const resp = await relatorioCumprimentoApi.post<ExportarResponse>('/exportar-pdf', {
        markdown: relatorioMarkdown,
        numero_processo: dadosCumprimento?.numero_processo_formatado || numeroCnj,
      })

      if (resp.status === 'sucesso' && resp.url_download) {
        const token = getToken()
        const separator = resp.url_download.includes('?') ? '&' : '?'
        window.open(`${resp.url_download}${separator}token=${token}`, '_blank')
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao exportar PDF'
      setErro(msg)
    } finally {
      setExportando(null)
    }
  }

  /** Copiar relatorio para area de transferencia */
  const handleCopiarRelatorio = async () => {
    if (!relatorioMarkdown) return
    try {
      await navigator.clipboard.writeText(relatorioMarkdown)
    } catch {
      // Silencioso — fallback nao necessario neste contexto
    }
  }

  /** Enviar feedback */
  const handleEnviarFeedback = async () => {
    if (!geracaoId || !feedbackAvaliacao) return

    setEnviandoFeedback(true)
    try {
      const payload: FeedbackPayload = {
        geracao_id: geracaoId,
        avaliacao: feedbackAvaliacao,
        nota: feedbackNota > 0 ? feedbackNota : undefined,
        comentario: feedbackComentario.trim() || undefined,
      }

      await relatorioCumprimentoApi.post('/feedback', payload)
      setFeedbackEnviado(true)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao enviar feedback'
      setErro(msg)
    } finally {
      setEnviandoFeedback(false)
    }
  }

  /** Carregar uma geracao do historico */
  const handleCarregarHistorico = (item: HistoricoItem) => {
    setNumeroCnj(item.numero_cumprimento_formatado || item.numero_cumprimento)
    setGeracaoId(item.id)
    setRelatorioMarkdown(item.conteudo_gerado || '')
    setDocumentosBaixados(item.documentos_baixados || [])
    setDadosCumprimento(item.dados_basicos?.cumprimento || null)
    setDadosPrincipal(item.dados_basicos?.principal || null)
    setTransitoJulgado(
      item.transito_julgado_localizado
        ? { localizado: true, data_transito: item.data_transito_julgado, fonte: null, id_documento: null, observacao: null }
        : null
    )
    setStreamingContent('')
    setMensagensLog([])
    setEtapas(ETAPAS_INICIAIS)
    setErro(null)
    setFeedbackEnviado(false)
    setFeedbackNota(0)
    setFeedbackAvaliacao(null)
    setFeedbackComentario('')
    setChatMessages([])
    setPageState('completed')
    setShowEditor(true)
  }

  /** Reiniciar (voltar ao estado idle) */
  const handleReiniciar = () => {
    abortSSE()
    setPageState('idle')
    setNumeroCnj('')
    setErro(null)
    setEtapas(ETAPAS_INICIAIS)
    setMensagensLog([])
    setStreamingContent('')
    setRelatorioMarkdown('')
    setGeracaoId(null)
    setDadosCumprimento(null)
    setDadosPrincipal(null)
    setDocumentosBaixados([])
    setTransitoJulgado(null)
    setFeedbackEnviado(false)
    setFeedbackNota(0)
    setFeedbackAvaliacao(null)
    setFeedbackComentario('')
    setSobrescrever(false)
    setProcessoExistente(null)
    setChatMessages([])
    setShowEditor(false)
  }

  // ============================================================
  // Dados derivados
  // ============================================================

  /** Detectar se tem agravo nos documentos */
  const temAgravo = documentosBaixados.some(
    (d) => d.categoria === 'decisao_agravo' || d.categoria === 'acordao_agravo'
  )

  /** Subtitulo para ContentDialog */
  const processoSubtitle = dadosCumprimento?.numero_processo_formatado || numeroCnj

  return {
    // Estado da pagina
    pageState,
    numeroCnj,
    setNumeroCnj,

    // Streaming
    etapas,
    mensagensLog,
    relatorioMarkdown,
    streamingContent,

    // Resultado
    geracaoId,
    dadosCumprimento,
    dadosPrincipal,
    documentosBaixados,
    transitoJulgado,

    // Chat
    chatInput,
    setChatInput,
    chatEditando,
    chatMessages,

    // Exportacao
    exportando,

    // Feedback
    feedbackNota,
    setFeedbackNota,
    feedbackAvaliacao,
    setFeedbackAvaliacao,
    feedbackComentario,
    setFeedbackComentario,
    feedbackEnviado,
    enviandoFeedback,

    // Verificacao processo existente
    processoExistente,
    sobrescrever,
    setSobrescrever,

    // Erro
    erro,
    setErro,

    // ContentDialog
    showEditor,
    setShowEditor,

    // Refs
    logScrollRef,

    // Historico
    historico,

    // Dados derivados
    temAgravo,
    processoSubtitle,

    // Handlers
    handleIniciarGeracao,
    handleEditarRelatorio,
    handleExportarDocx,
    handleExportarPdf,
    handleCopiarRelatorio,
    handleEnviarFeedback,
    handleCarregarHistorico,
    handleReiniciar,

    // Funcao para setar pageState (usada internamente e pelo ErroAlert)
    setPageState,
  }
}

/** Tipo de retorno do hook para tipagem dos subcomponentes */
export type UseRelatorioCumprimentoReturn = ReturnType<typeof useRelatorioCumprimento>
