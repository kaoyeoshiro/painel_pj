import { useState, useRef, useCallback, useEffect } from 'react'
import { classificadorApi, getToken } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useToast } from '@/hooks/use-toast'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { C, FONT_UI } from '@/lib/designTokens'
import { CircleDot, CirclePlus, FileSearch, FolderOpen, MessageCircleMore, Zap } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type {
  Prompt,
  PromptPayload,
  Projeto,
  ProjetoPayload,
  CodigoDocumento,
  Execucao,
  Resultado,
  ClassificacaoAvulsa,
  SSEEvent,
  PageTab,
} from '@/types/classificador'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function confiancaBadgeVariant(c: string): 'default' | 'secondary' | 'destructive' {
  if (c === 'alta') return 'default'
  if (c === 'media') return 'secondary'
  return 'destructive'
}

function statusBadgeVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'concluido') return 'default'
  if (s === 'em_andamento' || s === 'pendente') return 'secondary'
  if (s === 'erro' || s === 'travado') return 'destructive'
  return 'outline'
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FileDropZoneProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  multiple?: boolean
  accept?: string
}

function FileDropZone({ files, onFilesChange, multiple = true, accept = '.pdf,.txt,.zip' }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (!multiple && droppedFiles.length > 1) {
      onFilesChange([droppedFiles[0]])
    } else {
      onFilesChange(multiple ? [...files, ...droppedFiles] : droppedFiles.slice(0, 1))
    }
  }, [files, multiple, onFilesChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!multiple && selected.length > 1) {
      onFilesChange([selected[0]])
    } else {
      onFilesChange(multiple ? [...files, ...selected] : selected.slice(0, 1))
    }
    // Reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = ''
  }, [files, multiple, onFilesChange])

  const removeFile = useCallback((index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }, [files, onFilesChange])

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          data-testid="file-input"
        />
        <p className="text-sm text-muted-foreground">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Formatos aceitos: PDF, TXT, ZIP (max. 50MB cada)
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">{files.length} arquivo(s) selecionado(s)</p>
          <ScrollArea className="max-h-40">
            {files.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center justify-between py-1 px-2 text-sm rounded hover:bg-muted/50">
                <span className="truncate mr-2">{file.name} ({formatFileSize(file.size)})</span>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeFile(idx) }}>
                  Remover
                </Button>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 1: Novo Lote
// ---------------------------------------------------------------------------

interface NovoLoteTabProps {
  prompts: Prompt[]
  promptsLoading: boolean
  onProjetoCreated: () => void
  onSwitchTab: (tab: PageTab) => void
}

