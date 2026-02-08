import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { adminApi } from '@/lib/api'
import { PageContainer } from '@/components/layout'

// ── Estruturas de dados locais ──

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

/** Tipo do filtro de status dos resultados */
type StatusFilter = 'todos' | 'ok' | 'erro'

// ── Componente auxiliar: visualizacao JSON com syntax highlighting ──

/**
 * Renderiza JSON com cores diferenciadas por tipo de valor.
 * Chaves em azul, strings em verde, numeros em laranja, booleanos em roxo.
 */
function JsonHighlighted({ data, level = 0 }: { data: unknown; level?: number }) {
  const indent = '  '.repeat(level)
  const nextIndent = '  '.repeat(level + 1)

  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">null</span>
  }

  if (typeof data === 'string') {
    return <span className="text-green-600 dark:text-green-400">&quot;{data}&quot;</span>
  }

  if (typeof data === 'number') {
    return <span className="text-orange-600 dark:text-orange-400">{data}</span>
  }

  if (typeof data === 'boolean') {
    return <span className="text-purple-600 dark:text-purple-400">{data ? 'true' : 'false'}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>{'[]'}</span>
    return (
      <span>
        {'[\n'}
        {data.map((item, idx) => (
          <span key={idx}>
            {nextIndent}
            <JsonHighlighted data={item} level={level + 1} />
            {idx < data.length - 1 ? ',\n' : '\n'}
          </span>
        ))}
        {indent}{']'}
      </span>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) return <span>{'{}'}</span>
    return (
      <span>
        {'{\n'}
        {entries.map(([key, value], idx) => (
          <span key={key}>
            {nextIndent}
            <span className="text-blue-600 dark:text-blue-400">&quot;{key}&quot;</span>
            {': '}
            <JsonHighlighted data={value} level={level + 1} />
            {idx < entries.length - 1 ? ',\n' : '\n'}
          </span>
        ))}
        {indent}{'}'}
      </span>
    )
  }

  return <span>{String(data)}</span>
}

// ── Componente principal ──

