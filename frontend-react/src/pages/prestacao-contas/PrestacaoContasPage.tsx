import { useState, useEffect, useRef, useCallback } from 'react'
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
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { prestacaoContasApi, getToken } from '@/lib/api'
import { useMarkdown } from '@/hooks/useMarkdown'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentDialog } from '@/components/layout/ContentDialog'
import { C, FONT_UI, FONT_DOC } from '@/lib/designTokens'
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
  ChevronRight,
  Info,
} from 'lucide-react'
import type {
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

  // Dialog do resultado (ContentDialog)
  const [showResultDialog, setShowResultDialog] = useState(false)

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
  } = useQuery<HistoricoResponse>({
    queryKey: queryKeys.prestacaoContas.historico(),
    queryFn: () => prestacaoContasApi.get<HistoricoResponse>('/historico'),
  })

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Abre ContentDialog automaticamente quando resultado chega
  useEffect(() => {
    if (estadoPagina === 'resultado') {
      setShowResultDialog(true)
    }
  }, [estadoPagina])

  // =====================================================
  // FUNCOES DE SSE
  // =====================================================

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
        break
    }
  }, [numeroCNJ, toast, refetchHistorico])

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

      setEstadoPagina(prev => prev === 'processando' ? 'erro' : prev)
      toast({
        title: 'Erro',
        description: mensagemErro,
        variant: 'destructive',
      })
    }
  }

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

  const enviarRespostas = async () => {
    if (!geracaoId) return

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
        setGeracaoAtual(prev => prev ? {
          ...prev,
          parecer: resultado.parecer,
          fundamentacao: resultado.fundamentacao,
          irregularidades: resultado.irregularidades,
          perguntas_usuario: resultado.perguntas,
          respostas_usuario: respostas,
        } : null)

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
    setShowResultDialog(false)
  }

  // =====================================================
  // HELPERS DE RENDERIZACAO
  // =====================================================

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

  const parecerBadgeStyle = (parecer?: string): React.CSSProperties => {
    switch (parecer) {
      case 'favoravel': return { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
      case 'desfavoravel': return { background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }
      case 'duvida': return { background: C.orange100, color: '#92400e', borderColor: C.orange200 }
      default: return { background: C.gray100, color: C.text700, borderColor: C.gray200 }
    }
  }

  const parecerTexto = (parecer?: string): string => {
    switch (parecer) {
      case 'favoravel': return 'Favoravel'
      case 'desfavoravel': return 'Desfavoravel'
      case 'duvida': return 'Duvida'
      default: return 'Pendente'
    }
  }

  const parecerIcone = (parecer?: string) => {
    switch (parecer) {
      case 'favoravel': return <CheckCircle2 className="h-5 w-5" style={{ color: C.statusSuccess }} />
      case 'desfavoravel': return <XCircle className="h-5 w-5" style={{ color: C.statusError }} />
      case 'duvida': return <HelpCircle className="h-5 w-5" style={{ color: C.statusWarning }} />
      default: return <Clock className="h-5 w-5" style={{ color: C.gray400 }} />
    }
  }

  const formatarValor = (valor?: number): string => {
    if (valor === undefined || valor === null) return '-'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

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

  const renderFormulario = () => (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.navy950 }}
          >
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Analisar Prestacao de Contas</CardTitle>
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
            <Label htmlFor="numero-cnj" style={{ color: C.text700 }}>Numero do Processo (CNJ)</Label>
            <Input
              id="numero-cnj"
              value={numeroCNJ}
              onChange={(e) => setNumeroCNJ(e.target.value)}
              placeholder="0000000-00.2024.8.12.0001"
              disabled={estadoPagina === 'processando' || estadoPagina === 'verificando'}
              style={{ borderColor: C.gray200 }}
            />
            <p className="text-xs" style={{ color: C.text400 }}>
              Digite o numero completo do processo no formato CNJ
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base text-white"
            style={{ background: C.navy950 }}
            disabled={estadoPagina === 'processando' || estadoPagina === 'verificando'}
          >
            {estadoPagina === 'verificando' ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verificando...</>
            ) : estadoPagina === 'processando' ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
            ) : (
              <><Search className="mr-2 h-5 w-5" /> Analisar Prestacao de Contas</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )

  const renderInfoCard = () => (
    <Alert style={{ borderColor: C.navy200, background: C.navy50 }}>
      <Info className="h-4 w-4" style={{ color: C.navy700 }} />
      <AlertDescription>
        <p className="font-medium mb-1" style={{ color: C.navy950 }}>Como funciona?</p>
        <ul className="text-sm space-y-1" style={{ color: C.navy700 }}>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Sistema baixa o extrato da subconta automaticamente
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Identifica a peticao de prestacao de contas no processo
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Analisa notas fiscais e comprovantes anexados
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Emite parecer: Favoravel, Desfavoravel ou Duvida
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  )

  const renderProgresso = () => (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.navy950 }}
          >
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Analisando Prestacao de Contas</CardTitle>
            <CardDescription style={{ color: C.text500 }}>{progressoMensagem || 'Processando...'}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {etapas.map(etapa => (
            <div
              key={etapa.numero}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors"
              style={{
                borderColor: etapa.status === 'ativo' ? C.navy200
                  : etapa.status === 'concluido' ? '#bbf7d0'
                  : etapa.status === 'erro' ? '#fecaca'
                  : C.gray200,
                background: etapa.status === 'ativo' ? C.navy50
                  : etapa.status === 'concluido' ? '#f0fdf4'
                  : etapa.status === 'erro' ? '#fef2f2'
                  : C.gray50,
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: etapa.status === 'ativo' ? C.navy200
                    : etapa.status === 'concluido' ? '#bbf7d0'
                    : etapa.status === 'erro' ? '#fecaca'
                    : C.gray200,
                  color: etapa.status === 'ativo' ? C.navy700
                    : etapa.status === 'concluido' ? '#15803d'
                    : etapa.status === 'erro' ? '#b91c1c'
                    : C.gray400,
                }}
              >
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
                <p className="text-sm font-medium" style={{ color: C.text700 }}>
                  Etapa {etapa.numero}: {etapa.nome}
                </p>
                <p className="text-xs" style={{ color: C.text400 }}>{etapa.descricao}</p>
              </div>
              <Badge
                variant="outline"
                style={
                  etapa.status === 'concluido' ? { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
                  : etapa.status === 'ativo' ? { background: C.navy100, color: C.navy700, borderColor: C.navy200 }
                  : etapa.status === 'erro' ? { background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }
                  : { borderColor: C.gray300, color: C.text400 }
                }
              >
                {etapa.status === 'concluido' ? 'Concluido'
                  : etapa.status === 'ativo' ? 'Em andamento'
                  : etapa.status === 'erro' ? 'Erro'
                  : 'Aguardando'}
              </Badge>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: C.text400 }}>
            <span>Progresso</span>
            <span>{progressoPercent}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: C.gray200 }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progressoPercent}%`,
                background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  /** Conteudo do documento para o ContentDialog */
  const renderDocumentContent = () => {
    if (!geracaoAtual) return null
    const fundamentacaoText = geracaoAtual.fundamentacao || ''

    return (
      <div className="space-y-6">
        {/* Header do parecer */}
        <div
          className="flex items-center justify-between rounded-xl border p-4"
          style={{
            borderColor: geracaoAtual.parecer === 'favoravel' ? '#bbf7d0'
              : geracaoAtual.parecer === 'desfavoravel' ? '#fecaca'
              : C.orange200,
            background: geracaoAtual.parecer === 'favoravel' ? '#f0fdf4'
              : geracaoAtual.parecer === 'desfavoravel' ? '#fef2f2'
              : C.orange50,
          }}
        >
          <div className="flex items-center gap-3">
            {parecerIcone(geracaoAtual.parecer)}
            <div>
              <p className="font-semibold" style={{ color: C.text900 }}>
                Parecer: {parecerTexto(geracaoAtual.parecer)}
              </p>
              <p className="text-sm" style={{ color: C.text500 }}>
                {geracaoAtual.numero_cnj_formatado || geracaoAtual.numero_cnj}
              </p>
            </div>
          </div>
          <Badge variant="outline" style={parecerBadgeStyle(geracaoAtual.parecer)}>
            {parecerTexto(geracaoAtual.parecer)}
          </Badge>
        </div>

        {/* Dados extraidos */}
        {(geracaoAtual.valor_bloqueado !== undefined ||
          geracaoAtual.valor_utilizado !== undefined ||
          geracaoAtual.medicamento_pedido) && (
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: C.text400 }}>
              Dados Extraidos
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {geracaoAtual.valor_bloqueado !== undefined && geracaoAtual.valor_bloqueado !== null && (
                <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                  <p className="text-xs" style={{ color: C.text400 }}>Valor Bloqueado</p>
                  <p className="text-sm font-semibold" style={{ color: C.text900 }}>{formatarValor(geracaoAtual.valor_bloqueado)}</p>
                </div>
              )}
              {geracaoAtual.valor_utilizado !== undefined && geracaoAtual.valor_utilizado !== null && (
                <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                  <p className="text-xs" style={{ color: C.text400 }}>Valor Utilizado</p>
                  <p className="text-sm font-semibold" style={{ color: C.text900 }}>{formatarValor(geracaoAtual.valor_utilizado)}</p>
                </div>
              )}
              {geracaoAtual.valor_devolvido !== undefined && geracaoAtual.valor_devolvido !== null && (
                <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                  <p className="text-xs" style={{ color: C.text400 }}>Valor Devolvido</p>
                  <p className="text-sm font-semibold" style={{ color: C.text900 }}>{formatarValor(geracaoAtual.valor_devolvido)}</p>
                </div>
              )}
              {geracaoAtual.medicamento_pedido && (
                <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                  <p className="text-xs" style={{ color: C.text400 }}>Medicamento Pedido</p>
                  <p className="text-sm font-semibold" style={{ color: C.text900 }}>{geracaoAtual.medicamento_pedido}</p>
                </div>
              )}
              {geracaoAtual.medicamento_comprado && (
                <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                  <p className="text-xs" style={{ color: C.text400 }}>Medicamento Comprado</p>
                  <p className="text-sm font-semibold" style={{ color: C.text900 }}>{geracaoAtual.medicamento_comprado}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fundamentacao */}
        {fundamentacaoText && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: C.navy700 }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text400 }}>
                Fundamentacao
              </p>
            </div>
            <MarkdownContent text={fundamentacaoText} />
          </div>
        )}

        {/* Irregularidades */}
        {geracaoAtual.irregularidades && geracaoAtual.irregularidades.length > 0 && (
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: '#fecaca', background: '#fef2f2' }}
          >
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: C.statusError }} />
              <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>
                Irregularidades Identificadas
              </p>
            </div>
            <ul className="space-y-2">
              {geracaoAtual.irregularidades.map((irr, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: '#b91c1c' }}>
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{irr}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  /** Feedback inline para o ContentDialog */
  const renderFeedbackSection = () => (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: C.gray200, background: 'white' }}
    >
      <p className="mb-3 text-sm font-medium" style={{ color: C.text700 }}>
        Como voce avalia este parecer?
      </p>
      <div className="flex flex-wrap gap-2">
        {([
          { value: 'correto' as const, label: 'Correto', icon: Check, bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
          { value: 'parcial' as const, label: 'Parcial', icon: AlertCircle, bg: C.orange100, color: '#92400e', border: C.orange200 },
          { value: 'incorreto' as const, label: 'Incorreto', icon: X, bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
        ]).map(opt => (
          <Button
            key={opt.value}
            type="button"
            variant="outline"
            size="sm"
            style={
              avaliacaoSelecionada === opt.value
                ? { background: opt.bg, color: opt.color, borderColor: opt.border }
                : { borderColor: C.gray200, color: C.text500 }
            }
            onClick={() => setAvaliacaoSelecionada(opt.value)}
          >
            <opt.icon className="mr-1 h-3 w-3" />
            {opt.label}
          </Button>
        ))}
      </div>

      {avaliacaoSelecionada && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={comentarioFeedback}
            onChange={(e) => setComentarioFeedback(e.target.value)}
            placeholder="Comentario opcional..."
            rows={2}
            className="text-sm"
            style={{ borderColor: C.gray200 }}
          />
          <Button
            size="sm"
            onClick={enviarFeedback}
            disabled={isEnviandoFeedback}
            style={{ background: C.navy950 }}
            className="text-white"
          >
            {isEnviandoFeedback ? (
              <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Enviando...</>
            ) : (
              <><Star className="mr-2 h-3 w-3" /> Enviar Feedback</>
            )}
          </Button>
        </div>
      )}
    </div>
  )

  const renderDuvidas = () => (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.orange200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.orange500}, ${C.orange400})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.orange500 }}
          >
            <HelpCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Esclarecimentos Necessarios</CardTitle>
            <CardDescription style={{ color: C.text500 }}>
              A IA precisa de mais informacoes para emitir o parecer. Responda as perguntas abaixo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {perguntas.map((pergunta, idx) => (
          <div key={idx} className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: C.text900 }}>
              {idx + 1}. {pergunta}
            </Label>
            <Textarea
              value={respostas[pergunta] || ''}
              onChange={(e) =>
                setRespostas(prev => ({ ...prev, [pergunta]: e.target.value }))
              }
              placeholder="Digite sua resposta..."
              rows={3}
              style={{ borderColor: C.gray200, background: 'white' }}
            />
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={enviarRespostas}
            disabled={isEnviandoRespostas}
            className="flex-1 text-white"
            style={{ background: C.navy950 }}
          >
            {isEnviandoRespostas ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Enviar Respostas</>
            )}
          </Button>
          <Button onClick={resetarParaInicio} variant="ghost" style={{ color: C.text500 }}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  const renderDocumentosFaltantes = () => (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.orange200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.orange500}, ${C.orange400})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.orange500 }}
          >
            <Upload className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Documentos Pendentes</CardTitle>
            <CardDescription style={{ color: C.text500 }}>{mensagemDocsFaltantes}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {docsFaltantes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: C.text700 }}>Documentos necessarios:</p>
            <ul className="space-y-1">
              {docsFaltantes.map((doc, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: C.orange600 }}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{doc === 'extrato_subconta' ? 'Extrato da Subconta' : doc === 'notas_fiscais' ? 'Notas Fiscais / Comprovantes' : doc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label style={{ color: C.text700 }}>Anexar documentos (PDF)</Label>
          <div
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors"
            style={{ borderColor: C.orange400, color: C.orange600 }}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.orange50 }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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

        {arquivosUpload.length > 0 && (
          <div className="rounded-xl border bg-white p-3" style={{ borderColor: C.gray200 }}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.text400 }}>
              Arquivos Selecionados ({arquivosUpload.length})
            </p>
            <ul className="space-y-1">
              {arquivosUpload.map((file, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
                  <FileText className="h-4 w-4" style={{ color: C.orange500 }} />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs" style={{ color: C.text400 }}>{(file.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={enviarDocumentos}
            disabled={isEnviandoDocs || arquivosUpload.length === 0}
            className="flex-1 text-white"
            style={{ background: C.navy950 }}
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
            style={{ borderColor: C.gray200, color: C.text700 }}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Reprocessar
          </Button>
          {geracaoAtual?.status === 'aguardando_nota_fiscal' && (
            <Button
              onClick={continuarSemNotaFiscal}
              variant="outline"
              style={{ borderColor: C.gray200, color: C.text700 }}
            >
              <ChevronRight className="mr-2 h-4 w-4" />
              Continuar sem Nota Fiscal
            </Button>
          )}
          <Button
            onClick={cancelarPorFalta}
            variant="ghost"
            style={{ color: C.statusError }}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar Analise
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  const renderErro = () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium">Erro na analise</p>
        <p className="text-sm mt-1">{geracaoAtual?.erro || progressoMensagem || 'Ocorreu um erro durante o processamento.'}</p>
        <Button
          onClick={resetarParaInicio}
          variant="outline"
          size="sm"
          className="mt-3"
          style={{ borderColor: C.gray200 }}
        >
          <RotateCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  )

  const renderHistoricoRecente = () => {
    const geracoes = historicoData?.geracoes || []

    return (
      <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: C.text900 }}>
              <History className="h-4 w-4" style={{ color: C.navy700 }} />
              Analises Recentes
            </CardTitle>
            {geracoes.length > 0 && (
              <Badge variant="outline" style={{ borderColor: C.gray300, color: C.text500 }}>
                {historicoData?.total || 0} total
              </Badge>
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
              <p className="text-sm" style={{ color: C.text400 }}>Nenhuma analise realizada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {geracoes.slice(0, 5).map(g => (
                <button
                  key={g.id}
                  onClick={() => carregarDoHistorico(g.id)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all"
                  style={{ borderColor: C.gray200 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.navy300; e.currentTarget.style.background = C.navy50 }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.background = 'transparent' }}
                >
                  {parecerIcone(g.parecer)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: C.text900 }}>
                      {g.numero_cnj_formatado || g.numero_cnj}
                    </p>
                    <p className="text-xs" style={{ color: C.text400 }}>
                      {formatarData(g.criado_em)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.status === 'erro' ? (
                      <Badge variant="outline" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }} className="text-xs">Erro</Badge>
                    ) : g.parecer ? (
                      <Badge variant="outline" className="text-xs" style={parecerBadgeStyle(g.parecer)}>
                        {parecerTexto(g.parecer)}
                      </Badge>
                    ) : g.status === 'aguardando_documentos' || g.status === 'aguardando_nota_fiscal' ? (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: C.orange200, color: C.orange600 }}>Pendente</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: C.gray300, color: C.text400 }}>{g.status}</Badge>
                    )}
                    <ChevronRight className="h-4 w-4" style={{ color: C.text400 }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderHistoricoSheet = () => {
    const geracoes = historicoData?.geracoes || []

    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" title="Historico completo" className="h-8 w-8" style={{ color: C.text500 }}>
            <History className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2" style={{ color: C.text900 }}>
              <History className="h-5 w-5" style={{ color: C.navy700 }} />
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
                <FileText className="mx-auto h-10 w-10" style={{ color: C.gray300 }} />
                <p className="mt-3" style={{ color: C.text400 }}>Nenhuma analise encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {geracoes.map(g => (
                  <button
                    key={g.id}
                    onClick={() => carregarDoHistorico(g.id)}
                    className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all"
                    style={{ borderColor: C.gray200 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.navy300; e.currentTarget.style.background = C.navy50 }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.background = 'transparent' }}
                  >
                    {parecerIcone(g.parecer)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: C.text900 }}>
                        {g.numero_cnj_formatado || g.numero_cnj}
                      </p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: C.text400 }}>
                        <span>{formatarData(g.criado_em)}</span>
                        {g.tempo_processamento_ms && (
                          <span>({(g.tempo_processamento_ms / 1000).toFixed(0)}s)</span>
                        )}
                      </div>
                      {g.erro && (
                        <p className="text-xs truncate mt-0.5" style={{ color: C.statusError }}>{g.erro}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {g.status === 'erro' ? (
                        <Badge variant="outline" className="text-xs" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Erro</Badge>
                      ) : g.parecer ? (
                        <Badge variant="outline" className="text-xs" style={parecerBadgeStyle(g.parecer)}>
                          {parecerTexto(g.parecer)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs" style={{ borderColor: C.gray300, color: C.text400 }}>{g.status}</Badge>
                      )}
                      {g.permite_anexar && (
                        <Badge variant="outline" className="text-xs" style={{ borderColor: C.orange200, color: C.orange600 }}>
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

  /** Card resumo quando ContentDialog esta fechado */
  const renderResumoResultado = () => {
    if (!geracaoAtual) return null

    return (
      <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {parecerIcone(geracaoAtual.parecer)}
              <div>
                <p className="font-semibold" style={{ color: C.text900 }}>
                  Parecer: {parecerTexto(geracaoAtual.parecer)}
                </p>
                <p className="text-sm" style={{ color: C.text500 }}>
                  {geracaoAtual.numero_cnj_formatado || geracaoAtual.numero_cnj}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowResultDialog(true)}
                className="text-white"
                style={{ background: C.navy950 }}
              >
                Ver Parecer
              </Button>
              <Button
                onClick={resetarParaInicio}
                variant="ghost"
                style={{ color: C.text500 }}
              >
                <RotateCw className="mr-2 h-4 w-4" />
                Nova Analise
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderConfirmacaoDialog = () => (
    <Dialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ color: C.text900 }}>Processo ja analisado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm" style={{ color: C.text500 }}>
            Este processo ja possui uma analise registrada.
          </p>
          {verificacaoExistente && (
            <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: C.gray200 }}>
              <p className="text-sm" style={{ color: C.text700 }}>
                <strong>Processo:</strong> {verificacaoExistente.numero_cnj_formatado}
              </p>
              <p className="text-sm" style={{ color: C.text700 }}>
                <strong>Analisado em:</strong> {verificacaoExistente.criado_em}
              </p>
              {verificacaoExistente.parecer && (
                <p className="text-sm" style={{ color: C.text700 }}>
                  <strong>Parecer:</strong>{' '}
                  <Badge variant="outline" className="text-xs" style={parecerBadgeStyle(verificacaoExistente.parecer)}>
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
              className="text-white"
              style={{ background: C.navy950 }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Ver analise existente
            </Button>
            <Button
              variant="outline"
              style={{ borderColor: C.gray200, color: C.text700 }}
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
              style={{ color: C.text500 }}
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
    <div style={{ fontFamily: FONT_UI }}>
      <BreadcrumbBar
        title="Prestacao de Contas"
        icon={<Building2 style={{ width: 14, height: 14 }} />}
        actions={renderHistoricoSheet()}
      />

      <div style={{ maxWidth: 1350, margin: '0 auto', padding: '32px 40px' }}>
        <div className="max-w-4xl mx-auto space-y-6">
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

          {estadoPagina === 'resultado' && !showResultDialog && renderResumoResultado()}

          {estadoPagina === 'duvidas' && renderDuvidas()}

          {estadoPagina === 'aguardando_documentos' && renderDocumentosFaltantes()}

          {estadoPagina === 'erro' && (
            <>
              {renderErro()}
              {renderFormulario()}
            </>
          )}
        </div>
      </div>

      {/* ContentDialog para resultado */}
      {geracaoAtual && estadoPagina === 'resultado' && (
        <ContentDialog
          open={showResultDialog}
          onOpenChange={setShowResultDialog}
          title="Parecer de Prestacao de Contas"
          subtitle={geracaoAtual.numero_cnj_formatado || geracaoAtual.numero_cnj}
          icon={<Building2 className="h-5 w-5 text-white" />}
          headerActions={
            <>
              <Button
                onClick={exportarDocx}
                size="sm"
                className="text-white/70 hover:text-white"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <Download className="mr-2 h-4 w-4" /> DOCX
              </Button>
              <Button
                onClick={() => { setShowResultDialog(false); resetarParaInicio() }}
                size="sm"
                className="text-white/70 hover:text-white"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <RotateCw className="mr-2 h-4 w-4" /> Nova Analise
              </Button>
            </>
          }
          documentContent={renderDocumentContent()}
          feedbackSection={renderFeedbackSection()}
        />
      )}

      {renderConfirmacaoDialog()}
    </div>
  )
}

function MarkdownContent({ text }: { text: string }) {
  const { html } = useMarkdown(text)
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{ color: C.text700, fontFamily: FONT_DOC }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
