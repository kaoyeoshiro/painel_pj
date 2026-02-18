import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { adminApi } from '@/lib/api'
import {
  AlertTriangle,
  Eye,
  List,
  Plus,
  Trash2,
  Download,
  RotateCcw,
  FlaskConical,
  FileDown,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { AdminSubNav } from '@/components/layout'
import { GroupSelector } from '@/components/ui/GroupSelector'
import { C } from '@/lib/designTokens'

interface Categoria {
  id: number
  nome: string
}

interface ProcessoValidado {
  original: string
  normalizado: string | null
  valido: boolean
  erro: string | null
}

interface ClassificacaoResultado {
  processo: string
  categoria_id: number
  json_extraido: Record<string, unknown>
  modelo_usado: string
  tempo_segundos: number
  tokens_usados: number
  status: 'ok' | 'erro'
  erro?: string
}

interface ComparacaoResultado {
  processo: string
  acordo: boolean
  diferencas: string[]
  modelo_a: { nome: string; json_extraido: Record<string, unknown>; tempo_segundos: number }
  modelo_b: { nome: string; json_extraido: Record<string, unknown>; tempo_segundos: number }
}

interface FormatoCampo {
  type: string
  description: string
}

interface DocumentoTeste {
  id: number
  processo: string
  categoria_id: number
  json_extraido: Record<string, unknown>
  modelo_usado: string
  status: string
}

type StatusFilter = 'todos' | 'ok' | 'erro'
type ActiveTab = 'resultados' | 'visualizacao' | 'progresso'
type DownloadStatus = 'pendente' | 'baixando' | 'ok' | 'erro'

export function TesteCategoriasPage() {
  const { toast } = useToast()

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState<string>('')

  const [textProcessos, setTextProcessos] = useState<string>('')
  const [processosValidados, setProcessosValidados] = useState<ProcessoValidado[]>([])
  const [resultados, setResultados] = useState<ClassificacaoResultado[]>([])

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [compareModels, setCompareModels] = useState(false)
  const [observations, setObservations] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('resultados')

  const [loadingCategorias, setLoadingCategorias] = useState(false)
  const [loadingValidar, setLoadingValidar] = useState(false)
  const [loadingClassificar, setLoadingClassificar] = useState(false)
  const [loadingExportAll, setLoadingExportAll] = useState(false)
  const [loadingResetErrors, setLoadingResetErrors] = useState(false)

  // Estados para features orfas
  const [pdfCache, setPdfCache] = useState<Record<string, string>>({})
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadStatus>>({})
  const [formatoCategoria, setFormatoCategoria] = useState<Record<string, FormatoCampo> | null>(null)
  const [comparacaoResult, setComparacaoResult] = useState<ComparacaoResultado | null>(null)
  const [documentosDB, setDocumentosDB] = useState<DocumentoTeste[]>([])
  const [loadingDownload, setLoadingDownload] = useState(false)
  const [loadingComparacao, setLoadingComparacao] = useState(false)
  const [processoSelecionado, setProcessoSelecionado] = useState<string | null>(null)
  const [dialogComparacao, setDialogComparacao] = useState(false)
  const observationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selectedGroupId) {
      void carregarCategorias()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Recarrega quando grupo muda
  }, [selectedGroupId])

  // Carregar observacoes e formato ao selecionar categoria
  useEffect(() => {
    if (!categoriaId) {
      setObservations('')
      setFormatoCategoria(null)
      setDocumentosDB([])
      return
    }
    void carregarObservacoes(Number(categoriaId))
    void carregarFormato(Number(categoriaId))
    void carregarDocumentos(Number(categoriaId))
  }, [categoriaId])

  async function carregarCategorias(): Promise<void> {
    if (!selectedGroupId) return
    setLoadingCategorias(true)
    setCategorias([])
    setCategoriaId('')
    try {
      const data = await adminApi.get<Categoria[]>(
        `/admin/api/teste-categorias/categorias-ativas?group_id=${selectedGroupId}`,
      )
      setCategorias(data)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar categorias',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingCategorias(false)
    }
  }

  /** Carregar observacoes persistentes do backend */
  async function carregarObservacoes(catId: number): Promise<void> {
    try {
      const data = await adminApi.get<{ observacao: string }>(
        `/admin/api/teste-categorias/observacao/${catId}`,
      )
      setObservations(data.observacao || '')
    } catch {
      // Ignora erro — categoria pode nao ter observacoes ainda
      setObservations('')
    }
  }

  /** Salvar observacoes com debounce */
  function handleObservationChange(value: string): void {
    setObservations(value)
    if (observationTimerRef.current) clearTimeout(observationTimerRef.current)
    if (!categoriaId) return
    observationTimerRef.current = setTimeout(async () => {
      try {
        await adminApi.put(
          `/admin/api/teste-categorias/observacao/${categoriaId}`,
          { observacao: value },
        )
      } catch {
        // Falha silenciosa — nao bloquear o usuario
      }
    }, 500)
  }

  /** Carregar formato JSON da categoria */
  async function carregarFormato(catId: number): Promise<void> {
    try {
      const data = await adminApi.get<Record<string, FormatoCampo>>(
        `/admin/api/teste-categorias/categoria/${catId}/formato`,
      )
      setFormatoCategoria(data)
    } catch {
      setFormatoCategoria(null)
    }
  }

  /** Carregar documentos salvos no backend */
  async function carregarDocumentos(catId: number): Promise<void> {
    try {
      const data = await adminApi.get<DocumentoTeste[]>(
        `/admin/api/teste-categorias/documentos/${catId}`,
      )
      setDocumentosDB(data)
    } catch {
      setDocumentosDB([])
    }
  }

  async function adicionarProcessos(): Promise<void> {
    if (!textProcessos.trim()) {
      toast({ variant: 'destructive', title: 'Campo vazio', description: 'Digite ao menos um processo' })
      return
    }

    const linhas = textProcessos
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (linhas.length === 0) {
      toast({ variant: 'destructive', title: 'Sem processos validos' })
      return
    }

    setLoadingValidar(true)
    try {
      const data = await adminApi.post<ProcessoValidado[]>(
        '/admin/api/teste-categorias/validar-processos',
        { processos: linhas },
      )
      setProcessosValidados(data)
      setResultados([])
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao validar processos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingValidar(false)
    }
  }

  /** Classificar processos — usa lote se PDFs disponiveis no cache */
  async function classificarProcessos(): Promise<void> {
    const processosAptos = processosValidados
      .filter((p) => p.valido && p.normalizado)
      .map((p) => p.normalizado as string)

    if (!categoriaId) {
      toast({ variant: 'destructive', title: 'Selecione uma categoria' })
      return
    }

    if (processosAptos.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhum processo valido para classificar' })
      return
    }

    setLoadingClassificar(true)
    try {
      // Verifica se ha PDFs no cache para usar lote
      const itensComPdf = processosAptos
        .filter(p => pdfCache[p])
        .map(p => ({ processo: p, pdf_base64: pdfCache[p] }))

      if (itensComPdf.length > 0) {
        const data = await adminApi.post<ClassificacaoResultado[]>(
          '/admin/api/teste-categorias/classificar-lote',
          {
            categoria_id: Number(categoriaId),
            itens: itensComPdf,
          },
        )
        setResultados(data)
        // Salvar resultados no backend
        await salvarDocumentosLote(data)
      } else {
        const data = await adminApi.post<ClassificacaoResultado[]>(
          '/admin/api/teste-categorias/classificar',
          {
            processos: processosAptos,
            categoria_id: Number(categoriaId),
            comparar_modelos: compareModels,
            observacoes: observations || undefined,
          },
        )
        setResultados(data)
        await salvarDocumentosLote(data)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao classificar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingClassificar(false)
    }
  }

  /** Salvar resultados em lote no backend */
  async function salvarDocumentosLote(resultadosParaSalvar: ClassificacaoResultado[]): Promise<void> {
    if (!categoriaId || resultadosParaSalvar.length === 0) return
    try {
      await adminApi.post('/admin/api/teste-categorias/documentos/lote', {
        categoria_id: Number(categoriaId),
        documentos: resultadosParaSalvar.map(r => ({
          processo: r.processo,
          json_extraido: r.json_extraido,
          modelo_usado: r.modelo_usado,
          status: r.status,
        })),
      })
    } catch {
      // Falha silenciosa — resultados ja estao em memoria
    }
  }

  /** Baixar PDFs dos processos */
  async function handleDownloadDocumentos(): Promise<void> {
    const processosAptos = processosValidados
      .filter((p) => p.valido && p.normalizado)
      .map((p) => p.normalizado as string)

    if (!categoriaId || processosAptos.length === 0) {
      toast({ variant: 'destructive', title: 'Adicione processos validos primeiro' })
      return
    }

    setLoadingDownload(true)
    setActiveTab('progresso')

    // Inicializar progresso
    const progressInicial: Record<string, DownloadStatus> = {}
    processosAptos.forEach(p => { progressInicial[p] = 'pendente' })
    setDownloadProgress(progressInicial)

    // Marcar todos como baixando
    processosAptos.forEach(p => {
      setDownloadProgress(prev => ({ ...prev, [p]: 'baixando' }))
    })

    try {
      const data = await adminApi.post<Record<string, { pdf_base64: string; status: string }>>(
        '/admin/api/teste-categorias/baixar-documentos',
        {
          processos: processosAptos,
          categoria_id: Number(categoriaId),
        },
      )

      const novoPdfCache: Record<string, string> = { ...pdfCache }
      const novoProgress: Record<string, DownloadStatus> = {}

      for (const processo of processosAptos) {
        const item = data[processo]
        if (item?.pdf_base64) {
          novoPdfCache[processo] = item.pdf_base64
          novoProgress[processo] = 'ok'
        } else {
          novoProgress[processo] = 'erro'
        }
      }

      setPdfCache(novoPdfCache)
      setDownloadProgress(novoProgress)
      const okCount = Object.values(novoProgress).filter(s => s === 'ok').length
      toast({ title: `Download concluido`, description: `${okCount}/${processosAptos.length} PDFs baixados` })
    } catch (error) {
      processosAptos.forEach(p => {
        setDownloadProgress(prev => ({ ...prev, [p]: 'erro' }))
      })
      toast({
        variant: 'destructive',
        title: 'Erro ao baixar documentos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingDownload(false)
    }
  }

  /** Comparar 2 modelos para um processo especifico */
  async function handleComparar(processo: string): Promise<void> {
    if (!categoriaId || !pdfCache[processo]) {
      toast({ variant: 'destructive', title: 'PDF nao disponivel para comparacao' })
      return
    }

    setLoadingComparacao(true)
    setProcessoSelecionado(processo)
    setDialogComparacao(true)
    try {
      const data = await adminApi.post<ComparacaoResultado>(
        '/admin/api/teste-categorias/classificar-comparacao',
        {
          processo,
          categoria_id: Number(categoriaId),
          pdf_base64: pdfCache[processo],
        },
      )
      setComparacaoResult(data)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na comparacao',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
      setDialogComparacao(false)
    } finally {
      setLoadingComparacao(false)
    }
  }

  const handleClear = useCallback((): void => {
    setTextProcessos('')
    setProcessosValidados([])
    setResultados([])
    setStatusFilter('todos')
    setCompareModels(false)
    setPdfCache({})
    setDownloadProgress({})
    setComparacaoResult(null)
    setProcessoSelecionado(null)
  }, [])

  async function handleDownloadAll(): Promise<void> {
    setLoadingExportAll(true)
    try {
      const blob = await adminApi.blob('/admin/api/teste-categorias/exportar')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resultados-teste-categorias-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingExportAll(false)
    }
  }

  async function handleResetErrors(): Promise<void> {
    setLoadingResetErrors(true)
    try {
      await adminApi.post('/admin/api/teste-categorias/resetar-erros')
      setResultados((prev) =>
        prev.map((r) => (r.status === 'erro' ? { ...r, status: 'ok', erro: undefined } : r)),
      )
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao resetar erros',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingResetErrors(false)
    }
  }

  const filteredResults = useMemo(() => {
    if (statusFilter === 'todos') return resultados
    return resultados.filter((r) => r.status === statusFilter)
  }, [resultados, statusFilter])

  const progressStats = useMemo(() => {
    const total = resultados.length
    const ok = resultados.filter((r) => r.status === 'ok').length
    const erros = resultados.filter((r) => r.status === 'erro').length
    return { total, ok, erros }
  }, [resultados])

  const downloadStats = useMemo(() => {
    const entries = Object.values(downloadProgress)
    return {
      total: entries.length,
      ok: entries.filter(s => s === 'ok').length,
      baixando: entries.filter(s => s === 'baixando').length,
      erro: entries.filter(s => s === 'erro').length,
    }
  }, [downloadProgress])

  const pendentes = processosValidados.filter((p) => p.valido).length

  return (
    <>
      <BreadcrumbBar
        title="Ambiente de Teste de Categorias"
        icon={<FlaskConical className="w-3.5 h-3.5" />}
        actions={
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap" style={{ color: C.text500 }}>Categoria:</label>
            <Select value={categoriaId || '__none__'} onValueChange={(v) => setCategoriaId(v === '__none__' ? '' : v)} disabled={loadingCategorias}>
              <SelectTrigger className="h-9 min-w-[240px] bg-white text-sm" style={{ borderColor: C.gray300 }} data-testid="select-categoria">
                <SelectValue placeholder={loadingCategorias ? 'Carregando...' : '-- Selecione --'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Selecione --</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <ContentArea className="space-y-6">
        <AdminSubNav />

        <GroupSelector
          selectedGroupId={selectedGroupId}
          onGroupChange={setSelectedGroupId}
        />

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <Card className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: C.gray200 }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: C.gray200, background: C.navy50 }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: C.text700 }}>
                  <Plus className="h-4 w-4" style={{ color: C.navy600 }} />
                  Adicionar Processos
                </h3>
              </div>
              <div className="p-4">
                <Textarea
                  id="input-processos"
                  rows={4}
                  value={textProcessos}
                  onChange={(e) => setTextProcessos(e.target.value)}
                  className="w-full font-mono text-sm resize-none"
                  placeholder="Cole os numeros aqui (um por linha)..."
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={adicionarProcessos}
                    disabled={loadingValidar}
                    className="flex-1 text-white"
                    style={{ background: C.navy950 }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {loadingValidar ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                  <Button variant="outline" onClick={handleClear} title="Limpar pendentes" data-testid="btn-limpar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="border-t" style={{ borderColor: C.gray200 }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ background: C.gray50 }}>
                  <span className="text-sm font-medium flex items-center gap-1" style={{ color: C.text500 }}>
                    <AlertTriangle className="h-4 w-4" style={{ color: C.statusWarning }} />
                    Pendentes ({pendentes})
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadDocumentos}
                      disabled={loadingDownload || pendentes === 0 || !categoriaId}
                      title="Baixar PDFs dos processos"
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1" style={{ color: C.navy700 }} />
                      {loadingDownload ? 'Baixando...' : 'Baixar PDFs'}
                    </Button>
                    <Button variant="default" size="sm" onClick={handleDownloadAll} disabled={loadingExportAll}>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Baixar Todos
                    </Button>
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
                  {processosValidados.length === 0 ? (
                    <p className="text-center text-sm py-4" style={{ color: C.text400 }}>Selecione uma categoria</p>
                  ) : (
                    processosValidados.map((p, idx) => (
                      <div key={`${p.original}-${idx}`} className="text-xs px-2 py-1 rounded flex items-center justify-between" style={{ background: C.gray50, border: `1px solid ${C.gray200}` }}>
                        <span>{p.normalizado || p.original}</span>
                        {downloadProgress[p.normalizado || p.original] && (
                          <span className="ml-2">
                            {downloadProgress[p.normalizado || p.original] === 'baixando' && <Loader2 className="h-3 w-3 animate-spin" style={{ color: C.navy600 }} />}
                            {downloadProgress[p.normalizado || p.original] === 'ok' && <CheckCircle2 className="h-3 w-3" style={{ color: C.statusSuccess }} />}
                            {downloadProgress[p.normalizado || p.original] === 'erro' && <XCircle className="h-3 w-3" style={{ color: C.statusError }} />}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            <Card className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: C.gray200 }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: C.gray200, background: C.navy50 }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: C.text700 }}>
                  <List className="h-4 w-4" style={{ color: C.navy600 }} />
                  Observacoes
                </h3>
              </div>
              <div className="p-3">
                <Textarea
                  rows={5}
                  value={observations}
                  onChange={(e) => handleObservationChange(e.target.value)}
                  className="w-full text-sm resize-none"
                  placeholder="Anote erros, ajustes no prompt, etc..."
                />
                {categoriaId && (
                  <p className="text-xs mt-1" style={{ color: C.text400 }}>Salva automaticamente</p>
                )}
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-140px)] min-h-[560px]" style={{ border: `1px solid ${C.gray200}` }}>
              <div className="flex border-b" style={{ borderColor: C.gray200 }}>
                <button
                  onClick={() => setActiveTab('resultados')}
                  className="flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2"
                  style={{
                    borderBottom: activeTab === 'resultados' ? `3px solid ${C.navy700}` : '3px solid transparent',
                    color: activeTab === 'resultados' ? C.navy700 : C.text500,
                    background: activeTab === 'resultados' ? C.navy50 : 'transparent',
                  }}
                  data-testid="tab-resultados"
                >
                  <List className="h-4 w-4" />
                  Resultados ({resultados.length})
                </button>
                <button
                  onClick={() => setActiveTab('visualizacao')}
                  className="flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2"
                  style={{
                    borderBottom: activeTab === 'visualizacao' ? `3px solid ${C.navy700}` : '3px solid transparent',
                    color: activeTab === 'visualizacao' ? C.navy700 : C.text500,
                    background: activeTab === 'visualizacao' ? C.navy50 : 'transparent',
                  }}
                  data-testid="tab-visualizacao"
                >
                  <Eye className="h-4 w-4" />
                  Visualizacao
                </button>
                <button
                  onClick={() => setActiveTab('progresso')}
                  className="flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2"
                  style={{
                    borderBottom: activeTab === 'progresso' ? `3px solid ${C.navy700}` : '3px solid transparent',
                    color: activeTab === 'progresso' ? C.navy700 : C.text500,
                    background: activeTab === 'progresso' ? C.navy50 : 'transparent',
                  }}
                  data-testid="tab-progresso"
                >
                  <List className="h-4 w-4" />
                  Progresso
                </button>
              </div>

              {activeTab === 'resultados' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b flex items-center gap-4 flex-wrap" style={{ borderColor: C.gray200, background: C.gray50 }}>
                    <div className="flex items-center gap-2">
                      <label className="text-sm" style={{ color: C.text500 }}>Status:</label>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                        <SelectTrigger className="h-9 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="ok">Sucesso</SelectItem>
                          <SelectItem value="erro">Erro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200">
                      <Checkbox
                        checked={compareModels}
                        onCheckedChange={(checked) => setCompareModels(checked === true)}
                        id="toggle-comparacao"
                      />
                      <label htmlFor="toggle-comparacao" className="text-sm text-indigo-700 cursor-pointer whitespace-nowrap">
                        Comparar 2 modelos
                      </label>
                    </div>

                    <Button onClick={classificarProcessos} disabled={loadingClassificar} className="bg-green-600 hover:bg-green-700 text-white">
                      {loadingClassificar ? 'Classificando...' : 'Classificar Pendentes'}
                    </Button>

                    <Button variant="outline" onClick={handleResetErrors} disabled={loadingResetErrors} className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Resetar Erros
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {!categoriaId ? (
                      <div className="h-full flex items-center justify-center" style={{ color: C.text400 }}>
                        <div className="text-center">
                          <AlertTriangle className="h-14 w-14 mx-auto mb-3" style={{ color: C.statusWarning }} />
                          <p className="text-2xl" style={{ color: C.statusWarning }}>Selecione uma categoria</p>
                          <p className="text-sm mt-1">Os resultados sao exibidos por categoria</p>
                        </div>
                      </div>
                    ) : filteredResults.length === 0 ? (
                      <div className="h-full flex items-center justify-center" style={{ color: C.text400 }}>
                        <p className="text-xl">Nenhum resultado ainda. Selecione uma categoria e classifique os processos.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredResults.map((res, idx) => (
                          <Card key={`${res.processo}-${idx}`} className="p-4 rounded-2xl" style={{ borderColor: C.gray200 }}>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-mono text-sm font-semibold" style={{ color: C.text900 }}>{res.processo}</h3>
                              <div className="flex items-center gap-2">
                                {compareModels && pdfCache[res.processo] && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleComparar(res.processo)}
                                    disabled={loadingComparacao}
                                    className="text-xs"
                                  >
                                    Comparar
                                  </Button>
                                )}
                                <Badge variant={res.status === 'ok' ? 'success' : 'destructive'}>{res.status}</Badge>
                              </div>
                            </div>
                            <p className="text-xs" style={{ color: C.text500 }}>Modelo: {res.modelo_usado} | Tokens: {res.tokens_usados}</p>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'visualizacao' && (
                <div className="h-full overflow-y-auto p-6">
                  {/* Formato da categoria */}
                  {formatoCategoria && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold mb-3" style={{ color: C.text700 }}>Formato da Categoria</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(formatoCategoria).map(([campo, info]) => (
                          <div key={campo} className="p-3 rounded-xl" style={{ background: C.gray50, border: `1px solid ${C.gray200}` }}>
                            <p className="text-sm font-mono font-semibold" style={{ color: C.navy700 }}>{campo}</p>
                            <p className="text-xs mt-1" style={{ color: C.text500 }}>{info.description}</p>
                            <Badge variant="default" className="mt-1 text-xs">{info.type}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resultado da comparacao */}
                  {comparacaoResult && (
                    <div className="mb-6">
                      <div
                        className="p-4 rounded-xl mb-4"
                        style={{
                          background: comparacaoResult.acordo ? C.successBg : C.warningBgAlt,
                          border: `1px solid ${comparacaoResult.acordo ? C.statusSuccess : C.statusWarning}`,
                        }}
                      >
                        <p className="text-sm font-semibold" style={{ color: comparacaoResult.acordo ? C.successText : C.warningText }}>
                          {comparacaoResult.acordo
                            ? '100% acordo entre os modelos'
                            : `${comparacaoResult.diferencas.length} diferenca(s) encontrada(s)`}
                        </p>
                        {comparacaoResult.diferencas.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {comparacaoResult.diferencas.map((d, i) => (
                              <li key={i} className="text-xs" style={{ color: C.warningText }}>- {d}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="p-4 rounded-2xl" style={{ borderLeft: `4px solid ${C.statusSuccess}`, borderColor: C.gray200 }}>
                          <p className="text-sm font-semibold mb-1" style={{ color: C.text700 }}>{comparacaoResult.modelo_a.nome}</p>
                          <p className="text-xs mb-2" style={{ color: C.text400 }}>{comparacaoResult.modelo_a.tempo_segundos.toFixed(1)}s</p>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                            {JSON.stringify(comparacaoResult.modelo_a.json_extraido, null, 2)}
                          </pre>
                        </Card>
                        <Card className="p-4 rounded-2xl" style={{ borderLeft: `4px solid ${C.statusWarning}`, borderColor: C.gray200 }}>
                          <p className="text-sm font-semibold mb-1" style={{ color: C.text700 }}>{comparacaoResult.modelo_b.nome}</p>
                          <p className="text-xs mb-2" style={{ color: C.text400 }}>{comparacaoResult.modelo_b.tempo_segundos.toFixed(1)}s</p>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                            {JSON.stringify(comparacaoResult.modelo_b.json_extraido, null, 2)}
                          </pre>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Resultado selecionado */}
                  {processoSelecionado && !comparacaoResult && (
                    <div className="text-center py-8" style={{ color: C.text400 }}>
                      <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
                      <p>Carregando comparacao...</p>
                    </div>
                  )}

                  {!formatoCategoria && !comparacaoResult && !processoSelecionado && (
                    <div className="h-full flex items-center justify-center" style={{ color: C.text400 }}>
                      <div className="text-center">
                        <Eye className="h-14 w-14 mx-auto mb-3" />
                        <p className="text-lg">Selecione uma categoria para ver o formato</p>
                        <p className="text-sm mt-1">Ou compare modelos na aba Resultados</p>
                      </div>
                    </div>
                  )}

                  {/* Documentos salvos no backend */}
                  {documentosDB.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold mb-3" style={{ color: C.text700 }}>
                        Documentos Salvos ({documentosDB.length})
                      </h3>
                      <div className="space-y-2">
                        {documentosDB.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: C.gray50, border: `1px solid ${C.gray200}` }}>
                            <span className="font-mono text-xs" style={{ color: C.text700 }}>{doc.processo}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: C.text400 }}>{doc.modelo_usado}</span>
                              <Badge variant={doc.status === 'ok' ? 'success' : 'destructive'} className="text-xs">{doc.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'progresso' && (
                <div className="h-full overflow-y-auto p-6">
                  {/* Stats de classificacao */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="p-4 text-center rounded-2xl" style={{ borderColor: C.gray200 }}>
                      <p className="text-sm" style={{ color: C.text500 }}>Total Classificados</p>
                      <p className="text-3xl font-bold" style={{ color: C.text900 }}>{progressStats.total}</p>
                    </Card>
                    <Card className="p-4 text-center rounded-2xl" style={{ borderColor: C.gray200 }}>
                      <p className="text-sm" style={{ color: C.text500 }}>Sucesso</p>
                      <p className="text-3xl font-bold" style={{ color: C.statusSuccess }}>{progressStats.ok}</p>
                    </Card>
                    <Card className="p-4 text-center rounded-2xl" style={{ borderColor: C.gray200 }}>
                      <p className="text-sm" style={{ color: C.text500 }}>Erros</p>
                      <p className="text-3xl font-bold" style={{ color: C.statusError }}>{progressStats.erros}</p>
                    </Card>
                  </div>

                  {/* Stats de download */}
                  {downloadStats.total > 0 && (
                    <>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: C.text700 }}>Download de PDFs</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="p-4 text-center rounded-2xl" style={{ borderColor: C.gray200 }}>
                          <p className="text-sm" style={{ color: C.text500 }}>Baixados</p>
                          <p className="text-3xl font-bold" style={{ color: C.statusSuccess }}>{downloadStats.ok}</p>
                        </Card>
                        <Card className="p-4 text-center rounded-2xl" style={{ borderColor: C.gray200 }}>
                          <p className="text-sm" style={{ color: C.text500 }}>Em andamento</p>
                          <p className="text-3xl font-bold" style={{ color: C.navy600 }}>{downloadStats.baixando}</p>
                        </Card>
                        <Card className="p-4 text-center rounded-2xl" style={{ borderColor: C.gray200 }}>
                          <p className="text-sm" style={{ color: C.text500 }}>Falhas</p>
                          <p className="text-3xl font-bold" style={{ color: C.statusError }}>{downloadStats.erro}</p>
                        </Card>
                      </div>

                      {/* Lista detalhada de progresso por processo */}
                      <div className="space-y-1">
                        {Object.entries(downloadProgress).map(([processo, status]) => (
                          <div
                            key={processo}
                            className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                            style={{ background: C.gray50, border: `1px solid ${C.gray200}` }}
                          >
                            <span className="font-mono text-xs" style={{ color: C.text700 }}>{processo}</span>
                            <span className="flex items-center gap-1">
                              {status === 'pendente' && <span className="text-xs" style={{ color: C.text400 }}>Pendente</span>}
                              {status === 'baixando' && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C.navy600 }} />}
                              {status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: C.statusSuccess }} />}
                              {status === 'erro' && <XCircle className="h-3.5 w-3.5" style={{ color: C.statusError }} />}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentArea>

      {/* Dialog de comparacao de modelos */}
      <Dialog open={dialogComparacao} onOpenChange={setDialogComparacao}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparacao de Modelos — {processoSelecionado}</DialogTitle>
            <DialogDescription className="sr-only">
              Resultados da comparacao entre modelos de classificacao
            </DialogDescription>
          </DialogHeader>
          {loadingComparacao ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: C.navy600 }} />
            </div>
          ) : comparacaoResult ? (
            <div className="space-y-4">
              <div
                className="p-4 rounded-xl"
                style={{
                  background: comparacaoResult.acordo ? C.successBg : C.warningBgAlt,
                  border: `1px solid ${comparacaoResult.acordo ? C.statusSuccess : C.statusWarning}`,
                }}
              >
                <p className="text-sm font-semibold" style={{ color: comparacaoResult.acordo ? C.successText : C.warningText }}>
                  {comparacaoResult.acordo
                    ? '100% acordo entre os modelos'
                    : `${comparacaoResult.diferencas.length} diferenca(s) encontrada(s)`}
                </p>
                {comparacaoResult.diferencas.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {comparacaoResult.diferencas.map((d, i) => (
                      <li key={i} className="text-xs" style={{ color: C.warningText }}>- {d}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 rounded-2xl" style={{ borderLeft: `4px solid ${C.statusSuccess}`, borderColor: C.gray200 }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: C.text700 }}>Modelo A: {comparacaoResult.modelo_a.nome}</p>
                  <p className="text-xs mb-2" style={{ color: C.text400 }}>{comparacaoResult.modelo_a.tempo_segundos.toFixed(1)}s</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(comparacaoResult.modelo_a.json_extraido, null, 2)}
                  </pre>
                </Card>
                <Card className="p-4 rounded-2xl" style={{ borderLeft: `4px solid ${C.statusWarning}`, borderColor: C.gray200 }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: C.text700 }}>Modelo B: {comparacaoResult.modelo_b.nome}</p>
                  <p className="text-xs mb-2" style={{ color: C.text400 }}>{comparacaoResult.modelo_b.tempo_segundos.toFixed(1)}s</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(comparacaoResult.modelo_b.json_extraido, null, 2)}
                  </pre>
                </Card>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
