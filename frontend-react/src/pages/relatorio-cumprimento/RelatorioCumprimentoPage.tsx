import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Play,
  FileText,
  Send,
  User,
  Bot,
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
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuthStore } from '@/stores/auth-store'
import { useApiQuery } from '@/hooks/useApiQuery'
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
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

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

  // Refs
  const logScrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Buscar historico de geracoes
  const { data: historico, refetch: refetchHistorico } = useApiQuery<HistoricoItem[]>(
    () => relatorioCumprimentoApi.get('/historico'),
    { enabled: true }
  )

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

    try {
      const resp = await relatorioCumprimentoApi.post<EditarResponse>('/editar', {
        geracao_id: geracaoId,
        mensagem_usuario: mensagem,
      })

      if (resp.status === 'sucesso' && resp.relatorio_markdown) {
        setRelatorioMarkdown(resp.relatorio_markdown)
      } else {
        setErro(resp.mensagem || 'Erro ao editar relatorio')
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao editar relatorio'
      setErro(msg)
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
    setPageState('completed')
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
  }

  // Detectar se tem agravo nos documentos
  const temAgravo = documentosBaixados.some(
    (d) => d.categoria === 'decisao_agravo' || d.categoria === 'acordao_agravo'
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/dashboard' })}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-emerald-600" />
              <div>
                <h1 className="text-lg font-semibold">Relatorio de Cumprimento</h1>
                <p className="text-xs text-muted-foreground">Cumprimento de Sentenca</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.full_name}</span>
            {/* Drawer de historico */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="mr-2 h-4 w-4" />
                  Historico
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Relatorios Gerados</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                  <div className="space-y-2">
                    {!historico || historico.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhum relatorio gerado ainda.
                      </p>
                    ) : (
                      historico.map((item) => (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => handleCarregarHistorico(item)}
                        >
                          <CardHeader className="p-4">
                            <CardTitle className="text-sm font-medium">
                              {item.numero_cumprimento_formatado || item.numero_cumprimento}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(item.criado_em).toLocaleString('pt-BR')}
                              </span>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs">
                                Concluido
                              </Badge>
                              {item.tempo_processamento && (
                                <span className="text-xs text-muted-foreground">
                                  {item.tempo_processamento}s
                                </span>
                              )}
                            </div>
                            {item.dados_basicos?.cumprimento?.autor && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                Autor: {item.dados_basicos.cumprimento.autor}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Conteudo Principal */}
      <main className="container py-6 space-y-6">
        {/* Card de Entrada - Numero do Processo */}
        <Card>
          <CardHeader>
            <CardTitle>Numero do Processo (CNJ)</CardTitle>
            <CardDescription>
              Informe o numero do processo de cumprimento de sentenca no formato CNJ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="numero-cnj">Numero do Processo</Label>
                <Input
                  id="numero-cnj"
                  value={numeroCnj}
                  onChange={(e) => setNumeroCnj(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pageState !== 'streaming') {
                      handleIniciarGeracao()
                    }
                  }}
                  disabled={pageState === 'streaming'}
                />
              </div>
              <div className="flex items-end gap-2">
                {pageState === 'completed' && (
                  <Button variant="outline" onClick={handleReiniciar}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Novo
                  </Button>
                )}
                <Button
                  onClick={handleIniciarGeracao}
                  disabled={
                    pageState === 'streaming' ||
                    !numeroCnj.trim() ||
                    (processoExistente?.existe === true && !sobrescrever)
                  }
                >
                  {pageState === 'streaming' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Gerar Relatorio
                    </>
                  )}
                </Button>
              </div>
            </div>

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
                        // Carregar do historico
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
          </CardContent>
        </Card>

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {pageState === 'streaming' && (
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                )}
                Pipeline de Processamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Etapas do pipeline */}
              <div className="space-y-2">
                {etapas.map((etapa) => (
                  <EtapaStep key={etapa.numero} etapa={etapa} />
                ))}
              </div>

              <Separator />

              {/* Log de mensagens */}
              <div>
                <Label className="text-sm font-medium">Log de Processamento</Label>
                <ScrollArea
                  className="h-[200px] w-full rounded-md border p-3 mt-2 bg-slate-50"
                  ref={logScrollRef}
                >
                  <div className="space-y-1">
                    {mensagensLog.map((msg, idx) => (
                      <p key={idx} className="text-xs text-slate-600 font-mono">
                        {msg}
                      </p>
                    ))}
                    {pageState === 'streaming' && (
                      <p className="text-xs text-emerald-600 font-mono animate-pulse">
                        Processando...
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Conteudo sendo gerado em tempo real */}
              {streamingContent && (
                <div>
                  <Label className="text-sm font-medium">Relatorio (gerando...)</Label>
                  <ScrollArea className="h-[300px] w-full rounded-md border p-4 mt-2 bg-white">
                    <MarkdownContent content={streamingContent} />
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resultado: Relatorio Gerado */}
        {pageState === 'completed' && relatorioMarkdown && (
          <>
            {/* Informacoes do processo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Relatorio Gerado
                </CardTitle>
                <CardDescription>
                  {dadosCumprimento?.numero_processo_formatado || numeroCnj}
                  {dadosCumprimento?.autor && ` - ${dadosCumprimento.autor}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {dadosCumprimento?.comarca && (
                    <div>
                      <span className="text-muted-foreground">Comarca:</span>
                      <p className="font-medium">{dadosCumprimento.comarca}</p>
                    </div>
                  )}
                  {dadosCumprimento?.vara && (
                    <div>
                      <span className="text-muted-foreground">Vara:</span>
                      <p className="font-medium">{dadosCumprimento.vara}</p>
                    </div>
                  )}
                  {dadosPrincipal && (
                    <div>
                      <span className="text-muted-foreground">Processo Principal:</span>
                      <p className="font-medium">{dadosPrincipal.numero_processo_formatado}</p>
                    </div>
                  )}
                  {transitoJulgado?.localizado && (
                    <div>
                      <span className="text-muted-foreground">Transito em Julgado:</span>
                      <p className="font-medium">{transitoJulgado.data_transito || 'Localizado'}</p>
                    </div>
                  )}
                </div>

                {/* Alerta de Agravo */}
                {temAgravo && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Agravo de Instrumento Detectado</AlertTitle>
                    <AlertDescription>
                      Foram encontrados documentos de Agravo de Instrumento vinculados a este processo.
                      Verifique o relatorio para garantir que as decisoes do agravo foram consideradas.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Documentos baixados */}
                {documentosBaixados.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium">
                      Documentos Analisados ({documentosBaixados.length})
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {documentosBaixados.map((doc) => (
                        <Badge key={doc.id_documento} variant="secondary" className="text-xs">
                          {doc.nome_padronizado || doc.nome_original}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conteudo do Relatorio em Markdown */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Conteudo do Relatorio</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportarDocx}
                      disabled={exportando !== null}
                    >
                      {exportando === 'docx' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      DOCX
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportarPdf}
                      disabled={exportando !== null}
                    >
                      {exportando === 'pdf' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                      )}
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[600px] w-full rounded-md border p-6 bg-white">
                  <MarkdownContent content={relatorioMarkdown} />
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat de Edicao */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-emerald-600" />
                  Assistente de Edicao
                </CardTitle>
                <CardDescription>
                  Solicite alteracoes no relatorio via mensagem. A IA ira ajustar o conteudo conforme sua instrucao.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ex: Adicione mais detalhes sobre o transito em julgado..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleEditarRelatorio()
                      }
                    }}
                    disabled={chatEditando}
                  />
                  <Button
                    onClick={handleEditarRelatorio}
                    disabled={chatEditando || !chatInput.trim()}
                  >
                    {chatEditando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Avaliacao do Relatorio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedbackEnviado ? (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Feedback enviado! Obrigado pela avaliacao.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Avaliacao geral */}
                    <div>
                      <Label className="text-sm font-medium">Como voce avalia o relatorio?</Label>
                      <div className="flex gap-2 mt-2">
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
                            onClick={() => setFeedbackAvaliacao(opcao.value)}
                          >
                            {opcao.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Nota por estrelas */}
                    <div>
                      <Label className="text-sm font-medium">Nota (1 a 5 estrelas)</Label>
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setFeedbackNota(n)}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`h-6 w-6 transition-colors ${
                                n <= feedbackNota
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Comentario */}
                    <div>
                      <Label htmlFor="feedback-comentario" className="text-sm font-medium">
                        Comentario (opcional)
                      </Label>
                      <Textarea
                        id="feedback-comentario"
                        value={feedbackComentario}
                        onChange={(e) => setFeedbackComentario(e.target.value)}
                        placeholder="Descreva o que pode ser melhorado..."
                        rows={3}
                        className="mt-2"
                      />
                    </div>

                    <Button
                      onClick={handleEnviarFeedback}
                      disabled={!feedbackAvaliacao || enviandoFeedback}
                    >
                      {enviandoFeedback ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Enviar Feedback
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

// ============================================
// Componentes Auxiliares
// ============================================

/** Componente para exibir uma etapa do pipeline */
function EtapaStep({ etapa }: { etapa: EtapaPipeline }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          etapa.status === 'concluido'
            ? 'bg-emerald-100 text-emerald-600'
            : etapa.status === 'ativo'
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-gray-100 text-gray-400'
        }`}
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
        <div
          className={`font-medium text-sm ${
            etapa.status === 'ativo'
              ? 'text-emerald-600'
              : etapa.status === 'concluido'
              ? 'text-emerald-600'
              : 'text-gray-500'
          }`}
        >
          Etapa {etapa.numero}: {etapa.titulo}
        </div>
        {etapa.mensagem && (
          <div className="text-xs text-muted-foreground">{etapa.mensagem}</div>
        )}
      </div>
    </div>
  )
}

/** Componente para renderizar conteudo Markdown com sanitizacao */
function MarkdownContent({ content }: { content: string }) {
  const { html } = useMarkdown(content)
  return (
    <div
      className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
