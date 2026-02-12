import { useState, useEffect, useRef } from 'react'
import { Play, RotateCw, FlaskConical, MessageSquare, Send, User, Bot, Loader2, AlertCircle, Download } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useMarkdown } from '@/hooks/useMarkdown'
import { cumprimentoBetaApi, getToken } from '@/lib/api'
import type {
  SessionResponse,
  SessionListResponse,
  ConsolidationResponse,
  ChatMessageResponse,
  SSEEvent,
  GeneratedPieceResponse,
} from '@/types/cumprimento-beta'

export function CumprimentoBetaPage() {
  // Estado da sessao atual
  const [numeroProcesso, setNumeroProcesso] = useState('')
  const [sessaoAtual, setSessaoAtual] = useState<SessionResponse | null>(null)
  const [consolidacao, setConsolidacao] = useState<ConsolidationResponse | null>(null)
  const [mensagens, setMensagens] = useState<ChatMessageResponse[]>([])
  const [pecasGeradas, setPecasGeradas] = useState<GeneratedPieceResponse[]>([])

  // Estado de UI
  const [processando, setProcessando] = useState(false)
  const [consolidando, setConsolidando] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [enviandoMensagem, setEnviandoMensagem] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Buscar lista de sessoes para o historico
  const { data: sessoes, refetch: refetchSessoes } = useQuery<SessionListResponse>({
    queryKey: queryKeys.cumprimentoBeta.sessoes(),
    queryFn: () => cumprimentoBetaApi.get<SessionListResponse>('/sessoes?pagina=1&por_pagina=50'),
  })

  // Auto-scroll do chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [mensagens, streamContent])

  // Cleanup do polling
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const handleIniciarSessao = async () => {
    if (!numeroProcesso.trim()) {
      setErro('Informe o numero do processo')
      return
    }

    try {
      setErro(null)
      setProcessando(true)

      const response = await cumprimentoBetaApi.post<{ sessao_id: number; numero_processo_formatado: string }>(
        '/sessoes',
        { numero_processo: numeroProcesso }
      )

      await cumprimentoBetaApi.post(`/sessoes/${response.sessao_id}/processar`)
      await carregarSessao(response.sessao_id)
      iniciarPolling(response.sessao_id)
      refetchSessoes()
    } catch (error) {
      const err = error as Error
      setErro(err.message)
      setProcessando(false)
    }
  }

  const carregarSessao = async (sessaoId: number) => {
    try {
      setErro(null)
      const sessao = await cumprimentoBetaApi.get<SessionResponse>(`/sessoes/${sessaoId}`)
      setSessaoAtual(sessao)
      setNumeroProcesso(sessao.numero_processo_formatado)

      if (sessao.status === 'consolidando' && !sessao.tem_consolidacao) {
        executarConsolidacao(sessaoId)
      } else if ((sessao.status === 'chatbot' || sessao.status === 'finalizado') && sessao.tem_consolidacao) {
        await carregarDadosCompletos(sessaoId)
      } else if (['iniciado', 'baixando_docs', 'avaliando_relevancia', 'extraindo_json'].includes(sessao.status)) {
        setProcessando(true)
        iniciarPolling(sessaoId)
      }
    } catch (error) {
      const err = error as Error
      setErro(err.message)
    }
  }

  const carregarDadosCompletos = async (sessaoId: number) => {
    try {
      const [consolidacaoData, historicoChat, pecas] = await Promise.all([
        cumprimentoBetaApi.get<ConsolidationResponse>(`/sessoes/${sessaoId}/consolidacao`),
        cumprimentoBetaApi.get<{ mensagens: ChatMessageResponse[] }>(`/sessoes/${sessaoId}/conversas`),
        cumprimentoBetaApi.get<GeneratedPieceResponse[]>(`/sessoes/${sessaoId}/pecas`),
      ])

      setConsolidacao(consolidacaoData)
      setMensagens(historicoChat.mensagens)
      setPecasGeradas(pecas)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    }
  }

  const iniciarPolling = (sessaoId: number) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const sessao = await cumprimentoBetaApi.get<SessionResponse>(`/sessoes/${sessaoId}`)
        setSessaoAtual(sessao)

        if (sessao.status === 'consolidando' && !sessao.tem_consolidacao) {
          pararPolling()
          setProcessando(false)
          executarConsolidacao(sessaoId)
        } else if (sessao.status === 'chatbot' || sessao.status === 'finalizado') {
          pararPolling()
          setProcessando(false)
          await carregarDadosCompletos(sessaoId)
        } else if (sessao.status === 'erro') {
          pararPolling()
          setProcessando(false)
          setErro(sessao.erro_mensagem || 'Erro no processamento')
        }
      } catch (error) {
        console.error('Erro no polling:', error)
      }
    }, 2000)
  }

  const pararPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  const executarConsolidacao = async (sessaoId: number) => {
    try {
      setConsolidando(true)
      setStreamContent('')

      // eslint-disable-next-line no-restricted-globals -- Streaming SSE (getReader) — sera extraido para hook compartilhado (Wave 2)
      const response = await fetch(`/api/cumprimento-beta/sessoes/${sessaoId}/consolidar?streaming=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      })

      if (!response.ok) throw new Error('Erro ao iniciar consolidacao')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('Reader nao disponivel')

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
              const event: SSEEvent = JSON.parse(line.slice(6))

              if (event.event === 'chunk') {
                setStreamContent((prev) => prev + event.data.texto)
              } else if (event.event === 'concluido') {
                setConsolidando(false)
                await carregarDadosCompletos(sessaoId)
                setMensagens((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    role: 'assistant',
                    conteudo: 'Ola! Analisei o processo de cumprimento de sentenca. Como posso ajudar?',
                    modelo_usado: null,
                    usou_busca_vetorial: false,
                    created_at: new Date().toISOString(),
                  },
                ])
              } else if (event.event === 'erro') {
                setConsolidando(false)
                setErro(event.data.mensagem)
              }
            } catch (e) {
              console.warn('Erro ao parsear SSE:', e)
            }
          }
        }
      }
    } catch (error) {
      const err = error as Error
      setErro(err.message)
      setConsolidando(false)
    }
  }

  const handleEnviarMensagem = async () => {
    if (!chatInput.trim() || !sessaoAtual) return

    const mensagemUsuario = chatInput.trim()
    setChatInput('')
    setEnviandoMensagem(true)

    const msgUsuario: ChatMessageResponse = {
      id: Date.now(),
      role: 'user',
      conteudo: mensagemUsuario,
      modelo_usado: null,
      usou_busca_vetorial: false,
      created_at: new Date().toISOString(),
    }
    setMensagens((prev) => [...prev, msgUsuario])

    try {
      // eslint-disable-next-line no-restricted-globals -- Streaming SSE (getReader) — sera extraido para hook compartilhado (Wave 2)
      const response = await fetch(`/api/cumprimento-beta/sessoes/${sessaoAtual.id}/chat?streaming=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ conteudo: mensagemUsuario }),
      })

      if (!response.ok) throw new Error('Erro ao enviar mensagem')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('Reader nao disponivel')

      let respostaCompleta = ''
      let buffer = ''

      const msgIdAssistente = Date.now() + 1
      setMensagens((prev) => [
        ...prev,
        {
          id: msgIdAssistente,
          role: 'assistant',
          conteudo: '',
          modelo_usado: null,
          usou_busca_vetorial: false,
          created_at: new Date().toISOString(),
        },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.chunk) {
                respostaCompleta += data.chunk
                setMensagens((prev) =>
                  prev.map((msg) =>
                    msg.id === msgIdAssistente ? { ...msg, conteudo: respostaCompleta } : msg
                  )
                )
              }
            } catch (e) {
              console.warn('Erro ao parsear chunk:', e)
            }
          }
        }
      }

      setEnviandoMensagem(false)
    } catch (error) {
      const err = error as Error
      setErro(err.message)
      setEnviandoMensagem(false)
    }
  }

  const getStatusBadge = (status: SessionResponse['status']) => {
    const statusMap = {
      iniciado: { label: 'Iniciado', variant: 'secondary' as const },
      baixando_docs: { label: 'Baixando Docs', variant: 'default' as const },
      avaliando_relevancia: { label: 'Avaliando', variant: 'default' as const },
      extraindo_json: { label: 'Extraindo', variant: 'default' as const },
      consolidando: { label: 'Consolidando', variant: 'default' as const },
      chatbot: { label: 'Chat Ativo', variant: 'default' as const },
      finalizado: { label: 'Finalizado', variant: 'default' as const },
      erro: { label: 'Erro', variant: 'destructive' as const },
    }
    const info = statusMap[status] || { label: status, variant: 'secondary' as const }
    return <Badge variant={info.variant}>{info.label}</Badge>
  }

  return (
    <>
      <BreadcrumbBar
        title="Cumprimento de Sentenca"
        icon={<FlaskConical className="w-3.5 h-3.5" />}
        actions={
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                style={{ color: C.text400 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = C.gray100
                  e.currentTarget.style.color = C.text700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = C.text400
                }}
                title="Historico"
              >
                <RotateCw style={{ width: 16, height: 16 }} />
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Sessoes Anteriores</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                <div className="space-y-2">
                  {sessoes?.sessoes.map((sessao) => (
                    <Card
                      key={sessao.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderColor: C.gray200, borderRadius: 12 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      onClick={() => carregarSessao(sessao.id)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm" style={{ color: C.text900 }}>
                          {sessao.numero_processo_formatado}
                        </CardTitle>
                        <CardDescription className="text-xs" style={{ color: C.text400 }}>
                          {new Date(sessao.created_at).toLocaleString('pt-BR')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        {getStatusBadge(sessao.status)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        }
      />

      <ContentArea>
        <div className="space-y-6" style={{ maxWidth: 896, margin: '0 auto' }}>
        {/* Input de Processo */}
        <Card style={{ borderColor: C.gray200, borderRadius: 16 }}>
          <CardHeader>
            <CardTitle style={{ color: C.text900 }}>Numero do Processo (CNJ)</CardTitle>
            <CardDescription style={{ color: C.text400 }}>Formato: NNNNNNN-DD.AAAA.J.TR.OOOO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="numero-processo">Numero do Processo</Label>
                <Input
                  id="numero-processo"
                  value={numeroProcesso}
                  onChange={(e) => setNumeroProcesso(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleIniciarSessao()
                  }}
                  disabled={processando}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleIniciarSessao}
                  disabled={processando || !numeroProcesso.trim()}
                  style={{ background: C.navy950 }}
                >
                  {processando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Iniciar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {sessaoAtual && (
              <div className="flex items-center gap-4 text-sm" style={{ color: C.text700 }}>
                <div>Status: {getStatusBadge(sessaoAtual.status)}</div>
                {sessaoAtual.total_documentos > 0 && (
                  <div style={{ color: C.text400 }}>
                    Documentos: {sessaoAtual.documentos_processados}/{sessaoAtual.total_documentos} (
                    {sessaoAtual.documentos_relevantes} relevantes)
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Erro */}
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro no Processamento</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                setErro(null)
                if (sessaoAtual) carregarSessao(sessaoAtual.id)
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </Alert>
        )}

        {/* Processamento em Andamento */}
        {processando && sessaoAtual && (
          <Card style={{ borderColor: C.gray200, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ height: 4, background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: C.text900 }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.navy600 }} />
                Processando Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <ProcessStep
                  label="Download de Documentos"
                  active={sessaoAtual.status === 'baixando_docs'}
                  completed={['avaliando_relevancia', 'extraindo_json', 'consolidando', 'chatbot', 'finalizado'].includes(sessaoAtual.status)}
                  info={`${sessaoAtual.documentos_processados}/${sessaoAtual.total_documentos} documentos`}
                />
                <ProcessStep
                  label="Avaliacao de Relevancia"
                  active={sessaoAtual.status === 'avaliando_relevancia'}
                  completed={['extraindo_json', 'consolidando', 'chatbot', 'finalizado'].includes(sessaoAtual.status)}
                  info={`${sessaoAtual.documentos_relevantes} relevantes`}
                />
                <ProcessStep
                  label="Extracao de Informacoes"
                  active={sessaoAtual.status === 'extraindo_json'}
                  completed={['consolidando', 'chatbot', 'finalizado'].includes(sessaoAtual.status)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Consolidacao com Streaming */}
        {(consolidando || consolidacao) && (
          <Card style={{ borderColor: C.gray200, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ height: 4, background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: C.text900 }}>
                {consolidando ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.navy600 }} />
                    Consolidando Informacoes
                  </>
                ) : (
                  'Resumo Consolidado'
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md p-4" style={{ border: `1px solid ${C.gray200}` }}>
                <MarkdownContent content={consolidando ? streamContent : consolidacao?.resumo_consolidado || ''} />
              </ScrollArea>

              {consolidacao?.sugestoes_pecas && consolidacao.sugestoes_pecas.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-2" style={{ color: C.text900 }}>Sugestoes de Pecas</h3>
                  <div className="grid gap-2">
                    {consolidacao.sugestoes_pecas.map((sugestao, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                        style={{ border: `1px solid ${C.gray200}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        onClick={() => setChatInput(`Gere uma ${sugestao.tipo} para este processo`)}
                      >
                        <div>
                          <div className="font-medium text-sm" style={{ color: C.text900 }}>{sugestao.tipo}</div>
                          <div className="text-xs" style={{ color: C.text400 }}>{sugestao.descricao}</div>
                        </div>
                        <Badge
                          variant={
                            sugestao.prioridade === 'alta'
                              ? 'destructive'
                              : sugestao.prioridade === 'media'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {sugestao.prioridade}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chat */}
        {sessaoAtual && (sessaoAtual.status === 'chatbot' || sessaoAtual.status === 'finalizado') && consolidacao && (
          <Card style={{ borderColor: C.gray200, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ height: 4, background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: C.text900 }}>
                <MessageSquare className="h-5 w-5" style={{ color: C.navy600 }} />
                Chat com IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md p-4" style={{ border: `1px solid ${C.gray200}` }} ref={chatScrollRef}>
                <div className="space-y-4">
                  {mensagens.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {enviandoMensagem && (
                    <div className="flex gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: C.navy100 }}
                      >
                        <Bot className="h-4 w-4" style={{ color: C.navy700 }} />
                      </div>
                      <div className="flex-1">
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: C.navy600 }} />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEnviarMensagem()
                    }
                  }}
                  disabled={enviandoMensagem}
                />
                <Button
                  onClick={handleEnviarMensagem}
                  disabled={enviandoMensagem || !chatInput.trim()}
                  style={{ background: C.navy950 }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pecas Geradas */}
        {pecasGeradas.length > 0 && (
          <Card style={{ borderColor: C.gray200, borderRadius: 16 }}>
            <CardHeader>
              <CardTitle style={{ color: C.text900 }}>Pecas Geradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pecasGeradas.map((peca) => (
                  <div
                    key={peca.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ border: `1px solid ${C.gray200}` }}
                  >
                    <div>
                      <div className="font-medium text-sm" style={{ color: C.text900 }}>{peca.titulo}</div>
                      <div className="text-xs" style={{ color: C.text400 }}>
                        {new Date(peca.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    {peca.download_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={peca.download_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </ContentArea>
    </>
  )
}

// Componente auxiliar para step do processamento
function ProcessStep({
  label,
  active,
  completed,
  info,
}: {
  label: string
  active: boolean
  completed: boolean
  info?: string
}) {
  function getStepStyle(): { bg: string; color: string } {
    if (completed) return { bg: C.successBgStrong, color: C.successAccent }
    if (active) return { bg: C.navy100, color: C.navy700 }
    return { bg: C.gray100, color: C.text400 }
  }

  function getLabelColor(): string {
    if (active) return C.navy700
    if (completed) return C.successAccent
    return C.text500
  }

  const stepStyle = getStepStyle()

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ border: `1px solid ${C.gray200}` }}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: stepStyle.bg, color: stepStyle.color }}
      >
        {completed ? '✓' : active ? <Loader2 className="h-4 w-4 animate-spin" /> : '○'}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm" style={{ color: getLabelColor() }}>
          {label}
        </div>
        {info && <div className="text-xs" style={{ color: C.text400 }}>{info}</div>}
      </div>
    </div>
  )
}

// Componente auxiliar para mensagem do chat
function ChatMessage({ message }: { message: ChatMessageResponse }) {
  const { html } = useMarkdown(message.conteudo)
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: isUser ? C.gray100 : C.navy100 }}
      >
        {isUser
          ? <User className="h-4 w-4" style={{ color: C.text500 }} />
          : <Bot className="h-4 w-4" style={{ color: C.navy700 }} />
        }
      </div>
      <div
        className="flex-1 max-w-[85%] rounded-lg p-3"
        style={isUser
          ? { background: C.navy950, color: 'white' }
          : { background: C.gray100, color: C.text900 }
        }
      >
        {isUser ? (
          <div className="text-sm">{message.conteudo}</div>
        ) : (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  )
}

// Componente auxiliar para renderizar markdown
function MarkdownContent({ content }: { content: string }) {
  const { html } = useMarkdown(content)
  return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
