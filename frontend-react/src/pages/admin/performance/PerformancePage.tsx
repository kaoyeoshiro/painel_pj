import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/DataTable';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/api';
import { PageContainer } from '@/components/layout';

// Interfaces locais
interface PerformanceSummary {
  bottleneck_summary: Record<string, number>;
  avg_times: { llm: number; db: number; parse: number; total: number };
  recent_errors: Array<{ id: number; route: string; error_message: string; created_at: string }>;
}

interface PerformanceLog {
  id: number;
  created_at: string;
  system_name: string;
  route: string;
  total_ms: number;
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

export function PerformancePage() {
  const { toast } = useToast();
  const [timePeriod, setTimePeriod] = useState<string>('24');
  const [loading, setLoading] = useState(false);

  // Estado para Performance Sistema
  const [perfSummary, setPerfSummary] = useState<PerformanceSummary | null>(null);
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>([]);

  // Estado para Logs Gemini
  const [geminiSummary, setGeminiSummary] = useState<GeminiSummary | null>(null);
  const [geminiLogs, setGeminiLogs] = useState<GeminiLog[]>([]);

  // Carregar dados
  const loadData = async () => {
    setLoading(true);
    try {
      // Performance Sistema
      const summaryRes = await adminApi.get<PerformanceSummary>(`/admin/api/performance/summary?hours=${timePeriod}`);
      setPerfSummary(summaryRes);

      const logsRes = await adminApi.get<{ logs: PerformanceLog[] }>(`/admin/api/performance/logs?hours=${timePeriod}&limit=50`);
      setPerfLogs(logsRes.logs || []);

      // Logs Gemini
      const geminiSummaryRes = await adminApi.get<GeminiSummary>(`/admin/api/gemini-logs/summary?hours=${timePeriod}`);
      setGeminiSummary(geminiSummaryRes);

      const geminiLogsRes = await adminApi.get<{ logs: GeminiLog[] }>(`/admin/api/gemini-logs?hours=${timePeriod}&limit=50`);
      setGeminiLogs(geminiLogsRes.logs || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timePeriod]);

  // Função para renderizar barra colorida
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

  // Colunas para DataTable de Performance
  const perfColumns = [
    { accessor: 'system_name', header: 'Sistema' },
    { accessor: 'route', header: 'Rota' },
    {
      accessor: 'total_ms',
      header: 'Total MS',
      render: (value: unknown, log: PerformanceLog) => <span className="font-mono">{log.total_ms.toFixed(0)}ms</span>,
    },
    { accessor: 'bottleneck', header: 'Bottleneck' },
    {
      accessor: 'status',
      header: 'Status',
      render: (value: unknown, log: PerformanceLog) => (
        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
          {log.status}
        </Badge>
      ),
    },
  ];

  // Colunas para DataTable de Gemini
  const geminiColumns = [
    { accessor: 'sistema', header: 'Sistema' },
    { accessor: 'model', header: 'Modelo' },
    {
      accessor: 'time_total_ms',
      header: 'Latência',
      render: (value: unknown, log: GeminiLog) => <span className="font-mono">{log.time_total_ms.toFixed(0)}ms</span>,
    },
    {
      accessor: 'success',
      header: 'Sucesso',
      render: (value: unknown, log: GeminiLog) => (
        <Badge variant={log.success ? 'default' : 'destructive'}>
          {log.success ? 'Sim' : 'Não'}
        </Badge>
      ),
    },
    {
      accessor: 'tokens',
      header: 'Tokens',
      render: (value: unknown, log: GeminiLog) => {
        const total = (log.prompt_tokens_estimated || 0) + (log.response_tokens || 0);
        return <span className="font-mono">{total}</span>;
      },
    },
  ];

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Performance do Sistema</h1>
          <p className="text-gray-600 mt-1">Monitore o desempenho do sistema e da IA</p>
        </div>
        <div className="flex gap-3 items-center">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hora</SelectItem>
              <SelectItem value="6">6 horas</SelectItem>
              <SelectItem value="24">24 horas</SelectItem>
              <SelectItem value="72">3 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadData} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList>
          <TabsTrigger value="performance">Performance Sistema</TabsTrigger>
          <TabsTrigger value="gemini">Logs Gemini</TabsTrigger>
        </TabsList>

        {/* Tab 1: Performance Sistema */}
        <TabsContent value="performance" className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-600">LLM Médio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.llm.toFixed(0) || 0}ms
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">DB Médio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.db.toFixed(0) || 0}ms
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Parse Médio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.parse.toFixed(0) || 0}ms
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Total Médio</div>
              <div className="text-2xl font-bold mt-1">
                {perfSummary?.avg_times.total.toFixed(0) || 0}ms
              </div>
            </Card>
          </div>

