import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Search, Scale, Trash2, FileText, FileDown, RotateCw, Database } from 'lucide-react'
import { useMarkdown } from '@/hooks/useMarkdown'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { assistenciaApi } from '@/lib/api'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useToast } from '@/components/ui/toast'
import type {
  ConsultaRequest,
  ConsultaResponse,
  HistoricoItem,
  FeedbackRequest,
  FeedbackResponse,
} from '@/types/assistencia'
import { cn } from '@/lib/utils'

/** Tipo para o estado da tela */
type ViewState = 'inicial' | 'loading' | 'resultado' | 'erro'

/** Tipo para a avaliação de feedback */
type TipoAvaliacao = 'correto' | 'parcial' | 'incorreto' | 'erro_ia'

export function AssistenciaPage() {
  const { toast } = useToast()

  // Estados da aplicação
  const [viewState, setViewState] = useState<ViewState>('inicial')
  const [cnjInput, setCnjInput] = useState('')
  const [erroMensagem, setErroMensagem] = useState('')
  const [consultaAtual, setConsultaAtual] = useState<ConsultaResponse | null>(null)
  const [feedbackEnviado, setFeedbackEnviado] = useState(false)
  const [feedbackTipo, setFeedbackTipo] = useState('')

  // Query do histórico
  const {
    data: historico,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useApiQuery<HistoricoItem[]>(() => assistenciaApi.get('/historico'), {
    onError: (error) => console.error('Erro ao carregar histórico:', error),
  })

  /** Verifica se já existe feedback para a consulta atual */
  const verificarFeedback = useCallback(async (consultaId: number) => {
    try {
      const feedback = await assistenciaApi.get<FeedbackResponse>(`/feedback/${consultaId}`)

      if (feedback.has_feedback) {
        setFeedbackEnviado(true)
        const tipoTexto: Record<string, string> = {
          correto: 'Análise marcada como correta',
          parcial: 'Análise marcada como parcialmente correta',
          incorreto: 'Análise marcada como incorreta',
          erro_ia: 'Reportado como erro da IA',
        }
        setFeedbackTipo(tipoTexto[feedback.avaliacao || ''] || '')
      } else {
        setFeedbackEnviado(false)
        setFeedbackTipo('')
      }
    } catch (error) {
      // Se erro, assume que não tem feedback
      setFeedbackEnviado(false)
      setFeedbackTipo('')
    }
  }, [])

  /** Consulta processo */
  const consultarProcesso = useCallback(
    async (cnj: string, forceRefresh = false) => {
      if (!cnj.trim()) {
        toast({
          title: 'Campo obrigatório',
          description: 'Digite o número do processo',
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

        // Atualiza histórico
        refetchHistorico()

        // Verifica feedback
        if (result.consulta_id) {
          verificarFeedback(result.consulta_id)
        }

        if (result.cached) {
          toast({
            title: 'Consulta em cache',
            description: 'Dados recuperados do histórico',
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

  /** Reconsultar processo (força refresh) */
  const reconsultarProcesso = useCallback(() => {
    if (!consultaAtual) return

    const cnj = consultaAtual.dados.numeroProcesso || cnjInput

    if (
      confirm(
        'Deseja reconsultar este processo? Isso irá buscar dados atualizados do TJ-MS e gerar um novo relatório.'
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
          correto: 'Análise marcada como correta',
          parcial: 'Análise marcada como parcialmente correta',
          incorreto: 'Análise marcada como incorreta',
          erro_ia: 'Reportado como erro da IA',
        }

        setFeedbackEnviado(true)
        setFeedbackTipo(tipoTexto[avaliacao])

        toast({
          title: 'Feedback registrado',
          description: 'Obrigado pela sua avaliação!',
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

  /** Excluir item do histórico */
  const excluirDoHistorico = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation()

      try {
        await assistenciaApi.delete(`/historico/${id}`)
        refetchHistorico()
        toast({
          title: 'Removido',
          description: 'Item removido do histórico',
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
          description: 'Nenhum relatório disponível para download',
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

        // Criar link para download
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

  /** Handler para Enter no input */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      consultarProcesso(cnjInput)
    }
  }

  /** Formata data em português */
  const formatarData = (dataStr: string | undefined) => {
    if (!dataStr) return '-'
    try {
      const data = new Date(dataStr)
      return data.toLocaleDateString('pt-BR')
    } catch {
      return '-'
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => (window.location.href = '/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src="/logo/logo-pge.png" alt="PGE-MS" className="h-10 w-auto" />
          <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
            <Scale className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Assistência Judiciária</h1>
              <span className="text-xs text-gray-500">Consulta de Processos TJ-MS</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Consulta e Histórico */}
        <aside className="w-80 flex-shrink-0 border-r bg-white">
          {/* Formulário de consulta */}
          <div className="border-b p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Search className="h-4 w-4 text-primary" />
              Consultar Processo
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Número CNJ</label>
                <Input
                  value={cnjInput}
                  onChange={(e) => setCnjInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="0000000-00.0000.0.00.0000"
                  className="text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">Ex: 0800123-45.2024.8.12.0001</p>
              </div>
              <Button
                onClick={() => consultarProcesso(cnjInput)}
                className="w-full"
                disabled={viewState === 'loading'}
              >
                <Search className="mr-2 h-4 w-4" />
                Consultar
              </Button>
            </div>
          </div>

          {/* Histórico */}
          <div className="flex-1 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Histórico Recente
            </h3>
            <ScrollArea className="h-[calc(100vh-320px)]">
              {isLoadingHistorico ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : !historico || historico.length === 0 ? (
                <p className="text-sm italic text-gray-400">Nenhuma consulta ainda</p>
              ) : (
                <div className="space-y-2">
                  {historico.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-gray-100"
                    >
                      <button
                        onClick={() => {
                          setCnjInput(item.cnj)
                          consultarProcesso(item.cnj)
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="font-mono text-xs text-gray-600 group-hover:text-primary">
                          {item.cnj}
                        </div>
                        <div className="truncate text-xs text-gray-400">
                          {item.classe || 'Processo'}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => excluirDoHistorico(item.id, e)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex flex-1 flex-col overflow-hidden bg-gray-50">
          <ScrollArea className="flex-1 p-6">
            {/* Estado Inicial */}
            {viewState === 'inicial' && (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                    <Scale className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="mb-2 text-xl font-semibold text-gray-700">
                    Consulta de Processos
                  </h2>
                  <p className="text-gray-500">
                    Digite o número CNJ do processo para consultar informações no TJ-MS e gerar um
                    relatório automático com análise por IA.
                  </p>
                </div>
              </div>
            )}

            {/* Loading */}
            {viewState === 'loading' && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                  <p className="font-medium text-gray-600">Consultando processo...</p>
                  <p className="mt-1 text-sm text-gray-400">Isso pode levar alguns segundos</p>
                </div>
              </div>
            )}

            {/* Erro */}
            {viewState === 'erro' && (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100">
                    <Scale className="h-10 w-10 text-red-600" />
                  </div>
                  <h2 className="mb-2 text-xl font-semibold text-gray-700">Erro na Consulta</h2>
                  <p className="text-gray-500">{erroMensagem}</p>
                  <Button onClick={voltarInicio} variant="outline" className="mt-4">
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}

            {/* Resultado */}
            {viewState === 'resultado' && consultaAtual && (
              <div className="space-y-4">
                {/* Header do resultado */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Scale className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-mono text-lg font-bold">
                              {consultaAtual.dados.numeroProcesso || cnjInput}
                            </h3>
                            {consultaAtual.cached && (
                              <Badge variant="secondary" className="gap-1">
                                <Database className="h-3 w-3" />
                                Cache{' '}
                                {consultaAtual.consultado_em &&
                                  `(${formatarData(consultaAtual.consultado_em)})`}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">Número do Processo</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={reconsultarProcesso}
                          className="gap-1"
                        >
                          <RotateCw className="h-4 w-4" />
                          Reanalisar
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => downloadDocumento('docx')}
                          className="gap-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <FileText className="h-4 w-4" />
                          DOCX
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => downloadDocumento('pdf')}
                          className="gap-1 bg-red-600 hover:bg-red-700"
                        >
                          <FileDown className="h-4 w-4" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Relatório IA */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Scale className="h-5 w-5 text-green-500" />
                      Análise por IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consultaAtual.relatorio ? (
                      <MarkdownContent text={consultaAtual.relatorio} />
                    ) : (
                      <p className="italic text-gray-400">Relatório não disponível</p>
                    )}
                  </CardContent>
                </Card>

                {/* Feedback */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardHeader>
                    <CardTitle className="text-base">Avalie a Análise da IA</CardTitle>
                    <CardDescription>
                      Sua avaliação nos ajuda a melhorar o sistema. Por favor, indique se a análise
                      está correta.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!feedbackEnviado ? (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Button
                          variant="outline"
                          onClick={() => enviarFeedback('correto')}
                          className="flex h-auto flex-col gap-1 border-2 border-transparent bg-green-100 py-3 text-green-700 hover:border-green-400 hover:bg-green-200"
                        >
                          <span className="text-xl">✓</span>
                          <span className="text-sm font-medium">Correta</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => enviarFeedback('parcial')}
                          className="flex h-auto flex-col gap-1 border-2 border-transparent bg-yellow-100 py-3 text-yellow-700 hover:border-yellow-400 hover:bg-yellow-200"
                        >
                          <span className="text-xl">◐</span>
                          <span className="text-sm font-medium">Parcialmente</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => enviarFeedback('incorreto')}
                          className="flex h-auto flex-col gap-1 border-2 border-transparent bg-red-100 py-3 text-red-700 hover:border-red-400 hover:bg-red-200"
                        >
                          <span className="text-xl">✗</span>
                          <span className="text-sm font-medium">Incorreta</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => enviarFeedback('erro_ia')}
                          className="flex h-auto flex-col gap-1 border-2 border-transparent bg-gray-100 py-3 text-gray-700 hover:border-gray-400 hover:bg-gray-200"
                        >
                          <span className="text-xl">⚠</span>
                          <span className="text-sm font-medium">Erro/Não gerou</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <div className="mx-auto mb-2 text-3xl text-green-500">✓</div>
                        <p className="font-medium text-green-700">Obrigado pelo seu feedback!</p>
                        <p className="text-sm text-gray-500">{feedbackTipo}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </main>
      </div>
    </div>
  )
}

// Componente para renderizar markdown com sanitização DOMPurify
function MarkdownContent({ text }: { text: string }) {
  const { html } = useMarkdown(text)
  return (
    <div
      className="prose prose-sm max-w-none text-gray-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
