import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/toast'
import { useApiQuery } from '@/hooks/useApiQuery'
import { pedidoCalculoApi, getToken } from '@/lib/api'
import { marked } from 'marked'
import {
  Calculator,
  History,
  Loader2,
  Check,
  X,
  Download,
  Copy,
  FolderOpen,
  Send,
  Star,
  AlertCircle,
  FileText,
  Search,
  Brain,
  Sparkles,
} from 'lucide-react'
import type {
  HistoricoItem,
  StreamEvent,
  DadosBasicos,
  DadosExtracao,
  DocumentoBaixado,
  ChatMessage,
  VerificacaoExistente,
  EditarPedidoResponse,
  ExportarDocxResponse,
  DocumentoResponse,
} from '@/types/pedido-calculo'

// Configuracao do marked para renderizar markdown
marked.setOptions({
  breaks: true,
  gfm: true,
})

export function PedidoCalculoPage() {
  const { toast } = useToast()

  // Estado do formulario
  const [numeroCNJ, setNumeroCNJ] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Estado do progresso
  const [progressMessage, setProgressMessage] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [agentStatus, setAgentStatus] = useState<Record<number, 'aguardando' | 'ativo' | 'concluido' | 'erro'>>({
    1: 'aguardando',
    2: 'aguardando',
    3: 'aguardando',
    4: 'aguardando',
  })

  // Estado do editor
  const [showEditor, setShowEditor] = useState(false)
  const [geracaoId, setGeracaoId] = useState<number | null>(null)
  const [pedidoMarkdown, setPedidoMarkdown] = useState('')
  const [dadosBasicos, setDadosBasicos] = useState<DadosBasicos>({})
  const [dadosExtracao, setDadosExtracao] = useState<DadosExtracao>({})
  const [documentosBaixados, setDocumentosBaixados] = useState<DocumentoBaixado[]>([])
  const [historicoChat, setHistoricoChat] = useState<ChatMessage[]>([])
  const [isNovaGeracao, setIsNovaGeracao] = useState(false)

  // Estado do chat
  const [chatInput, setChatInput] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const chatMessagesRef = useRef<HTMLDivElement>(null)

  // Estado do streaming
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  // Estado do viewer de documentos
  const [showDocumentViewer, setShowDocumentViewer] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<{ id: string; tipo: string; processo: string } | null>(null)
  const [documentContent, setDocumentContent] = useState<string | null>(null)
  const [isLoadingDocument, setIsLoadingDocument] = useState(false)

  // Estado do feedback
  const [showFeedback, setShowFeedback] = useState(false)
  const [notaSelecionada, setNotaSelecionada] = useState<number | null>(null)
  const [comentarioFeedback, setComentarioFeedback] = useState('')

  // Historico
  const {
    data: historico,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useApiQuery<HistoricoItem[]>(() => pedidoCalculoApi.get('/historico'), {
    enabled: true,
  })

  // Scroll automatico do chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [historicoChat])

  // Funcao para processar eventos SSE
  const processarEventoStream = (event: StreamEvent) => {
    console.log('Evento SSE:', event)

    switch (event.tipo) {
      case 'inicio':
        setProgressMessage(event.mensagem)
        break

      case 'agente':
        setAgentStatus((prev) => ({ ...prev, [event.agente]: event.status }))
        setProgressMessage(event.mensagem)
        if (event.status === 'concluido') {
          setProgressPercent(event.agente * 25)
        }
        if (event.status === 'erro') {
          toast({
            title: 'Erro',
            description: event.mensagem,
            variant: 'destructive',
          })
        }
        break

      case 'info':
        setProgressMessage(event.mensagem)
        break

      case 'geracao_chunk':
        if (!isStreaming) {
          setIsStreaming(true)
          setStreamingContent('')
          abrirEditorStreaming()
        }
        setStreamingContent((prev) => prev + event.content)
        break

      case 'sucesso':
        setProgressPercent(100)
        setAgentStatus((prev) => ({ ...prev, 4: 'concluido' }))

        const conteudoFinal = isStreaming ? streamingContent : event.pedido_markdown

        if (isStreaming) {
          finalizarEditorStreaming(
            event.geracao_id,
            event.dados_basicos || {},
            event.dados_extracao || {},
            event.documentos_baixados || [],
            conteudoFinal || ''
          )
        } else {
          setTimeout(() => {
            exibirEditor(
              event.geracao_id,
              event.dados_basicos || {},
              event.dados_extracao || {},
              conteudoFinal || '',
              event.documentos_baixados || [],
              true
            )
          }, 500)
        }

        setIsProcessing(false)
        refetchHistorico()
        toast({
          title: 'Sucesso',
          description: 'Pedido de cálculo gerado com sucesso!',
        })
        break

      case 'erro':
        setIsProcessing(false)
        setIsStreaming(false)
        toast({
          title: 'Erro',
          description: event.mensagem,
          variant: 'destructive',
        })
        break
    }
  }

  // Funcao para iniciar processamento
  const iniciarProcessamento = async (sobrescrever: boolean = false) => {
    if (!numeroCNJ.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe o número do processo',
        variant: 'destructive',
      })
      return
    }

    // Verifica se ja existe no historico
    if (!sobrescrever) {
      try {
        const verificacao = await pedidoCalculoApi.get<VerificacaoExistente>(
          `/verificar-existente?numero_cnj=${encodeURIComponent(numeroCNJ)}`
        )

        if (verificacao.existe && verificacao.geracao_id) {
          // Mostra dialogo de confirmacao
          const resultado = await mostrarConfirmacaoSobrescrita(verificacao)
          if (resultado === 'cancelar') {
            return
          } else if (resultado === 'ver') {
            carregarDoHistorico(verificacao.geracao_id)
            return
          }
          // Se 'refazer', continua com sobrescrever = true
        }
      } catch (error) {
        console.warn('Erro ao verificar existente:', error)
      }
    }

    setIsProcessing(true)
    resetarStatusAgentes()
    setProgressMessage('Conectando ao TJ-MS...')
    setProgressPercent(0)

    try {
      const response = await fetch('/pedido-calculo/api/processar-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          numero_cnj: numeroCNJ,
          sobrescrever_existente: sobrescrever,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Erro ao processar')
      }

      // Le o stream SSE
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
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamEvent
              processarEventoStream(data)
            } catch (e) {
              console.warn('Erro ao parsear evento SSE:', e)
            }
          }
        }
      }
    } catch (error) {
      const err = error as Error
      let mensagemErro = err.message

      if (err.message.includes('502') || err.message.includes('Proxy')) {
        mensagemErro = 'Erro de conexão com o TJ-MS (502). O servidor pode estar temporariamente indisponível.'
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        mensagemErro = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.'
      }

      toast({
        title: 'Erro',
        description: mensagemErro,
        variant: 'destructive',
      })
      setIsProcessing(false)
    }
  }

  // Funcao para resetar status dos agentes
  const resetarStatusAgentes = () => {
    setAgentStatus({
      1: 'aguardando',
      2: 'aguardando',
      3: 'aguardando',
      4: 'aguardando',
    })
  }

  // Funcoes do editor
  const exibirEditor = (
    id: number,
    basicos: DadosBasicos,
    extracao: DadosExtracao,
    markdown: string,
    docs: DocumentoBaixado[],
    isNova: boolean
  ) => {
    setGeracaoId(id)
    setDadosBasicos(basicos)
    setDadosExtracao(extracao)
    setPedidoMarkdown(markdown)
    setDocumentosBaixados(docs)
    setIsNovaGeracao(isNova)
    setHistoricoChat([])
    setShowEditor(true)
  }

  const abrirEditorStreaming = () => {
    setIsProcessing(false)
    setShowEditor(true)
    setPedidoMarkdown('')
    setHistoricoChat([])
  }

  const finalizarEditorStreaming = (
    id: number,
    basicos: DadosBasicos,
    extracao: DadosExtracao,
    docs: DocumentoBaixado[],
    conteudo: string
  ) => {
    setGeracaoId(id)
    setDadosBasicos(basicos)
    setDadosExtracao(extracao)
    setPedidoMarkdown(conteudo)
    setDocumentosBaixados(docs)
    setIsStreaming(false)
    setStreamingContent('')
  }

  const fecharEditor = () => {
    setShowEditor(false)
    if (isNovaGeracao) {
      setShowFeedback(true)
    }
  }

  // Funcao para carregar do historico
  const carregarDoHistorico = async (id: number) => {
    try {
      const data = await pedidoCalculoApi.get<HistoricoItem>(`/historico/${id}`)

      const basicos = data.dados_processo || data.dados_agente1?.dados_basicos || {}
      const extracao = data.dados_agente2 || {}
      const markdown = data.conteudo_gerado || data.pedido_markdown || ''

      setNumeroCNJ(data.numero_cnj_formatado || data.numero_cnj || '')
      exibirEditor(data.id, basicos, extracao, markdown, data.documentos_baixados || [], false)

      if (data.historico_chat) {
        setHistoricoChat(data.historico_chat)
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao abrir pedido',
        variant: 'destructive',
      })
    }
  }

  // Funcoes do chat
  const enviarMensagemChat = async () => {
    if (!chatInput.trim() || isSendingChat) return

    const mensagem = chatInput.trim()
    setChatInput('')
    setIsSendingChat(true)

    // Adiciona mensagem do usuario
    const novoHistorico = [...historicoChat, { role: 'user' as const, content: mensagem }]
    setHistoricoChat(novoHistorico)

    try {
      const response = await pedidoCalculoApi.post<EditarPedidoResponse>('/editar-pedido', {
        pedido_markdown: pedidoMarkdown,
        mensagem_usuario: mensagem,
        historico_chat: historicoChat,
        dados_basicos: dadosBasicos,
        dados_extracao: dadosExtracao,
      })

      if (response.status === 'sucesso' && response.pedido_markdown) {
        setPedidoMarkdown(response.pedido_markdown)

        // Adiciona resposta do assistente
        setHistoricoChat([
          ...novoHistorico,
          { role: 'assistant', content: 'Pronto! Atualizei o pedido conforme solicitado.' },
        ])

        toast({
          title: 'Sucesso',
          description: 'Pedido atualizado',
        })
      } else {
        throw new Error(response.mensagem || 'Erro desconhecido')
      }
    } catch (error) {
      const err = error as Error
      setHistoricoChat([...novoHistorico, { role: 'assistant', content: `Erro: ${err.message}` }])

      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSendingChat(false)
    }
  }

  // Funcao para copiar pedido
  const copiarPedido = async () => {
    try {
      await navigator.clipboard.writeText(pedidoMarkdown)
      toast({
        title: 'Sucesso',
        description: 'Pedido copiado para a área de transferência!',
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao copiar',
        variant: 'destructive',
      })
    }
  }

  // Funcao para baixar DOCX
  const baixarDocx = async () => {
    if (!pedidoMarkdown) {
      toast({
        title: 'Atenção',
        description: 'Nenhum pedido para exportar',
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await pedidoCalculoApi.post<ExportarDocxResponse>('/exportar-docx', {
        markdown: pedidoMarkdown,
        numero_processo: numeroCNJ,
      })

      if (response.status === 'sucesso' && response.url_download) {
        const downloadUrl = `${response.url_download}?token=${encodeURIComponent(getToken() || '')}`

        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = response.filename || 'pedido_calculo.docx'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast({
          title: 'Sucesso',
          description: 'Download iniciado!',
        })
      } else {
        throw new Error(response.mensagem || 'Erro desconhecido')
      }
    } catch (error) {
      const err = error as Error
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Funcao para abrir viewer de documentos
  const abrirVisualizadorDocumentos = () => {
    if (!documentosBaixados || documentosBaixados.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Nenhum documento foi baixado para este processo',
        variant: 'destructive',
      })
      return
    }
    setShowDocumentViewer(true)
  }

  // Funcao para visualizar documento
  const visualizarDocumento = async (doc: DocumentoBaixado) => {
    setSelectedDocument({
      id: doc.id,
      tipo: doc.tipo || 'Documento',
      processo: doc.processo || 'principal',
    })
    setIsLoadingDocument(true)
    setDocumentContent(null)

    try {
      const numeroProcesso = doc.numero_processo || dadosBasicos.numero_processo || numeroCNJ
      const response = await pedidoCalculoApi.get<DocumentoResponse>(
        `/documento/${encodeURIComponent(numeroProcesso)}/${encodeURIComponent(doc.id)}?token=${encodeURIComponent(getToken() || '')}`
      )

      setDocumentContent(response.conteudo_base64)
    } catch (error) {
      const err = error as Error
      toast({
        title: 'Erro',
        description: `Erro ao carregar documento: ${err.message}`,
        variant: 'destructive',
      })
    } finally {
      setIsLoadingDocument(false)
    }
  }

  // Funcao para enviar feedback
  const enviarFeedback = async () => {
    if (!geracaoId || !notaSelecionada) return

    try {
      await pedidoCalculoApi.post('/feedback', {
        geracao_id: geracaoId,
        avaliacao: notaSelecionada >= 4 ? 'correto' : notaSelecionada >= 2 ? 'parcial' : 'incorreto',
        nota: notaSelecionada,
        comentario: comentarioFeedback || null,
      })

      toast({
        title: 'Sucesso',
        description: 'Feedback enviado! Obrigado!',
      })
    } catch (error) {
      console.error('Erro ao enviar feedback:', error)
    } finally {
      setShowFeedback(false)
      setNotaSelecionada(null)
      setComentarioFeedback('')
    }
  }

  // Funcao para mostrar confirmacao de sobrescrita
  const mostrarConfirmacaoSobrescrita = (dados: VerificacaoExistente): Promise<'cancelar' | 'ver' | 'refazer'> => {
    return new Promise((resolve) => {
      // Por simplicidade, vamos usar confirm nativo
      // Em producao, seria melhor usar um Dialog customizado
      const resposta = window.confirm(
        `Este processo já existe no histórico.\n\nProcesso: ${dados.numero_cnj_formatado || 'N/A'}\nAutor: ${dados.autor || 'N/A'}\nGerado em: ${dados.criado_em || 'N/A'}\n\nDeseja ver o pedido existente? (Cancelar para refazer)`
      )

      if (resposta) {
        resolve('ver')
      } else {
        const refazer = window.confirm('Deseja refazer o pedido?')
        resolve(refazer ? 'refazer' : 'cancelar')
      }
    })
  }

  // Renderiza status de um agente
  const renderAgentStatus = (num: number, nome: string, descricao: string) => {
    const status = agentStatus[num]
    const icons = {
      1: Search,
      2: Download,
      3: Brain,
      4: FileText,
    }
    const Icon = icons[num as keyof typeof icons]

    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
          status === 'ativo'
            ? 'bg-blue-50 border-blue-200'
            : status === 'concluido'
              ? 'bg-green-50 border-green-200'
              : status === 'erro'
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-100'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            status === 'ativo'
              ? 'bg-blue-500'
              : status === 'concluido'
                ? 'bg-green-500'
                : status === 'erro'
                  ? 'bg-red-500'
                  : 'bg-gray-200'
          }`}
        >
          {status === 'ativo' ? (
            <Loader2 className="h-4 w-4 text-white animate-spin" />
          ) : status === 'concluido' ? (
            <Check className="h-4 w-4 text-white" />
          ) : status === 'erro' ? (
            <X className="h-4 w-4 text-white" />
          ) : (
            <Icon className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">{nome}</p>
          <p className="text-xs text-gray-500">{descricao}</p>
        </div>
        <Badge
          variant={
            status === 'ativo'
              ? 'default'
              : status === 'concluido'
                ? 'default'
                : status === 'erro'
                  ? 'destructive'
                  : 'secondary'
          }
          className="text-xs"
        >
          {status === 'ativo'
            ? 'Processando'
            : status === 'concluido'
              ? 'Concluído'
              : status === 'erro'
                ? 'Erro'
                : 'Aguardando'}
        </Badge>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-gray-500 hover:text-gray-700 transition-colors">
                ←
              </a>
              <div className="border-l border-gray-300 pl-4">
                <h1 className="font-semibold text-gray-800">Pedido de Cálculo Judicial</h1>
                <p className="text-xs text-gray-500">Cumprimento de Sentença contra a Fazenda Pública</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <History className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Histórico</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-80px)] mt-4">
                    {isLoadingHistorico ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      </div>
                    ) : !historico || historico.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Nenhum pedido gerado ainda</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {historico.map((item) => {
                          const numero = item.numero_cnj_formatado || item.numero_cnj || 'Processo'
                          const autor =
                            item.dados_processo?.autor ||
                            item.dados_agente1?.dados_basicos?.autor ||
                            'Pedido de Cálculo'
                          const data = item.criado_em ? new Date(item.criado_em) : null

                          return (
                            <div
                              key={item.id}
                              onClick={() => carregarDoHistorico(item.id)}
                              className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-800 truncate">{numero}</span>
                                <span className="text-xs text-gray-400">
                                  {data ? data.toLocaleDateString('pt-BR') : '-'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 truncate">{autor}</span>
                                <span className="text-xs text-gray-400">
                                  {data ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
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
        {/* Formulario Principal */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Gerar Pedido de Cálculo</CardTitle>
                <CardDescription>Informe o número do processo para iniciar</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                iniciarProcessamento()
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="numero-cnj">Número do Processo (CNJ)</Label>
                <Input
                  id="numero-cnj"
                  value={numeroCNJ}
                  onChange={(e) => setNumeroCNJ(e.target.value)}
                  placeholder="0000000-00.2024.8.12.0001"
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">Digite o número completo do processo no formato CNJ</p>
              </div>

              <Button type="submit" className="w-full" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Pedido de Cálculo
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Historico Recente */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <History className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-lg">Pedidos Recentes</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistorico ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : !historico || historico.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum pedido gerado ainda</p>
                <p className="text-xs mt-1">Use o formulário acima para gerar seu primeiro pedido</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {historico.slice(0, 5).map((item) => {
                  const numero = item.numero_cnj_formatado || item.numero_cnj || 'Processo'
                  const autor =
                    item.dados_processo?.autor || item.dados_agente1?.dados_basicos?.autor || 'Pedido de Cálculo'
                  const data = item.criado_em ? new Date(item.criado_em) : null

                  return (
                    <div
                      key={item.id}
                      onClick={() => carregarDoHistorico(item.id)}
                      className="flex items-center gap-4 p-4 border rounded-xl hover:bg-amber-50 hover:border-amber-300 transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center group-hover:from-amber-200 group-hover:to-orange-200 transition-colors">
                        <Calculator className="h-6 w-6 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate group-hover:text-amber-700">{numero}</p>
                        <p className="text-sm text-amber-600 font-medium">{autor}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400">{data ? data.toLocaleDateString('pt-BR') : '-'}</p>
                        <p className="text-xs text-gray-300">
                          {data ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modal de Progresso */}
      <Dialog open={isProcessing} onOpenChange={setIsProcessing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
              <DialogTitle>Gerando Pedido de Cálculo</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">{progressMessage}</p>

            <div className="space-y-3">
              {renderAgentStatus(1, 'Agente 1: Análise XML', 'Extraindo dados do processo')}
              {renderAgentStatus(2, 'Agente 2: Download de Documentos', 'Baixando sentenças e certidões')}
              {renderAgentStatus(3, 'Agente 3: Extração de Informações', 'Analisando sentenças e critérios')}
              {renderAgentStatus(4, 'Agente 4: Geração do Pedido', 'Montando pedido de cálculo')}
            </div>

            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Editor */}
      <Dialog open={showEditor} onOpenChange={fecharEditor}>
        <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0 flex flex-col">
          {/* Header do Editor */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary-50 to-sky-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Pedido de Cálculo</h2>
                <p className="text-xs text-gray-500">{dadosBasicos.numero_processo || numeroCNJ}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={abrirVisualizadorDocumentos} size="sm" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Acessar Autos
              </Button>
              <Button onClick={baixarDocx} size="sm" variant="secondary" className="gap-2">
                <Download className="h-4 w-4" />
                Baixar DOCX
              </Button>
              <Button onClick={copiarPedido} size="sm" variant="secondary" className="gap-2">
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
          </div>

          {/* Conteudo Principal */}
          <div className="flex flex-1 overflow-hidden">
            {/* Painel de Visualizacao */}
            <div className="flex-1 flex flex-col bg-gray-50 border-r">
              <div className="px-4 py-2 border-b bg-white flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Visualização</span>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="bg-white rounded-xl shadow-sm border p-8 min-h-full">
                  {isStreaming ? (
                    <div>
                      <div className="flex items-center gap-2 text-primary-600 mb-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Gerando pedido em tempo real...</span>
                      </div>
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: marked(streamingContent) }}
                      />
                    </div>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: marked(pedidoMarkdown) }}
                    />
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Painel de Chat */}
            <div className="w-96 flex flex-col bg-white">
              <div className="px-4 py-3 border-b bg-gradient-to-r from-primary-50 to-sky-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Assistente de Edição</p>
                    <p className="text-xs text-gray-500">Peça alterações no pedido</p>
                  </div>
                </div>
              </div>

              <ScrollArea ref={chatMessagesRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Mensagem inicial */}
                  {historicoChat.length === 0 && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-gray-100 px-4 py-3 rounded-lg max-w-[85%]">
                        <p className="text-sm text-gray-700">
                          Olá! Sou o assistente de edição. Você pode me pedir para fazer alterações no pedido de
                          cálculo, como:
                        </p>
                        <ul className="text-xs text-gray-500 mt-2 space-y-1 list-disc list-inside">
                          <li>"Corrija o período da condenação"</li>
                          <li>"Adicione observação sobre EC 113/2021"</li>
                          <li>"Altere o índice de correção monetária"</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Mensagens do chat */}
                  {historicoChat.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`px-4 py-3 rounded-lg max-w-[85%] ${
                          msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-gray-500">U</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Indicador de digitacao */}
                  {isSendingChat && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-white" />
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

              <div className="p-4 border-t bg-gray-50">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        enviarMensagemChat()
                      }
                    }}
                    placeholder="Peça uma alteração..."
                    disabled={isSendingChat || isStreaming}
                    className="flex-1"
                  />
                  <Button onClick={enviarMensagemChat} disabled={isSendingChat || isStreaming} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">Enter para enviar</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualizador de Documentos */}
      <Dialog open={showDocumentViewer} onOpenChange={setShowDocumentViewer}>
        <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <div>
              <DialogTitle>Documentos Analisados</DialogTitle>
              <p className="text-sm text-gray-500">
                {documentosBaixados.length} documento(s) - Processo {numeroCNJ}
              </p>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Lista de Documentos */}
            <div className="w-64 border-r bg-gray-50 overflow-y-auto">
              {documentosBaixados.map((doc, idx) => {
                const isOrigem = doc.processo === 'origem'
                return (
                  <button
                    key={idx}
                    onClick={() => visualizarDocumento(doc)}
                    className={`w-full text-left px-4 py-3 hover:bg-white border-b transition-colors ${
                      selectedDocument?.id === doc.id ? 'bg-white border-l-4 border-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.tipo || 'Documento'}</p>
                        <p className="text-xs text-gray-500 truncate">{doc.id}</p>
                      </div>
                      {isOrigem && <Badge variant="secondary">Origem</Badge>}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Visualizador */}
            <div className="flex-1 overflow-hidden">
              {isLoadingDocument ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
                    <p>Carregando documento...</p>
                  </div>
                </div>
              ) : documentContent ? (
                <iframe src={`data:application/pdf;base64,${documentContent}`} className="w-full h-full border-0" />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Selecione um documento para visualizar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Feedback */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center">
                <Star className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle>Como foi a experiência?</DialogTitle>
                <p className="text-sm text-gray-500">Seu feedback nos ajuda a melhorar o sistema</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((nota) => (
                <button
                  key={nota}
                  onClick={() => setNotaSelecionada(nota)}
                  className="transition-colors"
                >
                  <Star
                    className={`h-8 w-8 ${notaSelecionada && nota <= notaSelecionada ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                  />
                </button>
              ))}
            </div>

            <Textarea
              value={comentarioFeedback}
              onChange={(e) => setComentarioFeedback(e.target.value)}
              placeholder="Comentários adicionais (opcional)"
              rows={3}
            />

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowFeedback(false)}>
                Pular
              </Button>
              <Button onClick={enviarFeedback} disabled={!notaSelecionada}>
                Enviar Feedback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