function NovoLoteTab({ prompts, promptsLoading, onProjetoCreated }: NovoLoteTabProps) {
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
            <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${C.gray200}` }}>
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

            <ScrollArea className="max-h-48 rounded-md p-3" style={{ border: `1px solid ${C.gray200}` }}>
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

// ---------------------------------------------------------------------------
// Tab 2: Meus Lotes
// ---------------------------------------------------------------------------

interface MeusLotesTabProps {
  onSwitchTab: (tab: PageTab) => void
}

function MeusLotesTab({ onSwitchTab }: MeusLotesTabProps) {
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
    queryFn: () => classificadorApi.get<Execucao[]>('/execucoes-em-andamento'),
    refetchInterval: 10000,
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

// ---------------------------------------------------------------------------
// Tab 3: Prompts
// ---------------------------------------------------------------------------

interface PromptsTabProps {
  prompts: Prompt[]
  promptsLoading: boolean
  onPromptsChange: () => void
}

function PromptsTab({ prompts, promptsLoading, onPromptsChange }: PromptsTabProps) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formConteudo, setFormConteudo] = useState('')
  const [formCodigos, setFormCodigos] = useState('')
  const [saving, setSaving] = useState(false)

  const openNew = useCallback(() => {
    setEditingPrompt(null)
    setFormNome('')
    setFormDescricao('')
    setFormConteudo('')
    setFormCodigos('')
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((prompt: Prompt) => {
    setEditingPrompt(prompt)
    setFormNome(prompt.nome)
    setFormDescricao(prompt.descricao ?? '')
    setFormConteudo(prompt.conteudo)
    setFormCodigos(prompt.codigos_documento ?? '')
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!formNome.trim() || !formConteudo.trim()) {
      toast({ title: 'Erro', description: 'Nome e conteudo sao obrigatorios', variant: 'destructive' })
      return
    }

    setSaving(true)
    const payload: PromptPayload = {
      nome: formNome.trim(),
      descricao: formDescricao.trim() || undefined,
      conteudo: formConteudo,
      codigos_documento: formCodigos.trim() || undefined,
    }

    try {
      if (editingPrompt) {
        await classificadorApi.put(`/prompts/${editingPrompt.id}`, payload)
        toast({ title: 'Prompt atualizado' })
      } else {
        await classificadorApi.post('/prompts', payload)
        toast({ title: 'Prompt criado' })
      }
      setDialogOpen(false)
      onPromptsChange()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [formNome, formDescricao, formConteudo, formCodigos, editingPrompt, toast, onPromptsChange])

  const handleDelete = useCallback(async (promptId: number) => {
    try {
      await classificadorApi.delete(`/prompts/${promptId}`)
      toast({ title: 'Prompt excluido' })
      onPromptsChange()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [toast, onPromptsChange])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Prompts de Classificacao</h3>
        <Button onClick={openNew}>Novo Prompt</Button>
      </div>

      {promptsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum prompt cadastrado. Crie um novo prompt para comecar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map(p => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{p.nome}</CardTitle>
                  <Badge variant={p.ativo ? 'default' : 'secondary'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                {p.descricao && <CardDescription>{p.descricao}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Criado em {formatDate(p.criado_em)}</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>Excluir</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Prompt form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? 'Editar Prompt' : 'Novo Prompt'}</DialogTitle>
            <DialogDescription>
              {editingPrompt ? 'Altere os campos do prompt' : 'Preencha os campos para criar um novo prompt de classificacao'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-nome">Nome</Label>
              <Input
                id="prompt-nome"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Nome do prompt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-descricao">Descricao</Label>
              <Input
                id="prompt-descricao"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Descricao (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-conteudo">Conteudo</Label>
              <Textarea
                id="prompt-conteudo"
                value={formConteudo}
                onChange={(e) => setFormConteudo(e.target.value)}
                placeholder="Conteudo do prompt de classificacao..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt-codigos">Codigos de tipos de documento (opcional)</Label>
              <Input
                id="prompt-codigos"
                value={formCodigos}
                onChange={(e) => setFormCodigos(e.target.value)}
                placeholder="Ex: 001,002,003"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4: Teste Rapido
// ---------------------------------------------------------------------------

interface TesteRapidoTabProps {
  prompts: Prompt[]
  promptsLoading: boolean
}

function TesteRapidoTab({ prompts, promptsLoading }: TesteRapidoTabProps) {
  const { toast } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [promptId, setPromptId] = useState<string>('')
  const [modelo, setModelo] = useState('google/gemini-2.5-flash-lite')
  const [modoProcessamento, setModoProcessamento] = useState<'chunk' | 'completo'>('chunk')
  const [posicaoChunk, setPosicaoChunk] = useState<'inicio' | 'fim'>('inicio')
  const [tamanhoChunk, setTamanhoChunk] = useState(1000)
  const [classificando, setClassificando] = useState(false)
  const [resultado, setResultado] = useState<ClassificacaoAvulsa | null>(null)

  const handleClassificar = useCallback(async () => {
    if (files.length === 0) return

    setClassificando(true)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('arquivo', files[0])
      if (promptId) formData.append('prompt_id', promptId)
      formData.append('modelo', modelo)
      formData.append('modo_processamento', modoProcessamento)
      formData.append('posicao_chunk', posicaoChunk)
      formData.append('tamanho_chunk', String(tamanhoChunk))

      const result = await classificadorApi.post<ClassificacaoAvulsa>('/classificar-avulso', formData)
      setResultado(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao classificar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
      setResultado({ sucesso: false, erro: msg })
    } finally {
      setClassificando(false)
    }
  }, [files, promptId, modelo, modoProcessamento, posicaoChunk, tamanhoChunk, toast])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left column - input */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Arquivo</CardTitle>
            <CardDescription>Envie um unico PDF para classificacao rapida</CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropZone
              files={files}
              onFilesChange={setFiles}
              multiple={false}
              accept=".pdf"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuracao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prompt</Label>
              {promptsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={promptId} onValueChange={setPromptId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um prompt (opcional)" />
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
              <Label htmlFor="teste-modelo">Modelo</Label>
              <Input
                id="teste-modelo"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Modo</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="teste-modo"
                    value="chunk"
                    checked={modoProcessamento === 'chunk'}
                    onChange={() => setModoProcessamento('chunk')}
                  />
                  <span className="text-sm">Chunk</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="teste-modo"
                    value="completo"
                    checked={modoProcessamento === 'completo'}
                    onChange={() => setModoProcessamento('completo')}
                  />
                  <span className="text-sm">Completo</span>
                </label>
              </div>
            </div>

            {modoProcessamento === 'chunk' && (
              <>
                <div className="space-y-2">
                  <Label>Posicao</Label>
                  <Select value={posicaoChunk} onValueChange={(v) => setPosicaoChunk(v as 'inicio' | 'fim')}>
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
                  <Label>Tamanho do Chunk ({tamanhoChunk})</Label>
                  <input
                    type="range"
                    min={100}
                    max={4000}
                    step={100}
                    value={tamanhoChunk}
                    onChange={(e) => setTamanhoChunk(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleClassificar}
              disabled={files.length === 0 || classificando}
            >
              {classificando ? 'Classificando...' : 'Classificar'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Right column - result */}
      <div>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-lg">Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            {classificando ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : resultado ? (
              resultado.sucesso ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Categoria</Label>
                    <p className="text-lg font-medium">{resultado.categoria}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Subcategoria</Label>
                    <p className="text-lg font-medium">{resultado.subcategoria}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Confianca</Label>
                    <div>
                      <Badge variant={confiancaBadgeVariant(resultado.confianca ?? 'baixa')}>
                        {resultado.confianca}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Justificativa</Label>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {resultado.justificativa}
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Erro na classificacao</AlertTitle>
                  <AlertDescription>{resultado.erro}</AlertDescription>
                </Alert>
              )
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Envie um arquivo e clique em "Classificar" para ver o resultado
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ClassificadorPage() {
  const [activeTab, setActiveTab] = useState<PageTab>('novo-lote')

  const { data: prompts, isLoading: promptsLoading, refetch: refetchPrompts } = useQuery<Prompt[]>({
    queryKey: queryKeys.classificador.prompts(),
    queryFn: () => classificadorApi.get<Prompt[]>('/prompts'),
  })

  const handleSwitchTab = useCallback((tab: PageTab) => {
    setActiveTab(tab)
  }, [])

  const promptsList = prompts ?? []

  return (
    <div style={{ fontFamily: FONT_UI }}>
      <BreadcrumbBar
        title="Classificador de Documentos"
        icon={<FileSearch style={{ width: 14, height: 14 }} />}
      />

      <div style={{ maxWidth: 1350, margin: '0 auto', padding: '32px 40px' }}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PageTab)}>
          <TabsList
            className="grid w-full grid-cols-4 h-auto rounded-none bg-transparent p-0"
            style={{ borderBottom: `1px solid ${C.gray200}` }}
          >
            <TabsTrigger value="novo-lote" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <CircleDot className="mr-2 h-4 w-4" />
              Novo Lote
            </TabsTrigger>
            <TabsTrigger value="meus-lotes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <FolderOpen className="mr-2 h-4 w-4" />
              Meus Lotes
            </TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <MessageCircleMore className="mr-2 h-4 w-4" />
              Prompts
            </TabsTrigger>
            <TabsTrigger value="teste-rapido" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
              <Zap className="mr-2 h-4 w-4" />
              Teste Rapido
            </TabsTrigger>
          </TabsList>

          <TabsContent value="novo-lote">
            <NovoLoteTab
              prompts={promptsList}
              promptsLoading={promptsLoading}
              onProjetoCreated={refetchPrompts}
              onSwitchTab={handleSwitchTab}
            />
          </TabsContent>

          <TabsContent value="meus-lotes">
            <MeusLotesTab onSwitchTab={handleSwitchTab} />
          </TabsContent>

          <TabsContent value="prompts">
            <PromptsTab
              prompts={promptsList}
              promptsLoading={promptsLoading}
              onPromptsChange={refetchPrompts}
            />
          </TabsContent>

          <TabsContent value="teste-rapido">
            <TesteRapidoTab
              prompts={promptsList}
              promptsLoading={promptsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
