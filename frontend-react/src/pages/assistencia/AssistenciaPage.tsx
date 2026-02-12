import { useState, useCallback, useEffect } from 'react'
import { Search, Scale, Trash2, FileText, FileDown, RotateCw, Database, Clock } from 'lucide-react'
import { useMarkdown } from '@/hooks/useMarkdown'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C, FONT_DOC } from '@/lib/designTokens'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { assistenciaApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useToast } from '@/components/ui/toast'
import type {
  ConsultaRequest,
  ConsultaResponse,
  HistoricoItem,
  FeedbackRequest,
  FeedbackResponse,
} from '@/types/assistencia'

/** Tipo para o estado da tela */
type ViewState = 'inicial' | 'loading' | 'resultado' | 'erro'

/** Tipo para a avaliacao de feedback */
type TipoAvaliacao = 'correto' | 'parcial' | 'incorreto' | 'erro_ia'

export function AssistenciaPage() {
  const { toast } = useToast()

  // Estados da aplicacao
  const [viewState, setViewState] = useState<ViewState>('inicial')
  const [cnjInput, setCnjInput] = useState('')
  const [erroMensagem, setErroMensagem] = useState('')
  const [consultaAtual, setConsultaAtual] = useState<ConsultaResponse | null>(null)
  const [feedbackEnviado, setFeedbackEnviado] = useState(false)
  const [feedbackTipo, setFeedbackTipo] = useState('')

  // Query do historico
  const {
    data: historico,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
    error: historicoError,
  } = useQuery<HistoricoItem[]>({
    queryKey: queryKeys.assistencia.historico(),
    queryFn: () => assistenciaApi.get<HistoricoItem[]>('/historico'),
  })

  // Log de erro no historico
  useEffect(() => {
    if (historicoError) {
      console.error('Erro ao carregar historico:', historicoError.message)
    }
  }, [historicoError])

  /** Verifica se ja existe feedback para a consulta atual */
  const verificarFeedback = useCallback(async (consultaId: number) => {
    try {
      const feedback = await assistenciaApi.get<FeedbackResponse>(`/feedback/${consultaId}`)

      if (feedback.has_feedback) {
        setFeedbackEnviado(true)
        const tipoTexto: Record<string, string> = {
          correto: 'Analise marcada como correta',
          parcial: 'Analise marcada como parcialmente correta',
          incorreto: 'Analise marcada como incorreta',
          erro_ia: 'Reportado como erro da IA',
        }
        setFeedbackTipo(tipoTexto[feedback.avaliacao || ''] || '')
      } else {
        setFeedbackEnviado(false)
        setFeedbackTipo('')
      }
    } catch {
      setFeedbackEnviado(false)
      setFeedbackTipo('')
    }
  }, [])

  /** Consulta processo */
  const consultarProcesso = useCallback(
    async (cnj: string, forceRefresh = false) => {
      if (!cnj.trim()) {
        toast({
          title: 'Campo obrigatorio',
          description: 'Digite o numero do processo',
          variant: 'destructive',
        })
        return
      }

      setViewState('loading')
      setFeedbackEnviado(false)
      setFeedbackTipo('')

      try {
        const request: ConsultaRequest = {
          cnj: cnj.trim(),
          force: forceRefresh,
        }

        const result = await assistenciaApi.post<ConsultaResponse>('/consultar', request)
        setConsultaAtual(result)
        setViewState('resultado')

        refetchHistorico()

        if (result.consulta_id) {
          verificarFeedback(result.consulta_id)
        }

        if (result.cached) {
          toast({
            title: 'Consulta em cache',
            description: 'Dados recuperados do historico',
          })
        } else {
          toast({
            title: 'Sucesso',
            description: 'Processo consultado com sucesso',
          })
        }
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : 'Erro ao consultar processo'
        setErroMensagem(mensagem)
        setViewState('erro')
        toast({
          title: 'Erro na consulta',
          description: mensagem,
          variant: 'destructive',
        })
      }
    },
    [toast, refetchHistorico, verificarFeedback]
  )

  /** Reconsultar processo (forca refresh) */
  const reconsultarProcesso = useCallback(() => {
    if (!consultaAtual) return

    const cnj = consultaAtual.dados.numeroProcesso || cnjInput

    if (
      confirm(
        'Deseja reconsultar este processo? Isso ira buscar dados atualizados do TJ-MS e gerar um novo relatorio.'
      )
    ) {
      consultarProcesso(cnj, true)
    }
  }, [consultaAtual, cnjInput, consultarProcesso])

  /** Enviar feedback */
  const enviarFeedback = useCallback(
    async (avaliacao: TipoAvaliacao) => {
      if (!consultaAtual?.consulta_id) {
        toast({
          title: 'Erro',
          description: 'Nenhuma consulta para avaliar',
          variant: 'destructive',
        })
        return
      }

      let comentario: string | null = null

      if (avaliacao === 'incorreto' || avaliacao === 'parcial') {
        comentario = prompt('Por favor, descreva brevemente o que estava incorreto (opcional):')
      }

      try {
        const request: FeedbackRequest = {
          consulta_id: consultaAtual.consulta_id,
          avaliacao,
          comentario,
        }

        await assistenciaApi.post('/feedback', request)

        const tipoTexto: Record<string, string> = {
          correto: 'Analise marcada como correta',
          parcial: 'Analise marcada como parcialmente correta',
          incorreto: 'Analise marcada como incorreta',
          erro_ia: 'Reportado como erro da IA',
        }

        setFeedbackEnviado(true)
        setFeedbackTipo(tipoTexto[avaliacao])

        toast({
          title: 'Feedback registrado',
          description: 'Obrigado pela sua avaliacao!',
        })
      } catch (error) {
        toast({
          title: 'Erro ao enviar feedback',
          description: error instanceof Error ? error.message : 'Erro desconhecido',
          variant: 'destructive',
        })
      }
    },
    [consultaAtual, toast]
  )

  /** Excluir item do historico */
  const excluirDoHistorico = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation()

      try {
        await assistenciaApi.delete(`/historico/${id}`)
        refetchHistorico()
        toast({
          title: 'Removido',
          description: 'Item removido do historico',
        })
      } catch (error) {
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Erro ao remover',
          variant: 'destructive',
        })
      }
    },
    [toast, refetchHistorico]
  )

  /** Baixar documento (DOCX ou PDF) */
  const downloadDocumento = useCallback(
    async (formato: 'docx' | 'pdf') => {
      if (!consultaAtual?.relatorio) {
        toast({
          title: 'Erro',
          description: 'Nenhum relatorio disponivel para download',
          variant: 'destructive',
        })
        return
      }

      try {
        const cnj = consultaAtual.dados.numeroProcesso || cnjInput
        const blob = await assistenciaApi.blob('/generate-doc', {
          method: 'POST',
          body: {
            markdown_text: consultaAtual.relatorio,
            cnj,
            format: formato,
          },
        })

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `relatorio_${cnj.replace(/\D/g, '')}.${formato}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast({
          title: 'Download iniciado',
          description: `Arquivo ${formato.toUpperCase()} baixado com sucesso`,
        })
      } catch (error) {
        toast({
          title: 'Erro no download',
          description: error instanceof Error ? error.message : 'Erro ao gerar documento',
          variant: 'destructive',
        })
      }
    },
    [consultaAtual, cnjInput, toast]
  )

  /** Voltar ao estado inicial */
  const voltarInicio = useCallback(() => {
    setViewState('inicial')
    setConsultaAtual(null)
    setFeedbackEnviado(false)
    setFeedbackTipo('')
  }, [])

  /** Formata data em portugues */
  const formatarData = (dataStr: string | undefined): string => {
    if (!dataStr) return '-'
    try {
      const data = new Date(dataStr)
      return data.toLocaleDateString('pt-BR')
    } catch {
      return '-'
    }
  }

  // =====================================================
  // RENDER: Historico Sheet (painel lateral)
  // =====================================================

  function renderHistoricoSheet(): React.ReactNode {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
            style={{ color: C.text500, fontSize: 13 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Historico</span>
          </button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[440px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2" style={{ color: C.text900 }}>
              <Clock className="h-5 w-5" style={{ color: C.navy700 }} />
              Historico de Consultas
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-100px)] pr-4">
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
            ) : !historico || historico.length === 0 ? (
              <div className="py-12 text-center">
                <Scale className="mx-auto h-10 w-10" style={{ color: C.gray300 }} />
                <p className="mt-3" style={{ color: C.text400 }}>Nenhuma consulta ainda</p>
              </div>
            ) : (
              <div className="space-y-1">
                {historico.slice(0, 15).map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors cursor-pointer"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <button
                      onClick={() => {
                        setCnjInput(item.cnj)
                        consultarProcesso(item.cnj)
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ fontFamily: 'monospace', color: C.text900 }}
                      >
                        {item.cnj}
                      </p>
                      <p
                        className="text-xs truncate mt-0.5"
                        style={{ color: C.text400, fontStyle: 'italic' }}
                      >
                        {item.classe || 'Processo'}
                      </p>
                    </button>
                    <button
                      onClick={(e) => excluirDoHistorico(item.id, e)}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100"
                      style={{ color: C.statusError }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.statusError + '15' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    )
  }

  // =====================================================
  // RENDER: Estado Inicial
  // =====================================================

  function renderEstadoInicial(): React.ReactNode {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="max-w-md text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: C.navy100, color: C.navy700 }}
          >
            <Scale style={{ width: 40, height: 40 }} />
          </div>
          <h2
            className="mb-2 text-xl font-semibold"
            style={{ color: C.text900 }}
          >
            Consulta de Processos
          </h2>
          <p style={{ color: C.text500, lineHeight: 1.7 }}>
            Digite o numero CNJ do processo para consultar informacoes
            no TJ-MS e gerar um relatorio automatico com analise por IA.
          </p>
        </div>
      </div>
    )
  }

  // =====================================================
  // RENDER: Loading
  // =====================================================

  function renderLoading(): React.ReactNode {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full"
            style={{
              border: `4px solid ${C.gray200}`,
              borderTopColor: C.navy950,
            }}
          />
          <p className="font-medium" style={{ color: C.text700 }}>Consultando processo...</p>
          <p className="mt-1 text-sm" style={{ color: C.text400 }}>Isso pode levar alguns segundos</p>
        </div>
      </div>
    )
  }

  // =====================================================
  // RENDER: Erro
  // =====================================================

  function renderErro(): React.ReactNode {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="max-w-md text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: C.statusError + '15', color: C.statusError }}
          >
            <Scale style={{ width: 40, height: 40 }} />
          </div>
          <h2 className="mb-2 text-xl font-semibold" style={{ color: C.text900 }}>
            Erro na Consulta
          </h2>
          <p style={{ color: C.text500 }}>{erroMensagem}</p>
          <button
            onClick={voltarInicio}
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
            style={{ border: `1px solid ${C.gray200}`, color: C.text700 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  // =====================================================
  // RENDER: Resultado
  // =====================================================

  function renderResultado(): React.ReactNode {
    if (!consultaAtual) return null

    return (
      <div className="space-y-5">
        {/* Card header do resultado */}
        <div
          className="overflow-hidden rounded-2xl border bg-white shadow-sm"
          style={{ borderColor: C.gray200 }}
        >
          <div
            className="h-1"
            style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }}
          />
          <div className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: C.navy100, color: C.navy700 }}
                >
                  <Scale style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-lg font-bold"
                      style={{ fontFamily: 'monospace', color: C.text900 }}
                    >
                      {consultaAtual.dados.numeroProcesso || cnjInput}
                    </h3>
                    {consultaAtual.cached && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: C.navy50, color: C.navy700 }}
                      >
                        <Database style={{ width: 12, height: 12 }} />
                        Cache{' '}
                        {consultaAtual.consultado_em &&
                          `(${formatarData(consultaAtual.consultado_em)})`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: C.text400 }}>Numero do Processo</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reconsultarProcesso}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors"
                  style={{ border: `1px solid ${C.gray200}`, color: C.text700 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Reanalisar
                </button>
                <button
                  onClick={() => downloadDocumento('docx')}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: C.navy950 }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  DOCX
                </button>
                <button
                  onClick={() => downloadDocumento('pdf')}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: C.statusError }}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card do relatorio IA */}
        <div
          className="overflow-hidden rounded-2xl border bg-white shadow-sm"
          style={{ borderColor: C.gray200 }}
        >
          <div
            className="h-1"
            style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }}
          />
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Scale style={{ width: 18, height: 18, color: C.statusSuccess }} />
              <h3 className="text-base font-semibold" style={{ color: C.text900 }}>
                Analise por IA
              </h3>
            </div>
            {consultaAtual.relatorio ? (
              <MarkdownContent text={consultaAtual.relatorio} />
            ) : (
              <p style={{ color: C.text400, fontStyle: 'italic' }}>Relatorio nao disponivel</p>
            )}
          </div>
        </div>

        {/* Card de feedback */}
        <div
          className="overflow-hidden rounded-2xl border bg-white shadow-sm"
          style={{ borderColor: C.gray200 }}
        >
          <div className="p-6">
            <h3 className="text-base font-semibold mb-1" style={{ color: C.text900 }}>
              Avalie a Analise da IA
            </h3>
            <p className="text-sm mb-4" style={{ color: C.text400 }}>
              Sua avaliacao nos ajuda a melhorar o sistema. Por favor, indique se a analise esta correta.
            </p>

            {!feedbackEnviado ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <button
                  onClick={() => enviarFeedback('correto')}
                  className="flex h-auto flex-col items-center gap-1.5 rounded-xl py-4 text-center font-medium transition-all"
                  style={{
                    background: C.statusSuccess + '15',
                    color: C.statusSuccess,
                    border: '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.statusSuccess }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <span className="text-xl">&#10003;</span>
                  <span className="text-sm">Correta</span>
                </button>
                <button
                  onClick={() => enviarFeedback('parcial')}
                  className="flex h-auto flex-col items-center gap-1.5 rounded-xl py-4 text-center font-medium transition-all"
                  style={{
                    background: C.statusWarning + '15',
                    color: C.statusWarning,
                    border: '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.statusWarning }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <span className="text-xl">&#9680;</span>
                  <span className="text-sm">Parcialmente</span>
                </button>
                <button
                  onClick={() => enviarFeedback('incorreto')}
                  className="flex h-auto flex-col items-center gap-1.5 rounded-xl py-4 text-center font-medium transition-all"
                  style={{
                    background: C.statusError + '15',
                    color: C.statusError,
                    border: '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.statusError }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <span className="text-xl">&#10007;</span>
                  <span className="text-sm">Incorreta</span>
                </button>
                <button
                  onClick={() => enviarFeedback('erro_ia')}
                  className="flex h-auto flex-col items-center gap-1.5 rounded-xl py-4 text-center font-medium transition-all"
                  style={{
                    background: C.gray100,
                    color: C.text500,
                    border: '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gray500 }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <span className="text-xl">&#9888;</span>
                  <span className="text-sm">Erro/Nao gerou</span>
                </button>
              </div>
            ) : (
              <div className="py-4 text-center">
                <div className="mx-auto mb-2 text-3xl" style={{ color: C.statusSuccess }}>&#10003;</div>
                <p className="font-medium" style={{ color: C.statusSuccess }}>Obrigado pelo seu feedback!</p>
                <p className="text-sm mt-1" style={{ color: C.text400 }}>{feedbackTipo}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // =====================================================
  // RENDER PRINCIPAL
  // =====================================================

  return (
    <>
      <BreadcrumbBar
        title="Assistencia Judiciaria"
        icon={<Scale className="w-3.5 h-3.5" />}
        maxWidthClass="max-w-4xl"
        actions={renderHistoricoSheet()}
      />

      <ContentArea maxWidthClass="max-w-4xl">
        <div className="space-y-6">
          {/* Formulario de consulta */}
          <div
            className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            style={{ borderColor: C.gray200 }}
          >
            <div
              className="h-1"
              style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }}
            />
            <div className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: C.navy100, color: C.navy700 }}
                >
                  <Search style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: C.text900, fontSize: 17 }}>
                    Consultar Processo
                  </h2>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: C.text500 }}
                  >
                    Numero CNJ
                  </label>
                  <input
                    value={cnjInput}
                    onChange={(e) => setCnjInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') consultarProcesso(cnjInput) }}
                    placeholder="0000000-00.0000.0.00.0000"
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-mono tracking-wide transition-colors outline-none"
                    style={{
                      border: `1px solid ${C.gray200}`,
                      color: C.text900,
                      background: C.gray50,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = C.navy500
                      e.currentTarget.style.background = 'white'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = C.gray200
                      e.currentTarget.style.background = C.gray50
                    }}
                  />
                  <p className="mt-1.5 text-xs" style={{ color: C.text400 }}>
                    Ex: 0800123-45.2024.8.12.0001
                  </p>
                </div>
                <button
                  onClick={() => consultarProcesso(cnjInput)}
                  disabled={viewState === 'loading'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  style={{ background: C.navy950 }}
                >
                  <Search style={{ width: 16, height: 16 }} />
                  Consultar
                </button>
              </div>
            </div>
          </div>

          {/* Estados condicionais */}
          {viewState === 'inicial' && renderEstadoInicial()}
          {viewState === 'loading' && renderLoading()}
          {viewState === 'erro' && renderErro()}
          {viewState === 'resultado' && renderResultado()}
        </div>
      </ContentArea>
    </>
  )
}

/** Componente para renderizar markdown com sanitizacao DOMPurify */
function MarkdownContent({ text }: { text: string }): React.ReactNode {
  const { html } = useMarkdown(text)
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{ fontFamily: FONT_DOC, color: C.text700 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
