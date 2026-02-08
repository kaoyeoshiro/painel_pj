import { useState, useEffect, useMemo } from 'react'
import { createApiClient } from '@/lib/api'
import { DataTable, type ColumnDef } from '@/components/shared/DataTable'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useMarkdown } from '@/hooks/useMarkdown'

// Interfaces
interface GeracaoAdmin {
  id: number
  numero_cnj: string
  numero_cnj_formatado?: string
  status: string
  parecer?: string
  fundamentacao?: string
  modelo_usado?: string
  tempo_processamento_ms?: number
  erro?: string
  criado_em: string
  documentos_faltantes?: string[]
}

interface GeracaoDetalhada extends GeracaoAdmin {
  logs_ia: LogChamadaIA[]
  prompt_analise?: string
  resposta_ia_bruta?: string
  extrato_subconta_texto?: string
  irregularidades?: string[]
  perguntas_usuario?: string[]
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

// Helper para formatar parecer badge
function getParecerBadgeVariant(parecer?: string): 'default' | 'success' | 'destructive' | 'warning' {
  if (!parecer) return 'default'
  const p = parecer.toLowerCase()
  if (p.includes('favoravel') || p.includes('favorável')) return 'success'
  if (p.includes('desfavoravel') || p.includes('desfavorável')) return 'destructive'
  if (p.includes('duvida') || p.includes('dúvida')) return 'warning'
  return 'default'
}

// Helper para formatar status badge
function getStatusBadgeVariant(status: string): 'default' | 'success' | 'destructive' {
  const s = status.toLowerCase()
  if (s === 'success' || s === 'sucesso' || s === 'completo') return 'success'
  if (s === 'error' || s === 'erro' || s === 'falha') return 'destructive'
  return 'default'
}

// Helper para formatar tempo de processamento
function formatTempo(ms?: number): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// Helper para formatar data
function formatData(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Componente de Log Colapsável
function LogItem({ log }: { log: LogChamadaIA }) {
  const [expanded, setExpanded] = useState(false)
  const { html: promptHtml } = useMarkdown(log.prompt_enviado || '')
  const { html: respostaHtml } = useMarkdown(log.resposta_ia || '')

  return (
    <Card className="mb-2">
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={log.sucesso ? 'success' : 'destructive'}>
              {log.etapa}
            </Badge>
            {log.descricao && (
              <span className="text-sm text-muted-foreground">{log.descricao}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {log.modelo_usado && <span>{log.modelo_usado}</span>}
            {log.tempo_ms && <span>{formatTempo(log.tempo_ms)}</span>}
            <span>{expanded ? '▼' : '▶'}</span>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {log.erro && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded">
              <p className="text-sm font-medium text-destructive">Erro:</p>
              <p className="text-sm">{log.erro}</p>
            </div>
          )}
          {log.tokens_entrada !== undefined && (
            <div className="mb-4 flex gap-4 text-sm">
              <span>Tokens Entrada: <strong>{log.tokens_entrada}</strong></span>
              <span>Tokens Saída: <strong>{log.tokens_saida || 0}</strong></span>
            </div>
          )}
          {log.prompt_enviado && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Prompt Enviado:</p>
              <div
                className="p-3 bg-muted rounded text-sm overflow-auto max-h-64"
                dangerouslySetInnerHTML={{ __html: promptHtml }}
              />
            </div>
          )}
          {log.resposta_ia && (
            <div>
              <p className="text-sm font-medium mb-2">Resposta IA:</p>
              <div
                className="p-3 bg-muted rounded text-sm overflow-auto max-h-64"
                dangerouslySetInnerHTML={{ __html: respostaHtml }}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function HistoricoPrestacaoContasPage() {
  const [geracoes, setGeracoes] = useState<GeracaoAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGeracao, setSelectedGeracao] = useState<GeracaoDetalhada | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const { toast } = useToast()

  const prestacaoAdminApi = useMemo(() => createApiClient('/admin/api/prestacao-admin'), [])
  const { html: fundamentacaoHtml } = useMarkdown(selectedGeracao?.fundamentacao || '')

  // Carregar lista de gerações
  useEffect(() => {
    loadGeracoes()
  }, [])

  async function loadGeracoes() {
    try {
      setLoading(true)
      const response = await prestacaoAdminApi.get<GeracaoAdmin[]>('/geracoes?limit=200&offset=0')
      setGeracoes(response)
    } catch (error) {
      console.error('Erro ao carregar gerações:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Carregar detalhes de uma geração
  async function loadDetalhes(id: number) {
    try {
      setLoadingDetalhes(true)
      const response = await prestacaoAdminApi.get<GeracaoDetalhada>(`/geracoes/${id}`)
      setSelectedGeracao(response)
      setDialogOpen(true)
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os detalhes da geração',
        variant: 'destructive'
      })
    } finally {
      setLoadingDetalhes(false)
    }
  }

  // Definição das colunas da tabela
  const columns: ColumnDef<GeracaoAdmin>[] = [
    {
      accessor: 'numero_cnj_formatado',
      header: 'CNJ',
      render: (value, row) => (
        <span className="font-mono text-sm">
          {row.numero_cnj_formatado || row.numero_cnj}
        </span>
      )
    },
    {
      accessor: 'parecer',
      header: 'Parecer',
      render: (value, row) => {
        const parecer = row.parecer
        if (!parecer) return <span className="text-muted-foreground">-</span>
        return (
          <Badge variant={getParecerBadgeVariant(parecer)}>
            {parecer}
          </Badge>
        )
      }
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (value, row) => (
        <Badge variant={getStatusBadgeVariant(row.status)}>
          {row.status}
        </Badge>
      )
    },
    {
      accessor: 'modelo_usado',
      header: 'Modelo',
      render: (value, row) => (
        <span className="text-sm">
          {row.modelo_usado || '-'}
        </span>
      )
    },
    {
      accessor: 'tempo_processamento_ms',
      header: 'Tempo',
      render: (value, row) => (
        <span className="text-sm">
          {formatTempo(row.tempo_processamento_ms)}
        </span>
      )
    },
    {
      accessor: 'criado_em',
      header: 'Data',
      render: (value, row) => (
        <span className="text-sm">
          {formatData(row.criado_em)}
        </span>
      )
    }
  ]

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Histórico - Prestação de Contas</h1>
        <p className="text-muted-foreground mt-2">
          Visualize todas as prestações de contas geradas
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={geracoes}
          isLoading={loading}
          onRowClick={(row) => loadDetalhes(row.id)}
        />
      )}

      {/* Dialog de Detalhes */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Geração #{selectedGeracao?.id}
            </DialogTitle>
          </DialogHeader>

          {loadingDetalhes ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : selectedGeracao ? (
            <Tabs defaultValue="parecer" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="parecer">Parecer</TabsTrigger>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="logs">Logs IA</TabsTrigger>
              </TabsList>

              {/* Tab 1: Parecer */}
              <TabsContent value="parecer" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Parecer
                      {selectedGeracao.parecer && (
                        <Badge variant={getParecerBadgeVariant(selectedGeracao.parecer)}>
                          {selectedGeracao.parecer}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedGeracao.fundamentacao ? (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: fundamentacaoHtml }}
                      />
                    ) : (
                      <p className="text-muted-foreground">Sem fundamentação disponível</p>
                    )}
                  </CardContent>
                </Card>

                {selectedGeracao.irregularidades && selectedGeracao.irregularidades.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Irregularidades Detectadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedGeracao.irregularidades.map((irreg, idx) => (
                          <li key={idx} className="text-sm">{irreg}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedGeracao.erro && (
                  <Card className="border-destructive">
                    <CardHeader>
                      <CardTitle className="text-destructive">Erro</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedGeracao.erro}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab 2: Dados */}
              <TabsContent value="dados" className="space-y-4">
                {selectedGeracao.extrato_subconta_texto && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Extrato da Subconta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap">
                        {selectedGeracao.extrato_subconta_texto}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {selectedGeracao.documentos_faltantes && selectedGeracao.documentos_faltantes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Documentos Faltantes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedGeracao.documentos_faltantes.map((doc, idx) => (
                          <li key={idx} className="text-sm">{doc}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedGeracao.perguntas_usuario && selectedGeracao.perguntas_usuario.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Perguntas do Usuário</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedGeracao.perguntas_usuario.map((pergunta, idx) => (
                          <li key={idx} className="text-sm">{pergunta}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab 3: Logs IA */}
              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Logs de Chamadas à IA</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedGeracao.logs_ia && selectedGeracao.logs_ia.length > 0 ? (
                      <div className="space-y-2">
                        {selectedGeracao.logs_ia.map((log) => (
                          <LogItem key={log.id} log={log} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhum log disponível</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
