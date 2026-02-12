import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Activity,
  Bot,
  ChevronDown,
  Code,
  Database,
  Download,
  RefreshCw,
  Server,
  CircleHelp,
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface PerformanceSummary {
  bottleneck_summary: Record<string, number>
  avg_times: { llm: number; db: number; parse: number; total: number }
  recent_errors: Array<{
    id: number
    route: string
    error_message: string
    created_at: string
  }>
  top_slowest?: Array<{
    route: string
    bottleneck: string
    avg_total_ms: number
  }>
}

interface PerformanceLog {
  id: number
  created_at: string
  system_name: string
  route: string
  action?: string
  total_ms: number
  llm_ms?: number
  db_ms?: number
  parse_ms?: number
  bottleneck: string
  status: string
  error_message?: string
}

interface GeminiSummary {
  total_calls: number
  stats: {
    success_count: number
    error_count: number
    avg_latency_ms: number
    success_rate: number
    total_prompt_tokens: number
    total_response_tokens: number
  }
  by_sistema: Array<{ sistema: string; count: number }>
  by_model: Array<{ model: string; count: number }>
}

interface GeminiLog {
  id: number
  created_at: string
  sistema: string
  model: string
  time_total_ms: number
  success: boolean
}

interface RouteMapping {
  rota: string
  sistema: string
  descricao: string
  metodo: string
}

type TabValue = 'sistema' | 'gemini' | 'avancado'

const PIE_COLORS = ['#a855f7', '#eab308', '#3b82f6', '#8D8F92']