export function TesteCategoriasPage() {
  const { toast } = useToast()

  // Estado principal
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [textProcessos, setTextProcessos] = useState<string>('')
  const [processosValidados, setProcessosValidados] = useState<ProcessoValidado[]>([])
  const [resultados, setResultados] = useState<ClassificacaoResultado[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(false)
  const [loadingValidar, setLoadingValidar] = useState(false)
  const [loadingClassificar, setLoadingClassificar] = useState(false)

  // Estado dos novos controles
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [compareModels, setCompareModels] = useState(false)
  const [observations, setObservations] = useState<string>('')
  const [loadingResetErrors, setLoadingResetErrors] = useState(false)
  const [loadingReclassifyErrors, setLoadingReclassifyErrors] = useState(false)
  const [loadingExportAll, setLoadingExportAll] = useState(false)
  const [loadingExportExpired, setLoadingExportExpired] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('resultados')

  // Carregar categorias ao montar
  useEffect(() => {
    carregarCategorias()
  }, [])

  // ── Funcoes de carregamento ──

  /** Busca categorias ativas no backend */
  async function carregarCategorias(): Promise<void> {
    setLoadingCategorias(true)
    try {
      const data = await adminApi.get<Categoria[]>(
        '/admin/api/categorias-resumo-json/teste-categorias/categorias-ativas'
      )
      setCategorias(data)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar categorias',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingCategorias(false)
    }
  }

  // ── Funcoes de acao ──

  /** Valida lista de processos digitados no textarea (23.1) */
  async function validarProcessos(): Promise<void> {
    if (!textProcessos.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo vazio',
        description: 'Digite pelo menos um numero de processo'
      })
      return
    }

    const linhas = textProcessos
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    if (linhas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum processo valido',
        description: 'Digite pelo menos um numero de processo'
      })
      return
    }

    setLoadingValidar(true)
    try {
      const data = await adminApi.post<ProcessoValidado[]>(
        '/admin/api/categorias-resumo-json/teste-categorias/validar-processos',
        { processos: linhas }
      )
      setProcessosValidados(data)
      setResultados([])

      const validos = data.filter(p => p.valido).length
      const invalidos = data.filter(p => !p.valido).length

      toast({
        title: 'Validacao concluida',
        description: `${validos} valido(s), ${invalidos} invalido(s)`
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao validar processos',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingValidar(false)
    }
  }

  /** Classifica processos validos usando a categoria selecionada */
  async function classificarProcessos(): Promise<void> {
    const processosAptos = processosValidados
      .filter(p => p.valido && p.normalizado)
      .map(p => p.normalizado!)

    if (processosAptos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum processo valido',
        description: 'Valide os processos antes de classificar'
      })
      return
    }

    if (!categoriaId) {
      toast({
        variant: 'destructive',
        title: 'Categoria nao selecionada',
        description: 'Selecione uma categoria antes de classificar'
      })
      return
    }

    setLoadingClassificar(true)
    try {
      const data = await adminApi.post<ClassificacaoResultado[]>(
        '/admin/api/categorias-resumo-json/teste-categorias/classificar',
        {
          processos: processosAptos,
          categoria_id: parseInt(categoriaId, 10),
          comparar_modelos: compareModels,
          observacoes: observations || undefined
        }
      )
      setResultados(data)

      const sucessos = data.filter(r => r.status === 'ok').length
      const erros = data.filter(r => r.status === 'erro').length

      toast({
        title: 'Classificacao concluida',
        description: `${sucessos} sucesso(s), ${erros} erro(s)`
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao classificar processos',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingClassificar(false)
    }
  }

  /** Limpa todos os processos validados e resultados (23.2) */
  const handleClear = useCallback((): void => {
    setTextProcessos('')
    setProcessosValidados([])
    setResultados([])
    setObservations('')
    setStatusFilter('todos')
    setCompareModels(false)
    toast({ title: 'Dados limpos', description: 'Todos os processos e resultados foram removidos' })
  }, [toast])

  /** Baixa todos os resultados em JSON/CSV (23.3) */
  async function handleDownloadAll(): Promise<void> {
    setLoadingExportAll(true)
    try {
      const blob = await adminApi.blob(
        '/admin/api/categorias-resumo-json/teste-categorias/exportar'
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resultados-teste-categorias-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({ title: 'Download concluido', description: 'Arquivo exportado com sucesso' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar resultados',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingExportAll(false)
    }
  }

  /** Reseta status dos processos com erro (23.5) */
  async function handleResetErrors(): Promise<void> {
    setLoadingResetErrors(true)
    try {
      await adminApi.post(
        '/admin/api/categorias-resumo-json/teste-categorias/resetar-erros'
      )

      // Atualiza localmente: remove status de erro dos resultados
      setResultados(prev =>
        prev.map(r =>
          r.status === 'erro'
            ? { ...r, status: 'ok' as const, erro: undefined }
            : r
        )
      )

      toast({ title: 'Erros resetados', description: 'Status dos processos com erro foram limpos' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao resetar',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingResetErrors(false)
    }
  }

  /** Baixa lista de processos com dados expirados (23.6) */
  async function handleDownloadExpired(): Promise<void> {
    setLoadingExportExpired(true)
    try {
      const blob = await adminApi.blob(
        '/admin/api/categorias-resumo-json/teste-categorias/expirados'
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `processos-expirados-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({ title: 'Download concluido', description: 'Lista de expirados exportada' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao baixar expirados',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingExportExpired(false)
    }
  }

  /** Reclassifica automaticamente os processos com erro (23.7) */
  async function handleReclassifyErrors(): Promise<void> {
    const processosComErro = resultados.filter(r => r.status === 'erro')
    if (processosComErro.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum erro encontrado',
        description: 'Nao ha processos com erro para reclassificar'
      })
      return
    }

    setLoadingReclassifyErrors(true)
    try {
      const data = await adminApi.post<ClassificacaoResultado[]>(
        '/admin/api/categorias-resumo-json/teste-categorias/reclassificar-erros',
        {
          processos: processosComErro.map(r => r.processo),
          categoria_id: parseInt(categoriaId, 10)
        }
      )

      // Substitui os resultados com erro pelos novos
      setResultados(prev => {
        const processosReclassificados = new Set(data.map(r => r.processo))
        const mantidos = prev.filter(r => !processosReclassificados.has(r.processo))
        return [...mantidos, ...data]
      })

      const sucessos = data.filter(r => r.status === 'ok').length
      const errosPersistentes = data.filter(r => r.status === 'erro').length

      toast({
        title: 'Reclassificacao concluida',
        description: `${sucessos} corrigido(s), ${errosPersistentes} ainda com erro`
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao reclassificar',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingReclassifyErrors(false)
    }
  }

  // ── Dados derivados ──

  const processosValidos = processosValidados.filter(p => p.valido)
  const podeClassificar = processosValidos.length > 0 && categoriaId !== ''
  const hasErrors = resultados.some(r => r.status === 'erro')

  /** Resultados filtrados pelo select de status (23.9) */
  const filteredResults = useMemo((): ClassificacaoResultado[] => {
    if (statusFilter === 'todos') return resultados
    return resultados.filter(r => r.status === statusFilter)
  }, [resultados, statusFilter])

  /** Estatisticas de progresso */
  const progressStats = useMemo(() => {
    const total = resultados.length
    const ok = resultados.filter(r => r.status === 'ok').length
    const errors = resultados.filter(r => r.status === 'erro').length
    const avgTime = total > 0
      ? resultados.reduce((sum, r) => sum + r.tempo_segundos, 0) / total
      : 0
    const totalTokens = resultados.reduce((sum, r) => sum + r.tokens_usados, 0)
    return { total, ok, errors, avgTime, totalTokens }
  }, [resultados])

  // ── Renderizacao ──

  return (
    <PageContainer className="space-y-6">
      <h1 className="text-2xl font-bold">Teste de Categorias</h1>

      {/* Selecao de categoria */}
      <Card className="p-4">
        <label className="block text-sm font-medium mb-2">
          Categoria <span className="text-red-500">*</span>
        </label>
        <Select
          value={categoriaId}
          onValueChange={setCategoriaId}
          disabled={loadingCategorias}
        >
          <SelectTrigger data-testid="select-categoria">
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map(cat => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Paineis lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Painel esquerdo - Validacao */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 space-y-4">
            <h2 className="text-xl font-semibold">Processos</h2>

            <div>
              <label className="block text-sm font-medium mb-2">
                Digite os numeros de processo (um por linha)
              </label>
              <Textarea
                data-testid="textarea-processos"
                value={textProcessos}
                onChange={(e) => setTextProcessos(e.target.value)}
                placeholder={'0000000-00.0000.0.00.0000\n0000001-00.0000.0.00.0000'}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {/* Botoes de acao do painel de processos */}
            <div className="flex gap-2">
              {/* 23.1 - Botao Adicionar e Validar (nome melhorado) */}
              <Button
                data-testid="btn-adicionar-validar"
                onClick={validarProcessos}
                disabled={loadingValidar || !textProcessos.trim()}
                className="flex-1"
              >
                {loadingValidar ? 'Validando...' : 'Adicionar e Validar'}
              </Button>

              {/* 23.2 - Botao Limpar */}
              <Button
                data-testid="btn-limpar"
                variant="outline"
                onClick={handleClear}
                disabled={processosValidados.length === 0 && resultados.length === 0}
              >
                Limpar
              </Button>
            </div>

            {/* Lista de processos validados */}
            {processosValidados.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Processos validados:</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {processosValidados.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm p-2 border rounded"
                    >
                      <span className="font-mono text-xs truncate">
                        {p.normalizado || p.original}
                      </span>
                      <Badge variant={p.valido ? 'success' : 'destructive'}>
                        {p.valido ? 'valido' : 'invalido'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 23.11 - Toggle Comparar 2 Modelos */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <Checkbox
                data-testid="toggle-comparar-modelos"
                id="compare-models"
                checked={compareModels}
                onCheckedChange={(checked) => setCompareModels(checked === true)}
              />
              <label
                htmlFor="compare-models"
                className="text-sm font-medium cursor-pointer select-none"
              >
                Comparar 2 modelos de IA
              </label>
            </div>

            {/* 23.13 - Textarea Observacoes */}
            <div className="pt-2 border-t">
              <label className="block text-sm font-medium mb-2">
                Observacoes sobre o teste
              </label>
              <Textarea
                data-testid="textarea-observacoes"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Adicione observacoes ou notas sobre este teste..."
                rows={3}
                className="text-sm"
              />
            </div>
          </Card>
        </div>

        {/* Painel direito - Resultados com Tabs (23.10) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            {/* Cabecalho com botoes de acao */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-semibold">Resultados</h2>

              <div className="flex items-center gap-2 flex-wrap">
                {/* 23.9 - Filtro Status */}
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger
                    data-testid="filtro-status"
                    className="w-[140px]"
                  >
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ok">Sucesso</SelectItem>
                    <SelectItem value="erro">Erro</SelectItem>
                  </SelectContent>
                </Select>

                {/* Botao Classificar */}
                <Button
                  data-testid="btn-classificar"
                  onClick={classificarProcessos}
                  disabled={!podeClassificar || loadingClassificar}
                >
                  {loadingClassificar ? 'Classificando...' : 'Classificar'}
                </Button>

                {/* 23.3 - Botao Baixar Todos */}
                <Button
                  data-testid="btn-baixar-todos"
                  variant="outline"
                  onClick={handleDownloadAll}
                  disabled={resultados.length === 0 || loadingExportAll}
                >
                  {loadingExportAll ? 'Exportando...' : 'Baixar Todos'}
                </Button>
              </div>
            </div>

            {/* Botoes secundarios para erros e expirados */}
            {resultados.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {/* 23.5 - Botao Resetar Erros */}
                <Button
                  data-testid="btn-resetar-erros"
                  variant="outline"
                  size="sm"
                  onClick={handleResetErrors}
                  disabled={!hasErrors || loadingResetErrors}
                >
                  {loadingResetErrors ? 'Resetando...' : 'Resetar Erros'}
                </Button>

                {/* 23.7 - Botao Reclassificar Erros */}
                <Button
                  data-testid="btn-reclassificar-erros"
                  variant="outline"
                  size="sm"
                  onClick={handleReclassifyErrors}
                  disabled={!hasErrors || loadingReclassifyErrors || !categoriaId}
                >
                  {loadingReclassifyErrors ? 'Reclassificando...' : 'Reclassificar Erros'}
                </Button>

                {/* 23.6 - Botao Baixar Expirados */}
                <Button
                  data-testid="btn-baixar-expirados"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadExpired}
                  disabled={loadingExportExpired}
                >
                  {loadingExportExpired ? 'Baixando...' : 'Baixar Expirados'}
                </Button>
              </div>
            )}

            {/* 23.10 - Tabs: Resultados / Visualizacao / Progresso */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList data-testid="tabs-resultados">
                <TabsTrigger value="resultados" data-testid="tab-resultados">
                  Resultados
                </TabsTrigger>
                <TabsTrigger value="visualizacao" data-testid="tab-visualizacao">
                  Visualizacao
                </TabsTrigger>
                <TabsTrigger value="progresso" data-testid="tab-progresso">
                  Progresso
                </TabsTrigger>
              </TabsList>

              {/* Aba 1: Resultados em cards */}
              <TabsContent value="resultados">
                <div className="space-y-4">
                  {filteredResults.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {resultados.length === 0
                        ? 'Nenhum resultado ainda. Selecione uma categoria e classifique os processos.'
                        : 'Nenhum resultado encontrado para o filtro selecionado.'}
                    </div>
                  ) : (
                    filteredResults.map((res, idx) => (
                      <Card key={idx} className="p-4 space-y-3">
                        {/* Cabecalho do resultado */}
                        <div className="flex items-center justify-between">
                          <h3 className="font-mono font-semibold">{res.processo}</h3>
                          <Badge variant={res.status === 'ok' ? 'success' : 'destructive'}>
                            {res.status}
                          </Badge>
                        </div>

                        {/* JSON extraido com chave-valor */}
                        {res.status === 'ok' && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">JSON Extraido:</h4>
                            <div className="bg-muted p-3 rounded text-sm space-y-1">
                              {Object.entries(res.json_extraido).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="font-medium">{key}:</span>
                                  <span className="text-muted-foreground">
                                    {typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadados */}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Modelo: {res.modelo_usado}</span>
                          <span>Tempo: {res.tempo_segundos.toFixed(2)}s</span>
                          <span>Tokens: {res.tokens_usados}</span>
                        </div>

                        {/* Erro se houver */}
                        {res.erro && (
                          <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                            <strong>Erro:</strong> {res.erro}
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Aba 2: Visualizacao JSON colorida (23.14) */}
              <TabsContent value="visualizacao">
                <div className="space-y-4" data-testid="tab-content-visualizacao">
                  {filteredResults.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {resultados.length === 0
                        ? 'Nenhum resultado para visualizar.'
                        : 'Nenhum resultado encontrado para o filtro selecionado.'}
                    </div>
                  ) : (
                    filteredResults.map((res, idx) => (
                      <Card key={idx} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-mono font-semibold">{res.processo}</h3>
                          <Badge variant={res.status === 'ok' ? 'success' : 'destructive'}>
                            {res.status}
                          </Badge>
                        </div>

                        {/* JSON com syntax highlighting */}
                        {res.status === 'ok' && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">JSON com syntax highlighting:</h4>
                            <pre
                              data-testid={`json-highlighted-${idx}`}
                              className="bg-gray-950 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap"
                            >
                              <JsonHighlighted data={res.json_extraido} />
                            </pre>
                          </div>
                        )}

                        {/* Erro se houver */}
                        {res.erro && (
                          <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                            <strong>Erro:</strong> {res.erro}
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Aba 3: Progresso e estatisticas */}
              <TabsContent value="progresso">
                <div className="space-y-4" data-testid="tab-content-progresso">
                  {resultados.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhum dado de progresso disponivel. Execute uma classificacao primeiro.
                    </div>
                  ) : (
                    <>
                      {/* Cards de resumo */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 text-center">
                          <div className="text-2xl font-bold">{progressStats.total}</div>
                          <div className="text-sm text-muted-foreground">Total</div>
                        </Card>
                        <Card className="p-4 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {progressStats.ok}
                          </div>
                          <div className="text-sm text-muted-foreground">Sucesso</div>
                        </Card>
                        <Card className="p-4 text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {progressStats.errors}
                          </div>
                          <div className="text-sm text-muted-foreground">Erros</div>
                        </Card>
                        <Card className="p-4 text-center">
                          <div className="text-2xl font-bold">
                            {progressStats.avgTime.toFixed(2)}s
                          </div>
                          <div className="text-sm text-muted-foreground">Tempo medio</div>
                        </Card>
                      </div>

                      {/* Barra de progresso visual */}
                      <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Taxa de sucesso</h3>
                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-green-500 h-4 rounded-full transition-all duration-500"
                            style={{
                              width: progressStats.total > 0
                                ? `${(progressStats.ok / progressStats.total) * 100}%`
                                : '0%'
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>
                            {progressStats.total > 0
                              ? `${((progressStats.ok / progressStats.total) * 100).toFixed(1)}%`
                              : '0%'}
                          </span>
                          <span>{progressStats.ok}/{progressStats.total}</span>
                        </div>
                      </Card>

                      {/* Detalhes adicionais */}
                      <Card className="p-4">
                        <h3 className="text-sm font-medium mb-3">Detalhes do consumo</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total de tokens</span>
                            <span className="font-medium">
                              {progressStats.totalTokens.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Media de tokens/processo</span>
                            <span className="font-medium">
                              {progressStats.total > 0
                                ? Math.round(progressStats.totalTokens / progressStats.total).toLocaleString('pt-BR')
                                : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Modelos utilizados</span>
                            <span className="font-medium">
                              {[...new Set(resultados.map(r => r.modelo_usado))].join(', ') || '-'}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
