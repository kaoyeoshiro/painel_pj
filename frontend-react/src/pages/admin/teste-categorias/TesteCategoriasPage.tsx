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
  Tags,
  Plus,
  Trash2,
  Download,
  RotateCcw,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout'

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
        '/admin/api/categorias-resumo-json/teste-categorias/categorias-ativas',
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
        '/admin/api/categorias-resumo-json/teste-categorias/validar-processos',
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
        '/admin/api/categorias-resumo-json/teste-categorias/classificar',
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
      const blob = await adminApi.blob('/admin/api/categorias-resumo-json/teste-categorias/exportar')
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
      await adminApi.post('/admin/api/categorias-resumo-json/teste-categorias/resetar-erros')
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
    <PageContainer fluid noPadding>
      <div className="px-4 pt-4">
        <PageHeader
          title="Ambiente de Teste de Categorias"
          description="Teste e valide a extracao de JSON por categoria"
          actions={
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border-2 border-amber-300 shrink-0">
              <Tags className="h-4 w-4 text-amber-600" />
              <label className="text-sm font-medium text-amber-700 whitespace-nowrap">Categoria:</label>
              <Select value={categoriaId || '__none__'} onValueChange={(v) => setCategoriaId(v === '__none__' ? '' : v)} disabled={loadingCategorias}>
                <SelectTrigger className="h-10 min-w-[240px] border-2 border-amber-400 bg-white font-semibold">
                  <SelectValue placeholder="-- Selecione uma categoria --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Selecione uma categoria --</SelectItem>
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
      </div>

      <div className="p-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-blue-50">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary-500" />
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
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {loadingValidar ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                  <Button variant="outline" onClick={handleClear} title="Limpar pendentes">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-200">
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Pendentes ({pendentes})
                  </span>
                  <Button variant="default" size="sm" onClick={handleDownloadAll} disabled={loadingExportAll}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Baixar Todos
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
                  {processosValidados.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">Selecione uma categoria</p>
                  ) : (
                    processosValidados.map((p, idx) => (
                      <div key={`${p.original}-${idx}`} className="text-xs px-2 py-1 rounded bg-gray-50 border border-gray-200">
                        {p.normalizado || p.original}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <List className="h-4 w-4 text-amber-500" />
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[calc(100vh-140px)] min-h-[560px]">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('resultados')}
                  className={`flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'resultados' ? 'border-b-[3px] border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500'
                  }`}
                >
                  <List className="h-4 w-4" />
                  Resultados ({resultados.length})
                </button>
                <button
                  onClick={() => setActiveTab('visualizacao')}
                  className={`flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'visualizacao' ? 'border-b-[3px] border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Visualizacao
                </button>
                <button
                  onClick={() => setActiveTab('progresso')}
                  className={`flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'progresso' ? 'border-b-[3px] border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500'
                  }`}
                >
                  <List className="h-4 w-4" />
                  Progresso
                </button>
              </div>

              {activeTab === 'resultados' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Status:</label>
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
                      <div className="h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <AlertTriangle className="h-14 w-14 mx-auto mb-3 text-amber-500" />
                          <p className="text-2xl text-amber-500">Selecione uma categoria</p>
                          <p className="text-sm mt-1">Os resultados sao exibidos por categoria</p>
                        </div>
                      </div>
                    ) : filteredResults.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        <p className="text-xl">Nenhum resultado ainda. Selecione uma categoria e classifique os processos.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredResults.map((res, idx) => (
                          <Card key={`${res.processo}-${idx}`} className="p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-mono text-sm font-semibold">{res.processo}</h3>
                              <Badge variant={res.status === 'ok' ? 'success' : 'destructive'}>{res.status}</Badge>
                            </div>
                            <p className="text-xs text-gray-500">Modelo: {res.modelo_usado} | Tokens: {res.tokens_usados}</p>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'visualizacao' && (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Eye className="h-14 w-14 mx-auto mb-3" />
                    <p className="text-lg">Selecione um item na aba Resultados</p>
                  </div>
                </div>
              )}

              {activeTab === 'progresso' && (
                <div className="h-full overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 text-center">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-3xl font-bold text-gray-800">{progressStats.total}</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-sm text-gray-500">Sucesso</p>
                      <p className="text-3xl font-bold text-green-600">{progressStats.ok}</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-sm text-gray-500">Erros</p>
                      <p className="text-3xl font-bold text-red-600">{progressStats.erros}</p>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
