import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/shared/DataTable'
import { C } from '@/lib/designTokens'
import {
  ChevronDown,
  Clock,
  Download,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

import type { UsePerformanceReturn } from '../hooks/usePerformance'
import { BOTTLENECK_STYLE, PIE_COLORS, BAR_COLORS, fmtMs, fmtTime } from '../hooks/usePerformance'

// ============================================================
// TAB: Performance Sistema
// ============================================================

export function TabSistema({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="space-y-6">

      {/* --- Cards de gargalo --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(['LLM', 'DB', 'PARSE', 'OUTRO'] as const).map(bn => {
          const style = BOTTLENECK_STYLE[bn]
          const count = vm.summary?.bottleneck_summary?.[bn] || 0
          const avg = bn === 'OUTRO' ? vm.summary?.avg_times.total : vm.summary?.avg_times[bn.toLowerCase() as 'llm' | 'db' | 'parse']
          return (
            <button key={bn} onClick={() => { vm.setFilterBottleneck(bn); void vm.loadData() }}
              className="bg-white rounded-2xl shadow-md p-4 border-l-4 text-left transition-shadow hover:shadow-lg"
              style={{ borderColor: C.gray200, borderLeftColor: style.color }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium" style={{ color: C.text500 }}>Gargalo {bn === 'OUTRO' ? 'Outro' : bn}</h3>
                  <p className="text-3xl leading-none mt-1 font-bold" style={{ color: style.color }}>{count}</p>
                </div>
                <style.icon className="h-7 w-7" style={{ color: style.color, opacity: 0.3 }} />
              </div>
              <p className="text-xs mt-2" style={{ color: C.text500 }}>avg: {fmtMs(avg || 0)}</p>
            </button>
          )
        })}
      </div>

      {/* --- Graficos --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: C.text900 }}>Distribuicao de Gargalos</h3>
          <div className="h-[220px] min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie data={vm.pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {vm.pieData.map((row, idx) => (
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
            {(['LLM', 'DB', 'PARSE'] as const).map(bn => {
              const style = BOTTLENECK_STYLE[bn]
              const items = vm.summary?.slowest_by_bottleneck?.[bn] || []
              return (
                <div key={bn}>
                  <h4 className="text-sm font-medium mb-2" style={{ color: style.color }}>
                    <style.icon className="h-4 w-4 inline mr-1" />{bn}
                  </h4>
                  <div className="space-y-1 text-xs">
                    {items.length === 0 && <span style={{ color: C.text400 }}>Sem dados</span>}
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between" style={{ color: C.text700 }}>
                        <span className="truncate mr-2">{item.route}</span>
                        <span className="font-mono whitespace-nowrap">{fmtMs(item.total_ms)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* --- Mapeamento Rota -> Sistema --- */}
      <RouteMapSection vm={vm} />

      {/* --- Top Routes (sem mapeamento) --- */}
      {vm.unmappedRoutes.length > 0 && <UnmappedRoutesSection vm={vm} />}

      {/* --- Filtros --- */}
      <SistemaFilters vm={vm} />

      {/* --- Tabela de logs --- */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border" style={{ borderColor: C.gray200 }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: C.gray200 }}>
          <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>
            Logs de Performance
            {vm.summary && <span className="text-sm font-normal ml-2" style={{ color: C.text400 }}>({vm.summary.total_logs} no periodo)</span>}
          </h2>
          <CleanupControls vm={vm} endpoint="/admin/api/performance/cleanup" />
        </div>
        <DataTable data={vm.perfLogs} columns={vm.perfColumns} isLoading={vm.loading} emptyMessage="Nenhum log encontrado" />
      </div>

      {/* --- Erros recentes --- */}
      {(vm.summary?.recent_errors?.length || 0) > 0 && <RecentErrors vm={vm} />}
    </div>
  )
}

// ============================================================
// TAB: Gemini API
// ============================================================

export function TabGemini({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="space-y-6">

      {/* --- Cards resumo --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: 'Total Chamadas', value: vm.geminiSummary?.total_calls || 0, sub: `${vm.geminiSummary?.stats.success_count || 0} ok / ${vm.geminiSummary?.stats.error_count || 0} erros`, color: C.statusSuccess },
          { label: 'Latencia Media', value: fmtMs(vm.geminiSummary?.stats.avg_latency_ms), sub: `min ${fmtMs(vm.geminiSummary?.stats.min_latency_ms)} / max ${fmtMs(vm.geminiSummary?.stats.max_latency_ms)}`, color: C.chartBlue },
          { label: 'Tokens Prompt', value: (vm.geminiSummary?.stats.total_prompt_tokens || 0).toLocaleString(), sub: `resp: ${(vm.geminiSummary?.stats.total_response_tokens || 0).toLocaleString()}`, color: C.chartPurple },
          { label: 'Taxa Sucesso', value: `${(vm.geminiSummary?.stats.success_rate || 0).toFixed(1)}%`, sub: `retries: ${vm.geminiSummary?.stats.total_retries || 0}`, color: C.navy500 },
        ]).map(card => (
          <div key={card.label} className="bg-white rounded-2xl shadow-md p-4 border-l-4" style={{ borderColor: C.gray200, borderLeftColor: card.color }}>
            <p className="text-sm" style={{ color: C.text500 }}>{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="text-xs mt-1" style={{ color: C.text400 }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {([
          { label: 'TTFT Medio', value: fmtMs(vm.geminiSummary?.stats.avg_ttft_ms), color: C.orange500 },
          { label: 'Geracao', value: fmtMs(vm.geminiSummary?.stats.avg_generation_ms), color: C.navy700 },
          { label: 'Cache Hits', value: vm.geminiSummary?.stats.cache_hits ?? 0, color: C.statusSuccess },
          { label: 'Com Imagens', value: vm.geminiSummary?.stats.with_images ?? 0, color: C.chartPurple },
          { label: 'Com Search', value: vm.geminiSummary?.stats.with_search ?? 0, color: C.chartBlue },
        ]).map(card => (
          <div key={card.label} className="bg-white rounded-2xl shadow-md p-3 border" style={{ borderColor: C.gray200 }}>
            <p className="text-xs" style={{ color: C.text500 }}>{card.label}</p>
            <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* --- Graficos --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: C.text900 }}>Chamadas por Sistema</h3>
          <div className="h-[240px] min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={vm.geminiBySystemData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Chamadas">
                  {vm.geminiBySystemData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: C.text900 }}>Chamadas por Modelo</h3>
          <div className="h-[240px] min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie data={vm.geminiByModelData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {vm.geminiByModelData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- Chamadas mais lentas --- */}
      {(vm.geminiSummary?.slowest_calls?.length || 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: C.text900 }}>
            <Clock className="h-4 w-4 inline mr-2" />Chamadas Mais Lentas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {vm.geminiSummary?.slowest_calls.slice(0, 6).map((call, i) => (
              <div key={i} className="p-3 rounded-lg border" style={{ borderColor: C.gray200 }}>
                <div className="flex justify-between">
                  <span className="text-sm font-medium" style={{ color: C.text900 }}>{call.sistema}</span>
                  <span className="text-sm font-bold" style={{ color: call.time_total_ms > 10000 ? C.statusError : C.orange500 }}>{fmtMs(call.time_total_ms)}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: C.text400 }}>{call.model}</p>
                {call.error && <p className="text-xs mt-1 truncate" style={{ color: C.statusError }}>{call.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Filtros Gemini --- */}
      <GeminiFilters vm={vm} />

      {/* --- Tabela Gemini --- */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border" style={{ borderColor: C.gray200 }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: C.gray200 }}>
          <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>Logs Gemini API</h2>
          <CleanupControls vm={vm} endpoint="/admin/api/gemini-logs/cleanup" />
        </div>
        <DataTable data={vm.geminiLogs} columns={vm.geminiColumns} isLoading={vm.loading} emptyMessage="Nenhum log encontrado" />
      </div>

      {/* --- Erros Gemini --- */}
      {(vm.geminiSummary?.recent_errors?.length || 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: C.statusError }}>Erros Recentes Gemini</h3>
          <div className="space-y-1">
            {vm.geminiSummary?.recent_errors.slice(0, 5).map((err, i) => (
              <div key={i} className="text-xs flex gap-2" style={{ color: C.text700 }}>
                <span style={{ color: C.text400 }}>{fmtTime(err.created_at)}</span>
                <span>{err.sistema}</span>
                <span className="truncate" style={{ color: C.statusError }}>{err.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB: Logs Avancados
// ============================================================

export function TabAvancado({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="space-y-6">

      {/* --- Cards resumo --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: 'Total Requests', value: vm.reqPerfSummary?.total_requests ?? 0, sub: `${vm.reqPerfSummary?.success_count ?? 0} ok / ${vm.reqPerfSummary?.error_count ?? 0} erros`, color: C.navy700 },
          { label: 'Latencia Media', value: fmtMs(vm.reqPerfSummary?.avg_total_ms), sub: `min ${fmtMs(vm.reqPerfSummary?.min_total_ms)} / max ${fmtMs(vm.reqPerfSummary?.max_total_ms)}`, color: C.orange500 },
          { label: 'TTFT Medio', value: fmtMs(vm.reqPerfSummary?.avg_ttft_ms), sub: 'Time to First Token', color: C.chartPurple },
          { label: 'Geracao Media', value: fmtMs(vm.reqPerfSummary?.avg_generation_ms), sub: 'Tempo de geracao LLM', color: C.chartBlue },
        ]).map(card => (
          <div key={card.label} className="bg-white rounded-2xl shadow-md p-4 border-l-4" style={{ borderColor: C.gray200, borderLeftColor: card.color }}>
            <p className="text-sm" style={{ color: C.text500 }}>{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="text-xs mt-1" style={{ color: C.text400 }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* --- Breakdown por etapa --- */}
      {vm.reqPerfSummary?.breakdown && (
        <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: C.text900 }}>Breakdown Medio por Etapa</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {([
              { label: 'Agente 1 (TJ-MS)', key: 'agente1_ms', color: C.navy700 },
              { label: 'Agente 2 (Detector)', key: 'agente2_ms', color: C.navy500 },
              { label: 'Prompt Build', key: 'prompt_build_ms', color: C.orange500 },
              { label: 'Pos-Processo', key: 'postprocess_ms', color: C.chartPurple },
              { label: 'DB Save', key: 'db_save_ms', color: C.chartYellow },
              { label: 'Overhead', key: 'overhead_ms', color: C.gray500 },
            ] as const).map(item => {
              const val = vm.reqPerfSummary!.breakdown?.[item.key as keyof typeof vm.reqPerfSummary.breakdown] ?? 0
              return (
                <div key={item.key} className="text-center p-3 rounded-lg" style={{ background: `${item.color}10` }}>
                  <p className="text-xs font-medium" style={{ color: item.color }}>{item.label}</p>
                  <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{fmtMs(val)}</p>
                </div>
              )
            })}
          </div>
          {vm.reqPerfSummary.streaming && (
            <div className="mt-3 flex gap-6 text-sm" style={{ color: C.text500 }}>
              <span>Chunks medio: <strong>{vm.reqPerfSummary.streaming.avg_chunks?.toFixed(0) ?? '-'}</strong></span>
              <span>Intervalo medio entre chunks: <strong>{fmtMs(vm.reqPerfSummary.streaming.avg_chunk_interval_ms)}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* --- Requests mais lentos --- */}
      {vm.reqPerfSlowest.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: C.text900 }}>
            <Clock className="h-4 w-4 inline mr-2" />Requests Mais Lentos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {vm.reqPerfSlowest.slice(0, 6).map((req, i) => (
              <div key={i} className="p-3 rounded-lg border" style={{ borderColor: C.gray200 }}>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono" style={{ color: C.text400 }}>{req.request_id?.slice(0, 8)}</span>
                  <span className="text-lg font-bold" style={{ color: req.total_ms > 20000 ? C.statusError : req.total_ms > 10000 ? C.orange500 : C.text900 }}>{fmtMs(req.total_ms)}</span>
                </div>
                {req.numero_cnj && <p className="text-xs mt-1" style={{ color: C.text700 }}>CNJ: {req.numero_cnj}</p>}
                {req.tipo_peca && <p className="text-xs" style={{ color: C.text400 }}>{req.tipo_peca}</p>}
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  {req.ttft_ms != null && <Badge variant="outline">TTFT: {fmtMs(req.ttft_ms)}</Badge>}
                  {req.generation_ms != null && <Badge variant="outline">Gen: {fmtMs(req.generation_ms)}</Badge>}
                  {req.agente1_ms != null && <Badge variant="outline">Ag1: {fmtMs(req.agente1_ms)}</Badge>}
                  {req.agente2_ms != null && <Badge variant="outline">Ag2: {fmtMs(req.agente2_ms)}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Filtros Avancado --- */}
      <AdvancedFilters vm={vm} />

      {/* --- Tabela --- */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border" style={{ borderColor: C.gray200 }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: C.gray200 }}>
          <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>Request Performance Logs</h2>
          <CleanupControls vm={vm} endpoint="/admin/api/gemini-logs/request-perf/cleanup" />
        </div>
        <DataTable data={vm.reqPerfLogs} columns={vm.advColumns} isLoading={vm.loading} emptyMessage="Nenhum log encontrado" searchable searchPlaceholder="Buscar por CNJ, tipo de peca..." />
      </div>
    </div>
  )
}

// ============================================================
// Subcomponentes compartilhados (internos)
// ============================================================

function CleanupControls({ vm, endpoint }: { vm: UsePerformanceReturn; endpoint: string }) {
  return (
    <div className="flex items-center gap-2">
      <Select value={vm.cleanupDays} onValueChange={vm.setCleanupDays}>
        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="3">3 dias</SelectItem>
          <SelectItem value="7">7 dias</SelectItem>
          <SelectItem value="14">14 dias</SelectItem>
          <SelectItem value="30">30 dias</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={() => void vm.handleCleanup(endpoint)} variant="ghost" size="sm" style={{ color: C.statusError }} disabled={vm.clearingLogs}>
        {vm.clearingLogs ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Limpando...</> : <><Trash2 className="h-3 w-3 mr-1" />Limpar</>}
      </Button>
    </div>
  )
}

function RouteMapSection({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" style={{ color: C.text900 }}>
          <MapPin className="h-4 w-4 inline mr-2" />Mapeamento Rota → Sistema
          <Badge variant="outline" className="ml-2">{vm.routeMaps.length}</Badge>
        </h3>
        <div className="flex items-center gap-2">
          <Button onClick={() => vm.openCreateMap()} size="sm" style={{ background: C.navy950, color: 'white' }}>
            <Plus className="h-3 w-3 mr-1" />Adicionar
          </Button>
          <button onClick={() => vm.setRouteMapExpanded(v => !v)} className="text-sm flex items-center gap-1" style={{ color: C.navy700 }}>
            <ChevronDown className={`h-4 w-4 transition-transform ${vm.routeMapExpanded ? 'rotate-180' : ''}`} />
            {vm.routeMapExpanded ? 'Recolher' : 'Expandir'}
          </button>
        </div>
      </div>
      {vm.routeMapExpanded && (
        <div className="mt-4 space-y-2">
          {vm.routeMaps.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: C.gray200 }}>
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm" style={{ color: C.text900 }}>{m.route_pattern}</span>
                <span className="mx-2" style={{ color: C.text400 }}>→</span>
                <Badge variant="outline">{m.system_name}</Badge>
                <Badge variant="secondary" className="ml-2 text-xs">{m.match_type}</Badge>
                {m.priority > 0 && <span className="text-xs ml-2" style={{ color: C.text400 }}>p:{m.priority}</span>}
              </div>
              <div className="flex gap-1 ml-2">
                <Button onClick={() => vm.openEditMap(m)} variant="ghost" size="sm"><Pencil className="h-3 w-3" /></Button>
                <Button onClick={() => void vm.deleteMap(m.id)} variant="ghost" size="sm" style={{ color: C.statusError }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          {vm.routeMaps.length === 0 && <p className="text-sm" style={{ color: C.text400 }}>Nenhum mapeamento configurado.</p>}
        </div>
      )}
    </div>
  )
}

function UnmappedRoutesSection({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" style={{ color: C.text900 }}>
          <Zap className="h-4 w-4 inline mr-2" />Rotas Frequentes sem Mapeamento
        </h3>
        <button onClick={() => vm.setTopRoutesExpanded(v => !v)} className="text-sm flex items-center gap-1" style={{ color: C.navy700 }}>
          <ChevronDown className={`h-4 w-4 transition-transform ${vm.topRoutesExpanded ? 'rotate-180' : ''}`} />
          {vm.topRoutesExpanded ? 'Recolher' : 'Expandir'}
        </button>
      </div>
      {vm.topRoutesExpanded && (
        <div className="mt-3 space-y-1">
          {vm.unmappedRoutes.slice(0, 10).map(r => (
            <div key={r.route} className="flex items-center justify-between py-1 text-sm">
              <span className="font-mono text-xs truncate flex-1" style={{ color: C.text700 }}>{r.route}</span>
              <Badge variant="secondary" className="mx-2">{r.count}x</Badge>
              <Button onClick={() => vm.openCreateMap({ route_pattern: r.route })} variant="outline" size="sm" className="text-xs">Mapear</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentErrors({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" style={{ color: C.statusError }}>
          Erros Recentes
          <Badge variant="destructive" className="ml-2">{vm.summary?.recent_errors.length}</Badge>
        </h3>
        <button onClick={() => vm.setErrorsExpanded(v => !v)} className="text-sm" style={{ color: C.navy700 }}>
          <ChevronDown className={`h-4 w-4 inline transition-transform ${vm.errorsExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {vm.errorsExpanded && (
        <div className="mt-3 space-y-2">
          {vm.summary?.recent_errors.map((err, i) => (
            <div key={i} className="flex items-start gap-3 p-2 rounded-lg" style={{ background: C.errorBg }}>
              <span className="text-xs whitespace-nowrap" style={{ color: C.text400 }}>{fmtTime(err.created_at)}</span>
              <span className="text-xs font-mono" style={{ color: C.text700 }}>{err.route}</span>
              <Badge variant="outline" className="text-xs">{err.error_type || 'unknown'}</Badge>
              <span className="text-xs flex-1 truncate" style={{ color: C.statusError }}>{err.error_message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Filtros por tab
// ============================================================

function SistemaFilters({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Sistema</label>
          <Select value={vm.filterSystem} onValueChange={vm.setFilterSystem}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vm.availableSystems.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Rota</label>
          <Input value={vm.filterRoute} onChange={e => vm.setFilterRoute(e.target.value)} placeholder="/api/..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Action</label>
          <Select value={vm.filterAction} onValueChange={vm.setFilterAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {vm.availableActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Gargalo</label>
          <Select value={vm.filterBottleneck} onValueChange={vm.setFilterBottleneck}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="LLM">LLM</SelectItem>
              <SelectItem value="DB">DB</SelectItem>
              <SelectItem value="PARSE">Parse</SelectItem>
              <SelectItem value="OUTRO">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Status</label>
          <Select value={vm.filterStatus} onValueChange={vm.setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Periodo</label>
          <Select value={vm.timePeriod} onValueChange={vm.setTimePeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hora</SelectItem>
              <SelectItem value="6">6 horas</SelectItem>
              <SelectItem value="24">24 horas</SelectItem>
              <SelectItem value="72">3 dias</SelectItem>
              <SelectItem value="168">7 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => void vm.loadData()} className="flex-1" style={{ background: C.navy950, color: 'white' }} data-testid="btn-refresh">
            Filtrar
          </Button>
          <Button onClick={vm.clearFilters} variant="outline" data-testid="btn-clear-filters">x</Button>
        </div>
      </div>
    </div>
  )
}

function GeminiFilters({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Sistema</label>
          <Select value={vm.filterGeminiSistema} onValueChange={vm.setFilterGeminiSistema}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vm.geminiSystems.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Modelo</label>
          <Select value={vm.filterGeminiModel} onValueChange={vm.setFilterGeminiModel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vm.geminiModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Status</label>
          <Select value={vm.filterGeminiStatus} onValueChange={vm.setFilterGeminiStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Falha</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Periodo</label>
          <Select value={vm.timePeriod} onValueChange={vm.setTimePeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hora</SelectItem>
              <SelectItem value="6">6 horas</SelectItem>
              <SelectItem value="24">24 horas</SelectItem>
              <SelectItem value="72">3 dias</SelectItem>
              <SelectItem value="168">7 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => void vm.loadData()} className="flex-1" style={{ background: C.navy950, color: 'white' }}>
            <RefreshCw className="h-3 w-3 mr-1" />Filtrar
          </Button>
          <Button onClick={vm.clearFilters} variant="outline">x</Button>
        </div>
      </div>
    </div>
  )
}

function AdvancedFilters({ vm }: { vm: UsePerformanceReturn }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border" style={{ borderColor: C.gray200 }}>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Sistema</label>
          <Select value={vm.filterAdvSistema} onValueChange={vm.setFilterAdvSistema}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="gerador_pecas">Gerador de Pecas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Periodo</label>
          <Select value={vm.timePeriod} onValueChange={vm.setTimePeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hora</SelectItem>
              <SelectItem value="6">6 horas</SelectItem>
              <SelectItem value="24">24 horas</SelectItem>
              <SelectItem value="72">3 dias</SelectItem>
              <SelectItem value="168">7 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: C.text700 }}>Latencia minima (ms)</label>
          <Input value={vm.filterMinLatency} onChange={e => vm.setFilterMinLatency(e.target.value)} placeholder="5000" type="number" />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => void vm.loadData()} className="flex-1" style={{ background: C.navy950, color: 'white' }}>
            <RefreshCw className="h-3 w-3 mr-1" />Filtrar
          </Button>
          <Button onClick={vm.clearFilters} variant="outline">x</Button>
        </div>
        <div className="flex items-end">
          <Button onClick={vm.exportAdvancedCsv} variant="outline" className="w-full">
            <Download className="h-3 w-3 mr-1" />Exportar CSV
          </Button>
        </div>
      </div>
    </div>
  )
}
