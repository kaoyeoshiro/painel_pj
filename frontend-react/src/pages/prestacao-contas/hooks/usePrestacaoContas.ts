import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { prestacaoContasApi } from '@/lib/api'
import { useStreamingFetch } from '@/services/api/streaming'
import type {
  GeracaoDetalhada,
  HistoricoResponse,
  VerificacaoExistente,
  EventoSSE,
  EtapaPipeline,
  EstadoPagina,
  ResponderDuvidaResponse,
} from '@/types/prestacao-contas'

// =====================================================
// CONSTANTES
// =====================================================

const API_BASE = '/prestacao-contas/api'

export const ETAPAS_INICIAIS: EtapaPipeline[] = [
  { numero: 1, nome: 'Subconta', descricao: 'Baixando extrato da subconta', icone: 'building', status: 'aguardando' },
  { numero: 2, nome: 'XML TJ-MS', descricao: 'Consultando dados do processo', icone: 'file-code', status: 'aguardando' },
  { numero: 3, nome: 'Identificar Prestacao', descricao: 'Localizando peticao de prestacao de contas', icone: 'search', status: 'aguardando' },
  { numero: 4, nome: 'Documentos', descricao: 'Baixando notas fiscais e comprovantes', icone: 'files', status: 'aguardando' },
  { numero: 5, nome: 'Analise IA', descricao: 'Emitindo parecer', icone: 'brain', status: 'aguardando' },
]

/**
 * Hook principal que orquestra todo o estado e logica da pagina
 * de Prestacao de Contas (SSE, CRUD, duvidas, documentos, historico, feedback).
 */
export function usePrestacaoContas() {
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

  // Feedback (stars)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false)

  // Confirmacao sobrescrita
  const [showConfirmacao, setShowConfirmacao] = useState(false)
  const [verificacaoExistente, setVerificacaoExistente] = useState<VerificacaoExistente | null>(null)

  // Historico
  const {
    data: historicoData,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery<HistoricoResponse>({
    queryKey: queryKeys.prestacaoContas.historico(),
    queryFn: () => prestacaoContasApi.get<HistoricoResponse>('/historico'),
  })

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

  // Hook de streaming SSE compartilhado
  const { start: iniciarStreamSSE } = useStreamingFetch<EventoSSE>({
    onEvent: (evento) => processarEventoSSE(evento),
  })

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

  const handleFeedbackSubmit = async (data: { nota: number; comentario: string | null }) => {
    if (!geracaoId) return

    setIsSubmittingFeedback(true)
    try {
      await prestacaoContasApi.post('/feedback', {
        geracao_id: geracaoId,
        nota: data.nota,
        comentario: data.comentario || undefined,
      })

      toast({
        title: 'Obrigado!',
        description: 'Sua avaliacao foi registrada com sucesso.',
      })
      setIsFeedbackSubmitted(true)
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || 'Erro ao enviar avaliacao',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingFeedback(false)
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
    setIsFeedbackSubmitted(false)
  }

  // =====================================================
  // HELPERS DE RENDERIZACAO (parecer)
  // =====================================================

  const parecerBadgeStyle = (parecer?: string): React.CSSProperties => {
    switch (parecer) {
      case 'favoravel': return { background: C.successBgStrong, color: C.successText, borderColor: C.successBorder }
      case 'desfavoravel': return { background: C.errorBgStrong, color: C.errorText, borderColor: C.errorBorder }
      case 'duvida': return { background: C.orange100, color: C.warningText, borderColor: C.orange200 }
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

  return {
    // Estado da pagina
    estadoPagina,

    // Formulario
    numeroCNJ,
    setNumeroCNJ,

    // Progresso
    etapas,
    progressoMensagem,
    progressoPercent,

    // Resultado
    geracaoAtual,
    geracaoId,
    showResultDialog,
    setShowResultDialog,

    // Duvidas
    perguntas,
    respostas,
    setRespostas,
    isEnviandoRespostas,

    // Documentos faltantes
    docsFaltantes,
    mensagemDocsFaltantes,
    arquivosUpload,
    setArquivosUpload,
    isEnviandoDocs,
    fileInputRef,

    // Feedback (stars)
    isSubmittingFeedback,
    isFeedbackSubmitted,

    // Confirmacao
    showConfirmacao,
    setShowConfirmacao,
    verificacaoExistente,

    // Historico
    historicoData,
    isLoadingHistorico,

    // Acoes
    iniciarAnalise,
    carregarDoHistorico,
    enviarRespostas,
    enviarDocumentos,
    reprocessarComDocumentos,
    continuarSemNotaFiscal,
    cancelarPorFalta,
    exportarDocx,
    handleFeedbackSubmit,
    resetarParaInicio,

    // Helpers
    parecerBadgeStyle,
    parecerTexto,
    formatarValor,
    formatarData,
  }
}

// Re-exportar tipo de retorno do hook para uso nos componentes
import { C } from '@/lib/designTokens'
export type UsePrestacaoContasReturn = ReturnType<typeof usePrestacaoContas>
