/**
 * Aba "Novo Lote" do Classificador de Documentos.
 *
 * Permite criar um projeto de classificacao em lote, enviar arquivos,
 * configurar parametros e acompanhar execucao via SSE.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { classificadorApi, getToken } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { C } from '@/lib/designTokens'
import { CirclePlus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Prompt, ProjetoPayload, Projeto, Resultado, SSEEvent, PageTab } from '@/types/classificador'
import { confiancaBadgeVariant, triggerDownload } from '../types'
import { FileDropZone } from './FileDropZone'

// ============================================================================
// Props
// ============================================================================

interface NovoLoteTabProps {
  prompts: Prompt[]
  promptsLoading: boolean
  onProjetoCreated: () => void
  onSwitchTab: (tab: PageTab) => void
}

// ============================================================================
// Componente
// ============================================================================

export function NovoLoteTab({ prompts, promptsLoading, onProjetoCreated }: NovoLoteTabProps) {
  const { toast } = useToast()
  const [nomeLote, setNomeLote] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploadMode, setUploadMode] = useState<'upload' | 'tjms'>('upload')
  const [promptId, setPromptId] = useState<string>('')
  const [modelo, setModelo] = useState('google/gemini-2.5-flash-lite')
  const [modoProcessamento, setModoProcessamento] = useState<'chunk' | 'completo'>('chunk')
  const [posicaoChunk, setPosicaoChunk] = useState<'inicio' | 'fim'>('inicio')
  const [tamanhoChunk, setTamanhoChunk] = useState(1000)

  // Execution state
  const [executando, setExecutando] = useState(false)
  const [progresso, setProgresso] = useState({ processados: 0, total: 0 })
  const [logs, setLogs] = useState<Array<{ tipo: string; mensagem: string }>>([])
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [execucaoId, setExecucaoId] = useState<number | null>(null)
  const [concluido, setConcluido] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canStart = files.length > 0 && promptId !== ''

  const resetExecution = useCallback(() => {
    setExecutando(false)
    setProgresso({ processados: 0, total: 0 })
    setLogs([])
    setResultados([])
    setExecucaoId(null)
    setConcluido(false)
  }, [])

  const addLog = useCallback((tipo: string, mensagem: string) => {
    setLogs(prev => [...prev, { tipo, mensagem }])
  }, [])

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      addLog('erro', 'Sem resposta do servidor ha mais de 60 segundos. A execucao pode estar travada.')
    }, 60000)
  }, [addLog])

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const handleIniciar = useCallback(async () => {
    if (!canStart) return
    resetExecution()
    setExecutando(true)

    try {
      // 1. Create project
      const projetoPayload: ProjetoPayload = {
        nome: nomeLote || `Lote ${new Date().toLocaleDateString('pt-BR')}`,
        prompt_id: Number(promptId),
        modelo,
        modo_processamento: modoProcessamento,
        posicao_chunk: posicaoChunk,
        tamanho_chunk: tamanhoChunk,
        max_concurrent: 3,
      }
      const projeto = await classificadorApi.post<Projeto>('/projetos', projetoPayload)
      addLog('inicio', `Projeto "${projeto.nome}" criado (ID: ${projeto.id})`)

      // 2. Upload files
      const formData = new FormData()
      for (const file of files) {
        formData.append('arquivos', file)
      }
      await classificadorApi.post(`/lotes/${projeto.id}/upload`, formData)
      addLog('inicio', `${files.length} arquivo(s) enviado(s)`)

      // 3. Start SSE execution
      const token = getToken()
      const sseUrl = `/classificador/api/projetos/${projeto.id}/executar${token ? `?token=${token}` : ''}`
      const es = new EventSource(sseUrl)
      eventSourceRef.current = es
      resetTimeout()

      es.onmessage = (event: MessageEvent) => {
        if (event.data === '[DONE]') {
          cleanup()
          return
        }

        resetTimeout()

        try {
          const data = JSON.parse(event.data) as SSEEvent
          switch (data.tipo) {
            case 'inicio':
              setExecucaoId(data.execucao_id)
              addLog('inicio', data.mensagem)
              break
            case 'progresso':
              setProgresso({ processados: data.processados, total: data.total })
              addLog('progresso', data.mensagem)
              break
            case 'concluido':
              setExecucaoId(data.execucao_id)
              addLog('concluido', data.mensagem)
              setConcluido(true)
              setExecutando(false)
              cleanup()
              // Load results
              classificadorApi.get<Resultado[]>(`/execucoes/${data.execucao_id}/resultados`)
                .then(setResultados)
                .catch(() => { /* results load failed, non-critical */ })
              onProjetoCreated()
              break
            case 'erro':
              addLog('erro', data.mensagem)
              setExecutando(false)
              cleanup()
              break
          }
        } catch {
          // Non-JSON message
          addLog('progresso', event.data as string)
        }
      }

      es.onerror = () => {
        addLog('erro', 'Conexao SSE perdida')
        setExecutando(false)
        cleanup()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      addLog('erro', msg)
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
      setExecutando(false)
    }
  }, [canStart, nomeLote, promptId, modelo, modoProcessamento, posicaoChunk, tamanhoChunk, files, addLog, resetExecution, resetTimeout, cleanup, toast, onProjetoCreated])

  const handleExportResults = useCallback(async (format: 'excel' | 'csv' | 'json') => {
    if (!execucaoId) return
    try {
      const extensions: Record<string, string> = { excel: 'xlsx', csv: 'csv', json: 'json' }
      const blob = await classificadorApi.blob(`/execucoes/${execucaoId}/exportar/${format}`)
      triggerDownload(blob, `resultados_${execucaoId}.${extensions[format]}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [execucaoId, toast])

  return (
    <div className="space-y-6">
      <div className="space-y-4 sm:hidden">
        <div className="flex items-center gap-2 text-[22px] font-semibold leading-tight" style={{ color: C.text900 }}>
          <CirclePlus className="h-4 w-4" style={{ color: C.navy700 }} />
          <span>Criar Novo Lote de Classificacao</span>
        </div>

        <Card>
          <CardContent className="pt-5">
            <div className="space-y-2">
              <Label htmlFor="nome-lote-mobile">Nome do Lote (opcional)</Label>
              <Input
                id="nome-lote-mobile"
                placeholder="Ex: Classificacao Decisoes Janeiro 2026"
                value={nomeLote}
                onChange={(e) => setNomeLote(e.target.value)}
                disabled={executando}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: C.text700 }}>Adicionar Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 border-b" style={{ borderColor: C.gray200 }}>
              <button
                type="button"
                onClick={() => setUploadMode('upload')}
                className="pb-2 text-sm font-semibold transition-colors"
                style={{
                  color: uploadMode === 'upload' ? C.navy700 : C.text500,
                  borderBottom: uploadMode === 'upload' ? `2px solid ${C.navy700}` : '2px solid transparent',
                }}
              >
                Upload de Arquivos
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('tjms')}
                className="pb-2 text-sm font-semibold transition-colors"
                style={{
                  color: uploadMode === 'tjms' ? C.navy700 : C.text500,
                  borderBottom: uploadMode === 'tjms' ? `2px solid ${C.navy700}` : '2px solid transparent',
                }}
              >
                Importar do TJ-MS
              </button>
            </div>

            {uploadMode === 'upload' ? (
              <FileDropZone
                files={files}
                onFilesChange={setFiles}
                multiple
                accept=".pdf,.txt,.zip"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Importacao direta do TJ-MS indisponivel neste ambiente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nome do lote */}
      <Card className="hidden sm:block">
        <CardHeader>
          <CardTitle className="text-lg">Novo Lote de Classificacao</CardTitle>
          <CardDescription>Configure e envie arquivos para classificacao em lote</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome-lote">Nome do Lote (opcional)</Label>
            <Input
              id="nome-lote"
              placeholder="Ex: Documentos Janeiro 2026"
              value={nomeLote}
              onChange={(e) => setNomeLote(e.target.value)}
              disabled={executando}
            />
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label>Arquivos</Label>
            <FileDropZone
              files={files}
              onFilesChange={setFiles}
              multiple
              accept=".pdf,.txt,.zip"
            />
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuracao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prompt</Label>
              {promptsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={promptId} onValueChange={setPromptId} disabled={executando}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um prompt" />
                  </SelectTrigger>
                  <SelectContent>
                    {prompts.filter(p => p.ativo).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                disabled={executando}
              />
            </div>

            <div className="space-y-2">
              <Label>Modo de Processamento</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modo"
                    value="chunk"
                    checked={modoProcessamento === 'chunk'}
                    onChange={() => setModoProcessamento('chunk')}
                    disabled={executando}
                  />
                  <span className="text-sm">Chunk</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modo"
                    value="completo"
                    checked={modoProcessamento === 'completo'}
                    onChange={() => setModoProcessamento('completo')}
                    disabled={executando}
                  />
                  <span className="text-sm">Completo</span>
                </label>
              </div>
            </div>

            {modoProcessamento === 'chunk' && (
              <>
                <div className="space-y-2">
                  <Label>Posicao do Chunk</Label>
                  <Select value={posicaoChunk} onValueChange={(v) => setPosicaoChunk(v as 'inicio' | 'fim')} disabled={executando}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inicio">Inicio</SelectItem>
                      <SelectItem value="fim">Fim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tamanho-chunk">Tamanho do Chunk ({tamanhoChunk})</Label>
                  <input
                    id="tamanho-chunk"
                    type="range"
                    min={100}
                    max={4000}
                    step={100}
                    value={tamanhoChunk}
                    onChange={(e) => setTamanhoChunk(Number(e.target.value))}
                    disabled={executando}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>100</span>
                    <span>4000</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleIniciar}
            disabled={!canStart || executando}
          >
            {executando ? 'Classificando...' : 'Iniciar Classificacao'}
          </Button>
        </CardFooter>
      </Card>

      {/* Progress area */}
      {(executando || logs.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {progresso.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{progresso.processados} / {progresso.total} processados</span>
                  <span>{Math.round((progresso.processados / progresso.total) * 100)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(progresso.processados / progresso.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <ScrollArea className="max-h-48 rounded-md border p-3" style={{ borderColor: C.gray200 }}>
              {logs.map((log, idx) => {
                let logColor: string
                if (log.tipo === 'erro') {
                  logColor = C.statusError
                } else if (log.tipo === 'concluido') {
                  logColor = C.statusSuccess
                } else {
                  logColor = C.text400
                }
                return (
                  <p
                    key={idx}
                    className="text-xs font-mono"
                    style={{ color: logColor }}
                  >
                    {log.mensagem}
                  </p>
                )
              })}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Results area */}
      {concluido && resultados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultados</CardTitle>
            <CardDescription>
              {resultados.filter(r => r.status === 'concluido').length} sucesso,{' '}
              {resultados.filter(r => r.status === 'erro').length} erros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead>Confianca</TableHead>
                  <TableHead>Justificativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium truncate max-w-[200px]">{r.nome_arquivo}</TableCell>
                    <TableCell>{r.categoria}</TableCell>
                    <TableCell>{r.subcategoria}</TableCell>
                    <TableCell>
                      <Badge variant={confiancaBadgeVariant(r.confianca)}>{r.confianca}</Badge>
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[300px]">{r.justificativa}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExportResults('excel')}>Exportar Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExportResults('csv')}>Exportar CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExportResults('json')}>Exportar JSON</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
