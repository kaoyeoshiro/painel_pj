import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/DataTable';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Interfaces locais
// ---------------------------------------------------------------------------

interface PerformanceSummary {
  bottleneck_summary: Record<string, number>;
  avg_times: { llm: number; db: number; parse: number; total: number };
  recent_errors: Array<{
    id: number;
    route: string;
    error_message: string;
    created_at: string;
  }>;
  /** Top 3 rotas mais lentas por gargalo (retornado pelo backend) */
  top_slowest?: Array<{
    route: string;
    bottleneck: string;
    avg_total_ms: number;
  }>;
}

interface PerformanceLog {
  id: number;
  created_at: string;
  system_name: string;
  route: string;
  action?: string;
  total_ms: number;
  llm_ms?: number;
  db_ms?: number;
  parse_ms?: number;
  network_ms?: number;
  bottleneck: string;
  status: string;
  error_message?: string;
}

interface GeminiSummary {
  total_calls: number;
  stats: {
    success_count: number;
    error_count: number;
    avg_latency_ms: number;
    success_rate: number;
    total_prompt_tokens: number;
    total_response_tokens: number;
  };
  by_sistema: Array<{ sistema: string; count: number }>;
  by_model: Array<{ model: string; count: number }>;
}

interface GeminiLog {
  id: number;
  created_at: string;
  sistema: string;
  model: string;
  time_total_ms: number;
  success: boolean;
  error?: string;
  prompt_tokens_estimated?: number;
  response_tokens?: number;
}

/** Mapeamento de rotas CRUD (27.16) */
interface RouteMapping {
  rota: string;
  sistema: string;
  descricao: string;
  metodo: string;
}

// ---------------------------------------------------------------------------
// Constantes auxiliares
// ---------------------------------------------------------------------------

/** Cores padrão para gráficos e barras */
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

/** Tipos de gargalo possíveis */
const BOTTLENECK_OPTIONS = ['llm', 'db', 'parse', 'network'] as const;

