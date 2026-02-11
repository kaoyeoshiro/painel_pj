import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FileText,
  Send,
  Loader2,
  AlertCircle,
  Download,
  FileDown,
  Star,
  Clock,
  History,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentDialog } from '@/components/layout/ContentDialog'
import { ChatPanel, type ChatMessage } from '@/components/layout/ChatPanel'
import { ContentArea } from '@/components/layout/ContentArea'
import { C, FONT_DOC } from '@/lib/designTokens'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useMarkdown } from '@/hooks/useMarkdown'
import { relatorioCumprimentoApi, getToken } from '@/lib/api'
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
const ETAPAS_INICIAIS: EtapaPipeline[] = [
  { numero: 1, titulo: 'Consulta ao TJ-MS', status: 'pendente' },
  { numero: 2, titulo: 'Identificar Processo Principal', status: 'pendente' },
  { numero: 3, titulo: 'Download de Documentos', status: 'pendente' },
  { numero: 4, titulo: 'Transito em Julgado', status: 'pendente' },
  { numero: 5, titulo: 'Geracao do Relatorio', status: 'pendente' },
]

export function RelatorioCumprimentoPage() {
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
  const abortControllerRef = useRef<AbortController | null>(null)

  // Buscar historico de geracoes
  const { data: historico, refetch: refetchHistorico } = useQuery<HistoricoItem[]>({
    queryKey: queryKeys.relatorioCumprimento.historico(),
    queryFn: () => relatorioCumprimentoApi.get<HistoricoItem[]>('/historico'),
  })

  // Auto-scroll dos logs
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
    }
  }, [mensagensLog])

  // Cleanup do abort controller ao desmontar
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

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

  // Processar um evento SSE individual
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

  // Iniciar geracao do relatorio via SSE
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

    // Criar abort controller para cancelamento
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const token = getToken()
      const response = await fetch(`${API_BASE}/processar-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          numero_cnj: numero,
          sobrescrever_existente: sobrescrever,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(errorData.detail || `Erro ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Reader nao disponivel')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evento = JSON.parse(line.slice(6)) as SSEEvent
              processarEventoSSE(evento)
            } catch (parseError) {
              console.warn('Erro ao parsear evento SSE:', parseError)
            }
          }
        }
      }

      // Processar buffer restante
      if (buffer.startsWith('data: ')) {
        try {
          const evento = JSON.parse(buffer.slice(6)) as SSEEvent
          processarEventoSSE(evento)
        } catch {
          // Ignora buffer residual invalido
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Cancelamento intencional, nao mostra erro
        return
      }
      const msg = error instanceof Error ? error.message : 'Erro inesperado'
      setErro(msg)
      setPageState('error')
    }
  }

  // Editar relatorio via chat
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

  // Exportar para DOCX
  const handleExportarDocx = async () => {
    if (!relatorioMarkdown) return

    setExportando('docx')
    try {
      const resp = await relatorioCumprimentoApi.post<ExportarResponse>('/exportar-docx', {
        markdown: relatorioMarkdown,
        numero_processo: dadosCumprimento?.numero_processo_formatado || numeroCnj,
      })

      if (resp.status === 'sucesso' && resp.url_download) {
        // Abre download em nova aba com token
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

  // Exportar para PDF
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

  // Copiar relatorio para area de transferencia
  const handleCopiarRelatorio = async () => {
    if (!relatorioMarkdown) return
    try {
      await navigator.clipboard.writeText(relatorioMarkdown)
    } catch {
      // Silencioso — fallback nao necessario neste contexto
    }
  }

  // Enviar feedback
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

  // Carregar uma geracao do historico
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

  // Reiniciar (voltar ao estado idle)
  const handleReiniciar = () => {
    abortControllerRef.current?.abort()
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

  // Detectar se tem agravo nos documentos
  const temAgravo = documentosBaixados.some(
    (d) => d.categoria === 'decisao_agravo' || d.categoria === 'acordao_agravo'
  )

  // Subtitulo para ContentDialog
  const processoSubtitle = dadosCumprimento?.numero_processo_formatado || numeroCnj

  return (
    <>
      {/* ============================================================ */}
      {/* BREADCRUMB BAR — subordinada ao Header global                */}
      {/* ============================================================ */}
      <BreadcrumbBar
        title="Relatorio de Cumprimento"
        icon={<FileText style={{ width: 14, height: 14 }} />}
        actions={
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
                style={{ color: C.text500, fontSize: 13 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <Clock style={{ width: 14, height: 14 }} />
                <span className="hidden sm:inline">Historico</span>
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Relatorios Gerados</SheetTitle>
              </SheetHeader>
              <ScrollArea className="mt-4 h-[calc(100vh-80px)]">
                {!historico || historico.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm" style={{ color: C.text400 }}>
                      Nenhum relatorio gerado ainda.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {historico.map((item) => (
                      <div
                        key={item.id}
                        className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors"
                        style={{ background: 'transparent' }}
                        onClick={() => handleCarregarHistorico(item)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ background: C.navy100, color: C.navy700 }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: C.text700 }}>
                            {item.numero_cumprimento_formatado || item.numero_cumprimento}
                          </p>
                          <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.criado_em).toLocaleString('pt-BR')}
                            </span>
                            {item.tempo_processamento && ` · ${item.tempo_processamento}s`}
                          </p>
                          {item.dados_basicos?.cumprimento?.autor && (
                            <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>
                              Autor: {item.dados_basicos.cumprimento.autor}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>
        }
      />

      {/* ============================================================ */}
      {/* CONTEUDO PRINCIPAL                                           */}
      {/* ============================================================ */}
      <ContentArea>
        <div className="space-y-6" style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Card de Entrada — Numero do Processo */}
          <div
            className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            style={{ borderColor: C.gray200 }}
          >
            {/* Accent bar navy */}
            <div className="h-1" style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
            <div className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: C.navy100, color: C.navy700 }}
                >
                  <FileText style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: C.text900, fontSize: 17 }}>
                    Gerar Relatorio de Cumprimento
                  </h2>
                  <p style={{ color: C.text400, fontSize: 13 }}>
                    Relatorio Inicial para Cumprimento de Sentenca
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="numero-cnj"
                    className="font-medium"
                    style={{ color: C.text500, fontSize: 13 }}
                  >
                    Numero do Processo de Cumprimento (CNJ)
                  </Label>
                  <Input
                    id="numero-cnj"
                    value={numeroCnj}
                    onChange={(e) => setNumeroCnj(e.target.value)}
                    placeholder="0000000-00.2024.8.12.0001"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pageState !== 'streaming') {
                        handleIniciarGeracao()
                      }
                    }}
                    disabled={pageState === 'streaming'}
                    className="mt-2 h-11 rounded-xl font-mono text-base tracking-wide"
                    style={{ borderColor: C.gray200 }}
                  />
                  <p className="mt-1 text-xs" style={{ color: C.text400 }}>
                    Digite o numero do processo de cumprimento de sentenca
                  </p>
                </div>

                <Button
                  onClick={handleIniciarGeracao}
                  className="h-11 w-full gap-2 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: C.navy950 }}
                  disabled={
                    pageState === 'streaming' ||
                    !numeroCnj.trim() ||
                    (processoExistente?.existe === true && !sobrescrever)
                  }
                >
                  {pageState === 'streaming' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Gerar Relatorio
                    </>
                  )}
                </Button>

                {/* Aviso de processo existente */}
                {processoExistente?.existe && pageState === 'idle' && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Processo ja gerado anteriormente</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">
                        Este processo foi gerado em {processoExistente.criado_em}
                        {processoExistente.autor && ` (Autor: ${processoExistente.autor})`}.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const itemHistorico = historico?.find((h) => h.id === processoExistente.geracao_id)
                            if (itemHistorico) {
                              handleCarregarHistorico(itemHistorico)
                            }
                          }}
                        >
                          Ver relatorio existente
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSobrescrever(true)}
                        >
                          Gerar novo mesmo assim
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>

          {/* Alerta de Erro */}
          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>
                {erro}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 ml-4"
                  onClick={() => {
                    setErro(null)
                    setPageState('idle')
                  }}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Pipeline de Processamento (visivel durante streaming) */}
          {(pageState === 'streaming' || pageState === 'error') && (
            <div
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: C.gray200 }}
            >
              <div className="h-1" style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
              <div className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  {pageState === 'streaming' && (
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.navy600 }} />
                  )}
                  <h3 className="font-bold" style={{ color: C.text900, fontSize: 16 }}>
                    Pipeline de Processamento
                  </h3>
                </div>

                {/* Etapas do pipeline */}
                <div className="space-y-2">
                  {etapas.map((etapa) => (
                    <EtapaStep key={etapa.numero} etapa={etapa} />
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Log de mensagens */}
                <div>
                  <Label className="text-sm font-medium" style={{ color: C.text700 }}>
                    Log de Processamento
                  </Label>
                  <ScrollArea
                    className="mt-2 h-[200px] w-full rounded-xl border p-3"
                    style={{ background: C.gray50, borderColor: C.gray200 }}
                    ref={logScrollRef}
                  >
                    <div className="space-y-1">
                      {mensagensLog.map((msg, idx) => (
                        <p key={idx} className="font-mono text-xs" style={{ color: C.text500 }}>
                          {msg}
                        </p>
                      ))}
                      {pageState === 'streaming' && (
                        <p className="animate-pulse font-mono text-xs" style={{ color: C.navy600 }}>
                          Processando...
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Conteudo sendo gerado em tempo real */}
                {streamingContent && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium" style={{ color: C.text700 }}>
                      Relatorio (gerando...)
                    </Label>
                    <ScrollArea
                      className="mt-2 h-[300px] w-full rounded-xl border bg-white p-4"
                      style={{ borderColor: C.gray200 }}
                    >
                      <MarkdownContent content={streamingContent} />
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botao para reabrir relatorio (quando completed mas dialog fechado) */}
          {pageState === 'completed' && relatorioMarkdown && !showEditor && (
            <div
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: C.gray200 }}
            >
              <div className="h-1" style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: '#f0fdf4', color: C.statusSuccess }}
                    >
                      <CheckCircle2 style={{ width: 20, height: 20 }} />
                    </div>
                    <div>
                      <h3 className="font-bold" style={{ color: C.text900, fontSize: 16 }}>
                        Relatorio Gerado
                      </h3>
                      <p style={{ color: C.text400, fontSize: 13 }}>
                        {processoSubtitle}
                        {dadosCumprimento?.autor && ` - ${dadosCumprimento.autor}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowEditor(true)}
                      className="gap-2 rounded-xl text-white"
                      style={{ background: C.navy950 }}
                    >
                      <FileText className="h-4 w-4" />
                      Abrir Relatorio
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReiniciar}
                      className="gap-2 rounded-xl"
                    >
                      <RotateCw className="h-4 w-4" />
                      Nova Geracao
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historico Recente (visivel no estado idle) */}
          {pageState === 'idle' && historico && historico.length > 0 && (
            <div
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: C.gray200 }}
            >
              <div className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: C.navy100, color: C.navy700 }}
                  >
                    <History style={{ width: 18, height: 18 }} />
                  </div>
                  <h3 className="font-semibold" style={{ color: C.text700, fontSize: 15 }}>
                    Relatorios Recentes
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {historico.slice(0, 5).map((item) => {
                    const numero = item.numero_cumprimento_formatado || item.numero_cumprimento
                    const autor = item.dados_basicos?.cumprimento?.autor || 'Relatorio de Cumprimento'
                    const data = item.criado_em ? new Date(item.criado_em) : null

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleCarregarHistorico(item)}
                        className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white p-3.5 transition-all hover:shadow-sm"
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gray200 }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
                      >
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                          style={{ background: C.navy100, color: C.navy700 }}
                        >
                          <FileText style={{ width: 20, height: 20 }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" style={{ color: C.text900, fontSize: 14 }}>
                            {numero}
                          </p>
                          <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>
                            {autor}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs" style={{ color: C.text400 }}>
                            {data ? data.toLocaleDateString('pt-BR') : '-'}
                          </p>
                          <p className="text-xs" style={{ color: C.gray500 }}>
                            {data ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </ContentArea>

      {/* ============================================================ */}
      {/* CONTENT DIALOG — Visualizacao do relatorio gerado            */}
      {/* ============================================================ */}
      <ContentDialog
        open={showEditor}
        onOpenChange={(open) => {
          setShowEditor(open)
        }}
        title="Relatorio de Cumprimento"
        subtitle={processoSubtitle}
        icon={<FileText className="h-5 w-5 text-white" />}
        headerActions={
          <>
            <Button
              onClick={handleExportarDocx}
              size="sm"
              className="gap-2 text-white/70 hover:bg-white/10 hover:text-white"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              disabled={exportando !== null}
            >
              {exportando === 'docx' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              DOCX
            </Button>
            <Button
              onClick={handleExportarPdf}
              size="sm"
              className="gap-2 text-white/70 hover:bg-white/10 hover:text-white"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              disabled={exportando !== null}
            >
              {exportando === 'pdf' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              PDF
            </Button>
            <Button
              onClick={handleCopiarRelatorio}
              size="sm"
              className="gap-2 text-white/70 hover:bg-white/10 hover:text-white"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
          </>
        }
        documentContent={
          <div>
            {/* Informacoes do processo */}
            {(dadosCumprimento || dadosPrincipal || transitoJulgado) && (
              <div
                className="mb-6 rounded-xl border p-4"
                style={{ background: C.gray50, borderColor: C.gray200 }}
              >
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  {dadosCumprimento?.comarca && (
                    <div>
                      <span style={{ color: C.text400, fontSize: 12 }}>Comarca</span>
                      <p className="font-medium" style={{ color: C.text700 }}>
                        {dadosCumprimento.comarca}
                      </p>
                    </div>
                  )}
                  {dadosCumprimento?.vara && (
                    <div>
                      <span style={{ color: C.text400, fontSize: 12 }}>Vara</span>
                      <p className="font-medium" style={{ color: C.text700 }}>
                        {dadosCumprimento.vara}
                      </p>
                    </div>
                  )}
                  {dadosPrincipal && (
                    <div>
                      <span style={{ color: C.text400, fontSize: 12 }}>Processo Principal</span>
                      <p className="font-medium" style={{ color: C.text700 }}>
                        {dadosPrincipal.numero_processo_formatado}
                      </p>
                    </div>
                  )}
                  {transitoJulgado?.localizado && (
                    <div>
                      <span style={{ color: C.text400, fontSize: 12 }}>Transito em Julgado</span>
                      <p className="font-medium" style={{ color: C.text700 }}>
                        {transitoJulgado.data_transito || 'Localizado'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Alerta de Agravo */}
                {temAgravo && (
                  <div
                    className="mt-3 flex items-start gap-2 rounded-lg p-3"
                    style={{ background: '#fef3c7', border: `1px solid ${C.statusWarning}33` }}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: C.statusWarning }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: C.text900 }}>
                        Agravo de Instrumento Detectado
                      </p>
                      <p className="text-xs" style={{ color: C.text500 }}>
                        Foram encontrados documentos de Agravo de Instrumento vinculados a este processo.
                        Verifique o relatorio para garantir que as decisoes do agravo foram consideradas.
                      </p>
                    </div>
                  </div>
                )}

                {/* Documentos baixados */}
                {documentosBaixados.length > 0 && (
                  <div className="mt-3">
                    <span style={{ color: C.text400, fontSize: 12 }}>
                      Documentos Analisados ({documentosBaixados.length})
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {documentosBaixados.map((doc) => (
                        <Badge
                          key={doc.id_documento}
                          variant="secondary"
                          className="text-xs"
                          style={{ background: C.navy100, color: C.navy700 }}
                        >
                          {doc.nome_padronizado || doc.nome_original}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conteudo do Relatorio em Markdown */}
            <div style={{ fontFamily: FONT_DOC }}>
              <MarkdownContent content={relatorioMarkdown} />
            </div>
          </div>
        }
        chatPanel={
          <ChatPanel
            messages={chatMessages}
            inputValue={chatInput}
            onInputChange={setChatInput}
            onSend={handleEditarRelatorio}
            isSending={chatEditando}
            placeholder="Ex: Adicione mais detalhes sobre o transito em julgado..."
            title="Assistente de Edicao"
            subtitle="Solicite alteracoes no relatorio"
          />
        }
        feedbackSection={
          <FeedbackSection
            feedbackEnviado={feedbackEnviado}
            feedbackAvaliacao={feedbackAvaliacao}
            feedbackNota={feedbackNota}
            feedbackComentario={feedbackComentario}
            enviandoFeedback={enviandoFeedback}
            onAvaliacaoChange={setFeedbackAvaliacao}
            onNotaChange={setFeedbackNota}
            onComentarioChange={setFeedbackComentario}
            onEnviar={handleEnviarFeedback}
          />
        }
      />
    </>
  )
}

// ============================================
// Componentes Auxiliares
// ============================================

/** Componente para exibir uma etapa do pipeline */
function EtapaStep({ etapa }: { etapa: EtapaPipeline }) {
  let bgColor: string
  let borderColor: string
  let badgeBg: string
  let badgeColor: string
  let textColor: string

  if (etapa.status === 'concluido') {
    bgColor = '#f0fdf4'
    borderColor = '#bbf7d0'
    badgeBg = C.statusSuccess
    badgeColor = '#fff'
    textColor = C.statusSuccess
  } else if (etapa.status === 'ativo') {
    bgColor = C.navy50
    borderColor = C.navy100
    badgeBg = C.navy950
    badgeColor = '#fff'
    textColor = C.navy700
  } else {
    bgColor = C.gray50
    borderColor = C.gray200
    badgeBg = C.gray200
    badgeColor = C.text400
    textColor = C.text400
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3 transition-colors"
      style={{ background: bgColor, borderColor }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: badgeBg, color: badgeColor }}
      >
        {etapa.status === 'concluido' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : etapa.status === 'ativo' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium" style={{ color: textColor }}>
          Etapa {etapa.numero}: {etapa.titulo}
        </div>
        {etapa.mensagem && (
          <div className="text-xs" style={{ color: C.text400 }}>{etapa.mensagem}</div>
        )}
      </div>
      {etapa.status === 'ativo' && (
        <span className="flex-shrink-0 text-[11px] font-medium" style={{ color: C.navy600 }}>Ativo</span>
      )}
      {etapa.status === 'concluido' && (
        <span className="flex-shrink-0 text-[11px] font-medium" style={{ color: C.statusSuccess }}>OK</span>
      )}
    </div>
  )
}

/** Componente para renderizar conteudo Markdown com sanitizacao */
function MarkdownContent({ content }: { content: string }) {
  const { html } = useMarkdown(content)
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{
        ['--tw-prose-headings' as string]: C.text900,
        ['--tw-prose-body' as string]: C.text700,
        ['--tw-prose-bold' as string]: C.text900,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Props do componente de feedback */
interface FeedbackSectionProps {
  feedbackEnviado: boolean
  feedbackAvaliacao: AvaliacaoFeedback | null
  feedbackNota: number
  feedbackComentario: string
  enviandoFeedback: boolean
  onAvaliacaoChange: (avaliacao: AvaliacaoFeedback) => void
  onNotaChange: (nota: number) => void
  onComentarioChange: (comentario: string) => void
  onEnviar: () => void
}

/** Componente de feedback extraido para uso no ContentDialog */
function FeedbackSection({
  feedbackEnviado,
  feedbackAvaliacao,
  feedbackNota,
  feedbackComentario,
  enviandoFeedback,
  onAvaliacaoChange,
  onNotaChange,
  onComentarioChange,
  onEnviar,
}: FeedbackSectionProps) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'white', borderColor: C.gray200 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-5 w-5" style={{ color: C.statusWarning }} />
        <h4 className="font-semibold" style={{ color: C.text900, fontSize: 15 }}>
          Avaliacao do Relatorio
        </h4>
      </div>

      {feedbackEnviado ? (
        <div className="flex items-center gap-2" style={{ color: C.statusSuccess }}>
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Feedback enviado! Obrigado pela avaliacao.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Avaliacao geral */}
          <div>
            <Label className="text-sm font-medium" style={{ color: C.text700 }}>
              Como voce avalia o relatorio?
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { value: 'correto', label: 'Correto' },
                  { value: 'parcial', label: 'Parcialmente correto' },
                  { value: 'incorreto', label: 'Incorreto' },
                  { value: 'erro_ia', label: 'Erro da IA' },
                ] as const
              ).map((opcao) => (
                <Button
                  key={opcao.value}
                  size="sm"
                  variant={feedbackAvaliacao === opcao.value ? 'default' : 'outline'}
                  onClick={() => onAvaliacaoChange(opcao.value)}
                  className="rounded-lg"
                  style={
                    feedbackAvaliacao === opcao.value
                      ? { background: C.navy950, color: '#fff' }
                      : undefined
                  }
                >
                  {opcao.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Nota por estrelas */}
          <div>
            <Label className="text-sm font-medium" style={{ color: C.text700 }}>
              Nota (1 a 5 estrelas)
            </Label>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onNotaChange(n)}
                  className="focus:outline-none"
                >
                  <Star
                    className="h-6 w-6 transition-colors"
                    style={{
                      color: n <= feedbackNota ? C.statusWarning : C.gray300,
                      fill: n <= feedbackNota ? C.statusWarning : 'none',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comentario */}
          <div>
            <Label
              htmlFor="feedback-comentario"
              className="text-sm font-medium"
              style={{ color: C.text700 }}
            >
              Comentario (opcional)
            </Label>
            <Textarea
              id="feedback-comentario"
              value={feedbackComentario}
              onChange={(e) => onComentarioChange(e.target.value)}
              placeholder="Descreva o que pode ser melhorado..."
              rows={3}
              className="mt-2 rounded-xl"
              style={{ borderColor: C.gray200 }}
            />
          </div>

          <Button
            onClick={onEnviar}
            disabled={!feedbackAvaliacao || enviandoFeedback}
            className="gap-2 rounded-xl text-white"
            style={{ background: C.navy950 }}
          >
            {enviandoFeedback ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar Feedback
          </Button>
        </div>
      )}
    </div>
  )
}
