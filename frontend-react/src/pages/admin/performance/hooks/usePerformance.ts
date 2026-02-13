import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { C } from '@/lib/designTokens'
import { Bot, Code, Database, CircleHelp } from 'lucide-react'
import { createElement } from 'react'

import type {
  TabValue,
  PerformanceSummary,
  PerformanceLog,
  GeminiSummary,
  GeminiLog,
  RouteMap,
  TopRoute,
  RequestPerfLog,
  RequestPerfSummary,
  BottleneckStyleEntry,
  MapFormData,
} from '../types'

// ============================================================
// Constantes
// ============================================================

export const PIE_COLORS = [C.chartPurple, C.chartYellow, C.chartBlue, C.gray500]
export const BAR_COLORS = [C.navy700, C.navy500, C.orange500, C.navy300, C.chartPurple, C.chartYellow]

export const BOTTLENECK_STYLE: Record<string, BottleneckStyleEntry> = {
  LLM: { color: C.chartPurple, icon: Bot },
  DB: { color: C.chartYellow, icon: Database },
  PARSE: { color: C.chartBlue, icon: Code },
  OUTRO: { color: C.gray400, icon: CircleHelp },
}

export function fmtMs(ms: number | undefined | null): string {
  if (ms == null) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms.toFixed(0)}ms`
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

// ============================================================
// Hook principal
// ============================================================

export function usePerformance() {
  const { toast } = useToast()

  // --- Estado: geral ---
  const [tab, setTab] = useState<TabValue>('sistema')
  const [loading, setLoading] = useState(false)
  const [timePeriod, setTimePeriod] = useState('24')

  // --- Estado: Tab Sistema ---
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>([])
  const [routeMaps, setRouteMaps] = useState<RouteMap[]>([])
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([])
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [availableSystems, setAvailableSystems] = useState<string[]>([])
  const [routeMapExpanded, setRouteMapExpanded] = useState(false)
  const [topRoutesExpanded, setTopRoutesExpanded] = useState(false)
  const [errorsExpanded, setErrorsExpanded] = useState(false)

  const [filterSystem, setFilterSystem] = useState('all')
  const [filterRoute, setFilterRoute] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterBottleneck, setFilterBottleneck] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // --- Estado: Route map CRUD ---
  const [mapDialogOpen, setMapDialogOpen] = useState(false)
  const [editingMap, setEditingMap] = useState<RouteMap | null>(null)
  const [mapForm, setMapForm] = useState<MapFormData>({ route_pattern: '', system_name: '', match_type: 'prefix', priority: 0 })
  const [savingMap, setSavingMap] = useState(false)

  // --- Estado: Tab Gemini ---
  const [geminiSummary, setGeminiSummary] = useState<GeminiSummary | null>(null)
  const [geminiLogs, setGeminiLogs] = useState<GeminiLog[]>([])
  const [geminiSystems, setGeminiSystems] = useState<string[]>([])
  const [geminiModels, setGeminiModels] = useState<string[]>([])
  const [filterGeminiSistema, setFilterGeminiSistema] = useState('all')
  const [filterGeminiModel, setFilterGeminiModel] = useState('all')
  const [filterGeminiStatus, setFilterGeminiStatus] = useState('all')

  // --- Estado: Tab Avancado ---
  const [reqPerfSummary, setReqPerfSummary] = useState<RequestPerfSummary | null>(null)
  const [reqPerfLogs, setReqPerfLogs] = useState<RequestPerfLog[]>([])
  const [reqPerfSlowest, setReqPerfSlowest] = useState<RequestPerfLog[]>([])
  const [filterAdvSistema, setFilterAdvSistema] = useState('all')
  const [filterMinLatency, setFilterMinLatency] = useState('')

  // --- Estado: operacoes ---
  const [clearingLogs, setClearingLogs] = useState(false)
  const [cleanupDays, setCleanupDays] = useState('7')

  // ============================================================
  // Carregamento de dados
  // ============================================================

  const loadSistemaData = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('hours', timePeriod)
    params.set('limit', '100')
    if (filterSystem !== 'all') params.set('system', filterSystem)
    if (filterRoute.trim()) params.set('route', filterRoute.trim())
    if (filterAction !== 'all') params.set('action', filterAction)
    if (filterBottleneck !== 'all') params.set('bottleneck', filterBottleneck)
    if (filterStatus !== 'all') params.set('status', filterStatus)
    const qs = params.toString()

    const [sum, logs, maps, routes, actions, systems] = await Promise.all([
      adminApi.get<PerformanceSummary>(`/admin/api/performance/summary?hours=${timePeriod}`),
      adminApi.get<{ logs: PerformanceLog[] }>(`/admin/api/performance/logs?${qs}`),
      adminApi.get<{ mappings: RouteMap[] }>('/admin/api/performance/route-maps'),
      adminApi.get<{ routes: TopRoute[] }>(`/admin/api/performance/top-routes?hours=${timePeriod}&limit=20`),
      adminApi.get<{ actions: string[] }>('/admin/api/performance/actions'),
      adminApi.get<{ systems: string[] }>('/admin/api/performance/systems'),
    ])

    setSummary(sum)
    setPerfLogs(logs.logs || [])
    setRouteMaps(maps.mappings || [])
    setTopRoutes(routes.routes || [])
    setAvailableActions(actions.actions || [])
    setAvailableSystems(systems.systems || [])
  }, [timePeriod, filterSystem, filterRoute, filterAction, filterBottleneck, filterStatus])

  const loadGeminiData = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('hours', timePeriod)
    params.set('limit', '100')
    if (filterGeminiSistema !== 'all') params.set('sistema', filterGeminiSistema)
    if (filterGeminiModel !== 'all') params.set('model', filterGeminiModel)
    if (filterGeminiStatus !== 'all') params.set('success', filterGeminiStatus === 'success' ? 'true' : 'false')
    const qs = params.toString()

    const [gSummary, gLogs, gSystems, gModels] = await Promise.all([
      adminApi.get<GeminiSummary>(`/admin/api/gemini-logs/summary?hours=${timePeriod}`),
      adminApi.get<{ logs: GeminiLog[] }>(`/admin/api/gemini-logs?${qs}`),
      adminApi.get<{ systems: string[] }>('/admin/api/gemini-logs/systems'),
      adminApi.get<{ models: string[] }>('/admin/api/gemini-logs/models'),
    ])

    setGeminiSummary(gSummary)
    setGeminiLogs(gLogs.logs || [])
    setGeminiSystems(gSystems.systems || [])
    setGeminiModels(gModels.models || [])
  }, [timePeriod, filterGeminiSistema, filterGeminiModel, filterGeminiStatus])

  const loadAdvancedData = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('hours', timePeriod)
    params.set('limit', '50')
    if (filterAdvSistema !== 'all') params.set('sistema', filterAdvSistema)
    if (filterMinLatency.trim()) params.set('min_total_ms', filterMinLatency.trim())
    const qs = params.toString()

    const [rSummary, rLogs, rSlowest] = await Promise.all([
      adminApi.get<RequestPerfSummary>(`/admin/api/gemini-logs/request-perf/summary?hours=${timePeriod}${filterAdvSistema !== 'all' ? `&sistema=${filterAdvSistema}` : ''}`),
      adminApi.get<{ logs: RequestPerfLog[] }>(`/admin/api/gemini-logs/request-perf?${qs}`),
      adminApi.get<{ slowest: RequestPerfLog[] }>(`/admin/api/gemini-logs/request-perf/slowest?hours=${timePeriod}&limit=6${filterAdvSistema !== 'all' ? `&sistema=${filterAdvSistema}` : ''}`),
    ])

    setReqPerfSummary(rSummary)
    setReqPerfLogs(rLogs.logs || [])
    setReqPerfSlowest(rSlowest.slowest || [])
  }, [timePeriod, filterAdvSistema, filterMinLatency])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'sistema') await loadSistemaData()
      else if (tab === 'gemini') await loadGeminiData()
      else if (tab === 'avancado') await loadAdvancedData()
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tab, loadSistemaData, loadGeminiData, loadAdvancedData, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // ============================================================
  // Handlers
  // ============================================================

  const clearFilters = () => {
    setTimePeriod('24')
    setFilterSystem('all')
    setFilterRoute('')
    setFilterAction('all')
    setFilterBottleneck('all')
    setFilterStatus('all')
    setFilterGeminiSistema('all')
    setFilterGeminiModel('all')
    setFilterGeminiStatus('all')
    setFilterAdvSistema('all')
    setFilterMinLatency('')
  }

  const handleCleanup = async (endpoint: string) => {
    setClearingLogs(true)
    try {
      const res = await adminApi.delete<{ deleted_count: number; message: string }>(`${endpoint}?days=${cleanupDays}`)
      toast({ title: 'Limpeza concluida', description: res.message })
      await loadData()
    } catch (error) {
      toast({ title: 'Erro ao limpar logs', description: error instanceof Error ? error.message : 'Erro', variant: 'destructive' })
    } finally {
      setClearingLogs(false)
    }
  }

  // --- Route map CRUD ---
  const openCreateMap = (prefill?: { route_pattern: string }) => {
    setEditingMap(null)
    setMapForm({ route_pattern: prefill?.route_pattern || '', system_name: '', match_type: 'prefix', priority: 0 })
    setMapDialogOpen(true)
  }

  const openEditMap = (m: RouteMap) => {
    setEditingMap(m)
    setMapForm({ route_pattern: m.route_pattern, system_name: m.system_name, match_type: m.match_type, priority: m.priority })
    setMapDialogOpen(true)
  }

  const saveMap = async () => {
    if (!mapForm.route_pattern.trim() || !mapForm.system_name.trim()) return
    setSavingMap(true)
    try {
      if (editingMap) {
        await adminApi.put(`/admin/api/performance/route-maps/${editingMap.id}`, mapForm)
        toast({ title: 'Mapeamento atualizado' })
      } else {
        await adminApi.post('/admin/api/performance/route-maps', mapForm)
        toast({ title: 'Mapeamento criado' })
      }
      setMapDialogOpen(false)
      await loadData()
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error instanceof Error ? error.message : 'Erro', variant: 'destructive' })
    } finally {
      setSavingMap(false)
    }
  }

  const deleteMap = async (id: number) => {
    try {
      await adminApi.delete(`/admin/api/performance/route-maps/${id}`)
      toast({ title: 'Mapeamento removido' })
      await loadData()
    } catch (error) {
      toast({ title: 'Erro ao remover', description: error instanceof Error ? error.message : 'Erro', variant: 'destructive' })
    }
  }

  const handleCacheInvalidate = async () => {
    try {
      await adminApi.post('/admin/api/performance/cache-invalidate', {})
      toast({ title: 'Caches invalidados com sucesso' })
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro', variant: 'destructive' })
    }
  }

  const exportAdvancedCsv = () => {
    const csv = [
      'id,created_at,request_id,cnj,tipo_peca,total_ms,ttft_ms,ag1,ag2,generation_ms,chunks,status',
      ...reqPerfLogs.map(l => `${l.id},${l.created_at},${l.request_id},${l.numero_cnj || ''},${l.tipo_peca || ''},${l.total_ms},${l.ttft_ms || ''},${l.agente1_ms || ''},${l.agente2_ms || ''},${l.generation_ms || ''},${l.streaming_chunks || ''},${l.success ? 'ok' : 'error'}`),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `request-perf-logs-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ============================================================
  // Dados derivados
  // ============================================================

  const pieData = useMemo(() => {
    const bn = summary?.bottleneck_summary || {}
    return [
      { name: 'LLM', value: bn.LLM || bn.llm || 0 },
      { name: 'DB', value: bn.DB || bn.db || 0 },
      { name: 'Parse', value: bn.PARSE || bn.parse || 0 },
      { name: 'Outro', value: bn.OUTRO || bn.outro || 0 },
    ]
  }, [summary])

  const geminiBySystemData = useMemo(() =>
    (geminiSummary?.by_sistema || []).slice(0, 8).map(s => ({ name: s.sistema, count: s.count })),
    [geminiSummary],
  )

  const geminiByModelData = useMemo(() =>
    (geminiSummary?.by_model || []).map(m => ({ name: m.model, value: m.count })),
    [geminiSummary],
  )

  /** Rotas frequentes sem mapeamento */
  const unmappedRoutes = useMemo(() =>
    topRoutes.filter(r => !r.has_mapping),
    [topRoutes],
  )

  // ============================================================
  // Definicoes de colunas para DataTable
  // ============================================================

  const perfColumns = [
    { accessor: 'created_at', header: 'Hora', render: (_: unknown, row: PerformanceLog) => fmtTime(row.created_at) },
    { accessor: 'system_name', header: 'Sistema' },
    { accessor: 'route', header: 'Rota', render: (_: unknown, row: PerformanceLog) => createElement('span', { className: 'text-xs font-mono' }, row.route) },
    { accessor: 'action', header: 'Action' },
    { accessor: 'total_ms', header: 'Total', render: (_: unknown, row: PerformanceLog) => fmtMs(row.total_ms) },
    { accessor: 'llm_request_ms', header: 'LLM', render: (_: unknown, row: PerformanceLog) => fmtMs(row.llm_request_ms) },
    { accessor: 'db_total_ms', header: 'DB', render: (_: unknown, row: PerformanceLog) => fmtMs(row.db_total_ms) },
    { accessor: 'json_parse_ms', header: 'Parse', render: (_: unknown, row: PerformanceLog) => fmtMs(row.json_parse_ms) },
    {
      accessor: 'bottleneck', header: 'Gargalo',
      render: (_: unknown, row: PerformanceLog) => {
        const style = BOTTLENECK_STYLE[row.bottleneck]
        return createElement(Badge, { variant: 'outline' as const, style: style ? { borderColor: style.color, color: style.color } : undefined }, row.bottleneck)
      },
    },
    {
      accessor: 'status', header: 'Status',
      render: (_: unknown, row: PerformanceLog) => createElement(Badge, { variant: row.status === 'ok' ? 'default' as const : 'destructive' as const }, row.status),
    },
  ]

  const geminiColumns = [
    { accessor: 'created_at', header: 'Hora', render: (_: unknown, row: GeminiLog) => fmtTime(row.created_at) },
    { accessor: 'sistema', header: 'Sistema' },
    { accessor: 'model', header: 'Modelo', render: (_: unknown, row: GeminiLog) => createElement('span', { className: 'text-xs' }, row.model) },
    { accessor: 'prompt_tokens_estimated', header: 'Tokens', render: (_: unknown, row: GeminiLog) => createElement('span', { className: 'text-xs' }, `${row.prompt_tokens_estimated ?? '-'}/${row.response_tokens ?? '-'}`) },
    { accessor: 'time_total_ms', header: 'Latencia', render: (_: unknown, row: GeminiLog) => fmtMs(row.time_total_ms) },
    { accessor: 'time_ttft_ms', header: 'TTFT', render: (_: unknown, row: GeminiLog) => fmtMs(row.time_ttft_ms) },
    { accessor: 'cached', header: 'Cache', render: (_: unknown, row: GeminiLog) => row.cached ? createElement(Badge, { variant: 'outline' as const, style: { borderColor: C.statusSuccess, color: C.statusSuccess } }, 'Hit') : createElement('span', { className: 'text-xs', style: { color: C.text400 } }, '-') },
    {
      accessor: 'success', header: 'Status',
      render: (_: unknown, row: GeminiLog) => createElement(Badge, { variant: row.success ? 'default' as const : 'destructive' as const }, row.success ? 'OK' : 'Erro'),
    },
    { accessor: 'username', header: 'Usuario', render: (_: unknown, row: GeminiLog) => createElement('span', { className: 'text-xs' }, row.username || '-') },
  ]

  const advColumns = [
    { accessor: 'created_at', header: 'Hora', render: (_: unknown, row: RequestPerfLog) => fmtTime(row.created_at) },
    { accessor: 'request_id', header: 'Request ID', render: (_: unknown, row: RequestPerfLog) => createElement('span', { className: 'text-xs font-mono' }, row.request_id?.slice(0, 8)) },
    { accessor: 'numero_cnj', header: 'CNJ', render: (_: unknown, row: RequestPerfLog) => createElement('span', { className: 'text-xs' }, row.numero_cnj || '-') },
    { accessor: 'tipo_peca', header: 'Tipo Peca', render: (_: unknown, row: RequestPerfLog) => createElement('span', { className: 'text-xs' }, row.tipo_peca || '-') },
    { accessor: 'total_ms', header: 'Total', render: (_: unknown, row: RequestPerfLog) => createElement('span', { style: { color: row.total_ms > 15000 ? C.statusError : row.total_ms > 10000 ? C.orange500 : undefined, fontWeight: row.total_ms > 10000 ? 600 : undefined } }, fmtMs(row.total_ms)) },
    { accessor: 'ttft_ms', header: 'TTFT', render: (_: unknown, row: RequestPerfLog) => fmtMs(row.ttft_ms) },
    { accessor: 'agente1_ms', header: 'Ag1', render: (_: unknown, row: RequestPerfLog) => fmtMs(row.agente1_ms) },
    { accessor: 'agente2_ms', header: 'Ag2', render: (_: unknown, row: RequestPerfLog) => fmtMs(row.agente2_ms) },
    { accessor: 'generation_ms', header: 'Geracao', render: (_: unknown, row: RequestPerfLog) => fmtMs(row.generation_ms) },
    { accessor: 'streaming_chunks', header: 'Chunks', render: (_: unknown, row: RequestPerfLog) => row.streaming_chunks ?? '-' },
    {
      accessor: 'success', header: 'Status',
      render: (_: unknown, row: RequestPerfLog) => createElement(Badge, { variant: row.success ? 'default' as const : 'destructive' as const }, row.success ? 'OK' : 'Erro'),
    },
  ]

  return {
    // Geral
    tab, setTab,
    loading,
    timePeriod, setTimePeriod,

    // Tab Sistema
    summary,
    perfLogs,
    routeMaps,
    topRoutes,
    unmappedRoutes,
    availableActions,
    availableSystems,
    routeMapExpanded, setRouteMapExpanded,
    topRoutesExpanded, setTopRoutesExpanded,
    errorsExpanded, setErrorsExpanded,
    filterSystem, setFilterSystem,
    filterRoute, setFilterRoute,
    filterAction, setFilterAction,
    filterBottleneck, setFilterBottleneck,
    filterStatus, setFilterStatus,

    // Route map CRUD
    mapDialogOpen, setMapDialogOpen,
    editingMap,
    mapForm, setMapForm,
    savingMap,

    // Tab Gemini
    geminiSummary,
    geminiLogs,
    geminiSystems,
    geminiModels,
    filterGeminiSistema, setFilterGeminiSistema,
    filterGeminiModel, setFilterGeminiModel,
    filterGeminiStatus, setFilterGeminiStatus,

    // Tab Avancado
    reqPerfSummary,
    reqPerfLogs,
    reqPerfSlowest,
    filterAdvSistema, setFilterAdvSistema,
    filterMinLatency, setFilterMinLatency,

    // Operacoes
    clearingLogs,
    cleanupDays, setCleanupDays,

    // Dados derivados
    pieData,
    geminiBySystemData,
    geminiByModelData,

    // Colunas
    perfColumns,
    geminiColumns,
    advColumns,

    // Handlers
    loadData,
    clearFilters,
    handleCleanup,
    openCreateMap,
    openEditMap,
    saveMap,
    deleteMap,
    handleCacheInvalidate,
    exportAdvancedCsv,
  }
}

export type UsePerformanceReturn = ReturnType<typeof usePerformance>