          {/* Distribuição de Bottlenecks */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Distribuição de Bottlenecks</h3>
            {perfSummary?.bottleneck_summary && Object.keys(perfSummary.bottleneck_summary).length > 0 ? (
              <div>
                {Object.entries(perfSummary.bottleneck_summary)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, value], idx) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                    const color = colors[idx % colors.length];
                    const maxValue = Math.max(...Object.values(perfSummary.bottleneck_summary));
                    return renderBar(key, value, maxValue, color, `bottleneck-${key}`);
                  })}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum dado disponível</p>
            )}
          </Card>

          {/* Erros Recentes */}
          {perfSummary?.recent_errors && perfSummary.recent_errors.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-red-600">Erros Recentes</h3>
              <div className="space-y-3">
                {perfSummary.recent_errors.slice(0, 5).map((error) => (
                  <div key={error.id} className="bg-red-50 border border-red-200 rounded p-3">
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

          {/* Tabela de Logs */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Logs de Performance</h3>
            <DataTable
              data={perfLogs}
              columns={perfColumns}
              isLoading={loading}
              emptyMessage="Nenhum log encontrado"
            />
          </Card>
        </TabsContent>

        {/* Tab 2: Logs Gemini */}
        <TabsContent value="gemini" className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-600">Total de Chamadas</div>
              <div className="text-2xl font-bold mt-1">
                {geminiSummary?.total_calls || 0}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Latência Média</div>
              <div className="text-2xl font-bold mt-1">
                {geminiSummary?.stats.avg_latency_ms.toFixed(0) || 0}ms
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Taxa de Sucesso</div>
              <div className="text-2xl font-bold mt-1">
                {geminiSummary?.stats.success_rate.toFixed(1) || 0}%
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Total de Tokens</div>
              <div className="text-2xl font-bold mt-1">
                {((geminiSummary?.stats.total_prompt_tokens || 0) + (geminiSummary?.stats.total_response_tokens || 0)).toLocaleString('pt-BR')}
              </div>
            </Card>
          </div>

          {/* Por Sistema */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Chamadas por Sistema</h3>
            {geminiSummary?.by_sistema && geminiSummary.by_sistema.length > 0 ? (
              <div>
                {geminiSummary.by_sistema
                  .sort((a, b) => b.count - a.count)
                  .map((item, idx) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                    const color = colors[idx % colors.length];
                    const maxValue = Math.max(...geminiSummary.by_sistema.map(s => s.count));
                    return renderBar(item.sistema, item.count, maxValue, color, `sistema-${item.sistema}`);
                  })}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum dado disponível</p>
            )}
          </Card>

          {/* Por Modelo */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Chamadas por Modelo</h3>
            {geminiSummary?.by_model && geminiSummary.by_model.length > 0 ? (
              <div>
                {geminiSummary.by_model
                  .sort((a, b) => b.count - a.count)
                  .map((item, idx) => {
                    const colors = ['#6366f1', '#14b8a6', '#f97316', '#ec4899', '#a855f7'];
                    const color = colors[idx % colors.length];
                    const maxValue = Math.max(...geminiSummary.by_model.map(m => m.count));
                    return renderBar(item.model, item.count, maxValue, color, `model-${item.model}`);
                  })}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum dado disponível</p>
            )}
          </Card>

          {/* Tabela de Logs */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Logs de Chamadas Gemini</h3>
            <DataTable
              data={geminiLogs}
              columns={geminiColumns}
              isLoading={loading}
              emptyMessage="Nenhum log encontrado"
            />
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
