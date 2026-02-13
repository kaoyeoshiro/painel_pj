import { useState, useEffect } from 'react'
import { createApiClient } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useMarkdown } from '@/hooks/useMarkdown'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { History, ChevronDown, ChevronRight, CheckCircle2, PlusCircle, XCircle, Eye } from 'lucide-react'
import { ActivationTracePanel } from '@/components/gerador/ActivationTracePanel'

interface Geracao {
  id: number
  numero_cnj: string
  numero_cnj_formatado: string | null
  tipo_peca: string | null
  modelo_usado: string | null
  criado_em: string
  tempo_processamento: number | null
  modo_ativacao_agente2: string | null
  modulos_ativados_det: number | null
  modulos_ativados_llm: number | null
}

interface GeracaoDetalhada extends Geracao {
  prompt_enviado: string | null
  resumo_consolidado: string | null
  conteudo_gerado: string | null
  historico_chat: Array<{ role: string; content: string }> | null
  versoes: Array<{ id: number; versao: number; conteudo: string; criado_em: string }> | null
  resultado_raw: string | null
  curadoria_humana: boolean
  curadoria_detalhes: string | null
}

interface CuradoriaModulo {
  id: number
  titulo: string
  categoria: string
  subcategoria: string | null
  conteudo: string
  origem: string
  tag: string
  tipo_decisao: string
  decisao_explicacao: string
  motivo_inclusao?: string
  motivo_exclusao?: string
  ordem?: number
  status_final: string
}

interface CuradoriaData {
  geracao_id: number
  modo: string
  metadata: {
    total_preview: number
    total_incluidos: number
    total_confirmados: number
    total_manuais: number
    total_excluidos: number
    preview_timestamp: string | null
    categorias_ordem: string[]
  }
  modulos_incluidos: CuradoriaModulo[]
  modulos_excluidos: CuradoriaModulo[]
  glossario: Record<string, string>
  explicacao_processo: {
    titulo: string
    etapas: string[]
    garantia: string
  }
}

const TIPO_PECA_LABELS: Record<string, string> = {
  contestacao: 'Contestacao',
  recurso_apelacao: 'Recurso de Apelacao',
  contrarrazoes: 'Contrarrazoes',
  parecer: 'Parecer',
  peticao_simples: 'Peticao Simples',
}

