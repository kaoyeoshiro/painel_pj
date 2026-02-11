import { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ContentArea } from '@/components/layout/ContentArea'
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
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { pedidoCalculoApi, getToken } from '@/lib/api'
import { useMarkdown } from '@/hooks/useMarkdown'
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
  ArrowLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Bot,
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

import { C } from '@/lib/designTokens'

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
  } = useQuery<HistoricoItem[]>({
    queryKey: queryKeys.pedidoCalculo.historico(),
    queryFn: () => pedidoCalculoApi.get<HistoricoItem[]>('/historico'),
  })

  // Scroll automatico do chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [historicoChat])

  // Funcao para processar eventos SSE
  const processarEventoStream = (event: StreamEvent) => {
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
        className="flex items-center gap-3 rounded-xl border p-3 transition-colors"
        style={{
          background: status === 'ativo' ? C.navy50
            : status === 'concluido' ? '#f0fdf4'
            : status === 'erro' ? '#fef2f2'
            : C.gray50,
          borderColor: status === 'ativo' ? C.navy100
            : status === 'concluido' ? '#bbf7d0'
            : status === 'erro' ? '#fecaca'
            : C.gray100,
        }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white"
          style={{
            background: status === 'ativo' ? C.navy950
              : status === 'concluido' ? '#22c55e'
              : status === 'erro' ? '#ef4444'
              : C.gray200,
            color: status === 'aguardando' ? C.text400 : '#fff',
          }}
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
          <p className="text-sm font-medium" style={{ color: C.text700 }}>{nome}</p>
          <p style={{ fontSize: 11, color: C.text400 }}>{descricao}</p>
        </div>
        {status === 'ativo' && (
          <span className="flex-shrink-0 text-[11px] font-medium" style={{ color: C.navy600 }}>Ativo</span>
        )}
        {status === 'concluido' && (
          <span className="flex-shrink-0 text-[11px] font-medium text-emerald-600">OK</span>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ============================================================ */}
      {/* BREADCRUMB BAR — leve, subordinada ao header global          */}
      {/* ============================================================ */}
      <div className="border-b border-gray-200">
        <div className="mx-auto flex h-12 max-w-pge items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: C.text400 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100; e.currentTarget.style.color = C.text700 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text400 }}
              aria-label="Voltar ao Dashboard"
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
            </Link>
            <ChevronRight style={{ width: 14, height: 14, color: C.text400, margin: '0 4px' }} />
            <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: C.navy100, color: C.navy700 }}>
              <Calculator style={{ width: 14, height: 14 }} />
            </div>
            <span className="font-semibold" style={{ fontSize: 15, color: C.text900, marginLeft: 4 }}>Pedido de Calculo</span>
          </div>

          <div className="flex items-center gap-2">
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
                  <SheetTitle>Historico</SheetTitle>
                </SheetHeader>
                <ScrollArea className="mt-4 h-[calc(100vh-80px)]">
                  {isLoadingHistorico ? (
                    <div className="py-8 text-center">
                      <p className="text-sm" style={{ color: C.text400 }}>Carregando historico...</p>
                    </div>
                  ) : !historico || historico.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm" style={{ color: C.text400 }}>Nenhum pedido gerado ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {historico.map((item) => {
                        const numero = item.numero_cnj_formatado || item.numero_cnj || 'Processo'
                        const autor =
                          item.dados_processo?.autor ||
                          item.dados_agente1?.dados_basicos?.autor ||
                          'Pedido de Calculo'
                        const data = item.criado_em ? new Date(item.criado_em) : null

                        return (
                          <div
                            key={item.id}
                            onClick={() => carregarDoHistorico(item.id)}
                            className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"
                          >
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: C.navy100, color: C.navy700 }}>
                              <FileText className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium" style={{ color: C.text700 }}>{numero}</p>
                              <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>
                                {autor} &middot; {data ? data.toLocaleDateString('pt-BR') : '-'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <ContentArea>
          {/* Formulario Principal */}
          <div className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
            {/* Navy accent bar */}
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
            <div className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: C.navy100, color: C.navy700 }}>
                  <Calculator style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: C.text900, fontSize: 17 }}>Gerar Pedido de Calculo</h2>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  iniciarProcessamento()
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="numero-cnj" className="font-medium" style={{ color: C.text500, fontSize: 15 }}>
                    Numero do Processo (CNJ)
                  </Label>
                  <Input
                    id="numero-cnj"
                    value={numeroCNJ}
                    onChange={(e) => setNumeroCNJ(e.target.value)}
                    placeholder="0000000-00.2024.8.12.0001"
                    className="mt-2 h-11 rounded-xl border-slate-200 bg-slate-50/50 font-mono text-base tracking-wide placeholder:text-slate-300 focus:border-slate-400 focus:bg-white focus:ring-slate-400/20"
                  />
                  <p className="mt-1 text-xs" style={{ color: C.text400 }}>Digite o numero completo do processo no formato CNJ</p>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full gap-2 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: C.navy950 }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Gerar Pedido de Calculo
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Historico Recente */}
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: C.navy100, color: C.navy700 }}>
                    <History style={{ width: 18, height: 18 }} />
                  </div>
                  <h3 className="font-semibold" style={{ color: C.text700, fontSize: 15 }}>Pedidos Recentes</h3>
                </div>
              </div>

              {isLoadingHistorico ? (
                <div className="py-6 text-center">
                  <p className="text-sm" style={{ color: C.text400 }}>Carregando historico...</p>
                </div>
              ) : !historico || historico.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: C.navy100, color: C.navy600 }}>
                    <Calculator className="h-6 w-6" />
                  </div>
                  <p className="mt-4 font-medium" style={{ fontSize: 15, color: C.text500 }}>Nenhum pedido gerado ainda</p>
                  <p className="mt-1" style={{ fontSize: 13, color: C.text400 }}>Use o formulario acima para gerar seu primeiro pedido</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {historico.slice(0, 5).map((item) => {
                    const numero = item.numero_cnj_formatado || item.numero_cnj || 'Processo'
                    const autor =
                      item.dados_processo?.autor || item.dados_agente1?.dados_basicos?.autor || 'Pedido de Calculo'
                    const data = item.criado_em ? new Date(item.criado_em) : null

                    return (
                      <div
                        key={item.id}
                        onClick={() => carregarDoHistorico(item.id)}
                        className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white p-3.5 transition-all hover:shadow-sm"
                        style={{ ['--hover-border' as string]: C.gray200 }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gray200)}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: C.navy100, color: C.navy700 }}>
                          <Calculator style={{ width: 20, height: 20 }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" style={{ color: C.text900, fontSize: 14 }}>{numero}</p>
                          <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>{autor}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs" style={{ color: C.text400 }}>{data ? data.toLocaleDateString('pt-BR') : '-'}</p>
                          <p className="text-xs" style={{ color: C.gray500 }}>
                            {data ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
      </ContentArea>

      {/* Modal de Progresso */}
      <Dialog open={isProcessing} onOpenChange={setIsProcessing}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <div className="flex items-center gap-3 rounded-t-lg px-6 py-4" style={{ background: C.navy950 }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: C.orange500 }}>
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
            <DialogHeader className="flex-1 space-y-0 p-0">
              <DialogTitle style={{ color: 'rgba(255,255,255,0.95)', fontSize: 16 }}>Gerando Pedido de Calculo</DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-4 p-6">
            <p className="text-sm" style={{ color: C.text500 }}>{progressMessage}</p>

            <div className="space-y-3">
              {renderAgentStatus(1, 'Agente 1: Analise XML', 'Extraindo dados do processo')}
              {renderAgentStatus(2, 'Agente 2: Download de Documentos', 'Baixando sentencas e certidoes')}
              {renderAgentStatus(3, 'Agente 3: Extracao de Informacoes', 'Analisando sentencas e criterios')}
              {renderAgentStatus(4, 'Agente 4: Geracao do Pedido', 'Montando pedido de calculo')}
            </div>

            <div className="h-2 overflow-hidden rounded-full" style={{ background: C.gray200 }}>
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Editor */}
      <Dialog open={showEditor} onOpenChange={fecharEditor}>
        <DialogContent className="flex h-[90vh] max-w-7xl flex-col gap-0 p-0">
          {/* Header do Editor — Navy */}
          <div className="flex items-center justify-between rounded-t-lg px-6 py-4" style={{ background: C.navy950 }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: C.orange500 }}>
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.95)', fontSize: 17 }}>Pedido de Calculo</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{dadosBasicos.numero_processo || numeroCNJ}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={abrirVisualizadorDocumentos} size="sm" className="gap-2 text-white hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.12)', border: 'none' }}>
                <FolderOpen className="h-4 w-4" />
                Acessar Autos
              </Button>
              <Button onClick={baixarDocx} size="sm" className="gap-2 text-white/70 hover:bg-white/10 hover:text-white" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}>
                <Download className="h-4 w-4" />
                Baixar DOCX
              </Button>
              <Button onClick={copiarPedido} size="sm" className="gap-2 text-white/70 hover:bg-white/10 hover:text-white" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
          </div>

          {/* Conteudo Principal */}
          <div className="flex flex-1 overflow-hidden">
            {/* Painel de Visualizacao */}
            <div className="flex flex-1 flex-col border-r" style={{ background: C.gray50, borderColor: C.gray200 }}>
              <div className="flex items-center justify-between border-b bg-white px-4 py-2" style={{ borderColor: C.gray200 }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text400, letterSpacing: '0.08em' }}>Visualizacao</span>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="min-h-full rounded-xl border bg-white p-8 shadow-sm" style={{ borderColor: C.gray200 }}>
                  {isStreaming ? (
                    <div>
                      <div className="mb-4 flex items-center gap-2" style={{ color: C.navy600 }}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Gerando pedido em tempo real...</span>
                      </div>
                      <MarkdownContent text={streamingContent} />
                    </div>
                  ) : (
                    <MarkdownContent text={pedidoMarkdown} />
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Painel de Chat — Navy header */}
            <div className="flex w-96 flex-col bg-white">
              <div className="border-b px-4 py-3" style={{ background: C.navy950, borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: C.orange500 }}>
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>Assistente de Edicao</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Peca alteracoes no pedido</p>
                  </div>
                </div>
              </div>

              <ScrollArea ref={chatMessagesRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Mensagem inicial */}
                  {historicoChat.length === 0 && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: C.navy950 }}>
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="max-w-[85%] rounded-lg px-4 py-3" style={{ background: C.gray100 }}>
                        <p className="text-sm" style={{ color: C.text700 }}>
                          Ola! Sou o assistente de edicao. Voce pode me pedir para fazer alteracoes no pedido de
                          calculo, como:
                        </p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs" style={{ color: C.text400 }}>
                          <li>"Corrija o periodo da condenacao"</li>
                          <li>"Adicione observacao sobre EC 113/2021"</li>
                          <li>"Altere o indice de correcao monetaria"</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Mensagens do chat */}
                  {historicoChat.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: C.navy950 }}>
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className="max-w-[85%] rounded-lg px-4 py-3"
                        style={{
                          background: msg.role === 'user' ? C.navy950 : C.gray100,
                          color: msg.role === 'user' ? '#fff' : C.text700,
                        }}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: C.orange500 }}>
                          <span className="text-xs font-bold text-white">U</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Indicador de digitacao */}
                  {isSendingChat && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: C.navy950 }}>
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="rounded-lg px-4 py-3" style={{ background: C.gray100 }}>
                        <div className="flex gap-1">
                          <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: C.gray500 }} />
                          <div className="h-2 w-2 animate-bounce rounded-full [animation-delay:0.2s]" style={{ background: C.gray500 }} />
                          <div className="h-2 w-2 animate-bounce rounded-full [animation-delay:0.4s]" style={{ background: C.gray500 }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t p-4" style={{ background: C.gray50, borderColor: C.gray200 }}>
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
                    placeholder="Peca uma alteracao..."
                    disabled={isSendingChat || isStreaming}
                    className="flex-1"
                  />
                  <Button onClick={enviarMensagemChat} disabled={isSendingChat || isStreaming} size="icon" className="text-white" style={{ background: C.navy950 }}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-center text-xs" style={{ color: C.text400 }}>Enter para enviar</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualizador de Documentos */}
      <Dialog open={showDocumentViewer} onOpenChange={setShowDocumentViewer}>
        <DialogContent className="flex h-[90vh] max-w-7xl flex-col gap-0 p-0">
          <div className="flex items-center gap-3 rounded-t-lg px-6 py-4" style={{ background: C.navy950 }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: C.orange500 }}>
              <FolderOpen className="h-5 w-5 text-white" />
            </div>
            <DialogHeader className="flex-1 space-y-0 p-0">
              <DialogTitle style={{ color: 'rgba(255,255,255,0.95)', fontSize: 16 }}>Documentos Analisados</DialogTitle>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                {documentosBaixados.length} documento(s) - Processo {numeroCNJ}
              </p>
            </DialogHeader>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Lista de Documentos */}
            <div className="w-64 overflow-y-auto border-r" style={{ background: C.gray50, borderColor: C.gray200 }}>
              {documentosBaixados.map((doc, idx) => {
                const isOrigem = doc.processo === 'origem'
                const isSelected = selectedDocument?.id === doc.id
                return (
                  <button
                    key={idx}
                    onClick={() => visualizarDocumento(doc)}
                    className="w-full border-b px-4 py-3 text-left transition-colors hover:bg-white"
                    style={{
                      borderColor: C.gray200,
                      background: isSelected ? '#fff' : 'transparent',
                      borderLeftWidth: isSelected ? 4 : 0,
                      borderLeftColor: isSelected ? C.navy950 : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0" style={{ color: C.navy600 }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: C.text900 }}>{doc.tipo || 'Documento'}</p>
                        <p className="truncate text-xs" style={{ color: C.text400 }}>{doc.id}</p>
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
                <div className="flex h-full items-center justify-center" style={{ color: C.text400 }}>
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
                    <p>Carregando documento...</p>
                  </div>
                </div>
              ) : documentContent ? (
                <iframe src={`data:application/pdf;base64,${documentContent}`} className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full items-center justify-center" style={{ color: C.text400 }}>
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: C.navy100, color: C.navy600 }}>
                      <FileText className="h-6 w-6" />
                    </div>
                    <p style={{ fontSize: 15 }}>Selecione um documento para visualizar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Feedback */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="flex items-center gap-3 rounded-t-lg px-6 py-4" style={{ background: C.navy950 }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#f59e0b' }}>
              <Star className="h-5 w-5 text-white" />
            </div>
            <DialogHeader className="flex-1 space-y-0 p-0">
              <DialogTitle style={{ color: 'rgba(255,255,255,0.95)', fontSize: 16 }}>Como foi a experiencia?</DialogTitle>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Seu feedback nos ajuda a melhorar o sistema</p>
            </DialogHeader>
          </div>

          <div className="space-y-4 p-6">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((nota) => (
                <button
                  key={nota}
                  onClick={() => setNotaSelecionada(nota)}
                  className="transition-colors"
                >
                  <Star
                    className={`h-8 w-8 ${notaSelecionada && nota <= notaSelecionada ? 'fill-yellow-400 text-yellow-400' : ''}`}
                    style={{ color: notaSelecionada && nota <= notaSelecionada ? '#facc15' : C.gray200 }}
                  />
                </button>
              ))}
            </div>

            <Textarea
              value={comentarioFeedback}
              onChange={(e) => setComentarioFeedback(e.target.value)}
              placeholder="Comentarios adicionais (opcional)"
              rows={3}
            />

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowFeedback(false)} style={{ color: C.text400 }}>
                Pular
              </Button>
              <Button onClick={enviarFeedback} disabled={!notaSelecionada} className="text-white" style={{ background: C.navy950 }}>
                Enviar Feedback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MarkdownContent({ text }: { text: string }) {
  const { html } = useMarkdown(text)
  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
