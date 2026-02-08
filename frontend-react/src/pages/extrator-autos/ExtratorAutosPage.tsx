import { useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { extratorApi, getToken } from '@/lib/api'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type {
  ProcessoInfo,
  CategoriaDocumento,
  PreviewDocumento,
  BertStatus,
  DownloadOptions,
  DownloadSSEEvent,
  HistoricoDownload,
  LoteResultados,
  ModoSelecao,
  PageState,
} from '@/types/extrator-autos'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarData(iso: string | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return '-'
  }
}

function timestamp(): string {
  return new Date().toLocaleTimeString('pt-BR')
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ExtratorAutosPage() {
  const { toast } = useToast()

  // -- Estado da maquina de estados --
  const [pageState, setPageState] = useState<PageState>('idle')
  const [erroMensagem, setErroMensagem] = useState('')

  // -- Modo lote --
  const [modoLote, setModoLote] = useState(false)

  // -- Inputs --
  const [cnjInput, setCnjInput] = useState('')
  const [loteCnjInput, setLoteCnjInput] = useState('')

  // -- Dados do processo / lote --
  const [processoInfo, setProcessoInfo] = useState<ProcessoInfo | null>(null)
  const [loteResultados, setLoteResultados] = useState<LoteResultados | null>(null)

  // -- Categorias e selecao --
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [categoriasSelec, setCategoriasSelec] = useState<Set<number>>(new Set())
  const [codigosManuais, setCodigosManuais] = useState<number[]>([])
  const [codigoInput, setCodigoInput] = useState('')
  const [modoSelecao, setModoSelecao] = useState<ModoSelecao>('categoria')

  // -- Preview --
  const [previewDocs, setPreviewDocs] = useState<PreviewDocumento[]>([])

  // -- Download --
  const [downloadOpcoes, setDownloadOpcoes] = useState<DownloadOptions>({
    formato: 'pdf_txt',
    mesclar_pdfs: false,
    salvar_xml: false,
    pasta_unica: false,
    processos_paralelos: 2,
  })
  const [downloadPercentual, setDownloadPercentual] = useState(0)
  const [downloadMensagem, setDownloadMensagem] = useState('')
  const [downloadLogs, setDownloadLogs] = useState<string[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // -- Historico --
  const [historicoAberto, setHistoricoAberto] = useState(false)

  // -- BERT --
  const { data: bertStatus } = useApiQuery<BertStatus>(
    () => extratorApi.get<BertStatus>('/bert/health'),
    { enabled: true },
  )

  // -- Historico query --
  const {
    data: historico,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useApiQuery<HistoricoDownload[]>(
    () => extratorApi.get<HistoricoDownload[]>('/historico'),
    { enabled: historicoAberto },
  )

  // Scroll automatico nos logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [downloadLogs])

  // ---------------------------------------------------------------------------
  // Acoes
  // ---------------------------------------------------------------------------

  /** Conta processos digitados no modo lote */
  const contarProcessosLote = useCallback((): number => {
    return loteCnjInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean).length
  }, [loteCnjInput])

  /** Consultar processo individual */
  const consultarProcesso = useCallback(async () => {
    const cnj = cnjInput.trim()
    if (!cnj) {
      toast({ title: 'Campo obrigatorio', description: 'Digite o numero CNJ', variant: 'destructive' })
      return
    }
    setPageState('consultando')
    setErroMensagem('')
    try {
      const info = await extratorApi.post<ProcessoInfo>('/consultar', { numero_cnj: cnj })
      setProcessoInfo(info)
      // Buscar categorias
      const cats = await extratorApi.get<CategoriaDocumento[]>('/categorias')
      setCategorias(cats)
      setCategoriasSelec(new Set())
      setCodigosManuais([])
      setPageState('selecionando')
      toast({ title: 'Processo encontrado', description: `${info.total_documentos} documentos` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar processo'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [cnjInput, toast])

  /** Consultar lote */
  const consultarLote = useCallback(async () => {
    const linhas = loteCnjInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (linhas.length === 0) {
      toast({ title: 'Campo obrigatorio', description: 'Digite ao menos um numero CNJ', variant: 'destructive' })
      return
    }
    setPageState('consultando')
    setErroMensagem('')
    try {
      const resultado = await extratorApi.post<LoteResultados>('/consultar-lote', { numeros_cnj: linhas })
      setLoteResultados(resultado)
      const cats = await extratorApi.get<CategoriaDocumento[]>('/categorias')
      setCategorias(cats)
      setCategoriasSelec(new Set())
      setCodigosManuais([])
      setPageState('selecionando')
      toast({
        title: 'Lote consultado',
        description: `${resultado.consultados} de ${resultado.total_processos} processos`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar lote'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [loteCnjInput, toast])

  /** Toggle categoria */
  const toggleCategoria = useCallback((id: number) => {
    setCategoriasSelec((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /** Adicionar codigo manual */
  const adicionarCodigoManual = useCallback(() => {
    const cod = parseInt(codigoInput, 10)
    if (isNaN(cod)) {
      toast({ title: 'Codigo invalido', description: 'Digite um numero valido', variant: 'destructive' })
      return
    }
    setCodigosManuais((prev) => (prev.includes(cod) ? prev : [...prev, cod]))
    setCodigoInput('')
  }, [codigoInput, toast])

  /** Remover codigo manual */
  const removerCodigoManual = useCallback((cod: number) => {
    setCodigosManuais((prev) => prev.filter((c) => c !== cod))
  }, [])

  /** Coletar todos os codigos selecionados */
  const codigosSelecionados = useCallback((): number[] => {
    const codsCategoria: number[] = []
    for (const catId of categoriasSelec) {
      const cat = categorias.find((c) => c.id === catId)
      if (cat) codsCategoria.push(...cat.codigos)
    }
    return [...new Set([...codsCategoria, ...codigosManuais])]
  }, [categoriasSelec, categorias, codigosManuais])

  /** Visualizar documentos (preview - modo individual) */
  const visualizarDocumentos = useCallback(async () => {
    const codigos = codigosSelecionados()
    if (codigos.length === 0) {
      toast({
        title: 'Nenhuma selecao',
        description: 'Selecione ao menos uma categoria ou codigo',
        variant: 'destructive',
      })
      return
    }
    setPageState('consultando')
    try {
      const preview = await extratorApi.post<PreviewDocumento[]>('/preview', {
        numero_cnj: processoInfo?.numero_cnj,
        codigos,
        metodo: modoSelecao,
      })
      setPreviewDocs(preview)
      setPageState('preview')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar preview'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [codigosSelecionados, processoInfo, modoSelecao, toast])

  /** Toggle selecao de documento no preview */
  const toggleDocPreview = useCallback((docId: string) => {
    setPreviewDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, selecionado: !d.selecionado } : d)),
    )
  }, [])

  /** Selecionar/deselecionar todos */
  const toggleTodosPreview = useCallback(() => {
    const todosSelec = previewDocs.every((d) => d.selecionado)
    setPreviewDocs((prev) => prev.map((d) => ({ ...d, selecionado: !todosSelec })))
  }, [previewDocs])

  /** Contadores de preview */
  const previewContadores = useCallback(() => {
    const total = previewDocs.length
    const selecionados = previewDocs.filter((d) => d.selecionado).length
    return { total, selecionados }
  }, [previewDocs])

  /** Iniciar download via SSE (fetch + ReadableStream) */
  const iniciarDownload = useCallback(async () => {
    const docsSelecionados = previewDocs.filter((d) => d.selecionado)

    if (!modoLote && docsSelecionados.length === 0) {
      toast({
        title: 'Nenhum documento selecionado',
        description: 'Selecione ao menos um documento para baixar',
        variant: 'destructive',
      })
      return
    }

    setPageState('baixando')
    setDownloadPercentual(0)
    setDownloadMensagem('Iniciando download...')
    setDownloadLogs([`[${timestamp()}] Iniciando download...`])
    setJobId(null)

    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    let url: string
    let body: unknown

    if (modoLote && loteResultados) {
      url = '/extrator-autos/api/baixar-lote'
      body = {
        processos: loteResultados.resultados.map((p) => p.numero_cnj),
        formato: downloadOpcoes.formato,
        opcoes: downloadOpcoes,
      }
    } else {
      url = '/extrator-autos/api/baixar'
      body = {
        numero_cnj: processoInfo?.numero_cnj,
        documentos_ids: docsSelecionados.map((d) => d.id),
        formato: downloadOpcoes.formato,
        opcoes: downloadOpcoes,
      }
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Stream nao suportado')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue

          try {
            const evento = JSON.parse(jsonStr) as DownloadSSEEvent
            if (evento.tipo === 'progresso') {
              setDownloadPercentual(evento.percentual ?? 0)
              if (evento.mensagem) {
                setDownloadMensagem(evento.mensagem)
                setDownloadLogs((prev) => [...prev, `[${timestamp()}] ${evento.mensagem}`])
              }
            } else if (evento.tipo === 'concluido') {
              setDownloadPercentual(100)
              setDownloadMensagem('Download concluido!')
              setJobId(evento.job_id ?? null)
              setDownloadLogs((prev) => [
                ...prev,
                `[${timestamp()}] Download concluido! ${evento.total_docs ?? 0} documentos.`,
              ])
              setPageState('concluido')
            } else if (evento.tipo === 'erro') {
              setDownloadMensagem(evento.mensagem ?? 'Erro durante download')
              setDownloadLogs((prev) => [
                ...prev,
                `[${timestamp()}] ERRO: ${evento.mensagem}`,
              ])
              setPageState('erro')
              setErroMensagem(evento.mensagem ?? 'Erro durante download')
            }
          } catch {
            // Linha SSE nao parseavel — ignora
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro de conexao'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro no download', description: msg, variant: 'destructive' })
    }
  }, [previewDocs, modoLote, loteResultados, processoInfo, downloadOpcoes, toast])

  /** Baixar ZIP concluido */
  const baixarZip = useCallback(async () => {
    if (!jobId) return
    try {
      const blob = await extratorApi.blob(`/download/${jobId}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `extrator_${jobId}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: 'Erro ao baixar arquivo',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }, [jobId, toast])

  /** Nova consulta (reset) */
  const novaConsulta = useCallback(() => {
    setPageState('idle')
    setCnjInput('')
    setLoteCnjInput('')
    setProcessoInfo(null)
    setLoteResultados(null)
    setCategorias([])
    setCategoriasSelec(new Set())
    setCodigosManuais([])
    setPreviewDocs([])
    setDownloadPercentual(0)
    setDownloadMensagem('')
    setDownloadLogs([])
    setJobId(null)
    setErroMensagem('')
  }, [])

  /** Handler Enter no input CNJ */
  const handleCnjKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') consultarProcesso()
  }

  // ---------------------------------------------------------------------------
  // Badge de resolucao especial
  // ---------------------------------------------------------------------------

  function resolucaoBadge(doc: PreviewDocumento) {
    if (!doc.resolucao_especial) return null
    const { metodo } = doc.resolucao_especial
    if (metodo === 'primeiro_cronologico') {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">1o Doc</Badge>
    }
    if (metodo === 'codigo') {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">codigo direto</Badge>
    }
    if (metodo === 'bert') {
      const status = doc.resolucao_especial.bert_status ?? 'Candidato'
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">BERT: {status}</Badge>
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ===== Header ===== */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/dashboard')}>
            ← Voltar
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <div>
            <h1 className="text-lg font-semibold">Extrator de Autos</h1>
            <span className="text-xs text-gray-500">Download de documentos processuais</span>
          </div>
        </div>

        {/* BERT Status */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
              data-testid="bert-status"
            >
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  bertStatus?.available ? 'bg-green-500' : 'bg-red-400',
                )}
              />
              BERT {bertStatus?.available ? 'Online' : 'Offline'}
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Status do BERT</DialogTitle>
              <DialogDescription>Configuracao do classificador BERT</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Disponivel:</span>
                <Badge variant={bertStatus?.available ? 'default' : 'destructive'}>
                  {bertStatus?.available ? 'Sim' : 'Nao'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Modo:</span>
                <span>{bertStatus?.mode ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Endpoint:</span>
                <span className="truncate max-w-[200px]">{bertStatus?.endpoint ?? '-'}</span>
              </div>
              {bertStatus?.error && (
                <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">
                  {bertStatus.error}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* ===== Conteudo Principal ===== */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* ===== Secao 1: Input ===== */}
          {(pageState === 'idle' || pageState === 'erro') && (
            <Card>
              <CardHeader>
                <CardTitle>Consultar Processo</CardTitle>
                <CardDescription>
                  Informe o numero CNJ para buscar documentos do processo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Toggle Modo Lote */}
                <div className="flex items-center gap-3">
                  <Label htmlFor="modo-lote" className="text-sm">Modo Lote</Label>
                  <button
                    id="modo-lote"
                    role="switch"
                    type="button"
                    aria-checked={modoLote}
                    onClick={() => setModoLote(!modoLote)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      modoLote ? 'bg-primary' : 'bg-gray-200',
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
                        modoLote ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                  <span className="text-xs text-gray-500">
                    {modoLote ? 'Varios processos' : 'Processo individual'}
                  </span>
                </div>

                {!modoLote ? (
                  /* Input individual */
                  <div className="space-y-2">
                    <Label htmlFor="cnj-input">Numero CNJ</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cnj-input"
                        value={cnjInput}
                        onChange={(e) => setCnjInput(e.target.value)}
                        onKeyDown={handleCnjKeyDown}
                        placeholder="0000000-00.0000.0.00.0000"
                        className="flex-1"
                      />
                      <Button onClick={consultarProcesso} disabled={!cnjInput.trim() || pageState === 'consultando'}>
                        Consultar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Textarea lote */
                  <div className="space-y-2">
                    <Label htmlFor="lote-input">Numeros CNJ (um por linha)</Label>
                    <Textarea
                      id="lote-input"
                      value={loteCnjInput}
                      onChange={(e) => setLoteCnjInput(e.target.value)}
                      placeholder={'0000000-00.0000.0.00.0000\n1111111-11.2024.8.12.0001'}
                      rows={6}
                      data-testid="lote-textarea"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {contarProcessosLote()} processo(s) informado(s)
                      </span>
                      <Button
                        onClick={consultarLote}
                        disabled={contarProcessosLote() === 0 || pageState === 'consultando'}
                      >
                        Consultar Lote
                      </Button>
                    </div>
                  </div>
                )}

                {/* Erro */}
                {pageState === 'erro' && erroMensagem && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {erroMensagem}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ===== Loading ===== */}
          {pageState === 'consultando' && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                <p className="font-medium text-gray-600">Consultando processo...</p>
                <p className="mt-1 text-sm text-gray-400">Isso pode levar alguns segundos</p>
              </CardContent>
            </Card>
          )}

          {/* ===== Secao 2: Selecao ===== */}
          {pageState === 'selecionando' && (
            <>
              {/* Info do processo */}
              {processoInfo && !modoLote && (
                <Card>
                  <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
                    <div>
                      <span className="text-xs text-gray-500">Classe Processual</span>
                      <p className="text-sm font-medium">{processoInfo.classe_processual || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Comarca</span>
                      <p className="text-sm font-medium">{processoInfo.comarca || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Vara</span>
                      <p className="text-sm font-medium">{processoInfo.vara || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Total de Documentos</span>
                      <p className="text-sm font-medium">{processoInfo.total_documentos}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resumo lote */}
              {modoLote && loteResultados && (
                <Card>
                  <CardContent className="grid grid-cols-3 gap-4 p-4">
                    <div>
                      <span className="text-xs text-gray-500">Total Processos</span>
                      <p className="text-sm font-medium">{loteResultados.total_processos}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Consultados</span>
                      <p className="text-sm font-medium">{loteResultados.consultados}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Com Erro</span>
                      <p className="text-sm font-medium text-red-500">{loteResultados.com_erro}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabs de selecao */}
              <Card>
                <CardHeader>
                  <CardTitle>Selecao de Documentos</CardTitle>
                  <CardDescription>
                    Escolha as categorias ou codigos dos documentos que deseja extrair
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs
                    value={modoSelecao}
                    onValueChange={(v) => setModoSelecao(v as ModoSelecao)}
                  >
                    <TabsList>
                      <TabsTrigger value="categoria">Categorias</TabsTrigger>
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                      <TabsTrigger value="hibrido">Hibrido</TabsTrigger>
                    </TabsList>

                    {/* Tab Categorias */}
                    <TabsContent value="categoria" className="mt-4">
                      {categorias.length === 0 ? (
                        <div className="space-y-2">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {categorias.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleCategoria(cat.id)}
                              className={cn(
                                'rounded-lg border-2 p-3 text-left transition-colors',
                                categoriasSelec.has(cat.id)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 hover:border-gray-300',
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{cat.nome}</span>
                                {categoriasSelec.has(cat.id) && (
                                  <Badge variant="default" className="text-xs">
                                    Selecionada
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-gray-500">{cat.descricao}</p>
                              <p className="mt-1 text-xs text-gray-400">
                                {cat.codigos.length} codigo(s)
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* Tab Manual */}
                    <TabsContent value="manual" className="mt-4 space-y-4">
                      <div className="flex gap-2">
                        <Input
                          value={codigoInput}
                          onChange={(e) => setCodigoInput(e.target.value)}
                          placeholder="Codigo do tipo (ex: 60)"
                          className="w-48"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') adicionarCodigoManual()
                          }}
                        />
                        <Button variant="outline" onClick={adicionarCodigoManual}>
                          Adicionar
                        </Button>
                      </div>
                      {codigosManuais.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {codigosManuais.map((cod) => (
                            <Badge
                              key={cod}
                              variant="secondary"
                              className="cursor-pointer gap-1"
                              onClick={() => removerCodigoManual(cod)}
                            >
                              {cod} x
                            </Badge>
                          ))}
                        </div>
                      )}
                      {codigosManuais.length === 0 && (
                        <p className="text-sm text-gray-400">
                          Nenhum codigo adicionado. Digite o codigo do tipo de documento acima.
                        </p>
                      )}
                    </TabsContent>

                    {/* Tab Hibrido */}
                    <TabsContent value="hibrido" className="mt-4 space-y-4">
                      {/* Categorias como chips */}
                      <div>
                        <Label className="mb-2 block text-sm">Categorias</Label>
                        <div className="flex flex-wrap gap-2">
                          {categorias.map((cat) => (
                            <Badge
                              key={cat.id}
                              variant={categoriasSelec.has(cat.id) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => toggleCategoria(cat.id)}
                            >
                              {cat.nome}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      {/* Codigos manuais */}
                      <div>
                        <Label className="mb-2 block text-sm">Codigos adicionais</Label>
                        <div className="flex gap-2">
                          <Input
                            value={codigoInput}
                            onChange={(e) => setCodigoInput(e.target.value)}
                            placeholder="Codigo (ex: 60)"
                            className="w-48"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') adicionarCodigoManual()
                            }}
                          />
                          <Button variant="outline" size="sm" onClick={adicionarCodigoManual}>
                            Adicionar
                          </Button>
                        </div>
                        {codigosManuais.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {codigosManuais.map((cod) => (
                              <Badge
                                key={cod}
                                variant="secondary"
                                className="cursor-pointer gap-1"
                                onClick={() => removerCodigoManual(cod)}
                              >
                                {cod} x
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Separator className="my-4" />

                  <div className="flex justify-end">
                    {!modoLote ? (
                      <Button onClick={visualizarDocumentos}>Visualizar Documentos</Button>
                    ) : (
                      <Button
                        onClick={() => {
                          // Em modo lote, pula direto para opcoes de download
                          setPageState('preview')
                        }}
                      >
                        Resumo do Lote
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ===== Secao 3: Preview (modo individual) ===== */}
          {pageState === 'preview' && !modoLote && (
            <Card>
              <CardHeader>
                <CardTitle>Preview de Documentos</CardTitle>
                <CardDescription>
                  {previewContadores().selecionados} selecionados de {previewContadores().total} encontrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <input
                          type="checkbox"
                          checked={previewDocs.length > 0 && previewDocs.every((d) => d.selecionado)}
                          onChange={toggleTodosPreview}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Resolucao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={doc.selecionado}
                            onChange={() => toggleDocPreview(doc.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{doc.tipo_codigo}</TableCell>
                        <TableCell className="text-sm">{doc.tipo_descricao}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{doc.descricao}</TableCell>
                        <TableCell className="text-xs">{formatarData(doc.data_juntada)}</TableCell>
                        <TableCell>{resolucaoBadge(doc)}</TableCell>
                      </TableRow>
                    ))}
                    {previewDocs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-400">
                          Nenhum documento encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ===== Secao 4: Opcoes de Download ===== */}
          {(pageState === 'preview' || (pageState === 'selecionando' && modoLote)) && (
            <Card>
              <CardHeader>
                <CardTitle>Opcoes de Download</CardTitle>
                <CardDescription>Configure o formato e opcoes de saida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Formato */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Formato de Saida</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
                      { value: 'pdf_txt', label: 'PDF + TXT' },
                      { value: 'pdf', label: 'Somente PDF' },
                      { value: 'txt', label: 'Somente TXT' },
                      { value: 'xml_only', label: 'Somente XML' },
                    ] as const).map((fmt) => (
                      <button
                        key={fmt.value}
                        type="button"
                        onClick={() => setDownloadOpcoes((prev) => ({ ...prev, formato: fmt.value }))}
                        className={cn(
                          'rounded-md border px-3 py-2 text-sm transition-colors',
                          downloadOpcoes.formato === fmt.value
                            ? 'border-primary bg-primary/10 font-medium text-primary'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300',
                        )}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={downloadOpcoes.mesclar_pdfs}
                      onChange={(e) =>
                        setDownloadOpcoes((prev) => ({ ...prev, mesclar_pdfs: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Mesclar PDFs
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={downloadOpcoes.salvar_xml}
                      onChange={(e) =>
                        setDownloadOpcoes((prev) => ({ ...prev, salvar_xml: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Salvar XML completo
                  </label>

                  {/* Opcoes exclusivas do lote */}
                  {modoLote && (
                    <>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={downloadOpcoes.pasta_unica}
                          onChange={(e) =>
                            setDownloadOpcoes((prev) => ({ ...prev, pasta_unica: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Pasta unica
                      </label>
                      <div className="flex items-center gap-3">
                        <Label className="text-sm">Processos simultaneos:</Label>
                        <select
                          value={downloadOpcoes.processos_paralelos}
                          onChange={(e) =>
                            setDownloadOpcoes((prev) => ({
                              ...prev,
                              processos_paralelos: parseInt(e.target.value, 10),
                            }))
                          }
                          className="rounded-md border px-2 py-1 text-sm"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={iniciarDownload}>Baixar Documentos</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== Secao 5: Progresso do Download ===== */}
          {pageState === 'baixando' && (
            <Card>
              <CardHeader>
                <CardTitle>Baixando Documentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Barra de progresso */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{downloadMensagem}</span>
                    <span className="font-medium">{downloadPercentual}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadPercentual}%` }}
                    />
                  </div>
                </div>

                {/* Logs */}
                <ScrollArea className="h-48 rounded-md border bg-gray-900 p-3">
                  <div className="space-y-1 font-mono text-xs text-gray-300">
                    {downloadLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* ===== Secao 6: Download Concluido ===== */}
          {pageState === 'concluido' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <span className="text-2xl text-green-600">&#10003;</span>
                </div>
                <h2 className="mb-2 text-xl font-semibold text-green-700">Download concluido!</h2>
                <p className="mb-6 text-sm text-green-600">{downloadMensagem}</p>
                <div className="flex gap-3">
                  {jobId && (
                    <Button onClick={baixarZip} className="bg-green-600 hover:bg-green-700">
                      Baixar ZIP
                    </Button>
                  )}
                  <Button variant="outline" onClick={novaConsulta}>
                    Nova Consulta
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== Secao 7: Historico (colapsavel) ===== */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => {
                const next = !historicoAberto
                setHistoricoAberto(next)
                if (next) refetchHistorico()
              }}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Historico de Downloads</CardTitle>
                <span className="text-sm text-gray-400">{historicoAberto ? '▲' : '▼'}</span>
              </div>
            </CardHeader>

            {historicoAberto && (
              <CardContent>
                {isLoadingHistorico ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !historico || historico.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">
                    Nenhum download registrado
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Processo</TableHead>
                        <TableHead>Modo</TableHead>
                        <TableHead>Formato</TableHead>
                        <TableHead>Docs</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.numero_cnj}</TableCell>
                          <TableCell className="text-sm">{item.modo}</TableCell>
                          <TableCell className="text-sm">{item.formato}</TableCell>
                          <TableCell className="text-sm">{item.total_docs}</TableCell>
                          <TableCell>
                            <Badge
                              variant={item.status === 'concluido' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatarData(item.criado_em)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}