export function PerformancePage() {
  const { toast } = useToast()

  const [tab, setTab] = useState<TabValue>('sistema')
  const [loading, setLoading] = useState(false)
  const [clearingLogs, setClearingLogs] = useState(false)

  const [timePeriod, setTimePeriod] = useState('24')
  const [filterSistema, setFilterSistema] = useState('all')
  const [filterRota, setFilterRota] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterGargalo, setFilterGargalo] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>([])
  const [geminiSummary, setGeminiSummary] = useState<GeminiSummary | null>(null)
  const [geminiLogs, setGeminiLogs] = useState<GeminiLog[]>([])
  const [routeMapping, setRouteMapping] = useState<RouteMapping[]>([])

  const [routeMapExpanded, setRouteMapExpanded] = useState(false)

  const buildFilterQuery = useCallback(() => {
    const params = new URLSearchParams()
    params.set('hours', timePeriod)
    if (filterSistema !== 'all') params.set('sistema', filterSistema)
    if (filterRota.trim()) params.set('rota', filterRota.trim())
    if (filterGargalo !== 'all') params.set('gargalo', filterGargalo)
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (filterAction !== 'all') params.set('action', filterAction)
    return params.toString()
  }, [timePeriod, filterSistema, filterRota, filterGargalo, filterStatus, filterAction])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildFilterQuery()

      const [sum, logs, gSummary, gLogs] = await Promise.all([
        adminApi.get<PerformanceSummary>(`/admin/api/performance/summary?${qs}`),
        adminApi.get<{ logs: PerformanceLog[] }>(`/admin/api/performance/logs?${qs}&limit=50`),
        adminApi.get<GeminiSummary>(`/admin/api/gemini-logs/summary?hours=${timePeriod}`),
        adminApi.get<{ logs: GeminiLog[] }>(`/admin/api/gemini-logs?hours=${timePeriod}&limit=50`),
      ])

      setSummary(sum)
      setPerfLogs(logs.logs || [])
      setGeminiSummary(gSummary)
      setGeminiLogs(gLogs.logs || [])

      try {
        const mapping = await adminApi.get<{ mappings: RouteMapping[] }>('/admin/api/performance/route-mapping')
        setRouteMapping(mapping.mappings || [])
      } catch {
        setRouteMapping([])
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar performance',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [buildFilterQuery, timePeriod, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const clearFilters = () => {
    setTimePeriod('24')
    setFilterSistema('all')
    setFilterRota('')
    setFilterAction('all')
    setFilterGargalo('all')
    setFilterStatus('all')
  }

  const cleanupLogs = async () => {
    setClearingLogs(true)
    try {
      await adminApi.delete('/admin/api/performance/logs/limpar?hours=168')
      await loadData()
    } catch (error) {
      toast({
        title: 'Erro ao limpar logs',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setClearingLogs(false)
    }
  }

  const pieData = useMemo(() => {
    const bottlenecks = summary?.bottleneck_summary || {}
    return [
      { name: 'LLM', value: bottlenecks.llm || 0 },
      { name: 'DB', value: bottlenecks.db || 0 },
      { name: 'Parse', value: bottlenecks.parse || 0 },
      { name: 'Outro', value: bottlenecks.network || bottlenecks.outro || 0 },
    ]
  }, [summary])

  const topSlowest = useMemo(() => {
    if (summary?.top_slowest && summary.top_slowest.length > 0) return summary.top_slowest

    const grouped = new Map<string, { total: number; count: number; bottleneck: string }>()
    perfLogs.forEach((log) => {
      const key = `${log.route}|${log.bottleneck}`
      const curr = grouped.get(key) || { total: 0, count: 0, bottleneck: log.bottleneck }
      curr.total += log.total_ms
      curr.count += 1
      grouped.set(key, curr)
    })

    return Array.from(grouped.entries())
      .map(([key, val]) => ({
        route: key.split('|')[0],
        bottleneck: val.bottleneck,
        avg_total_ms: val.total / val.count,
      }))
      .sort((a, b) => b.avg_total_ms - a.avg_total_ms)
      .slice(0, 3)
  }, [summary, perfLogs])

  const perfColumns = [
    { accessor: 'created_at', header: 'Hora', render: (_: unknown, row: PerformanceLog) => new Date(row.created_at).toLocaleTimeString('pt-BR') },
    { accessor: 'system_name', header: 'Sistema' },
    { accessor: 'route', header: 'Rota' },
    { accessor: 'action', header: 'Action' },
    { accessor: 'total_ms', header: 'Total', render: (_: unknown, row: PerformanceLog) => `${row.total_ms.toFixed(0)} ms` },
    { accessor: 'llm_ms', header: 'LLM', render: (_: unknown, row: PerformanceLog) => `${(row.llm_ms || 0).toFixed(0)} ms` },
    { accessor: 'db_ms', header: 'DB', render: (_: unknown, row: PerformanceLog) => `${(row.db_ms || 0).toFixed(0)} ms` },
    { accessor: 'parse_ms', header: 'Parse', render: (_: unknown, row: PerformanceLog) => `${(row.parse_ms || 0).toFixed(0)} ms` },
    {
      accessor: 'bottleneck',
      header: 'Gargalo',
      render: (_: unknown, row: PerformanceLog) => <Badge variant="outline">{row.bottleneck}</Badge>,
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (_: unknown, row: PerformanceLog) => <Badge variant={row.status === 'success' || row.status === 'ok' ? 'default' : 'destructive'}>{row.status}</Badge>,
    },
  ]

  const geminiColumns = [
    { accessor: 'created_at', header: 'Hora', render: (_: unknown, row: GeminiLog) => new Date(row.created_at).toLocaleTimeString('pt-BR') },
    { accessor: 'sistema', header: 'Sistema' },
    { accessor: 'model', header: 'Modelo' },
    { accessor: 'time_total_ms', header: 'Latência', render: (_: unknown, row: GeminiLog) => `${row.time_total_ms.toFixed(0)} ms` },
    {
      accessor: 'success',
      header: 'Sucesso',
      render: (_: unknown, row: GeminiLog) => <Badge variant={row.success ? 'default' : 'destructive'}>{row.success ? 'Sim' : 'Não'}</Badge>,
    },
  ]

  const routeColumns = [
    { accessor: 'metodo', header: 'Método' },
    { accessor: 'rota', header: 'Rota' },
    { accessor: 'sistema', header: 'Sistema' },
    { accessor: 'descricao', header: 'Descrição' },
  ]

  return (
    <>
      <BreadcrumbBar
        title="Performance & Logs"
        icon={<Activity style={{ width: 14, height: 14 }} />}
        actions={
          <span className="text-xs flex items-center gap-1" style={{ color: C.statusSuccess }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.statusSuccess }} />
            Sempre ativo
          </span>
        }
      />
      <ContentArea>

      <nav className="flex gap-8 overflow-x-auto border-b mb-6" style={{ borderColor: C.gray200 }}>
        <button onClick={() => setTab('sistema')} className="py-4 px-1 font-medium whitespace-nowrap" style={tab === 'sistema' ? { borderBottom: `3px solid ${C.navy700}`, color: C.navy700 } : { color: C.text500 }} data-testid="tab-performance">
          <Server className="h-4 w-4 inline mr-2" />Performance Sistema
        </button>
        <button onClick={() => setTab('gemini')} className="py-4 px-1 font-medium whitespace-nowrap" style={tab === 'gemini' ? { borderBottom: `3px solid ${C.navy700}`, color: C.navy700 } : { color: C.text500 }} data-testid="tab-gemini">
          <Bot className="h-4 w-4 inline mr-2" />Logs Gemini API
        </button>
        <button onClick={() => setTab('avancado')} className="py-4 px-1 font-medium whitespace-nowrap" style={tab === 'avancado' ? { borderBottom: `3px solid ${C.navy700}`, color: C.navy700 } : { color: C.text500 }} data-testid="tab-advanced-logs">
          <Code className="h-4 w-4 inline mr-2" />Logs Avancados
        </button>
      </nav>

      <div>
        {tab === 'sistema' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4 border-purple-500" style={{ borderColor: C.gray200, borderLeftColor: undefined }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium" style={{ color: C.text500 }}>Gargalo LLM</h3>
                    <p className="text-3xl leading-none mt-1 font-bold text-purple-600">{summary?.bottleneck_summary.llm || 0}</p>
                  </div>
                  <Bot className="h-7 w-7 text-purple-300" />
                </div>
                <p className="text-xs mt-2" style={{ color: C.text500 }}>avg: {(summary?.avg_times.llm || 0).toFixed(0)} ms</p>
              </div>

              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4 border-yellow-500" style={{ borderColor: C.gray200, borderLeftColor: undefined }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium" style={{ color: C.text500 }}>Gargalo DB</h3>
                    <p className="text-3xl leading-none mt-1 font-bold text-yellow-600">{summary?.bottleneck_summary.db || 0}</p>
                  </div>
                  <Database className="h-7 w-7 text-yellow-300" />
                </div>
                <p className="text-xs mt-2" style={{ color: C.text500 }}>avg: {(summary?.avg_times.db || 0).toFixed(0)} ms</p>
              </div>

              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4 border-blue-500" style={{ borderColor: C.gray200, borderLeftColor: undefined }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium" style={{ color: C.text500 }}>Gargalo Parse</h3>
                    <p className="text-3xl leading-none mt-1 font-bold text-blue-600">{summary?.bottleneck_summary.parse || 0}</p>
                  </div>
                  <Code className="h-7 w-7 text-blue-300" />
                </div>
                <p className="text-xs mt-2" style={{ color: C.text500 }}>avg: {(summary?.avg_times.parse || 0).toFixed(0)} ms</p>
              </div>

              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4" style={{ borderColor: C.gray200, borderLeftColor: C.gray400 }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium" style={{ color: C.text500 }}>Outro</h3>
                    <p className="text-3xl leading-none mt-1 font-bold" style={{ color: C.text700 }}>{summary?.bottleneck_summary.network || 0}</p>
                  </div>
                  <CircleHelp className="h-7 w-7" style={{ color: C.gray300 }} />
                </div>
                <p className="text-xs mt-2" style={{ color: C.text500 }}>total avg: {(summary?.avg_times.total || 0).toFixed(0)} ms</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: C.text900 }}>Distribuicao de Gargalos</h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                        {pieData.map((row, idx) => (
                          <Cell key={row.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-md p-4 lg:col-span-2 border" style={{ borderColor: C.gray200 }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: C.text900 }}>Top 3 Mais Lentas por Gargalo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-purple-600 mb-2"><Bot className="h-4 w-4 inline mr-1" />LLM</h4>
                    <div className="space-y-1 text-xs">
                      {topSlowest.filter((t) => (t.bottleneck || '').toLowerCase().includes('llm')).slice(0, 3).map((item) => (
                        <div key={`${item.route}-llm`} style={{ color: C.text700 }}>{item.route}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-600 mb-2"><Database className="h-4 w-4 inline mr-1" />DB</h4>
                    <div className="space-y-1 text-xs">
                      {topSlowest.filter((t) => (t.bottleneck || '').toLowerCase().includes('db')).slice(0, 3).map((item) => (
                        <div key={`${item.route}-db`} style={{ color: C.text700 }}>{item.route}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-600 mb-2"><Code className="h-4 w-4 inline mr-1" />Parse</h4>
                    <div className="space-y-1 text-xs">
                      {topSlowest.filter((t) => (t.bottleneck || '').toLowerCase().includes('parse')).slice(0, 3).map((item) => (
                        <div key={`${item.route}-parse`} style={{ color: C.text700 }}>{item.route}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold" style={{ color: C.text900 }}>Mapeamento Rota - Sistema</h3>
                <button onClick={() => setRouteMapExpanded((v) => !v)} className="text-sm flex items-center gap-1" style={{ color: C.navy700 }}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${routeMapExpanded ? 'rotate-180' : ''}`} />
                  {routeMapExpanded ? 'Recolher' : 'Expandir'}
                </button>
              </div>
              {routeMapExpanded && (
                <div className="mt-4">
                  <DataTable data={routeMapping} columns={routeColumns} isLoading={loading} emptyMessage="Nenhum mapeamento encontrado" />
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Sistema</label>
                  <Input value={filterSistema === 'all' ? 'Todos' : filterSistema} onChange={(e) => setFilterSistema(e.target.value || 'all')} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Rota</label>
                  <Input value={filterRota} onChange={(e) => setFilterRota(e.target.value)} placeholder="/api/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Action</label>
                  <Input value={filterAction === 'all' ? 'Todas' : filterAction} onChange={(e) => setFilterAction(e.target.value || 'all')} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Gargalo</label>
                  <Select value={filterGargalo} onValueChange={setFilterGargalo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="llm">LLM</SelectItem>
                      <SelectItem value="db">DB</SelectItem>
                      <SelectItem value="parse">Parse</SelectItem>
                      <SelectItem value="network">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Status</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="success">OK</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Periodo</label>
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="6">6 horas</SelectItem>
                      <SelectItem value="24">24 horas</SelectItem>
                      <SelectItem value="72">3 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={() => void loadData()} className="flex-1" style={{ background: C.navy950, color: 'white' }} data-testid="btn-refresh">
                    Filtrar
                  </Button>
                  <Button onClick={clearFilters} variant="outline" data-testid="btn-clear-filters">x</Button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md overflow-hidden border" style={{ borderColor: C.gray200 }}>
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: C.gray200 }}>
                <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>Logs de Performance</h2>
                <Button onClick={cleanupLogs} variant="ghost" className="text-sm" style={{ color: C.statusError }} disabled={clearingLogs}>
                  {clearingLogs ? 'Limpando...' : 'Limpar antigos'}
                </Button>
              </div>
              <DataTable data={perfLogs} columns={perfColumns} isLoading={loading} emptyMessage="Nenhum log encontrado" />
            </div>
          </div>
        )}

        {tab === 'gemini' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4 border-green-500" style={{ borderColor: C.gray200, borderLeftColor: undefined }}>
                <p className="text-sm" style={{ color: C.text500 }}>Total Chamadas</p>
                <p className="text-2xl font-bold text-green-600">{geminiSummary?.total_calls || 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4 border-blue-500" style={{ borderColor: C.gray200, borderLeftColor: undefined }}>
                <p className="text-sm" style={{ color: C.text500 }}>Latencia Media</p>
                <p className="text-2xl font-bold text-blue-600">{(geminiSummary?.stats.avg_latency_ms || 0).toFixed(0)} ms</p>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4 border-purple-500" style={{ borderColor: C.gray200, borderLeftColor: undefined }}>
                <p className="text-sm" style={{ color: C.text500 }}>Tokens Prompt</p>
                <p className="text-2xl font-bold text-purple-600">{geminiSummary?.stats.total_prompt_tokens || 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-4 border-l-4 border-teal-500" style={{ borderColor: C.gray200, borderLeftColor: undefined }}>
                <p className="text-sm" style={{ color: C.text500 }}>Taxa Sucesso</p>
                <p className="text-2xl font-bold text-teal-600">{(geminiSummary?.stats.success_rate || 0).toFixed(1)}%</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md overflow-hidden border" style={{ borderColor: C.gray200 }}>
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: C.gray200 }}>
                <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>Logs Gemini API</h2>
                <Button onClick={() => void loadData()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                </Button>
              </div>
              <DataTable data={geminiLogs} columns={geminiColumns} isLoading={loading} emptyMessage="Nenhum log encontrado" />
            </div>
          </div>
        )}

        {tab === 'avancado' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-md overflow-hidden border" style={{ borderColor: C.gray200 }}>
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: C.gray200 }}>
                <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>Logs Avancados</h2>
                <Button onClick={() => {
                  const csv = [
                    'id,created_at,system_name,route,action,total_ms,bottleneck,status',
                    ...perfLogs.map((l) => `${l.id},${l.created_at},${l.system_name},${l.route},${l.action || ''},${l.total_ms},${l.bottleneck},${l.status}`),
                  ].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `performance-logs-${Date.now()}.csv`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                }} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Exportar
                </Button>
              </div>
              <DataTable data={perfLogs} columns={perfColumns} isLoading={loading} emptyMessage="Nenhum log encontrado" searchable searchPlaceholder="Buscar..." />
            </div>
          </div>
        )}
      </div>
      </ContentArea>
    </>
  )
}
