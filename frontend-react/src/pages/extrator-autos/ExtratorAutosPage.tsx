import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { FolderSearch, Clock } from 'lucide-react'
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
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
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
// Badge de status do historico com tokens
// ---------------------------------------------------------------------------

function statusBadgeStyle(status: string): React.CSSProperties {
  if (status === 'concluido') {
    return { background: '#dcfce7', color: C.statusSuccess, border: 'none' }
  }
  if (status === 'erro') {
    return { background: '#fef2f2', color: C.statusError, border: 'none' }
  }
  if (status === 'processando') {
    return { background: C.navy100, color: C.navy700, border: 'none' }
  }
  // pendente ou outros
  return { background: C.gray100, color: C.text500, border: 'none' }
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
  const { data: bertStatus } = useQuery<BertStatus>({
    queryKey: queryKeys.extrator.bertHealth(),
    queryFn: () => extratorApi.get<BertStatus>('/bert/health'),
  })

  // -- Historico query --
  const {
    data: historico,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery<HistoricoDownload[]>({
    queryKey: queryKeys.extrator.historico(),
    queryFn: () => extratorApi.get<HistoricoDownload[]>('/historico'),
    enabled: historicoAberto,
  })

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
      return (
        <Badge style={{ background: C.navy100, color: C.navy700, border: 'none' }}>
          1o Doc
        </Badge>
      )
    }
    if (metodo === 'codigo') {
      return (
        <Badge style={{ background: '#dcfce7', color: C.statusSuccess, border: 'none' }}>
          codigo direto
        </Badge>
      )
    }
    if (metodo === 'bert') {
      const status = doc.resolucao_especial.bert_status ?? 'Candidato'
      return (
        <Badge style={{ background: '#fef3c7', color: '#92400e', border: 'none' }}>
          BERT: {status}
        </Badge>
      )
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ============================================================ */}
      {/* BREADCRUMB BAR                                               */}
      {/* ============================================================ */}
      <BreadcrumbBar
        title="Extrator de Autos"
        icon={<FolderSearch style={{ width: 14, height: 14 }} />}
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
                style={{ color: C.text500, fontSize: 13 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                data-testid="bert-status"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: bertStatus?.available ? C.statusSuccess : C.statusError }}
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
                  <span style={{ color: C.text400 }}>Disponivel:</span>
                  <Badge
                    style={bertStatus?.available
                      ? { background: '#dcfce7', color: C.statusSuccess, border: 'none' }
                      : { background: '#fef2f2', color: C.statusError, border: 'none' }
                    }
                  >
                    {bertStatus?.available ? 'Sim' : 'Nao'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: C.text400 }}>Modo:</span>
                  <span style={{ color: C.text700 }}>{bertStatus?.mode ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: C.text400 }}>Endpoint:</span>
                  <span className="max-w-[200px] truncate" style={{ color: C.text700 }}>
                    {bertStatus?.endpoint ?? '-'}
                  </span>
                </div>
                {bertStatus?.error && (
                  <div
                    className="mt-2 rounded p-2 text-xs"
                    style={{ background: '#fef2f2', color: C.statusError }}
                  >
                    {bertStatus.error}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ============================================================ */}
      {/* MAIN CONTENT                                                 */}
      {/* ============================================================ */}
      <ContentArea className="space-y-6">

          {/* ===== Secao 1: Input ===== */}
          {(pageState === 'idle' || pageState === 'erro') && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
              <div className="p-6">
                <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
                  Consultar Processo
                </h3>
                <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
                  Informe o numero CNJ para buscar documentos do processo
                </p>

                <div className="mt-5 space-y-4">
                  {/* Toggle Modo Lote */}
                  <div className="flex items-center gap-3">
                    <Label htmlFor="modo-lote" className="text-sm" style={{ color: C.text700 }}>
                      Modo Lote
                    </Label>
                    <button
                      id="modo-lote"
                      role="switch"
                      type="button"
                      aria-checked={modoLote}
                      onClick={() => setModoLote(!modoLote)}
                      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                      style={{ background: modoLote ? C.navy950 : C.gray300 }}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
                          modoLote ? 'translate-x-5' : 'translate-x-0',
                        )}
                      />
                    </button>
                    <span style={{ fontSize: 12, color: C.text400 }}>
                      {modoLote ? 'Varios processos' : 'Processo individual'}
                    </span>
                  </div>

                  {!modoLote ? (
                    /* Input individual */
                    <div className="space-y-2">
                      <Label htmlFor="cnj-input" style={{ color: C.text700 }}>Numero CNJ</Label>
                      <div className="flex gap-2">
                        <Input
                          id="cnj-input"
                          value={cnjInput}
                          onChange={(e) => setCnjInput(e.target.value)}
                          onKeyDown={handleCnjKeyDown}
                          placeholder="0000000-00.0000.0.00.0000"
                          className="flex-1"
                          style={{ borderColor: C.gray200 }}
                        />
                        <Button
                          onClick={consultarProcesso}
                          disabled={!cnjInput.trim() || pageState === 'consultando'}
                          style={{ background: C.navy950, color: '#fff' }}
                        >
                          Consultar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Textarea lote */
                    <div className="space-y-2">
                      <Label htmlFor="lote-input" style={{ color: C.text700 }}>
                        Numeros CNJ (um por linha)
                      </Label>
                      <Textarea
                        id="lote-input"
                        value={loteCnjInput}
                        onChange={(e) => setLoteCnjInput(e.target.value)}
                        placeholder={'0000000-00.0000.0.00.0000\n1111111-11.2024.8.12.0001'}
                        rows={6}
                        data-testid="lote-textarea"
                        style={{ borderColor: C.gray200 }}
                      />
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 12, color: C.text400 }}>
                          {contarProcessosLote()} processo(s) informado(s)
                        </span>
                        <Button
                          onClick={consultarLote}
                          disabled={contarProcessosLote() === 0 || pageState === 'consultando'}
                          style={{ background: C.navy950, color: '#fff' }}
                        >
                          Consultar Lote
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Erro */}
                  {pageState === 'erro' && erroMensagem && (
                    <div
                      className="rounded-lg p-3 text-sm"
                      style={{ background: '#fef2f2', color: C.statusError }}
                    >
                      {erroMensagem}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== Loading ===== */}
          {pageState === 'consultando' && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
              <div className="flex flex-col items-center justify-center py-12">
                <div
                  className="mb-4 h-10 w-10 animate-spin rounded-full border-4"
                  style={{ borderColor: C.gray200, borderTopColor: C.navy700 }}
                />
                <p className="font-medium" style={{ color: C.text700 }}>Consultando processo...</p>
                <p className="mt-1 text-sm" style={{ color: C.text400 }}>Isso pode levar alguns segundos</p>
              </div>
            </div>
          )}

          {/* ===== Secao 2: Selecao ===== */}
          {pageState === 'selecionando' && (
            <>
              {/* Info do processo */}
              {processoInfo && !modoLote && (
                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
                  <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
                    <div>
                      <span style={{ fontSize: 12, color: C.text400 }}>Classe Processual</span>
                      <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                        {processoInfo.classe_processual || '-'}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: C.text400 }}>Comarca</span>
                      <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                        {processoInfo.comarca || '-'}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: C.text400 }}>Vara</span>
                      <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                        {processoInfo.vara || '-'}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: C.text400 }}>Total de Documentos</span>
                      <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                        {processoInfo.total_documentos}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumo lote */}
              {modoLote && loteResultados && (
                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
                  <div className="grid grid-cols-3 gap-4 p-5">
                    <div>
                      <span style={{ fontSize: 12, color: C.text400 }}>Total Processos</span>
                      <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                        {loteResultados.total_processos}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: C.text400 }}>Consultados</span>
                      <p className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                        {loteResultados.consultados}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: C.text400 }}>Com Erro</span>
                      <p className="font-medium" style={{ fontSize: 14, color: C.statusError }}>
                        {loteResultados.com_erro}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs de selecao */}
              <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
                <div className="p-6">
                  <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
                    Selecao de Documentos
                  </h3>
                  <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
                    Escolha as categorias ou codigos dos documentos que deseja extrair
                  </p>

                  <div className="mt-5">
                    <Tabs
                      value={modoSelecao}
                      onValueChange={(v) => setModoSelecao(v as ModoSelecao)}
                    >
                      <TabsList className="rounded-lg p-1" style={{ background: C.gray100 }}>
                        <TabsTrigger
                          value="categoria"
                          className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
                          style={{ color: modoSelecao === 'categoria' ? C.navy700 : C.text500 }}
                        >
                          Categorias
                        </TabsTrigger>
                        <TabsTrigger
                          value="manual"
                          className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
                          style={{ color: modoSelecao === 'manual' ? C.navy700 : C.text500 }}
                        >
                          Manual
                        </TabsTrigger>
                        <TabsTrigger
                          value="hibrido"
                          className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors data-[state=active]:bg-white data-[state=active]:shadow-sm"
                          style={{ color: modoSelecao === 'hibrido' ? C.navy700 : C.text500 }}
                        >
                          Hibrido
                        </TabsTrigger>
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
                                className="rounded-xl border-2 p-3 text-left transition-colors"
                                style={{
                                  borderColor: categoriasSelec.has(cat.id) ? C.navy500 : C.gray200,
                                  background: categoriasSelec.has(cat.id) ? C.navy50 : '#fff',
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium" style={{ fontSize: 14, color: C.text900 }}>
                                    {cat.nome}
                                  </span>
                                  {categoriasSelec.has(cat.id) && (
                                    <Badge style={{ background: C.navy950, color: '#fff', border: 'none', fontSize: 11 }}>
                                      Selecionada
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-1" style={{ fontSize: 12, color: C.text500 }}>{cat.descricao}</p>
                                <p className="mt-1" style={{ fontSize: 12, color: C.text400 }}>
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
                            style={{ borderColor: C.gray200 }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') adicionarCodigoManual()
                            }}
                          />
                          <Button
                            variant="outline"
                            onClick={adicionarCodigoManual}
                            style={{ borderColor: C.gray200, color: C.text500 }}
                          >
                            Adicionar
                          </Button>
                        </div>
                        {codigosManuais.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {codigosManuais.map((cod) => (
                              <Badge
                                key={cod}
                                className="cursor-pointer gap-1"
                                onClick={() => removerCodigoManual(cod)}
                                style={{ background: C.gray100, color: C.text700, border: 'none' }}
                              >
                                {cod} x
                              </Badge>
                            ))}
                          </div>
                        )}
                        {codigosManuais.length === 0 && (
                          <p style={{ fontSize: 14, color: C.text400 }}>
                            Nenhum codigo adicionado. Digite o codigo do tipo de documento acima.
                          </p>
                        )}
                      </TabsContent>

                      {/* Tab Hibrido */}
                      <TabsContent value="hibrido" className="mt-4 space-y-4">
                        {/* Categorias como chips */}
                        <div>
                          <Label className="mb-2 block text-sm" style={{ color: C.text700 }}>Categorias</Label>
                          <div className="flex flex-wrap gap-2">
                            {categorias.map((cat) => (
                              <Badge
                                key={cat.id}
                                className="cursor-pointer"
                                onClick={() => toggleCategoria(cat.id)}
                                style={categoriasSelec.has(cat.id)
                                  ? { background: C.navy950, color: '#fff', border: 'none' }
                                  : { background: 'transparent', color: C.text500, border: `1px solid ${C.gray200}` }
                                }
                              >
                                {cat.nome}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Separator style={{ background: C.gray200 }} />
                        {/* Codigos manuais */}
                        <div>
                          <Label className="mb-2 block text-sm" style={{ color: C.text700 }}>
                            Codigos adicionais
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              value={codigoInput}
                              onChange={(e) => setCodigoInput(e.target.value)}
                              placeholder="Codigo (ex: 60)"
                              className="w-48"
                              style={{ borderColor: C.gray200 }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') adicionarCodigoManual()
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={adicionarCodigoManual}
                              style={{ borderColor: C.gray200, color: C.text500 }}
                            >
                              Adicionar
                            </Button>
                          </div>
                          {codigosManuais.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {codigosManuais.map((cod) => (
                                <Badge
                                  key={cod}
                                  className="cursor-pointer gap-1"
                                  onClick={() => removerCodigoManual(cod)}
                                  style={{ background: C.gray100, color: C.text700, border: 'none' }}
                                >
                                  {cod} x
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    <Separator className="my-4" style={{ background: C.gray200 }} />

                    <div className="flex justify-end">
                      {!modoLote ? (
                        <Button
                          onClick={visualizarDocumentos}
                          style={{ background: C.navy950, color: '#fff' }}
                        >
                          Visualizar Documentos
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            // Em modo lote, pula direto para opcoes de download
                            setPageState('preview')
                          }}
                          style={{ background: C.navy950, color: '#fff' }}
                        >
                          Resumo do Lote
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== Secao 3: Preview (modo individual) ===== */}
          {pageState === 'preview' && !modoLote && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
              <div className="p-6">
                <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
                  Preview de Documentos
                </h3>
                <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
                  {previewContadores().selecionados} selecionados de {previewContadores().total} encontrados
                </p>

                <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: C.gray200 }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: C.navy100 }}>
                        <TableHead className="w-[50px]" style={{ color: C.text700 }}>
                          <input
                            type="checkbox"
                            checked={previewDocs.length > 0 && previewDocs.every((d) => d.selecionado)}
                            onChange={toggleTodosPreview}
                            className="h-4 w-4 rounded"
                            style={{ borderColor: C.gray300 }}
                          />
                        </TableHead>
                        <TableHead style={{ color: C.text700 }}>Codigo</TableHead>
                        <TableHead style={{ color: C.text700 }}>Tipo</TableHead>
                        <TableHead style={{ color: C.text700 }}>Descricao</TableHead>
                        <TableHead style={{ color: C.text700 }}>Data</TableHead>
                        <TableHead style={{ color: C.text700 }}>Resolucao</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewDocs.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-gray-50">
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={doc.selecionado}
                              onChange={() => toggleDocPreview(doc.id)}
                              className="h-4 w-4 rounded"
                              style={{ borderColor: C.gray300 }}
                            />
                          </TableCell>
                          <TableCell className="font-mono" style={{ fontSize: 12, color: C.text700 }}>
                            {doc.tipo_codigo}
                          </TableCell>
                          <TableCell style={{ fontSize: 14, color: C.text700 }}>{doc.tipo_descricao}</TableCell>
                          <TableCell className="max-w-[200px] truncate" style={{ fontSize: 14, color: C.text700 }}>
                            {doc.descricao}
                          </TableCell>
                          <TableCell style={{ fontSize: 12, color: C.text500 }}>
                            {formatarData(doc.data_juntada)}
                          </TableCell>
                          <TableCell>{resolucaoBadge(doc)}</TableCell>
                        </TableRow>
                      ))}
                      {previewDocs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center" style={{ color: C.text400 }}>
                            Nenhum documento encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* ===== Secao 4: Opcoes de Download ===== */}
          {(pageState === 'preview' || (pageState === 'selecionando' && modoLote)) && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
              <div className="p-6">
                <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
                  Opcoes de Download
                </h3>
                <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
                  Configure o formato e opcoes de saida
                </p>

                <div className="mt-5 space-y-6">
                  {/* Formato */}
                  <div className="space-y-2">
                    <Label className="font-medium" style={{ fontSize: 14, color: C.text700 }}>
                      Formato de Saida
                    </Label>
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
                          className="rounded-lg border px-3 py-2 text-sm transition-colors"
                          style={{
                            borderColor: downloadOpcoes.formato === fmt.value ? C.navy500 : C.gray200,
                            background: downloadOpcoes.formato === fmt.value ? C.navy50 : '#fff',
                            color: downloadOpcoes.formato === fmt.value ? C.navy700 : C.text500,
                            fontWeight: downloadOpcoes.formato === fmt.value ? 600 : 400,
                          }}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
                      <input
                        type="checkbox"
                        checked={downloadOpcoes.mesclar_pdfs}
                        onChange={(e) =>
                          setDownloadOpcoes((prev) => ({ ...prev, mesclar_pdfs: e.target.checked }))
                        }
                        className="h-4 w-4 rounded"
                        style={{ borderColor: C.gray300 }}
                      />
                      Mesclar PDFs
                    </label>
                    <label className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
                      <input
                        type="checkbox"
                        checked={downloadOpcoes.salvar_xml}
                        onChange={(e) =>
                          setDownloadOpcoes((prev) => ({ ...prev, salvar_xml: e.target.checked }))
                        }
                        className="h-4 w-4 rounded"
                        style={{ borderColor: C.gray300 }}
                      />
                      Salvar XML completo
                    </label>

                    {/* Opcoes exclusivas do lote */}
                    {modoLote && (
                      <>
                        <label className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
                          <input
                            type="checkbox"
                            checked={downloadOpcoes.pasta_unica}
                            onChange={(e) =>
                              setDownloadOpcoes((prev) => ({ ...prev, pasta_unica: e.target.checked }))
                            }
                            className="h-4 w-4 rounded"
                            style={{ borderColor: C.gray300 }}
                          />
                          Pasta unica
                        </label>
                        <div className="flex items-center gap-3">
                          <Label style={{ fontSize: 14, color: C.text700 }}>Processos simultaneos:</Label>
                          <select
                            value={downloadOpcoes.processos_paralelos}
                            onChange={(e) =>
                              setDownloadOpcoes((prev) => ({
                                ...prev,
                                processos_paralelos: parseInt(e.target.value, 10),
                              }))
                            }
                            className="rounded-lg border px-2 py-1 text-sm"
                            style={{ borderColor: C.gray200, color: C.text700 }}
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

                  <Separator style={{ background: C.gray200 }} />

                  <div className="flex justify-end">
                    <Button
                      onClick={iniciarDownload}
                      style={{ background: C.navy950, color: '#fff' }}
                    >
                      Baixar Documentos
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Secao 5: Progresso do Download ===== */}
          {pageState === 'baixando' && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
              <div className="p-6 space-y-4">
                <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
                  Baixando Documentos
                </h3>

                {/* Barra de progresso */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: C.text500 }}>{downloadMensagem}</span>
                    <span className="font-medium" style={{ color: C.text900 }}>{downloadPercentual}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: C.gray200 }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${downloadPercentual}%`,
                        background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})`,
                      }}
                    />
                  </div>
                </div>

                {/* Logs */}
                <ScrollArea className="h-48 rounded-lg border p-3" style={{ background: '#0f172a', borderColor: C.gray200 }}>
                  <div className="space-y-1 font-mono text-xs" style={{ color: C.gray400 }}>
                    {downloadLogs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* ===== Secao 6: Download Concluido ===== */}
          {pageState === 'concluido' && (
            <div
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: '#bbf7d0' }}
            >
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.statusSuccess}, #34d399)` }} />
              <div className="flex flex-col items-center justify-center py-10" style={{ background: '#f0fdf4' }}>
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: '#dcfce7' }}
                >
                  <span className="text-2xl" style={{ color: C.statusSuccess }}>&#10003;</span>
                </div>
                <h2 className="mb-2 text-xl font-semibold" style={{ color: '#15803d' }}>
                  Download concluido!
                </h2>
                <p className="mb-6 text-sm" style={{ color: C.statusSuccess }}>{downloadMensagem}</p>
                <div className="flex gap-3">
                  {jobId && (
                    <Button
                      onClick={baixarZip}
                      style={{ background: C.statusSuccess, color: '#fff' }}
                    >
                      Baixar ZIP
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={novaConsulta}
                    style={{ borderColor: C.gray200, color: C.text500 }}
                  >
                    Nova Consulta
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ===== Secao 7: Historico (colapsavel) ===== */}
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
            <div
              className="flex cursor-pointer items-center justify-between p-5"
              onClick={() => {
                const next = !historicoAberto
                setHistoricoAberto(next)
                if (next) refetchHistorico()
              }}
            >
              <div className="flex items-center gap-2">
                <Clock style={{ width: 16, height: 16, color: C.text400 }} />
                <h3 className="font-bold" style={{ fontSize: 15, color: C.text900 }}>
                  Historico de Downloads
                </h3>
              </div>
              <span style={{ fontSize: 14, color: C.text400 }}>{historicoAberto ? '\u25B2' : '\u25BC'}</span>
            </div>

            {historicoAberto && (
              <div className="border-t px-5 pb-5" style={{ borderColor: C.gray200 }}>
                {isLoadingHistorico ? (
                  <div className="space-y-2 pt-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !historico || historico.length === 0 ? (
                  <p className="py-4 text-center text-sm" style={{ color: C.text400 }}>
                    Nenhum download registrado
                  </p>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: C.gray200 }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ background: C.navy100 }}>
                          <TableHead style={{ color: C.text700 }}>Processo</TableHead>
                          <TableHead style={{ color: C.text700 }}>Modo</TableHead>
                          <TableHead style={{ color: C.text700 }}>Formato</TableHead>
                          <TableHead style={{ color: C.text700 }}>Docs</TableHead>
                          <TableHead style={{ color: C.text700 }}>Status</TableHead>
                          <TableHead style={{ color: C.text700 }}>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historico.map((item) => (
                          <TableRow key={item.id} className="hover:bg-gray-50">
                            <TableCell className="font-mono" style={{ fontSize: 12, color: C.text700 }}>
                              {item.numero_cnj}
                            </TableCell>
                            <TableCell style={{ fontSize: 14, color: C.text700 }}>{item.modo}</TableCell>
                            <TableCell style={{ fontSize: 14, color: C.text700 }}>{item.formato}</TableCell>
                            <TableCell style={{ fontSize: 14, color: C.text700 }}>{item.total_docs}</TableCell>
                            <TableCell>
                              <Badge style={statusBadgeStyle(item.status)} className="text-xs">
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell style={{ fontSize: 12, color: C.text500 }}>
                              {formatarData(item.criado_em)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>

      </ContentArea>
    </>
  )
}