/** Status possíveis */
const STATUS_OPTIONS = ['success', 'error'] as const;

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function PerformancePage() {
  const { toast } = useToast();

  // --- Filtros globais ---
  const [timePeriod, setTimePeriod] = useState<string>('24');
  const [filterSistema, setFilterSistema] = useState<string>('all');
  const [filterRota, setFilterRota] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterGargalo, setFilterGargalo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // --- Estado de carregamento ---
  const [loading, setLoading] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // --- Dados: Performance Sistema ---
  const [perfSummary, setPerfSummary] = useState<PerformanceSummary | null>(null);
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>([]);

  // --- Dados: Gemini ---
  const [geminiSummary, setGeminiSummary] = useState<GeminiSummary | null>(null);
  const [geminiLogs, setGeminiLogs] = useState<GeminiLog[]>([]);

  // --- Dados: Mapeamento de Rotas (27.16) ---
  const [routeMapping, setRouteMapping] = useState<RouteMapping[]>([]);

  // ---------------------------------------------------------------------------
  // Extração de opções dinâmicas para filtros (baseado nos logs carregados)
  // ---------------------------------------------------------------------------

  /** Sistemas distintos disponíveis nos logs */
  const availableSistemas = useMemo(() => {
    const set = new Set(perfLogs.map((l) => l.system_name).filter(Boolean));
    return Array.from(set).sort();
  }, [perfLogs]);

  /** Actions distintas disponíveis nos logs */
  const availableActions = useMemo(() => {
    const set = new Set(perfLogs.map((l) => l.action).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [perfLogs]);

  // ---------------------------------------------------------------------------
  // Construção da query string de filtros
  // ---------------------------------------------------------------------------

  const buildFilterQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('hours', timePeriod);
    if (filterSistema && filterSistema !== 'all') params.set('sistema', filterSistema);
    if (filterRota.trim()) params.set('rota', filterRota.trim());
    if (filterGargalo && filterGargalo !== 'all') params.set('gargalo', filterGargalo);
    if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
    return params.toString();
  }, [timePeriod, filterSistema, filterRota, filterGargalo, filterStatus]);

  // ---------------------------------------------------------------------------
  // Carregamento de dados
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildFilterQuery();

      // Performance Sistema
      const summaryRes = await adminApi.get<PerformanceSummary>(
        `/admin/api/performance/summary?${qs}`,
      );
      setPerfSummary(summaryRes);

      const logsRes = await adminApi.get<{ logs: PerformanceLog[] }>(
        `/admin/api/performance/logs?${qs}&limit=50`,
      );
      setPerfLogs(logsRes.logs || []);

      // Logs Gemini
      const geminiSummaryRes = await adminApi.get<GeminiSummary>(
        `/admin/api/gemini-logs/summary?hours=${timePeriod}`,
      );
      setGeminiSummary(geminiSummaryRes);

      const geminiLogsRes = await adminApi.get<{ logs: GeminiLog[] }>(
        `/admin/api/gemini-logs?hours=${timePeriod}&limit=50`,
      );
      setGeminiLogs(geminiLogsRes.logs || []);

      // Mapeamento de rotas (27.16)
      try {
        const mappingRes = await adminApi.get<{ mappings: RouteMapping[] }>(
          '/admin/api/performance/route-mapping',
        );
        setRouteMapping(mappingRes.mappings || []);
      } catch {
        // Endpoint pode ainda não existir; não bloqueia o restante
        setRouteMapping([]);
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [buildFilterQuery, timePeriod, toast]);

  // Recarrega ao mudar qualquer filtro
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod, filterSistema, filterRota, filterAction, filterGargalo, filterStatus]);

  // ---------------------------------------------------------------------------
  // Ação: Limpar filtros (27.2)
  // ---------------------------------------------------------------------------

  const handleClearFilters = () => {
    setTimePeriod('24');
    setFilterSistema('all');
    setFilterRota('');
    setFilterAction('all');
    setFilterGargalo('all');
    setFilterStatus('all');
  };

  /** Verifica se algum filtro está ativo (para destacar o botão) */
  const hasActiveFilters =
    timePeriod !== '24' ||
    filterSistema !== 'all' ||
    filterRota.trim() !== '' ||
    filterAction !== 'all' ||
    filterGargalo !== 'all' ||
    filterStatus !== 'all';

  // ---------------------------------------------------------------------------
  // Ação: Limpar logs antigos (27.3)
  // ---------------------------------------------------------------------------

  const handleClearOldLogs = async () => {
    if (!window.confirm('Tem certeza que deseja limpar logs com mais de 7 dias?')) return;

    setClearingLogs(true);
    try {
      await adminApi.delete<{ deleted: number }>(
        '/admin/api/performance/logs/limpar?hours=168',
      );
      toast({
        title: 'Logs antigos removidos',
        description: 'Logs com mais de 7 dias foram limpos com sucesso.',
      });
      // Recarrega dados após limpeza
      await loadData();
    } catch (error) {
      toast({
        title: 'Erro ao limpar logs',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setClearingLogs(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Cards de gargalo clicáveis (27.13)
  // ---------------------------------------------------------------------------

  /** Ao clicar num stat card de gargalo, filtra a tabela por aquele tipo */
  const handleBottleneckCardClick = (bottleneck: string) => {
    // Se já está selecionado, remove o filtro
    if (filterGargalo === bottleneck) {
      setFilterGargalo('all');
    } else {
      setFilterGargalo(bottleneck);
    }
  };

  // ---------------------------------------------------------------------------
  // Top 3 rotas mais lentas (27.15) - cálculo local como fallback
  // ---------------------------------------------------------------------------

  const topSlowest = useMemo(() => {
    // Prioriza dados do backend se disponíveis
    if (perfSummary?.top_slowest && perfSummary.top_slowest.length > 0) {
      return perfSummary.top_slowest.slice(0, 3);
    }

    // Fallback: calcula localmente a partir dos logs
    if (perfLogs.length === 0) return [];

    const routeMap = new Map<string, { total: number; count: number; bottleneck: string }>();
    for (const log of perfLogs) {
      const key = `${log.route}__${log.bottleneck}`;
      const entry = routeMap.get(key) || { total: 0, count: 0, bottleneck: log.bottleneck };
      entry.total += log.total_ms;
      entry.count += 1;
      routeMap.set(key, entry);
    }

    return Array.from(routeMap.entries())
      .map(([key, val]) => ({
        route: key.split('__')[0],
        bottleneck: val.bottleneck,
        avg_total_ms: val.total / val.count,
      }))
      .sort((a, b) => b.avg_total_ms - a.avg_total_ms)
      .slice(0, 3);
  }, [perfSummary, perfLogs]);

  // ---------------------------------------------------------------------------
  // Dados para PieChart de bottlenecks (27.14)
  // ---------------------------------------------------------------------------

  const bottleneckPieData = useMemo(() => {
    if (!perfSummary?.bottleneck_summary) return [];
    return Object.entries(perfSummary.bottleneck_summary).map(([name, value]) => ({
      name,
      value,
    }));
  }, [perfSummary]);

  // ---------------------------------------------------------------------------
  // Renderização: barra colorida auxiliar
  // ---------------------------------------------------------------------------

  const renderBar = (label: string, value: number, max: number, color: string, key: string) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div key={key} className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>{label}</span>
          <span className="font-semibold">{value}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Colunas DataTable: Performance (tab padrão)
  // ---------------------------------------------------------------------------

  const perfColumns = [
    { accessor: 'system_name', header: 'Sistema' },
    { accessor: 'route', header: 'Rota' },
    {
      accessor: 'total_ms',
      header: 'Total MS',
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="font-mono">{log.total_ms.toFixed(0)}ms</span>
      ),
    },
    { accessor: 'bottleneck', header: 'Gargalo' },
    {
      accessor: 'status',
      header: 'Status',
      render: (_value: unknown, log: PerformanceLog) => (
        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
          {log.status}
        </Badge>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Colunas DataTable: Logs Avançados (27.12) - todos os campos expandidos
  // ---------------------------------------------------------------------------

  const advancedPerfColumns = [
    { accessor: 'id', header: 'ID', sortable: true },
    {
      accessor: 'created_at',
      header: 'Data/Hora',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="font-mono text-xs">
          {new Date(log.created_at).toLocaleString('pt-BR')}
        </span>
      ),
    },
    { accessor: 'system_name', header: 'Sistema', sortable: true },
    { accessor: 'route', header: 'Rota', sortable: true },
    { accessor: 'action', header: 'Action', sortable: true },
    {
      accessor: 'total_ms',
      header: 'Total (ms)',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="font-mono">{log.total_ms.toFixed(0)}</span>
      ),
    },
    {
      accessor: 'llm_ms',
      header: 'LLM (ms)',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="font-mono">{log.llm_ms != null ? log.llm_ms.toFixed(0) : '-'}</span>
      ),
    },
    {
      accessor: 'db_ms',
      header: 'DB (ms)',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="font-mono">{log.db_ms != null ? log.db_ms.toFixed(0) : '-'}</span>
      ),
    },
    {
      accessor: 'parse_ms',
      header: 'Parse (ms)',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="font-mono">{log.parse_ms != null ? log.parse_ms.toFixed(0) : '-'}</span>
      ),
    },
    {
      accessor: 'network_ms',
      header: 'Network (ms)',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="font-mono">
          {log.network_ms != null ? log.network_ms.toFixed(0) : '-'}
        </span>
      ),
    },
    {
      accessor: 'bottleneck',
      header: 'Gargalo',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <Badge variant="outline">{log.bottleneck}</Badge>
      ),
    },
    {
      accessor: 'status',
      header: 'Status',
      sortable: true,
      render: (_value: unknown, log: PerformanceLog) => (
        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
          {log.status}
        </Badge>
      ),
    },
    {
      accessor: 'error_message',
      header: 'Erro',
      render: (_value: unknown, log: PerformanceLog) => (
        <span className="text-xs text-red-600 max-w-[200px] truncate block" title={log.error_message}>
          {log.error_message || '-'}
        </span>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Colunas DataTable: Gemini
  // ---------------------------------------------------------------------------

  const geminiColumns = [
    { accessor: 'sistema', header: 'Sistema' },
    { accessor: 'model', header: 'Modelo' },
    {
      accessor: 'time_total_ms',
      header: 'Latencia',
      render: (_value: unknown, log: GeminiLog) => (
        <span className="font-mono">{log.time_total_ms.toFixed(0)}ms</span>
      ),
    },
    {
      accessor: 'success',
      header: 'Sucesso',
      render: (_value: unknown, log: GeminiLog) => (
        <Badge variant={log.success ? 'default' : 'destructive'}>
          {log.success ? 'Sim' : 'Nao'}
        </Badge>
      ),
    },
    {
      accessor: 'tokens',
      header: 'Tokens',
      render: (_value: unknown, log: GeminiLog) => {
        const total = (log.prompt_tokens_estimated || 0) + (log.response_tokens || 0);
        return <span className="font-mono">{total}</span>;
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Colunas DataTable: Mapeamento de Rotas (27.16)
  // ---------------------------------------------------------------------------

  const routeMappingColumns = [
    { accessor: 'metodo', header: 'Metodo', sortable: true },
    { accessor: 'rota', header: 'Rota', sortable: true },
    { accessor: 'sistema', header: 'Sistema', sortable: true },
    { accessor: 'descricao', header: 'Descricao', sortable: true },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageContainer className="space-y-6">
      {/* ================================================================= */}
      {/* Header com ações globais                                          */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Performance do Sistema</h1>
          <p className="text-gray-600 mt-1">Monitore o desempenho do sistema e da IA</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Período */}
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32" data-testid="select-time-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hora</SelectItem>
              <SelectItem value="6">6 horas</SelectItem>
              <SelectItem value="24">24 horas</SelectItem>
              <SelectItem value="72">3 dias</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={loadData} disabled={loading} data-testid="btn-refresh">
            {loading ? 'Carregando...' : 'Atualizar'}
          </Button>

          {/* 27.2 - Botão Limpar Filtros */}
          <Button
            variant="outline"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            data-testid="btn-clear-filters"
          >
            Limpar Filtros
          </Button>

          {/* 27.3 - Botão Limpar Logs Antigos */}
          <Button
            variant="destructive"
            onClick={handleClearOldLogs}
            disabled={clearingLogs}
            data-testid="btn-clear-old-logs"
          >
            {clearingLogs ? 'Limpando...' : 'Limpar Antigos'}
          </Button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Barra de Filtros Avançados (27.4 a 27.8)                          */}
      {/* ================================================================= */}
      <Card className="p-4" data-testid="filter-bar">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 27.4 - Filtro Sistema */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sistema</label>
            <Select value={filterSistema} onValueChange={setFilterSistema}>
              <SelectTrigger data-testid="filter-sistema">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableSistemas.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 27.5 - Filtro Rota */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Rota</label>
            <Input
              placeholder="Ex: /api/classificar"
              value={filterRota}
              onChange={(e) => setFilterRota(e.target.value)}
              data-testid="filter-rota"
            />
          </div>

          {/* 27.6 - Filtro Action */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Action</label>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger data-testid="filter-action">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableActions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 27.7 - Filtro Gargalo */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Gargalo</label>
            <Select value={filterGargalo} onValueChange={setFilterGargalo}>
              <SelectTrigger data-testid="filter-gargalo">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {BOTTLENECK_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 27.8 - Filtro Status */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="filter-status">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'success' ? 'Sucesso' : 'Erro'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ================================================================= */}
      {/* Tabs principais (27.12 - terceira tab adicionada)                 */}
      {/* ================================================================= */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList>
          <TabsTrigger value="performance" data-testid="tab-performance">
            Performance Sistema
          </TabsTrigger>
          <TabsTrigger value="gemini" data-testid="tab-gemini">
            Logs Gemini
          </TabsTrigger>
          <TabsTrigger value="advanced" data-testid="tab-advanced-logs">
            Logs Avancados
          </TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* Tab 1: Performance Sistema                                     */}
        {/* ============================================================= */}
        <TabsContent value="performance" className="space-y-6">
          {/* --- Cards de gargalo clicáveis (27.13) --- */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                filterGargalo === 'llm' ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleBottleneckCardClick('llm')}
              data-testid="card-bottleneck-llm"
            >
              <div className="text-sm text-gray-600">LLM Medio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.llm.toFixed(0) || 0}ms
              </div>
              {filterGargalo === 'llm' && (
                <Badge variant="default" className="mt-2">Filtro ativo</Badge>
              )}
            </Card>

            <Card
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                filterGargalo === 'db' ? 'ring-2 ring-green-500' : ''
              }`}
              onClick={() => handleBottleneckCardClick('db')}
              data-testid="card-bottleneck-db"
            >
              <div className="text-sm text-gray-600">DB Medio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.db.toFixed(0) || 0}ms
              </div>
              {filterGargalo === 'db' && (
                <Badge variant="default" className="mt-2">Filtro ativo</Badge>
              )}
            </Card>

            <Card
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                filterGargalo === 'parse' ? 'ring-2 ring-yellow-500' : ''
              }`}
              onClick={() => handleBottleneckCardClick('parse')}
              data-testid="card-bottleneck-parse"
            >
              <div className="text-sm text-gray-600">Parse Medio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.parse.toFixed(0) || 0}ms
              </div>
              {filterGargalo === 'parse' && (
                <Badge variant="default" className="mt-2">Filtro ativo</Badge>
              )}
            </Card>

            <Card
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                filterGargalo === 'network' ? 'ring-2 ring-purple-500' : ''
              }`}
              onClick={() => handleBottleneckCardClick('network')}
              data-testid="card-bottleneck-network"
            >
              <div className="text-sm text-gray-600">Total Medio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.total.toFixed(0) || 0}ms
              </div>
              {filterGargalo === 'network' && (
                <Badge variant="default" className="mt-2">Filtro ativo</Badge>
              )}
            </Card>
          </div>

          {/* --- Distribuição de Bottlenecks: Barra + PieChart (27.14) --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Barras */}
            <Card className="p-6" data-testid="chart-bottleneck-bars">
              <h3 className="text-lg font-semibold mb-4">Distribuicao de Gargalos (Barras)</h3>
              {perfSummary?.bottleneck_summary &&
              Object.keys(perfSummary.bottleneck_summary).length > 0 ? (
                <div>
                  {Object.entries(perfSummary.bottleneck_summary)
                    .sort(([, a], [, b]) => b - a)
                    .map(([key, value], idx) => {
                      const color = CHART_COLORS[idx % CHART_COLORS.length];
                      const maxValue = Math.max(
                        ...Object.values(perfSummary.bottleneck_summary),
                      );
                      return renderBar(key, value, maxValue, color, `bottleneck-${key}`);
                    })}
                </div>
              ) : (
                <p className="text-gray-500">Nenhum dado disponivel</p>
              )}
            </Card>

            {/* PieChart (27.14) */}
            <Card className="p-6" data-testid="chart-bottleneck-pie">
              <h3 className="text-lg font-semibold mb-4">Distribuicao de Gargalos (Pizza)</h3>
              {bottleneckPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={bottleneckPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                    >
                      {bottleneckPieData.map((_entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500">Nenhum dado disponivel</p>
              )}
            </Card>
          </div>

          {/* --- Top 3 Mais Lentas (27.15) --- */}
          <Card className="p-6" data-testid="top-slowest-routes">
            <h3 className="text-lg font-semibold mb-4">Top 3 Rotas Mais Lentas</h3>
            {topSlowest.length > 0 ? (
              <div className="space-y-3">
                {topSlowest.map((item, idx) => (
                  <div
                    key={`slow-${idx}`}
                    className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-orange-600">#{idx + 1}</span>
                      <div>
                        <div className="font-semibold text-sm">{item.route}</div>
                        <Badge variant="outline" className="mt-1">
                          Gargalo: {item.bottleneck}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-700">
                        {item.avg_total_ms.toFixed(0)}ms
                      </div>
                      <div className="text-xs text-gray-500">media</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum dado disponivel</p>
            )}
          </Card>

          {/* --- Erros Recentes --- */}
          {perfSummary?.recent_errors && perfSummary.recent_errors.length > 0 && (
            <Card className="p-6" data-testid="recent-errors">
              <h3 className="text-lg font-semibold mb-4 text-red-600">Erros Recentes</h3>
              <div className="space-y-3">
                {perfSummary.recent_errors.slice(0, 5).map((error) => (
                  <div
                    key={error.id}
                    className="bg-red-50 border border-red-200 rounded p-3"
                  >
                    <div className="font-semibold text-sm">{error.route}</div>
                    <div className="text-sm text-red-700 mt-1">{error.error_message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(error.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* --- Tabela de Logs de Performance --- */}
          <Card className="p-6" data-testid="perf-logs-table">
            <h3 className="text-lg font-semibold mb-4">Logs de Performance</h3>
            <DataTable
              data={perfLogs}
              columns={perfColumns}
              isLoading={loading}
              emptyMessage="Nenhum log encontrado"
            />
          </Card>

          {/* --- Mapeamento de Rotas CRUD (27.16) --- */}
          <Card className="p-6" data-testid="route-mapping">
            <h3 className="text-lg font-semibold mb-4">Mapeamento de Rotas CRUD</h3>
            {routeMapping.length > 0 ? (
              <DataTable
                data={routeMapping}
                columns={routeMappingColumns}
                isLoading={loading}
                searchable
                searchPlaceholder="Buscar rota, sistema ou descricao..."
                emptyMessage="Nenhuma rota mapeada"
              />
            ) : (
              <p className="text-gray-500">Nenhum mapeamento disponivel</p>
            )}
          </Card>
        </TabsContent>

        {/* ============================================================= */}
        {/* Tab 2: Logs Gemini                                             */}
        {/* ============================================================= */}
        <TabsContent value="gemini" className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4" data-testid="gemini-total-calls">
              <div className="text-sm text-gray-600">Total de Chamadas</div>
              <div className="text-2xl font-bold mt-1">
                {geminiSummary?.total_calls || 0}
              </div>
            </Card>
            <Card className="p-4" data-testid="gemini-avg-latency">
              <div className="text-sm text-gray-600">Latencia Media</div>
              <div className="text-2xl font-bold mt-1">
                {geminiSummary?.stats.avg_latency_ms.toFixed(0) || 0}ms
              </div>
            </Card>
            <Card className="p-4" data-testid="gemini-success-rate">
              <div className="text-sm text-gray-600">Taxa de Sucesso</div>
              <div className="text-2xl font-bold mt-1">
                {geminiSummary?.stats.success_rate.toFixed(1) || 0}%
              </div>
            </Card>
            <Card className="p-4" data-testid="gemini-total-tokens">
              <div className="text-sm text-gray-600">Total de Tokens</div>
              <div className="text-2xl font-bold mt-1">
                {(
                  (geminiSummary?.stats.total_prompt_tokens || 0) +
                  (geminiSummary?.stats.total_response_tokens || 0)
                ).toLocaleString('pt-BR')}
              </div>
            </Card>
          </div>

          {/* Por Sistema */}
          <Card className="p-6" data-testid="gemini-by-sistema">
            <h3 className="text-lg font-semibold mb-4">Chamadas por Sistema</h3>
            {geminiSummary?.by_sistema && geminiSummary.by_sistema.length > 0 ? (
              <div>
                {geminiSummary.by_sistema
                  .sort((a, b) => b.count - a.count)
                  .map((item, idx) => {
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    const maxValue = Math.max(
                      ...geminiSummary.by_sistema.map((s) => s.count),
                    );
                    return renderBar(
                      item.sistema,
                      item.count,
                      maxValue,
                      color,
                      `sistema-${item.sistema}`,
                    );
                  })}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum dado disponivel</p>
            )}
          </Card>

          {/* Por Modelo */}
          <Card className="p-6" data-testid="gemini-by-model">
            <h3 className="text-lg font-semibold mb-4">Chamadas por Modelo</h3>
            {geminiSummary?.by_model && geminiSummary.by_model.length > 0 ? (
              <div>
                {geminiSummary.by_model
                  .sort((a, b) => b.count - a.count)
                  .map((item, idx) => {
                    const colors = [
                      '#6366f1',
                      '#14b8a6',
                      '#f97316',
                      '#ec4899',
                      '#a855f7',
                    ];
                    const color = colors[idx % colors.length];
                    const maxValue = Math.max(
                      ...geminiSummary.by_model.map((m) => m.count),
                    );
                    return renderBar(
                      item.model,
                      item.count,
                      maxValue,
                      color,
                      `model-${item.model}`,
                    );
                  })}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum dado disponivel</p>
            )}
          </Card>

          {/* Tabela de Logs Gemini */}
          <Card className="p-6" data-testid="gemini-logs-table">
            <h3 className="text-lg font-semibold mb-4">Logs de Chamadas Gemini</h3>
            <DataTable
              data={geminiLogs}
              columns={geminiColumns}
              isLoading={loading}
              emptyMessage="Nenhum log encontrado"
            />
          </Card>
        </TabsContent>

        {/* ============================================================= */}
        {/* Tab 3: Logs Avançados (27.12)                                  */}
        {/* ============================================================= */}
        <TabsContent value="advanced" className="space-y-6">
          <Card className="p-6" data-testid="advanced-logs-table">
            <h3 className="text-lg font-semibold mb-4">
              Logs Avancados de Performance
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Tabela completa com todos os campos expandidos, ordenacao e busca.
            </p>
            <DataTable
              data={perfLogs}
              columns={advancedPerfColumns}
              isLoading={loading}
              searchable
              searchPlaceholder="Buscar em todos os campos..."
              emptyMessage="Nenhum log encontrado para os filtros selecionados"
              pageSize={20}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
