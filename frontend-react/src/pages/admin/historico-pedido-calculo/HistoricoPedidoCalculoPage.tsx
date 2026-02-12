/**
 * Historico - Pedido de Calculo (Admin)
 *
 * Exibe todas as geracoes de pedidos de calculo com logs de IA.
 */

import { useState, useEffect } from 'react'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@/components/shared/DataTable'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/toast'
import { pedidoCalculoAdminApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useMarkdown } from '@/hooks/useMarkdown'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { Calculator } from 'lucide-react'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface GeracaoResumo {
  id: number
  numero_cnj: string
  numero_cnj_formatado?: string
  modelo_usado?: string
  tempo_processamento?: number
  criado_em: string
  total_logs: number
  tem_erro: boolean
}

interface LogChamadaIA {
  id: number
  etapa: string
  descricao?: string
  modelo_usado?: string
  tokens_entrada?: number
  tokens_saida?: number
  tempo_ms?: number
  sucesso: boolean
  erro?: string
  criado_em: string
  prompt_enviado?: string
  resposta_ia?: string
}

interface GeracaoDetalhada extends GeracaoResumo {
  dados_processo?: Record<string, unknown>
  dados_agente1?: Record<string, unknown>
  dados_agente2?: Record<string, unknown>
  documentos_baixados?: Array<{ id: number; tipo?: string; classificacao_ia?: string }>
  conteudo_gerado?: string
  resultado_raw?: string
  logs_ia: LogChamadaIA[]
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

/** Renderiza um objeto JSON formatado */
function JsonViewer({ data }: { data: Record<string, unknown> | undefined }) {
  if (!data) {
    return <div className="text-muted-foreground text-sm">Sem dados</div>
  }

  return (
    <pre className="rounded-md bg-muted p-4 text-xs overflow-x-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

/** Renderiza logs colapsaveis */
function LogItem({ log }: { log: LogChamadaIA }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={log.sucesso ? 'default' : 'destructive'}>
                {log.sucesso ? 'Sucesso' : 'Erro'}
              </Badge>
              <span className="font-semibold text-sm">{log.etapa}</span>
            </div>
            {log.descricao && <p className="text-sm text-muted-foreground">{log.descricao}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? '↑ Fechar' : '↓ Detalhes'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          {log.modelo_usado && (
            <div>
              <span className="text-muted-foreground">Modelo: </span>
              <span className="font-mono">{log.modelo_usado}</span>
            </div>
          )}
          {log.tempo_ms != null && (
            <div>
              <span className="text-muted-foreground">Tempo: </span>
              <span>{(log.tempo_ms / 1000).toFixed(2)}s</span>
            </div>
          )}
          {log.tokens_entrada != null && (
            <div>
              <span className="text-muted-foreground">Tokens In: </span>
              <span>{log.tokens_entrada}</span>
            </div>
          )}
          {log.tokens_saida != null && (
            <div>
              <span className="text-muted-foreground">Tokens Out: </span>
              <span>{log.tokens_saida}</span>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-0">
          {log.erro && (
            <div>
              <div className="text-sm font-semibold text-destructive mb-1">Erro:</div>
              <pre className="text-xs bg-destructive/10 p-2 rounded overflow-x-auto">
                {log.erro}
              </pre>
            </div>
          )}

          {log.prompt_enviado && (
            <div>
              <div className="text-sm font-semibold mb-1">Prompt Enviado:</div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-60">
                {log.prompt_enviado}
              </pre>
            </div>
          )}

          {log.resposta_ia && (
            <div>
              <div className="text-sm font-semibold mb-1">Resposta IA:</div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-60">
                {log.resposta_ia}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

/** Modal de detalhes */
function DetalhesModal({
  geracao,
  onClose,
}: {
  geracao: GeracaoDetalhada | null
  onClose: () => void
}) {
  const { html: pedidoHtml } = useMarkdown(geracao?.conteudo_gerado ?? '')
  const [expandedView, setExpandedView] = useState<string | null>(null)

  /** Copiar conteúdo para clipboard */
  const copiarConteudo = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Fallback silencioso
    }
  }

  if (!geracao) return null

  // Modal expandido (fullscreen viewer)
  if (expandedView) {
    return (
      <Dialog open onOpenChange={() => setExpandedView(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Visualização Expandida</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copiarConteudo(expandedView)}
                data-testid="btn-copiar-expandido"
              >
                Copiar
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <pre className="text-sm bg-muted p-4 rounded whitespace-pre-wrap">
              {expandedView}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={!!geracao} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes - {geracao.numero_cnj_formatado || geracao.numero_cnj}</DialogTitle>
          <DialogDescription>
            Gerado em {new Date(geracao.criado_em).toLocaleString('pt-BR')}
            {geracao.tempo_processamento && ` • ${geracao.tempo_processamento.toFixed(1)}s`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pedido" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pedido">Pedido</TabsTrigger>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="logs">Logs IA ({geracao.logs_ia.length})</TabsTrigger>
            <TabsTrigger value="raw">Resultado Raw</TabsTrigger>
          </TabsList>

          <TabsContent value="pedido" className="flex-1 min-h-0 mt-2">
            <div className="flex gap-2 mb-2">
              {geracao.conteudo_gerado && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedView(geracao.conteudo_gerado!)}
                    data-testid="btn-expand-pedido"
                  >
                    Expandir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copiarConteudo(geracao.conteudo_gerado!)}
                    data-testid="btn-copiar-pedido"
                  >
                    Copiar
                  </Button>
                </>
              )}
            </div>
            <ScrollArea className="h-[500px] rounded-md border">
              {geracao.conteudo_gerado ? (
                <div
                  className="prose prose-sm max-w-none p-4"
                  dangerouslySetInnerHTML={{ __html: pedidoHtml }}
                />
              ) : (
                <div className="text-muted-foreground p-4">Sem conteúdo gerado</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="dados" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Dados do Processo</h3>
                  <JsonViewer data={geracao.dados_processo} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Dados Agente 1</h3>
                  <JsonViewer data={geracao.dados_agente1} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Dados Agente 2</h3>
                  <JsonViewer data={geracao.dados_agente2} />
                </div>

                {geracao.documentos_baixados && geracao.documentos_baixados.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Documentos Baixados ({geracao.documentos_baixados.length})
                    </h3>
                    <div className="space-y-2">
                      {geracao.documentos_baixados.map((doc) => (
                        <div key={doc.id} className="text-xs bg-muted p-2 rounded">
                          <span className="font-mono">ID {doc.id}</span>
                          {doc.tipo && <span className="ml-2">• {doc.tipo}</span>}
                          {doc.classificacao_ia && <span className="ml-2">• {doc.classificacao_ia}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-[500px]">
              <div className="pr-4">
                {geracao.logs_ia.length === 0 ? (
                  <div className="text-muted-foreground">Sem logs de IA</div>
                ) : (
                  geracao.logs_ia.map((log) => <LogItem key={log.id} log={log} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="flex-1 min-h-0 mt-2">
            <div className="flex gap-2 mb-2">
              {geracao.resultado_raw && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedView(geracao.resultado_raw!)}
                    data-testid="btn-expand-raw"
                  >
                    Expandir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copiarConteudo(geracao.resultado_raw!)}
                    data-testid="btn-copiar-raw"
                  >
                    Copiar
                  </Button>
                </>
              )}
            </div>
            <ScrollArea className="h-[500px] rounded-md border">
              <pre className="text-sm p-4 whitespace-pre-wrap">
                {geracao.resultado_raw || 'Sem resultado bruto disponível'}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Pagina principal
// ---------------------------------------------------------------------------

export function HistoricoPedidoCalculoPage() {
  const [selectedGeracao, setSelectedGeracao] = useState<GeracaoDetalhada | null>(null)
  const { toast } = useToast()

  // Busca lista de geracoes
  const { data: geracoes, isLoading, error: geracoesError } = useQuery<GeracaoResumo[]>({
    queryKey: queryKeys.admin.pedidoCalculoGeracoes(),
    queryFn: () => pedidoCalculoAdminApi.get<GeracaoResumo[]>('/geracoes?limit=200&offset=0'),
  })

  // Exibe toast ao ocorrer erro na query (exibe toast em caso de erro)
  useEffect(() => {
    if (geracoesError) {
      toast({
        title: 'Erro ao carregar histórico',
        description: geracoesError instanceof Error ? geracoesError.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }, [geracoesError, toast])

  // Handler ao clicar numa linha
  const handleRowClick = async (row: GeracaoResumo) => {
    try {
      const detalhes = await pedidoCalculoAdminApi.get<GeracaoDetalhada>(`/geracoes/${row.id}`)
      setSelectedGeracao(detalhes)
    } catch (err) {
      toast({
        title: 'Erro ao carregar detalhes',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // Definicao de colunas
  const columns: ColumnDef<GeracaoResumo>[] = [
    {
      accessor: 'numero_cnj_formatado',
      header: 'CNJ',
      sortable: true,
      render: (val, row) => (
        <span className="font-mono text-sm">
          {(val as string) || row.numero_cnj}
        </span>
      ),
    },
    {
      accessor: 'tem_erro',
      header: 'Status',
      render: (val) => (
        <Badge variant={val ? 'destructive' : 'default'}>
          {val ? 'Erro' : 'Sucesso'}
        </Badge>
      ),
    },
    {
      accessor: 'modelo_usado',
      header: 'Modelo',
      render: (val) => (
        <span className="text-xs font-mono">{val || '—'}</span>
      ),
    },
    {
      accessor: 'tempo_processamento',
      header: 'Tempo',
      sortable: true,
      render: (val) =>
        val != null ? `${(val as number).toFixed(1)}s` : '—',
    },
    {
      accessor: 'criado_em',
      header: 'Data',
      sortable: true,
      render: (val) =>
        new Date(val as string).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
    },
    {
      accessor: 'total_logs',
      header: 'Logs',
      render: (val) => <span className="text-muted-foreground">{val}</span>,
    },
  ]

  return (
    <>
      <BreadcrumbBar
        title="Historico - Pedido de Calculo"
        icon={<Calculator style={{ width: 14, height: 14 }} />}
      />
      <ContentArea className="space-y-6">
          <DataTable
            columns={columns}
            data={geracoes || []}
            isLoading={isLoading}
            searchable
            searchPlaceholder="Buscar por CNJ..."
            pageSize={20}
            onRowClick={handleRowClick}
            emptyMessage="Nenhuma geracao encontrada"
          />
      </ContentArea>

      <DetalhesModal geracao={selectedGeracao} onClose={() => setSelectedGeracao(null)} />
    </>
  )
}
