import { useState, useEffect } from 'react'
import { createApiClient } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useMarkdown } from '@/hooks/useMarkdown'

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
  const { toast } = useToast()

  useEffect(() => {
    loadGeracoes()
  }, [])

  const loadGeracoes = async () => {
    try {
      setLoading(true)
      const response = await geradorAdminApi.get<Geracao[]>('/geracoes', {
        params: { limit: 100 }
      })
      setGeracoes(response.data)
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
      const response = await geradorAdminApi.get<GeracaoDetalhada>(`/geracoes/${id}`)
      setSelectedGeracao(response.data)
      setDialogOpen(true)
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

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-4">
        <h1 className="text-2xl font-bold">Historico - Gerador de Pecas</h1>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold">Historico - Gerador de Pecas</h1>

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
              </DialogHeader>

              <Tabs defaultValue="prompt" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="prompt">Prompt</TabsTrigger>
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="minuta">Minuta</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>

                <TabsContent value="prompt">
                  <Card>
                    <CardContent className="pt-6">
                      <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">
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
                        <div className="text-sm text-gray-500">Nenhum historico de chat disponivel</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Tempo: {formatTempo(selectedGeracao.tempo_processamento)} |
                  Modelo: {selectedGeracao.modelo_usado || 'N/A'}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MinutaContent({ content }: { content: string | null }) {
  const html = useMarkdown(content || 'Nenhuma minuta disponivel')

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
