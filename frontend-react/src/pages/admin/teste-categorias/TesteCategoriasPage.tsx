import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { AdminSubNav } from '@/components/layout'
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

type StatusFilter = 'todos' | 'ok' | 'erro'
type ActiveTab = 'resultados' | 'visualizacao' | 'progresso'

export function TesteCategoriasPage() {
  const { toast } = useToast()

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

  useEffect(() => {
    void carregarCategorias()
  }, [])

  async function carregarCategorias(): Promise<void> {
    setLoadingCategorias(true)
    try {
      const data = await adminApi.get<Categoria[]>(
        '/admin/api/teste-categorias/categorias-ativas',
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
      toast({ variant: 'destructive', title: 'Sem processos válidos' })
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

  async function classificarProcessos(): Promise<void> {
    const processosAptos = processosValidados
      .filter((p) => p.valido && p.normalizado)
      .map((p) => p.normalizado as string)

    if (!categoriaId) {
      toast({ variant: 'destructive', title: 'Selecione uma categoria' })
      return
    }

    if (processosAptos.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhum processo válido para classificar' })
      return
    }

    setLoadingClassificar(true)
    try {
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

  const handleClear = useCallback((): void => {
    setTextProcessos('')
    setProcessosValidados([])
    setResultados([])
    setStatusFilter('todos')
    setCompareModels(false)
    setObservations('')
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

  const pendentes = processosValidados.filter((p) => p.valido).length

  return (
    <>
      <BreadcrumbBar
        title="Ambiente de Teste de Categorias"
        icon={<FlaskConical style={{ width: 14, height: 14 }} />}
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
                  <Button variant="default" size="sm" onClick={handleDownloadAll} disabled={loadingExportAll}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Baixar Todos
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
                  {processosValidados.length === 0 ? (
                    <p className="text-center text-sm py-4" style={{ color: C.text400 }}>Selecione uma categoria</p>
                  ) : (
                    processosValidados.map((p, idx) => (
                      <div key={`${p.original}-${idx}`} className="text-xs px-2 py-1 rounded" style={{ background: C.gray50, border: `1px solid ${C.gray200}` }}>
                        {p.normalizado || p.original}
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
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full text-sm resize-none"
                  placeholder="Anote erros, ajustes no prompt, etc..."
                />
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
                              <Badge variant={res.status === 'ok' ? 'success' : 'destructive'}>{res.status}</Badge>
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
                <div className="h-full flex items-center justify-center" style={{ color: C.text400 }}>
                  <div className="text-center">
                    <Eye className="h-14 w-14 mx-auto mb-3" />
                    <p className="text-lg">Selecione um item na aba Resultados</p>
                  </div>
                </div>
              )}

              {activeTab === 'progresso' && (
                <div className="h-full overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 text-center rounded-2xl" style={{ borderColor: C.gray200 }}>
                      <p className="text-sm" style={{ color: C.text500 }}>Total</p>
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
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentArea>
    </>
  )
}
