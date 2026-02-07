import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Play, RotateCw, FlaskConical, MessageSquare, Send, User, Bot, Loader2, AlertCircle, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuthStore } from '@/stores/auth-store'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useMarkdown } from '@/hooks/useMarkdown'
import { cumprimentoBetaApi } from '@/lib/api'
import type {
  SessionResponse,
  SessionListResponse,
  ConsolidationResponse,
  ChatMessageResponse,
  SSEEvent,
  PieceSuggestion,
  GeneratedPieceResponse,
} from '@/types/cumprimento-beta'

export function CumprimentoBetaPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  // Estado da sessão atual
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

  // Buscar lista de sessões para o histórico
  const { data: sessoes, refetch: refetchSessoes } = useApiQuery<SessionListResponse>(
    () => cumprimentoBetaApi.get('/sessoes?pagina=1&por_pagina=50'),
    { enabled: true }
  )

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

  // Função para iniciar nova sessão
  const handleIniciarSessao = async () => {
    if (!numeroProcesso.trim()) {
      setErro('Informe o número do processo')
      return
    }

    try {
      setErro(null)
      setProcessando(true)

      // Criar sessão
      const response = await cumprimentoBetaApi.post<{ sessao_id: number; numero_processo_formatado: string }>(
        '/sessoes',
        { numero_processo: numeroProcesso }
      )

      // Iniciar processamento
      await cumprimentoBetaApi.post(`/sessoes/${response.sessao_id}/processar`)

      // Carregar sessão criada
      await carregarSessao(response.sessao_id)

      // Iniciar polling
      iniciarPolling(response.sessao_id)

      // Atualizar histórico
      refetchSessoes()
    } catch (error) {
      const err = error as Error
      setErro(err.message)
      setProcessando(false)
    }
  }

  // Função para carregar sessão existente
  const carregarSessao = async (sessaoId: number) => {
    try {
      setErro(null)
      const sessao = await cumprimentoBetaApi.get<SessionResponse>(`/sessoes/${sessaoId}`)
      setSessaoAtual(sessao)
      setNumeroProcesso(sessao.numero_processo_formatado)

      // Se está consolidando mas não tem consolidação, executar
      if (sessao.status === 'consolidando' && !sessao.tem_consolidacao) {
        executarConsolidacao(sessaoId)
      }
      // Se já está no modo chatbot, carregar consolidação e mensagens
      else if ((sessao.status === 'chatbot' || sessao.status === 'finalizado') && sessao.tem_consolidacao) {
        await carregarDadosCompletos(sessaoId)
      }
      // Se ainda está processando, iniciar polling
      else if (['iniciado', 'baixando_docs', 'avaliando_relevancia', 'extraindo_json'].includes(sessao.status)) {
        setProcessando(true)
        iniciarPolling(sessaoId)
      }
    } catch (error) {
      const err = error as Error
      setErro(err.message)
    }
  }

  // Função para carregar consolidação e mensagens
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

  // Polling do status da sessão
  const iniciarPolling = (sessaoId: number) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const sessao = await cumprimentoBetaApi.get<SessionResponse>(`/sessoes/${sessaoId}`)
        setSessaoAtual(sessao)

        // Se terminou o processamento
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

  // Executar consolidação com streaming
  const executarConsolidacao = async (sessaoId: number) => {
    try {
      setConsolidando(true)
      setStreamContent('')

      const response = await fetch(`/api/cumprimento-beta/sessoes/${sessaoId}/consolidar?streaming=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      })

      if (!response.ok) throw new Error('Erro ao iniciar consolidação')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('Reader não disponível')

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
                // Adicionar mensagem inicial do assistente
                setMensagens((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    role: 'assistant',
                    conteudo: 'Olá! Analisei o processo de cumprimento de sentença. Como posso ajudar?',
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

  // Enviar mensagem no chat
  const handleEnviarMensagem = async () => {
    if (!chatInput.trim() || !sessaoAtual) return

    const mensagemUsuario = chatInput.trim()
    setChatInput('')
    setEnviandoMensagem(true)

    // Adicionar mensagem do usuário imediatamente
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
      const response = await fetch(`/api/cumprimento-beta/sessoes/${sessaoAtual.id}/chat?streaming=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ conteudo: mensagemUsuario }),
      })

      if (!response.ok) throw new Error('Erro ao enviar mensagem')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('Reader não disponível')

      let respostaCompleta = ''
      let buffer = ''

      // Criar mensagem temporária do assistente
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
                // Atualizar mensagem do assistente
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

  // Renderizar status da sessão
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/dashboard' })}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-purple-600" />
              <div>
                <h1 className="text-lg font-semibold">Cumprimento de Sentença</h1>
                <Badge variant="secondary" className="text-xs">
                  <FlaskConical className="mr-1 h-3 w-3" />
                  Beta
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.full_name}</span>
            {/* Drawer de histórico */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  Histórico
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Sessões Anteriores</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                  <div className="space-y-2">
                    {sessoes?.sessoes.map((sessao) => (
                      <Card
                        key={sessao.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => carregarSessao(sessao.id)}
                      >
                        <CardHeader className="p-4">
                          <CardTitle className="text-sm">{sessao.numero_processo_formatado}</CardTitle>
                          <CardDescription className="text-xs">
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6 space-y-6">
        {/* Input de Processo */}
        <Card>
          <CardHeader>
            <CardTitle>Número do Processo (CNJ)</CardTitle>
            <CardDescription>Formato: NNNNNNN-DD.AAAA.J.TR.OOOO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="numero-processo">Número do Processo</Label>
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
                <Button onClick={handleIniciarSessao} disabled={processando || !numeroProcesso.trim()}>
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
              <div className="flex items-center gap-4 text-sm">
                <div>Status: {getStatusBadge(sessaoAtual.status)}</div>
                {sessaoAtual.total_documentos > 0 && (
                  <div className="text-muted-foreground">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
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
                  label="Avaliação de Relevância"
                  active={sessaoAtual.status === 'avaliando_relevancia'}
                  completed={['extraindo_json', 'consolidando', 'chatbot', 'finalizado'].includes(sessaoAtual.status)}
                  info={`${sessaoAtual.documentos_relevantes} relevantes`}
                />
                <ProcessStep
                  label="Extração de Informações"
                  active={sessaoAtual.status === 'extraindo_json'}
                  completed={['consolidando', 'chatbot', 'finalizado'].includes(sessaoAtual.status)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Consolidação com Streaming */}
        {(consolidando || consolidacao) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {consolidando ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    Consolidando Informações
                  </>
                ) : (
                  'Resumo Consolidado'
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <MarkdownContent content={consolidando ? streamContent : consolidacao?.resumo_consolidado || ''} />
              </ScrollArea>

              {consolidacao?.sugestoes_pecas && consolidacao.sugestoes_pecas.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-2">Sugestões de Peças</h3>
                  <div className="grid gap-2">
                    {consolidacao.sugestoes_pecas.map((sugestao, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                        onClick={() => setChatInput(`Gere uma ${sugestao.tipo} para este processo`)}
                      >
                        <div>
                          <div className="font-medium text-sm">{sugestao.tipo}</div>
                          <div className="text-xs text-muted-foreground">{sugestao.descricao}</div>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                Chat com IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4" ref={chatScrollRef}>
                <div className="space-y-4">
                  {mensagens.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {enviandoMensagem && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
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
                <Button onClick={handleEnviarMensagem} disabled={enviandoMensagem || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Peças Geradas */}
        {pecasGeradas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Peças Geradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pecasGeradas.map((peca) => (
                  <div key={peca.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{peca.titulo}</div>
                      <div className="text-xs text-muted-foreground">
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
      </main>
    </div>
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
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          completed ? 'bg-green-100 text-green-600' : active ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'
        }`}
      >
        {completed ? '✓' : active ? <Loader2 className="h-4 w-4 animate-spin" /> : '○'}
      </div>
      <div className="flex-1">
        <div className={`font-medium text-sm ${active ? 'text-purple-600' : completed ? 'text-green-600' : 'text-gray-500'}`}>
          {label}
        </div>
        {info && <div className="text-xs text-muted-foreground">{info}</div>}
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
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-slate-100' : 'bg-purple-100'
        }`}
      >
        {isUser ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4 text-purple-600" />}
      </div>
      <div
        className={`flex-1 max-w-[85%] rounded-lg p-3 ${
          isUser ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-900'
        }`}
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
