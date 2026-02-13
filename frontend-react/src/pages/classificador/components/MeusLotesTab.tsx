/**
 * Aba "Meus Lotes" do Classificador de Documentos.
 *
 * Lista projetos existentes, permite ver detalhes, executar classificacao,
 * visualizar resultados e exportar dados.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { classificadorApi, getToken } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Projeto, CodigoDocumento, Execucao, Resultado, PageTab } from '@/types/classificador'
import { formatDate, confiancaBadgeVariant, statusBadgeVariant, triggerDownload } from '../types'

// ============================================================================
// Props
// ============================================================================

interface MeusLotesTabProps {
  onSwitchTab: (tab: PageTab) => void
}

// ============================================================================
// Componente
// ============================================================================

export function MeusLotesTab({ onSwitchTab }: MeusLotesTabProps) {
  const { toast } = useToast()
  const execEventSourceRef = useRef<EventSource | null>(null)
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null)
  const [projetoCodigos, setProjetoCodigos] = useState<CodigoDocumento[]>([])
  const [projetoExecucoes, setProjetoExecucoes] = useState<Execucao[]>([])
  const [resultadosExecucao, setResultadosExecucao] = useState<Resultado[]>([])
  const [resultadosExecucaoId, setResultadosExecucaoId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [codigosFiltro, setCodigosFiltro] = useState('')

  const { data: projetos, isLoading: projetosLoading, refetch: refetchProjetos } = useQuery<Projeto[]>({
    queryKey: queryKeys.classificador.projetos(),
    queryFn: () => classificadorApi.get<Projeto[]>('/projetos'),
  })

  const { data: execucoesEmAndamento, refetch: refetchEmAndamento } = useQuery<Execucao[]>({
    queryKey: queryKeys.classificador.execucoesEmAndamento(),
    queryFn: async () => {
      try {
        return await classificadorApi.get<Execucao[]>('/execucoes-em-andamento')
      } catch {
        // Endpoint pode retornar 404 em ambientes sem esta rota configurada.
        // Retorna array vazio para nao exibir erro ao usuario.
        return []
      }
    },
    refetchInterval: 10000,
    retry: false,
  })

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (execEventSourceRef.current) {
        execEventSourceRef.current.close()
        execEventSourceRef.current = null
      }
    }
  }, [])

  const handleOpenProjeto = useCallback(async (projeto: Projeto) => {
    setSelectedProjeto(projeto)
    setDetailLoading(true)
    setResultadosExecucao([])
    setResultadosExecucaoId(null)
    try {
      const [codigos, execucoes] = await Promise.all([
        classificadorApi.get<CodigoDocumento[]>(`/projetos/${projeto.id}/codigos`),
        classificadorApi.get<Execucao[]>(`/projetos/${projeto.id}/execucoes`),
      ])
      setProjetoCodigos(codigos)
      setProjetoExecucoes(execucoes)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar detalhes'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  const handleExecutarProjeto = useCallback(async (projetoId: number) => {
    setSelectedProjeto(null)
    toast({ title: 'Execucao iniciada', description: 'Acompanhe o progresso na aba "Novo Lote"' })
    // Close any previous EventSource
    if (execEventSourceRef.current) {
      execEventSourceRef.current.close()
    }
    const token = getToken()
    const sseUrl = `/classificador/api/projetos/${projetoId}/executar${token ? `?token=${token}` : ''}`
    const es = new EventSource(sseUrl)
    execEventSourceRef.current = es
    es.onmessage = (event: MessageEvent) => {
      if (event.data === '[DONE]') {
        es.close()
        execEventSourceRef.current = null
        refetchProjetos()
        refetchEmAndamento()
        toast({ title: 'Classificacao concluida' })
      }
    }
    es.onerror = () => {
      es.close()
      execEventSourceRef.current = null
      toast({ title: 'Erro na execucao', variant: 'destructive' })
    }
    refetchEmAndamento()
  }, [toast, refetchProjetos, refetchEmAndamento])

  const handleVerResultados = useCallback(async (execucaoId: number) => {
    try {
      const results = await classificadorApi.get<Resultado[]>(`/execucoes/${execucaoId}/resultados`)
      setResultadosExecucao(results)
      setResultadosExecucaoId(execucaoId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar resultados'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [toast])

  const handleExportResults = useCallback(async (execucaoId: number, format: 'excel' | 'csv' | 'json') => {
    try {
      const ext: Record<string, string> = { excel: 'xlsx', csv: 'csv', json: 'json' }
      const blob = await classificadorApi.blob(`/execucoes/${execucaoId}/exportar/${format}`)
      triggerDownload(blob, `resultados_${execucaoId}.${ext[format]}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [toast])

  const handleCancelarExecucao = useCallback(async (execucaoId: number) => {
    try {
      await classificadorApi.post(`/execucoes/${execucaoId}/cancelar`)
      toast({ title: 'Execucao cancelada' })
      refetchEmAndamento()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [toast, refetchEmAndamento])

  const filteredCodigos = projetoCodigos.filter(c =>
    !codigosFiltro || c.codigo.toLowerCase().includes(codigosFiltro.toLowerCase()) ||
    (c.arquivo_nome ?? '').toLowerCase().includes(codigosFiltro.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Running executions alert */}
      {execucoesEmAndamento && execucoesEmAndamento.length > 0 && (
        <Alert>
          <AlertTitle>Execucoes em andamento</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 mt-2">
              {execucoesEmAndamento.map(ex => (
                <Card key={ex.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Execucao #{ex.id}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant(ex.status)}>{ex.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {ex.arquivos_processados}/{ex.total_arquivos}
                        </span>
                      </div>
                      {ex.total_arquivos > 0 && (
                        <div className="w-48 bg-muted rounded-full h-1.5 mt-1">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${(ex.arquivos_processados / ex.total_arquivos) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleCancelarExecucao(ex.id)}>
                      Cancelar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Meus Lotes</h3>
        <Button onClick={() => onSwitchTab('novo-lote')}>Novo Lote</Button>
      </div>

      {/* Project grid */}
      {projetosLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !projetos || projetos.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum lote encontrado. Crie um novo lote para comecar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetos.map(p => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleOpenProjeto(p)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.nome}</CardTitle>
                {p.descricao && <CardDescription>{p.descricao}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{p.total_codigos ?? 0} docs</span>
                  <span>{p.total_execucoes ?? 0} execucoes</span>
                  <span>{p.modelo}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Criado em {formatDate(p.criado_em)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project detail dialog */}
      <Dialog open={selectedProjeto !== null} onOpenChange={(open) => { if (!open) setSelectedProjeto(null) }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedProjeto && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProjeto.nome}</DialogTitle>
                {selectedProjeto.descricao && (
                  <DialogDescription>{selectedProjeto.descricao}</DialogDescription>
                )}
              </DialogHeader>

              {/* Config summary */}
              <div className="space-y-2 text-sm">
                <p><strong>Modelo:</strong> {selectedProjeto.modelo}</p>
                <p><strong>Modo:</strong> {selectedProjeto.modo_processamento}</p>
                {selectedProjeto.modo_processamento === 'chunk' && (
                  <p><strong>Chunk:</strong> {selectedProjeto.posicao_chunk}, {selectedProjeto.tamanho_chunk} chars</p>
                )}
              </div>

              <Separator />

              {detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <>
                  {/* Document codes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Documentos ({projetoCodigos.length})</h4>
                      <Input
                        placeholder="Filtrar..."
                        value={codigosFiltro}
                        onChange={(e) => setCodigosFiltro(e.target.value)}
                        className="w-48 h-8"
                      />
                    </div>
                    {filteredCodigos.length > 0 ? (
                      <ScrollArea className="max-h-40">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Codigo</TableHead>
                              <TableHead>Arquivo</TableHead>
                              <TableHead>Fonte</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredCodigos.map(c => (
                              <TableRow key={c.id}>
                                <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                                <TableCell className="text-xs">{c.arquivo_nome ?? '-'}</TableCell>
                                <TableCell><Badge variant="outline">{c.fonte}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum documento encontrado</p>
                    )}
                  </div>

                  <Separator />

                  {/* Executions history */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Historico de Execucoes</h4>
                    {projetoExecucoes.length > 0 ? (
                      <div className="space-y-2">
                        {projetoExecucoes.map(ex => (
                          <Card key={ex.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">#{ex.id}</span>
                                  <Badge variant={statusBadgeVariant(ex.status)}>{ex.status}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {ex.arquivos_sucesso} sucesso, {ex.arquivos_erro} erros de {ex.total_arquivos}
                                </p>
                                {ex.iniciado_em && (
                                  <p className="text-xs text-muted-foreground">{formatDate(ex.iniciado_em)}</p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {ex.status === 'concluido' && (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => handleVerResultados(ex.id)}>
                                      Ver Resultados
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleExportResults(ex.id, 'excel')}>
                                      Excel
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma execucao realizada</p>
                    )}
                  </div>

                  {/* Results for selected execution */}
                  {resultadosExecucao.length > 0 && resultadosExecucaoId && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Resultados da Execucao #{resultadosExecucaoId}</h4>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleExportResults(resultadosExecucaoId, 'csv')}>CSV</Button>
                            <Button variant="outline" size="sm" onClick={() => handleExportResults(resultadosExecucaoId, 'json')}>JSON</Button>
                          </div>
                        </div>
                        <ScrollArea className="max-h-60">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Documento</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Subcategoria</TableHead>
                                <TableHead>Confianca</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {resultadosExecucao.map((r, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs truncate max-w-[150px]">{r.nome_arquivo}</TableCell>
                                  <TableCell className="text-xs">{r.categoria}</TableCell>
                                  <TableCell className="text-xs">{r.subcategoria}</TableCell>
                                  <TableCell>
                                    <Badge variant={confiancaBadgeVariant(r.confianca)}>{r.confianca}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </>
              )}

              <DialogFooter>
                <Button onClick={() => handleExecutarProjeto(selectedProjeto.id)}>
                  Executar Classificacao
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
