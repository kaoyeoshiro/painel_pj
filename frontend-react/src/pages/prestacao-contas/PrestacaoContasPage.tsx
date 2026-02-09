import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { PageContainer, PageHeader } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/toast'
import { useApiQuery } from '@/hooks/useApiQuery'
import { prestacaoContasApi, getToken } from '@/lib/api'
import { useMarkdown } from '@/hooks/useMarkdown'
import {
  FileText,
  History,
  Loader2,
  Check,
  X,
  Download,
  Upload,
  Send,
  Star,
  AlertCircle,
  Search,
  Brain,
  Building2,
  FileCode,
  Files,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  MessageSquare,
  ChevronRight,
  Info,
  LayoutGrid,
} from 'lucide-react'
import type {
  GeracaoHistorico,
  GeracaoDetalhada,
  HistoricoResponse,
  VerificacaoExistente,
  EventoSSE,
  EtapaPipeline,
  EstadoPagina,
  TipoAvaliacao,
  ResponderDuvidaResponse,
} from '@/types/prestacao-contas'

// =====================================================
// CONSTANTES
// =====================================================

const API_BASE = '/prestacao-contas/api'

const ETAPAS_INICIAIS: EtapaPipeline[] = [
  { numero: 1, nome: 'Subconta', descricao: 'Baixando extrato da subconta', icone: 'building', status: 'aguardando' },
  { numero: 2, nome: 'XML TJ-MS', descricao: 'Consultando dados do processo', icone: 'file-code', status: 'aguardando' },
  { numero: 3, nome: 'Identificar Prestacao', descricao: 'Localizando peticao de prestacao de contas', icone: 'search', status: 'aguardando' },
  { numero: 4, nome: 'Documentos', descricao: 'Baixando notas fiscais e comprovantes', icone: 'files', status: 'aguardando' },
  { numero: 5, nome: 'Analise IA', descricao: 'Emitindo parecer', icone: 'brain', status: 'aguardando' },
]

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function PrestacaoContasPage() {
  const { toast } = useToast()

  // Estado da pagina (maquina de estados)
  const [estadoPagina, setEstadoPagina] = useState<EstadoPagina>('idle')

  // Formulario
  const [numeroCNJ, setNumeroCNJ] = useState('')

  // Progresso do pipeline
  const [etapas, setEtapas] = useState<EtapaPipeline[]>(ETAPAS_INICIAIS)
  const [progressoMensagem, setProgressoMensagem] = useState('')
  const [progressoPercent, setProgressoPercent] = useState(0)

  // Resultado da analise
  const [geracaoAtual, setGeracaoAtual] = useState<GeracaoDetalhada | null>(null)
  const [geracaoId, setGeracaoId] = useState<number | null>(null)

  // Duvidas da IA
  const [perguntas, setPerguntas] = useState<string[]>([])
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [isEnviandoRespostas, setIsEnviandoRespostas] = useState(false)

  // Documentos faltantes
  const [docsFaltantes, setDocsFaltantes] = useState<string[]>([])
  const [mensagemDocsFaltantes, setMensagemDocsFaltantes] = useState('')
  const [arquivosUpload, setArquivosUpload] = useState<File[]>([])
  const [isEnviandoDocs, setIsEnviandoDocs] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Feedback
  const [showFeedback, setShowFeedback] = useState(false)
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState<TipoAvaliacao | null>(null)
  const [comentarioFeedback, setComentarioFeedback] = useState('')
  const [isEnviandoFeedback, setIsEnviandoFeedback] = useState(false)

  // Confirmacao sobrescrita
  const [showConfirmacao, setShowConfirmacao] = useState(false)
  const [verificacaoExistente, setVerificacaoExistente] = useState<VerificacaoExistente | null>(null)

  // Ref para abortar stream
  const abortControllerRef = useRef<AbortController | null>(null)

  // Historico
  const {
    data: historicoData,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useApiQuery<HistoricoResponse>(() => prestacaoContasApi.get('/historico'), {
    enabled: true,
  })

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // =====================================================
  // FUNCOES DE SSE
  // =====================================================

  /** Processa um evento SSE recebido do backend */
  const processarEventoSSE = useCallback((evento: EventoSSE) => {
    switch (evento.tipo) {
      case 'inicio':
        setProgressoMensagem(evento.mensagem || 'Iniciando processamento...')
        break

      case 'etapa':
        if (evento.etapa) {
          setEtapas(prev => prev.map(e => {
            if (e.numero === evento.etapa) {
              return { ...e, status: 'ativo' }
            }
            if (e.numero < (evento.etapa || 0)) {
              return { ...e, status: 'concluido' }
            }
            return e
          }))
          setProgressoMensagem(evento.mensagem || evento.etapa_nome || '')
        }
        break

      case 'progresso':
        if (evento.progresso !== undefined) {
          setProgressoPercent(evento.progresso)
        }
        if (evento.etapa) {
          setEtapas(prev => prev.map(e =>
            e.numero === evento.etapa ? { ...e, status: 'concluido' } : e
          ))
        }
        setProgressoMensagem(evento.mensagem || '')
        break

      case 'info':
        setProgressoMensagem(evento.mensagem || '')
        break

      case 'aviso':
        toast({
          title: 'Aviso',
          description: evento.mensagem || 'Aviso durante processamento',
        })
        break

      case 'erro':
        setEstadoPagina('erro')
        setProgressoMensagem(evento.mensagem || 'Erro no processamento')
        toast({
          title: 'Erro',
          description: evento.mensagem || 'Erro durante o processamento',
          variant: 'destructive',
        })
        break

      case 'resultado':
      case 'sucesso': {
        const dados = evento.dados
        if (dados) {
          const idGeracao = dados.geracao_id as number | undefined
          if (idGeracao) {
            setGeracaoId(idGeracao)
          }

          const parecer = dados.parecer as string | undefined
          const fundamentacao = dados.fundamentacao as string | undefined
          const irregularidades = dados.irregularidades as string[] | undefined
          const perguntasIA = dados.perguntas as string[] | undefined

          // Monta objeto parcial para exibir resultado imediato
          setGeracaoAtual(prev => ({
            ...prev,
            id: idGeracao || prev?.id || 0,
            numero_cnj: prev?.numero_cnj || numeroCNJ,
            status: parecer === 'duvida' ? 'processando' : 'concluida',
            parecer,
            fundamentacao,
            irregularidades,
            perguntas_usuario: perguntasIA,
            valor_bloqueado: dados.valor_bloqueado as number | undefined,
            valor_utilizado: dados.valor_utilizado as number | undefined,
            valor_devolvido: dados.valor_devolvido as number | undefined,
            medicamento_pedido: dados.medicamento_pedido as string | undefined,
            medicamento_comprado: dados.medicamento_comprado as string | undefined,
            criado_em: prev?.criado_em || new Date().toISOString(),
          }))

          // Se tem duvidas, vai para estado de duvidas
          if (parecer === 'duvida' && perguntasIA && perguntasIA.length > 0) {
            setPerguntas(perguntasIA)
            setRespostas({})
            setEstadoPagina('duvidas')
          } else {
            setEstadoPagina('resultado')
          }

          setProgressoPercent(100)
          setEtapas(prev => prev.map(e => ({ ...e, status: 'concluido' })))
          refetchHistorico()
        }
        break
      }

      case 'solicitar_documentos': {
        const dados = evento.dados
        if (dados) {
          const idGeracao = dados.geracao_id as number | undefined
          if (idGeracao) {
            setGeracaoId(idGeracao)
          }
          setDocsFaltantes(dados.documentos_faltantes as string[] || [])
          setMensagemDocsFaltantes(dados.mensagem as string || evento.mensagem || 'Documentos necessarios nao encontrados.')
          setEstadoPagina('aguardando_documentos')
          refetchHistorico()
        }
        break
      }

      case 'fim':
        // Evento final do stream, nao precisa fazer nada especial
        break
    }
  }, [numeroCNJ, toast, refetchHistorico])

  /** Inicia leitura de stream SSE via POST */
  const iniciarStreamSSE = useCallback(async (url: string, body: Record<string, unknown>) => {
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const token = getToken()
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
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
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as EventoSSE
              processarEventoSSE(data)
            } catch (e) {
              console.warn('Erro ao parsear evento SSE:', e)
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      throw error
    } finally {
      abortControllerRef.current = null
    }
  }, [processarEventoSSE])

  // =====================================================
  // ACOES PRINCIPAIS
  // =====================================================

  /** Inicia analise de um processo */
  const iniciarAnalise = async (sobrescrever: boolean = false) => {
    const cnj = numeroCNJ.trim()
    if (!cnj) {
      toast({
        title: 'Atencao',
        description: 'Informe o numero do processo',
        variant: 'destructive',
      })
      return
    }

    // Verifica se ja existe (a nao ser que esteja sobrescrevendo)
    if (!sobrescrever) {
      try {
        setEstadoPagina('verificando')
        const verificacao = await prestacaoContasApi.get<VerificacaoExistente>(
          `/verificar-existente?numero_cnj=${encodeURIComponent(cnj)}`
        )

        if (verificacao.existe && verificacao.geracao_id) {
          setVerificacaoExistente(verificacao)
          setShowConfirmacao(true)
          setEstadoPagina('idle')
          return
        }
      } catch (error) {
        console.warn('Erro ao verificar existente:', error)
      }
    }

    // Reseta estados
    setEstadoPagina('processando')
    setEtapas(ETAPAS_INICIAIS.map(e => ({ ...e, status: 'aguardando' })))
    setProgressoMensagem('Conectando ao servidor...')
    setProgressoPercent(0)
    setGeracaoAtual(null)
    setGeracaoId(null)
    setPerguntas([])
    setRespostas({})
    setDocsFaltantes([])

    try {
      await iniciarStreamSSE(`${API_BASE}/analisar-stream`, {
        numero_cnj: cnj,
        sobrescrever_existente: sobrescrever,
      })
    } catch (error) {
      const err = error as Error
      let mensagemErro = err.message

      if (err.message.includes('502') || err.message.includes('Proxy')) {
        mensagemErro = 'Erro de conexao com o TJ-MS (502). O servidor pode estar temporariamente indisponivel.'
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        mensagemErro = 'Erro de conexao com o servidor. Verifique sua internet e tente novamente.'
      }

      // Somente atualiza se ainda estiver processando (evita sobrescrever resultado/duvidas)
      setEstadoPagina(prev => prev === 'processando' ? 'erro' : prev)
      toast({
        title: 'Erro',
        description: mensagemErro,
        variant: 'destructive',
      })
    }
  }

  /** Carrega detalhes de uma analise do historico */
  const carregarDoHistorico = async (id: number) => {
    try {
      const detalhes = await prestacaoContasApi.get<GeracaoDetalhada>(`/historico/${id}`)
      setGeracaoAtual(detalhes)
      setGeracaoId(detalhes.id)

      if (detalhes.status === 'aguardando_documentos' || detalhes.status === 'aguardando_nota_fiscal') {
        setDocsFaltantes(detalhes.documentos_faltantes || [])
        setMensagemDocsFaltantes(detalhes.mensagem_erro_usuario || 'Documentos pendentes.')
        setEstadoPagina('aguardando_documentos')
      } else if (detalhes.parecer === 'duvida' && detalhes.perguntas_usuario && detalhes.perguntas_usuario.length > 0) {
        setPerguntas(detalhes.perguntas_usuario)
        setRespostas(detalhes.respostas_usuario || {})
        setEstadoPagina('duvidas')
      } else if (detalhes.status === 'erro') {
        setEstadoPagina('erro')
      } else {
        setEstadoPagina('resultado')
      }

      if (detalhes.numero_cnj_formatado) {
        setNumeroCNJ(detalhes.numero_cnj_formatado)
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao carregar detalhes',
        variant: 'destructive',
      })
    }
  }

  /** Envia respostas das duvidas da IA */
  const enviarRespostas = async () => {
    if (!geracaoId) return

    // Valida que todas as perguntas foram respondidas
    const semResposta = perguntas.filter(p => !respostas[p]?.trim())
    if (semResposta.length > 0) {
      toast({
        title: 'Atencao',
        description: 'Responda todas as perguntas antes de enviar.',
        variant: 'destructive',
      })
      return
    }

    setIsEnviandoRespostas(true)
    try {
      const resultado = await prestacaoContasApi.post<ResponderDuvidaResponse>(
        '/responder-duvida',
        { geracao_id: geracaoId, respostas }
      )

      if (resultado.sucesso) {
        // Atualiza o estado com novo resultado
        setGeracaoAtual(prev => prev ? {
          ...prev,
          parecer: resultado.parecer,
          fundamentacao: resultado.fundamentacao,
          irregularidades: resultado.irregularidades,
          perguntas_usuario: resultado.perguntas,
          respostas_usuario: respostas,
        } : null)

        // Se ainda tem duvidas, continua no fluxo de duvidas
        if (resultado.parecer === 'duvida' && resultado.perguntas && resultado.perguntas.length > 0) {
          setPerguntas(resultado.perguntas)
          setRespostas({})
          toast({
            title: 'Novas perguntas',
            description: 'A IA tem mais perguntas para esclarecer.',
          })
        } else {
          setEstadoPagina('resultado')
          toast({
            title: 'Sucesso',
            description: 'Analise atualizada com suas respostas!',
          })
        }

        refetchHistorico()
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao enviar respostas',
        variant: 'destructive',
      })
    } finally {
      setIsEnviandoRespostas(false)
    }
  }

  /** Envia documentos faltantes */
  const enviarDocumentos = async () => {
    if (!geracaoId || arquivosUpload.length === 0) return

    setIsEnviandoDocs(true)
    try {
      const formData = new FormData()
      formData.append('geracao_id', String(geracaoId))
      formData.append('numero_cnj', numeroCNJ)
      arquivosUpload.forEach(file => {
        formData.append('arquivos', file)
      })

      const resultado = await prestacaoContasApi.post<{
        sucesso: boolean
        mensagem: string
        arquivos_processados: string[]
        estado_expirado: boolean
      }>('/upload-documentos-faltantes', formData)

      if (resultado.sucesso) {
        toast({
          title: 'Documentos enviados',
          description: resultado.mensagem,
        })
        setArquivosUpload([])
        refetchHistorico()

        // Se nao expirou, usuario pode reprocessar
        if (!resultado.estado_expirado) {
          toast({
            title: 'Reprocessar',
            description: 'Execute "Reprocessar" para continuar a analise com os novos documentos.',
          })
        }
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao enviar documentos',
        variant: 'destructive',
      })
    } finally {
      setIsEnviandoDocs(false)
    }
  }

  /** Reprocessa analise com documentos salvos */
  const reprocessarComDocumentos = async () => {
    if (!geracaoId) return

    setEstadoPagina('processando')
    setEtapas(ETAPAS_INICIAIS.map(e => ({ ...e, status: 'aguardando' })))
    setProgressoMensagem('Reprocessando com documentos salvos...')
    setProgressoPercent(0)

    try {
      await iniciarStreamSSE(`${API_BASE}/reprocessar-com-documentos`, {
        geracao_id: geracaoId,
      })
    } catch (error) {
      setEstadoPagina('erro')
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao reprocessar',
        variant: 'destructive',
      })
    }
  }

  /** Continua analise sem nota fiscal */
  const continuarSemNotaFiscal = async () => {
    if (!geracaoId) return

    setEstadoPagina('processando')
    setEtapas(ETAPAS_INICIAIS.map(e => ({ ...e, status: 'aguardando' })))
    setProgressoMensagem('Continuando analise sem nota fiscal...')
    setProgressoPercent(0)

    try {
      await iniciarStreamSSE(`${API_BASE}/continuar-sem-nota-fiscal`, {
        geracao_id: geracaoId,
      })
    } catch (error) {
      setEstadoPagina('erro')
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao continuar',
        variant: 'destructive',
      })
    }
  }

  /** Cancela analise por falta de documentos */
  const cancelarPorFalta = async () => {
    if (!geracaoId) return

    try {
      await prestacaoContasApi.post('/cancelar-por-falta-documentos', {
        geracao_id: geracaoId,
        motivo: 'Usuario optou por cancelar - documentos indisponiveis',
      })

      toast({
        title: 'Analise cancelada',
        description: 'A analise foi salva no historico com status de erro.',
      })

      resetarParaInicio()
      refetchHistorico()
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao cancelar',
        variant: 'destructive',
      })
    }
  }

  /** Exporta parecer para DOCX */
  const exportarDocx = async () => {
    if (!geracaoId) return

    try {
      const blob = await prestacaoContasApi.post<Blob>(
        '/exportar-parecer',
        { geracao_id: geracaoId },
        { responseType: 'blob' }
      )

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `parecer_${geracaoAtual?.numero_cnj || 'processo'}.docx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Sucesso',
        description: 'Parecer exportado com sucesso!',
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao exportar DOCX',
        variant: 'destructive',
      })
    }
  }

  /** Envia feedback sobre a analise */
  const enviarFeedback = async () => {
    if (!geracaoId || !avaliacaoSelecionada) return

    setIsEnviandoFeedback(true)
    try {
      await prestacaoContasApi.post('/feedback', {
        geracao_id: geracaoId,
        avaliacao: avaliacaoSelecionada,
        comentario: comentarioFeedback || undefined,
      })

      toast({
        title: 'Obrigado!',
        description: 'Seu feedback foi registrado com sucesso.',
      })
      setShowFeedback(false)
      setAvaliacaoSelecionada(null)
      setComentarioFeedback('')
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao enviar feedback',
        variant: 'destructive',
      })
    } finally {
      setIsEnviandoFeedback(false)
    }
  }

  /** Reseta para o estado inicial */
  const resetarParaInicio = () => {
    setEstadoPagina('idle')
    setNumeroCNJ('')
    setGeracaoAtual(null)
    setGeracaoId(null)
    setPerguntas([])
    setRespostas({})
    setDocsFaltantes([])
    setArquivosUpload([])
    setEtapas(ETAPAS_INICIAIS)
    setProgressoMensagem('')
    setProgressoPercent(0)
  }

  // =====================================================
  // HELPERS DE RENDERIZACAO
  // =====================================================

  /** Retorna icone da etapa */
  const renderEtapaIcone = (etapa: EtapaPipeline) => {
    const iconClass = 'h-4 w-4'
    switch (etapa.numero) {
      case 1: return <Building2 className={iconClass} />
      case 2: return <FileCode className={iconClass} />
      case 3: return <Search className={iconClass} />
      case 4: return <Files className={iconClass} />
      case 5: return <Brain className={iconClass} />
      default: return <FileText className={iconClass} />
    }
  }

  /** Retorna cor do badge da etapa */
  const etapaBadgeVariant = (status: EtapaPipeline['status']): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'concluido': return 'default'
      case 'ativo': return 'secondary'
      case 'erro': return 'destructive'
      default: return 'outline'
    }
  }

  /** Retorna texto do badge da etapa */
  const etapaBadgeTexto = (status: EtapaPipeline['status']): string => {
    switch (status) {
      case 'concluido': return 'Concluido'
      case 'ativo': return 'Em andamento'
      case 'erro': return 'Erro'
      default: return 'Aguardando'
    }
  }

  /** Retorna cor do badge do parecer */
  const parecerBadgeClass = (parecer?: string): string => {
    switch (parecer) {
      case 'favoravel': return 'bg-green-100 text-green-800 border-green-200'
      case 'desfavoravel': return 'bg-red-100 text-red-800 border-red-200'
      case 'duvida': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  /** Retorna texto do parecer */
  const parecerTexto = (parecer?: string): string => {
    switch (parecer) {
      case 'favoravel': return 'Favoravel'
      case 'desfavoravel': return 'Desfavoravel'
      case 'duvida': return 'Duvida'
      default: return 'Pendente'
    }
  }

  /** Retorna icone do parecer */
  const parecerIcone = (parecer?: string) => {
    switch (parecer) {
      case 'favoravel': return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'desfavoravel': return <XCircle className="h-5 w-5 text-red-600" />
      case 'duvida': return <HelpCircle className="h-5 w-5 text-yellow-600" />
      default: return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  /** Formata valor monetario */
  const formatarValor = (valor?: number): string => {
    if (valor === undefined || valor === null) return '-'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  /** Formata data para exibicao */
  const formatarData = (data?: string): string => {
    if (!data) return '-'
    try {
      return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return data
    }
  }

  // =====================================================
  // SECOES DA PAGINA
  // =====================================================

  /** Formulario de entrada */
  const renderFormulario = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Analisar Prestação de Contas</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void iniciarAnalise()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="numero-cnj">Numero do Processo (CNJ)</Label>
            <Input
              id="numero-cnj"
              value={numeroCNJ}
              onChange={(e) => setNumeroCNJ(e.target.value)}
              placeholder="0000000-00.2024.8.12.0001"
              disabled={estadoPagina === 'processando' || estadoPagina === 'verificando'}
            />
            <p className="text-xs text-muted-foreground">
              Digite o numero completo do processo no formato CNJ
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={estadoPagina === 'processando' || estadoPagina === 'verificando'}
          >
            {estadoPagina === 'verificando' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</>
            ) : estadoPagina === 'processando' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
            ) : (
              <><Search className="mr-2 h-4 w-4" /> Analisar Prestação de Contas</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )

  /** Card informativo sobre o sistema */
  const renderInfoCard = () => (
    <Alert className="border-blue-200 bg-blue-50">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription>
        <p className="font-medium text-blue-800 mb-1">Como funciona?</p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 text-blue-500 flex-shrink-0" /> Sistema baixa o extrato da subconta automaticamente
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 text-blue-500 flex-shrink-0" /> Identifica a peticao de prestacao de contas no processo
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 text-blue-500 flex-shrink-0" /> Analisa notas fiscais e comprovantes anexados
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 text-blue-500 flex-shrink-0" /> Emite parecer: Favoravel, Desfavoravel ou Duvida
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  )

  /** Modal de progresso do processamento */
  const renderProgresso = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
          <div>
            <CardTitle>Analisando Prestacao de Contas</CardTitle>
            <CardDescription>{progressoMensagem || 'Processando...'}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Etapas do pipeline */}
        <div className="space-y-3">
          {etapas.map(etapa => (
            <div
              key={etapa.numero}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                etapa.status === 'ativo' ? 'border-sky-200 bg-sky-50' :
                etapa.status === 'concluido' ? 'border-green-200 bg-green-50' :
                etapa.status === 'erro' ? 'border-red-200 bg-red-50' :
                'border-gray-100 bg-gray-50'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                etapa.status === 'ativo' ? 'bg-sky-200 text-sky-700' :
                etapa.status === 'concluido' ? 'bg-green-200 text-green-700' :
                etapa.status === 'erro' ? 'bg-red-200 text-red-700' :
                'bg-gray-200 text-gray-400'
              }`}>
                {etapa.status === 'ativo' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : etapa.status === 'concluido' ? (
                  <Check className="h-4 w-4" />
                ) : etapa.status === 'erro' ? (
                  <X className="h-4 w-4" />
                ) : (
                  renderEtapaIcone(etapa)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700">
                  Etapa {etapa.numero}: {etapa.nome}
                </p>
                <p className="text-xs text-gray-500">{etapa.descricao}</p>
              </div>
              <Badge variant={etapaBadgeVariant(etapa.status)}>
                {etapaBadgeTexto(etapa.status)}
              </Badge>
            </div>
          ))}
        </div>

        {/* Barra de progresso */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{progressoPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-500"
              style={{ width: `${progressoPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  /** Secao de resultado da analise */
  const renderResultado = () => {
    if (!geracaoAtual) return null

    const fundamentacaoText = geracaoAtual.fundamentacao || ''

    return (
      <div className="space-y-4">
        {/* Header do resultado com parecer */}
        <Card className={`border-2 ${
          geracaoAtual.parecer === 'favoravel' ? 'border-green-300' :
          geracaoAtual.parecer === 'desfavoravel' ? 'border-red-300' :
          'border-yellow-300'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {parecerIcone(geracaoAtual.parecer)}
                <div>
                  <CardTitle>Parecer: {parecerTexto(geracaoAtual.parecer)}</CardTitle>
                  <CardDescription>
                    {geracaoAtual.numero_cnj_formatado || geracaoAtual.numero_cnj}
                  </CardDescription>
                </div>
              </div>
              <Badge className={parecerBadgeClass(geracaoAtual.parecer)}>
                {parecerTexto(geracaoAtual.parecer)}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Dados extraidos (valores) */}
        {(geracaoAtual.valor_bloqueado !== undefined ||
          geracaoAtual.valor_utilizado !== undefined ||
          geracaoAtual.medicamento_pedido) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Extraidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {geracaoAtual.valor_bloqueado !== undefined && geracaoAtual.valor_bloqueado !== null && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor Bloqueado</p>
                    <p className="text-sm font-semibold">{formatarValor(geracaoAtual.valor_bloqueado)}</p>
                  </div>
                )}
                {geracaoAtual.valor_utilizado !== undefined && geracaoAtual.valor_utilizado !== null && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor Utilizado</p>
                    <p className="text-sm font-semibold">{formatarValor(geracaoAtual.valor_utilizado)}</p>
                  </div>
                )}
                {geracaoAtual.valor_devolvido !== undefined && geracaoAtual.valor_devolvido !== null && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor Devolvido</p>
                    <p className="text-sm font-semibold">{formatarValor(geracaoAtual.valor_devolvido)}</p>
                  </div>
                )}
                {geracaoAtual.medicamento_pedido && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Medicamento Pedido</p>
                    <p className="text-sm font-semibold">{geracaoAtual.medicamento_pedido}</p>
                  </div>
                )}
                {geracaoAtual.medicamento_comprado && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Medicamento Comprado</p>
                    <p className="text-sm font-semibold">{geracaoAtual.medicamento_comprado}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fundamentacao */}
        {fundamentacaoText && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-sky-500" />
                Fundamentacao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownContent text={fundamentacaoText} />
            </CardContent>
          </Card>
        )}

        {/* Irregularidades (se desfavoravel) */}
        {geracaoAtual.irregularidades && geracaoAtual.irregularidades.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-red-800">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Irregularidades Identificadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {geracaoAtual.irregularidades.map((irr, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-red-700">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{irr}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Botoes de acao */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportarDocx} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar DOCX
          </Button>
          <Button onClick={() => setShowFeedback(true)} variant="outline">
            <MessageSquare className="mr-2 h-4 w-4" />
            Avaliar Resultado
          </Button>
          <Button onClick={resetarParaInicio} variant="ghost">
            <RotateCw className="mr-2 h-4 w-4" />
            Nova Analise
          </Button>
        </div>
      </div>
    )
  }

  /** Secao de duvidas (perguntas da IA) */
  const renderDuvidas = () => (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500">
            <HelpCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Esclarecimentos Necessarios</CardTitle>
            <CardDescription>
              A IA precisa de mais informacoes para emitir o parecer. Responda as perguntas abaixo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {perguntas.map((pergunta, idx) => (
          <div key={idx} className="space-y-2">
            <Label className="text-sm font-medium text-yellow-800">
              {idx + 1}. {pergunta}
            </Label>
            <Textarea
              value={respostas[pergunta] || ''}
              onChange={(e) =>
                setRespostas(prev => ({ ...prev, [pergunta]: e.target.value }))
              }
              placeholder="Digite sua resposta..."
              rows={3}
              className="bg-white"
            />
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={enviarRespostas}
            disabled={isEnviandoRespostas}
            className="flex-1"
          >
            {isEnviandoRespostas ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Enviar Respostas</>
            )}
          </Button>
          <Button onClick={resetarParaInicio} variant="ghost">
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  /** Secao de documentos faltantes */
  const renderDocumentosFaltantes = () => (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500">
            <Upload className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Documentos Pendentes</CardTitle>
            <CardDescription>{mensagemDocsFaltantes}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de documentos faltantes */}
        {docsFaltantes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-800">Documentos necessarios:</p>
            <ul className="space-y-1">
              {docsFaltantes.map((doc, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{doc === 'extrato_subconta' ? 'Extrato da Subconta' : doc === 'notas_fiscais' ? 'Notas Fiscais / Comprovantes' : doc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Area de upload */}
        <div className="space-y-2">
          <Label>Anexar documentos (PDF)</Label>
          <div
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 p-6 text-amber-600 transition-colors hover:border-amber-400 hover:bg-amber-100/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-5 w-5" />
            <span className="text-sm">Clique para selecionar arquivos PDF</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setArquivosUpload(Array.from(e.target.files))
              }
            }}
          />
        </div>

        {/* Arquivos selecionados */}
        {arquivosUpload.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-white p-3">
            <p className="mb-2 text-xs font-medium uppercase text-gray-500">
              Arquivos Selecionados ({arquivosUpload.length})
            </p>
            <ul className="space-y-1">
              {arquivosUpload.map((file, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Botoes */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={enviarDocumentos}
            disabled={isEnviandoDocs || arquivosUpload.length === 0}
            className="flex-1"
          >
            {isEnviandoDocs ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Enviar Documentos</>
            )}
          </Button>
          <Button
            onClick={reprocessarComDocumentos}
            variant="outline"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Reprocessar
          </Button>
          {geracaoAtual?.status === 'aguardando_nota_fiscal' && (
            <Button
              onClick={continuarSemNotaFiscal}
              variant="outline"
            >
              <ChevronRight className="mr-2 h-4 w-4" />
              Continuar sem Nota Fiscal
            </Button>
          )}
          <Button onClick={cancelarPorFalta} variant="ghost" className="text-red-600 hover:text-red-700">
            <X className="mr-2 h-4 w-4" />
            Cancelar Analise
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  /** Secao de erro */
  const renderErro = () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium">Erro na analise</p>
        <p className="text-sm mt-1">{geracaoAtual?.erro || progressoMensagem || 'Ocorreu um erro durante o processamento.'}</p>
        <Button onClick={resetarParaInicio} variant="outline" size="sm" className="mt-3">
          <RotateCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  )

  /** Historico recente (inline) */
  const renderHistoricoRecente = () => {
    const geracoes = historicoData?.geracoes || []

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Análises Recentes
            </CardTitle>
            {geracoes.length > 0 && (
              <Badge variant="secondary">{historicoData?.total || 0} total</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistorico ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : geracoes.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma analise realizada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {geracoes.slice(0, 5).map(g => (
                <button
                  key={g.id}
                  onClick={() => carregarDoHistorico(g.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  {parecerIcone(g.parecer)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {g.numero_cnj_formatado || g.numero_cnj}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatarData(g.criado_em)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.status === 'erro' ? (
                      <Badge variant="destructive" className="text-xs">Erro</Badge>
                    ) : g.parecer ? (
                      <Badge className={`text-xs ${parecerBadgeClass(g.parecer)}`}>
                        {parecerTexto(g.parecer)}
                      </Badge>
                    ) : g.status === 'aguardando_documentos' || g.status === 'aguardando_nota_fiscal' ? (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">Pendente</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">{g.status}</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  /** Historico completo (Sheet lateral) */
  const renderHistoricoSheet = () => {
    const geracoes = historicoData?.geracoes || []

    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" title="Historico completo" className="h-8 w-8 text-gray-500">
            <History className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historico de Analises
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
            {isLoadingHistorico ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : geracoes.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-muted-foreground">Nenhuma analise encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {geracoes.map(g => (
                  <button
                    key={g.id}
                    onClick={() => carregarDoHistorico(g.id)}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                  >
                    {parecerIcone(g.parecer)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {g.numero_cnj_formatado || g.numero_cnj}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatarData(g.criado_em)}</span>
                        {g.tempo_processamento_ms && (
                          <span>({(g.tempo_processamento_ms / 1000).toFixed(0)}s)</span>
                        )}
                      </div>
                      {g.erro && (
                        <p className="text-xs text-red-500 truncate mt-0.5">{g.erro}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {g.status === 'erro' ? (
                        <Badge variant="destructive" className="text-xs">Erro</Badge>
                      ) : g.parecer ? (
                        <Badge className={`text-xs ${parecerBadgeClass(g.parecer)}`}>
                          {parecerTexto(g.parecer)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{g.status}</Badge>
                      )}
                      {g.permite_anexar && (
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                          Docs pendentes
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    )
  }

  /** Modal de feedback */
  const renderFeedbackDialog = () => (
    <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar Analise</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>O parecer esta correto?</Label>
            <div className="flex gap-2">
              {([
                { value: 'correto' as const, label: 'Correto', icon: Check, color: 'hover:border-green-500 hover:bg-green-50' },
                { value: 'parcial' as const, label: 'Parcial', icon: AlertCircle, color: 'hover:border-yellow-500 hover:bg-yellow-50' },
                { value: 'incorreto' as const, label: 'Incorreto', icon: X, color: 'hover:border-red-500 hover:bg-red-50' },
              ]).map(opt => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={avaliacaoSelecionada === opt.value ? 'default' : 'outline'}
                  className={`flex-1 ${avaliacaoSelecionada !== opt.value ? opt.color : ''}`}
                  onClick={() => setAvaliacaoSelecionada(opt.value)}
                >
                  <opt.icon className="mr-1 h-4 w-4" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-comentario">Comentario (opcional)</Label>
            <Textarea
              id="feedback-comentario"
              value={comentarioFeedback}
              onChange={(e) => setComentarioFeedback(e.target.value)}
              placeholder="Descreva o que pode ser melhorado..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowFeedback(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={enviarFeedback}
              disabled={!avaliacaoSelecionada || isEnviandoFeedback}
            >
              {isEnviandoFeedback ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><Star className="mr-2 h-4 w-4" /> Enviar Feedback</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  /** Modal de confirmacao de sobrescrita */
  const renderConfirmacaoDialog = () => (
    <Dialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Processo ja analisado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Este processo ja possui uma analise registrada.
          </p>
          {verificacaoExistente && (
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm">
                <strong>Processo:</strong> {verificacaoExistente.numero_cnj_formatado}
              </p>
              <p className="text-sm">
                <strong>Analisado em:</strong> {verificacaoExistente.criado_em}
              </p>
              {verificacaoExistente.parecer && (
                <p className="text-sm">
                  <strong>Parecer:</strong>{' '}
                  <Badge className={`text-xs ${parecerBadgeClass(verificacaoExistente.parecer)}`}>
                    {parecerTexto(verificacaoExistente.parecer)}
                  </Badge>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setShowConfirmacao(false)
                if (verificacaoExistente?.geracao_id) {
                  void carregarDoHistorico(verificacaoExistente.geracao_id)
                }
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Ver analise existente
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmacao(false)
                void iniciarAnalise(true)
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Refazer analise
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowConfirmacao(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  // =====================================================
  // RENDER PRINCIPAL
  // =====================================================

  return (
    <PageContainer noPadding className="max-w-5xl px-4 sm:px-6 lg:px-8 pt-4 pb-0 space-y-6">
      <PageHeader
        title="Prestação de Contas"
        subtitle="processos de Medicamentos"
        backTo="/dashboard"
        showMobileBrand
        compactMobile
        mobileInlineActions
        className="border-b border-gray-200 pb-3 sm:border-0 sm:pb-0"
        actions={
          <div className="flex items-center gap-2">
            {renderHistoricoSheet()}
            <Link
              to="/dashboard"
              className="flex flex-col items-center justify-center text-[11px] leading-none text-gray-500 transition-colors hover:text-gray-700 sm:hidden"
            >
              <LayoutGrid className="mb-0.5 h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>
        }
      />

      {/* Conteudo principal baseado no estado */}
      {estadoPagina === 'idle' && (
        <>
          {renderFormulario()}
          {renderInfoCard()}
          {renderHistoricoRecente()}
        </>
      )}

      {estadoPagina === 'verificando' && (
        <>
          {renderFormulario()}
          {renderInfoCard()}
        </>
      )}

      {estadoPagina === 'processando' && renderProgresso()}

      {estadoPagina === 'resultado' && renderResultado()}

      {estadoPagina === 'duvidas' && renderDuvidas()}

      {estadoPagina === 'aguardando_documentos' && renderDocumentosFaltantes()}

      {estadoPagina === 'erro' && (
        <>
          {renderErro()}
          {renderFormulario()}
        </>
      )}

      {/* Dialogs */}
      {renderFeedbackDialog()}
      {renderConfirmacaoDialog()}
    </PageContainer>
  )
}

function MarkdownContent({ text }: { text: string }) {
  const { html } = useMarkdown(text)
  return (
    <div
      className="prose prose-sm max-w-none text-gray-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