export function HistoricoGeradorPage() {
  const geradorAdminApi = createApiClient('/admin/api/gerador-pecas-admin')
  const [geracoes, setGeracoes] = useState<Geracao[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGeracao, setSelectedGeracao] = useState<GeracaoDetalhada | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [curadoriaData, setCuradoriaData] = useState<CuradoriaData | null>(null)
  const [curadoriaLoading, setCuradoriaLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadGeracoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Carrega apenas na montagem
  }, [])

  const loadGeracoes = async () => {
    try {
      setLoading(true)
      const response = await geradorAdminApi.get<Geracao[]>('/geracoes?limit=100')
      setGeracoes(response)
    } catch (error) {
      toast({
        title: 'Erro ao carregar historico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadGeracaoDetalhada = async (id: number) => {
    try {
      setDetailLoading(true)
      setCuradoriaData(null)
      const response = await geradorAdminApi.get<GeracaoDetalhada>(`/geracoes/${id}`)
      setSelectedGeracao(response)
      setDialogOpen(true)

      // Carrega curadoria em paralelo se for semi-automático
      if (response.modo_ativacao_agente2 === 'semi_automatico') {
        loadCuradoria(id)
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar detalhes',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setDetailLoading(false)
    }
  }

  const loadCuradoria = async (id: number) => {
    try {
      setCuradoriaLoading(true)
      const response = await geradorAdminApi.get<CuradoriaData>(`/geracoes/${id}/curadoria`)
      setCuradoriaData(response)
    } catch {
      // Silencioso — aba de curadoria mostrará fallback
      setCuradoriaData(null)
    } finally {
      setCuradoriaLoading(false)
    }
  }

  const getModoLabel = (modo: string | null): { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' } => {
    switch (modo) {
      case 'semi_automatico':
        return { label: 'Semi-Automatico', variant: 'warning' }
      case 'fast_path':
        return { label: 'Fast Path', variant: 'success' }
      case 'misto':
        return { label: 'Misto', variant: 'secondary' }
      case 'llm':
        return { label: 'LLM', variant: 'default' }
      default:
        return { label: 'N/A', variant: 'secondary' }
    }
  }

  const formatTempo = (segundos: number | null): string => {
    if (!segundos) return 'N/A'
    if (segundos < 60) return `${segundos.toFixed(1)}s`
    const minutos = Math.floor(segundos / 60)
    const segs = Math.floor(segundos % 60)
    return `${minutos}m ${segs}s`
  }

  const formatData = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const columns = [
    {
      accessor: 'numero_cnj',
      header: 'CNJ',
      render: (value: unknown, row: Geracao) => row.numero_cnj_formatado || value,
    },
    {
      accessor: 'tipo_peca',
      header: 'Tipo Peca',
      render: (value: unknown) => {
        const val = value as string | null
        return val ? TIPO_PECA_LABELS[val] || val : 'N/A'
      },
    },
    {
      accessor: 'modo_ativacao_agente2',
      header: 'Modo',
      render: (value: unknown) => {
        const { label, variant} = getModoLabel(value as string | null)
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      accessor: 'modelo_usado',
      header: 'Modelo',
      render: (value: unknown) => (value as string | null) || 'N/A',
    },
    {
      accessor: 'tempo_processamento',
      header: 'Tempo',
      render: (value: unknown) => formatTempo(value as number | null),
    },
    {
      accessor: 'criado_em',
      header: 'Data',
      render: (value: unknown) => formatData(value as string),
    },
  ]

  // Baixar DOCX da geração
  const handleDownloadDocx = async (id: number) => {
    try {
      const blob = await geradorAdminApi.get<Blob>(`/geracoes/${id}/download-docx`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(blob as unknown as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `geracao_${id}.docx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        title: 'Erro ao baixar DOCX',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <>
        <BreadcrumbBar
          title="Historico - Gerador de Pecas"
          icon={<History className="w-3.5 h-3.5" />}
        />
        <ContentArea>
          <Skeleton className="h-96 w-full" />
        </ContentArea>
      </>
    )
  }

  return (
    <>
      <BreadcrumbBar
        title="Historico - Gerador de Pecas"
        icon={<History className="w-3.5 h-3.5" />}
      />
      <ContentArea className="space-y-4">

      <DataTable
        data={geracoes}
        columns={columns}
        onRowClick={(row) => loadGeracaoDetalhada(row.id)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : selectedGeracao ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Detalhes da Geracao - {selectedGeracao.numero_cnj_formatado || selectedGeracao.numero_cnj}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detalhes da geracao de peca juridica
                </DialogDescription>
              </DialogHeader>

              {/* Badge curadoria e botão download */}
              <div className="flex items-center gap-3 mb-4">
                {selectedGeracao.curadoria_humana && (
                  <Badge variant="warning" data-testid="badge-curadoria">
                    Curadoria Humana
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadDocx(selectedGeracao.id)}
                  data-testid="btn-download-docx"
                >
                  Baixar DOCX
                </Button>
              </div>

              <Tabs defaultValue={selectedGeracao.modo_ativacao_agente2 === 'semi_automatico' ? 'curadoria' : 'prompt'} className="w-full">
                <TabsList className={`grid w-full ${selectedGeracao.modo_ativacao_agente2 === 'semi_automatico' ? 'grid-cols-8' : 'grid-cols-7'}`}>
                  {selectedGeracao.modo_ativacao_agente2 === 'semi_automatico' && (
                    <TabsTrigger value="curadoria">Curadoria</TabsTrigger>
                  )}
                  <TabsTrigger value="ativacao">Ativação</TabsTrigger>
                  <TabsTrigger value="prompt">Prompt</TabsTrigger>
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="minuta">Minuta</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="versoes">Versoes</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>

                {selectedGeracao.modo_ativacao_agente2 === 'semi_automatico' && (
                  <TabsContent value="curadoria">
                    {curadoriaLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-40 w-full" />
                      </div>
                    ) : curadoriaData ? (
                      <CuradoriaTab data={curadoriaData} />
                    ) : (
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm" style={{ color: C.text500 }}>
                            Dados de curadoria nao disponiveis para esta geracao.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                )}

                <TabsContent value="ativacao" className="-mx-6 -mb-4">
                  <ActivationTracePanel geracaoId={selectedGeracao.id} adminMode />
                </TabsContent>

                <TabsContent value="prompt">
                  <Card>
                    <CardContent className="pt-6">
                      <pre className="whitespace-pre-wrap text-sm p-4 rounded" style={{ background: C.gray50 }}>
                        {selectedGeracao.prompt_enviado || 'Nenhum prompt disponivel'}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="resumo">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm whitespace-pre-wrap">
                        {selectedGeracao.resumo_consolidado || 'Nenhum resumo disponivel'}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="minuta">
                  <Card>
                    <CardContent className="pt-6">
                      <MinutaContent content={selectedGeracao.conteudo_gerado} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="chat">
                  <Card>
                    <CardContent className="pt-6">
                      {selectedGeracao.historico_chat && selectedGeracao.historico_chat.length > 0 ? (
                        <div className="space-y-3">
                          {selectedGeracao.historico_chat.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                msg.role === 'user'
                                  ? 'bg-blue-50 border-l-4 border-blue-500'
                                  : 'bg-green-50 border-l-4 border-green-500'
                              }`}
                            >
                              <div className="font-semibold text-xs uppercase mb-1">
                                {msg.role === 'user' ? 'Usuario' : 'Assistente'}
                              </div>
                              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm" style={{ color: C.text500 }}>Nenhum historico de chat disponivel</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="versoes">
                  <Card>
                    <CardContent className="pt-6">
                      {selectedGeracao.versoes && selectedGeracao.versoes.length > 0 ? (
                        <div className="space-y-4">
                          {selectedGeracao.versoes.map((versao) => (
                            <div key={versao.id} className="border rounded-lg p-4">
                              <div className="flex justify-between items-center mb-2">
                                <Badge variant="outline">Versão {versao.versao}</Badge>
                                <span className="text-xs" style={{ color: C.text500 }}>
                                  {formatData(versao.criado_em)}
                                </span>
                              </div>
                              <VersaoContent content={versao.conteudo} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm" style={{ color: C.text500 }}>Nenhuma versão disponível</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="raw">
                  <Card>
                    <CardContent className="pt-6">
                      <pre className="whitespace-pre-wrap text-sm p-4 rounded overflow-auto max-h-[500px]" style={{ background: C.gray50 }}>
                        {selectedGeracao.resultado_raw || 'Sem resultado bruto disponível'}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Nota sobre curadoria — detalhes completos na aba dedicada */}

              <DialogFooter className="flex items-center justify-between">
                <div className="text-sm" style={{ color: C.text500 }}>
                  Tempo: {formatTempo(selectedGeracao.tempo_processamento)} |
                  Modelo: {selectedGeracao.modelo_usado || 'N/A'}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      </ContentArea>
    </>
  )
}

// =====================================================
// Componente de auditoria de curadoria
// =====================================================

function CuradoriaTab({ data }: { data: CuradoriaData }) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [showGlossario, setShowGlossario] = useState(false)
  const [showProcesso, setShowProcesso] = useState(false)
  const [filter, setFilter] = useState<'todos' | 'confirmados' | 'manuais' | 'excluidos'>('todos')

  const toggleModule = (key: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const { metadata, modulos_incluidos, modulos_excluidos } = data

  const confirmados = modulos_incluidos.filter(m => m.tipo_decisao === 'confirmado')
  const manuais = modulos_incluidos.filter(m => m.tipo_decisao === 'manual')

  const modulosFiltrados = filter === 'todos'
    ? [...modulos_incluidos, ...modulos_excluidos]
    : filter === 'confirmados'
      ? confirmados
      : filter === 'manuais'
        ? manuais
        : modulos_excluidos

  return (
    <div className="space-y-4">
      {/* Cards de estatisticas */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Sugestoes do Sistema"
          value={metadata.total_preview}
          icon={<Eye className="w-4 h-4" />}
          color={C.navy600}
          bgColor={C.navy50}
        />
        <StatCard
          label="Confirmados"
          value={metadata.total_confirmados}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="#16a34a"
          bgColor="#f0fdf4"
        />
        <StatCard
          label="Adicionados"
          value={metadata.total_manuais}
          icon={<PlusCircle className="w-4 h-4" />}
          color={C.orange600}
          bgColor={C.orange50}
        />
        <StatCard
          label="Removidos"
          value={metadata.total_excluidos}
          icon={<XCircle className="w-4 h-4" />}
          color="#dc2626"
          bgColor="#fef2f2"
        />
      </div>

      {/* Filtros rapidos */}
      <div className="flex gap-2">
        {([
          { key: 'todos', label: 'Todos', count: modulos_incluidos.length + modulos_excluidos.length },
          { key: 'confirmados', label: 'Confirmados', count: confirmados.length },
          { key: 'manuais', label: 'Manuais', count: manuais.length },
          { key: 'excluidos', label: 'Excluidos', count: modulos_excluidos.length },
        ] as const).map(f => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({f.count})
          </Button>
        ))}
      </div>

      {/* Lista de modulos */}
      <div className="space-y-2">
        {modulosFiltrados.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: C.text500 }}>
            Nenhum modulo neste filtro.
          </p>
        ) : (
          modulosFiltrados.map((modulo) => {
            const key = `${modulo.status_final}-${modulo.id}`
            const isExpanded = expandedModules.has(key)
            const isExcluido = modulo.status_final === 'excluido'
            const isManual = modulo.tipo_decisao === 'manual'

            return (
              <div
                key={key}
                className="border rounded-lg overflow-hidden"
                style={{
                  borderColor: isExcluido ? '#fecaca' : isManual ? C.orange200 : '#bbf7d0',
                }}
              >
                {/* Cabecalho do modulo */}
                <button
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => toggleModule(key)}
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: C.gray500 }} />
                    : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.gray500 }} />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{modulo.titulo}</span>
                      <Badge
                        variant={isExcluido ? 'destructive' : isManual ? 'warning' : 'success'}
                        className="text-xs"
                      >
                        {isExcluido ? 'Removido' : isManual ? 'Manual' : 'Confirmado'}
                      </Badge>
                      <span className="text-xs" style={{ color: C.gray500 }}>{modulo.categoria}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: C.text500 }}>
                      {modulo.decisao_explicacao}
                    </p>
                  </div>
                  {modulo.ordem && (
                    <span className="text-xs font-mono shrink-0 px-2 py-0.5 rounded" style={{ background: C.gray100, color: C.gray600 }}>
                      #{modulo.ordem}
                    </span>
                  )}
                </button>

                {/* Conteudo expandido */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t" style={{ borderColor: C.gray200 }}>
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2 flex-wrap text-xs">
                        <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: C.gray100 }}>
                          {modulo.tag}
                        </span>
                        {modulo.subcategoria && (
                          <span style={{ color: C.gray500 }}>Sub: {modulo.subcategoria}</span>
                        )}
                      </div>
                      <pre
                        className="text-xs whitespace-pre-wrap p-3 rounded max-h-60 overflow-auto"
                        style={{ background: C.gray50, color: C.text700 }}
                      >
                        {modulo.conteudo}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Secoes colapsaveis: Processo e Glossario */}
      <div className="space-y-2 pt-2">
        <button
          className="flex items-center gap-2 text-sm font-medium w-full text-left"
          style={{ color: C.navy700 }}
          onClick={() => setShowProcesso(!showProcesso)}
        >
          {showProcesso ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {data.explicacao_processo.titulo}
        </button>
        {showProcesso && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <ol className="space-y-1.5 text-sm" style={{ color: C.text700 }}>
                {(data.explicacao_processo?.etapas ?? []).map((etapa, i) => (
                  <li key={i}>{etapa}</li>
                ))}
              </ol>
              <p className="text-xs mt-3 font-medium" style={{ color: C.navy600 }}>
                {data.explicacao_processo.garantia}
              </p>
            </CardContent>
          </Card>
        )}

        <button
          className="flex items-center gap-2 text-sm font-medium w-full text-left"
          style={{ color: C.navy700 }}
          onClick={() => setShowGlossario(!showGlossario)}
        >
          {showGlossario ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Glossario de Termos
        </button>
        {showGlossario && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <dl className="space-y-2 text-sm">
                {Object.entries(data.glossario ?? {}).map(([termo, definicao]) => (
                  <div key={termo}>
                    <dt className="font-mono text-xs font-semibold" style={{ color: C.navy700 }}>{termo}</dt>
                    <dd style={{ color: C.text500 }}>{definicao}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, bgColor }: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
}) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: bgColor }}>
      <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-xs font-medium" style={{ color }}>{label}</p>
    </div>
  )
}

function MinutaContent({ content }: { content: string | null }) {
  const { html } = useMarkdown(content || 'Nenhuma minuta disponivel')

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function VersaoContent({ content }: { content: string }) {
  const { html } = useMarkdown(content)

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
