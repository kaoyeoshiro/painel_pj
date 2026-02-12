import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformancePage } from '../PerformancePage';
import { adminApi } from '@/lib/api';

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getToken: vi.fn(() => null),
}));

// Mock do toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock recharts (SVG components cause issues in jsdom)
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => <div />,
  Bar: () => <div />,
  Cell: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
}));

describe('PerformancePage', () => {
  const mockPerfSummary = {
    period_hours: 24,
    total_logs: 100,
    bottleneck_summary: { LLM: 15, DB: 8, PARSE: 3, OUTRO: 2 },
    avg_times: { llm: 1200, db: 300, parse: 100, total: 1600 },
    slowest_by_bottleneck: {
      LLM: [{ route: '/api/gerar', total_ms: 5000, llm_ms: 4500 }],
      DB: [{ route: '/api/save', total_ms: 2000, db_ms: 1800 }],
      PARSE: [],
      OUTRO: [],
    },
    recent_errors: [
      {
        route: '/api/test',
        error_type: 'timeout',
        error_message: 'Timeout',
        created_at: '2024-01-01T10:00:00Z',
      },
    ],
  };

  const mockPerfLogs = {
    logs: [
      {
        id: 1,
        created_at: '2024-01-01T10:00:00Z',
        system_name: 'gerador_pecas',
        route: '/api/gerar',
        total_ms: 1500,
        llm_request_ms: 1200,
        db_total_ms: 200,
        json_parse_ms: 50,
        bottleneck: 'LLM',
        status: 'ok',
      },
      {
        id: 2,
        created_at: '2024-01-01T11:00:00Z',
        system_name: 'bert_training',
        route: '/api/train',
        total_ms: 500,
        llm_request_ms: 0,
        db_total_ms: 400,
        json_parse_ms: 10,
        bottleneck: 'DB',
        status: 'error',
        error_message_short: 'Connection failed',
      },
    ],
  };

  const mockRouteMaps = {
    mappings: [
      {
        id: 1,
        route_pattern: '/api/gerar',
        system_name: 'Gerador de Pecas',
        match_type: 'prefix',
        priority: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
  };

  const mockTopRoutes = {
    routes: [
      { route: '/api/unknown', count: 50, system_name: 'unknown', has_mapping: false },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock padrao para todas as chamadas
    (adminApi.get as any).mockImplementation((url: string) => {
      if (url.includes('/admin/api/performance/summary')) {
        return Promise.resolve(mockPerfSummary);
      }
      if (url.includes('/admin/api/performance/logs')) {
        return Promise.resolve(mockPerfLogs);
      }
      if (url.includes('/admin/api/performance/route-maps')) {
        return Promise.resolve(mockRouteMaps);
      }
      if (url.includes('/admin/api/performance/top-routes')) {
        return Promise.resolve(mockTopRoutes);
      }
      if (url.includes('/admin/api/performance/actions')) {
        return Promise.resolve({ actions: ['gerar_peca', 'classificar'] });
      }
      if (url.includes('/admin/api/performance/systems')) {
        return Promise.resolve({ systems: ['gerador_pecas', 'bert_training'] });
      }
      if (url.includes('/admin/api/gemini-logs/summary')) {
        return Promise.resolve({
          total_calls: 150,
          stats: {
            success_count: 145,
            error_count: 5,
            avg_latency_ms: 1250,
            success_rate: 96.7,
            total_prompt_tokens: 50000,
            total_response_tokens: 30000,
          },
          by_sistema: [{ sistema: 'gerador_pecas', count: 100 }],
          by_model: [{ model: 'gemini-1.5-pro', count: 120 }],
          slowest_calls: [],
          recent_errors: [],
        });
      }
      if (url.includes('/admin/api/gemini-logs/systems')) {
        return Promise.resolve({ systems: ['gerador_pecas'] });
      }
      if (url.includes('/admin/api/gemini-logs/models')) {
        return Promise.resolve({ models: ['gemini-1.5-pro'] });
      }
      if (url.includes('/admin/api/gemini-logs')) {
        return Promise.resolve({ logs: [], total: 0, limit: 100, offset: 0 });
      }
      return Promise.resolve({});
    });
  });

  it('deve renderizar a pagina e carregar dados iniciais', async () => {
    render(<PerformancePage />);

    expect(screen.getByText('Performance & Logs')).toBeInTheDocument();

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/performance/summary')
      );
      expect(adminApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/performance/logs')
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Gargalo LLM')).toBeInTheDocument();
      expect(screen.getByText('Gargalo DB')).toBeInTheDocument();
      expect(screen.getByText('Gargalo PARSE')).toBeInTheDocument();
    });
  });

  it('deve usar endpoints corretos com parametros corretos', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      // Verifica endpoint correto de route-maps (nao route-mapping)
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/route-maps');
      // Verifica endpoints de filtro dinamico
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/actions');
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/systems');
      // Verifica top-routes
      expect(adminApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/performance/top-routes')
      );
    });
  });

  it('deve exibir dados com keys uppercase de bottleneck', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      // Backend retorna keys uppercase (LLM, DB, PARSE, OUTRO)
      expect(screen.getByText('15')).toBeInTheDocument(); // LLM count
      expect(screen.getByText('8')).toBeInTheDocument(); // DB count
      expect(screen.getByText('3')).toBeInTheDocument(); // PARSE count
    });
  });

  it('deve ter as tres tabs navegaveis', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled();
    });

    expect(screen.getByText('Performance Sistema')).toBeInTheDocument();
    expect(screen.getByText('Logs Gemini API')).toBeInTheDocument();
    expect(screen.getByText('Logs Avancados')).toBeInTheDocument();
  });

  it('deve exibir filtros com dropdowns dinamicos', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      expect(screen.getByText('Gargalo LLM')).toBeInTheDocument();
    });

    expect(screen.getByText('Filtrar')).toBeInTheDocument();
  });

  it('deve exibir botao de limpeza de logs', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      expect(screen.getByText('Logs de Performance')).toBeInTheDocument();
    });

    // Botao de limpar com icone Trash2
    const limparBtn = screen.getByText('Limpar');
    expect(limparBtn).toBeInTheDocument();
  });

  it('deve alternar para tab Gemini e carregar dados', async () => {
    const user = userEvent.setup();
    render(<PerformancePage />);

    await waitFor(() => {
      expect(screen.getByText('Gargalo LLM')).toBeInTheDocument();
    });

    const geminiTab = screen.getByText('Logs Gemini API');
    await user.click(geminiTab);

    await waitFor(() => {
      expect(screen.getByText('Total Chamadas')).toBeInTheDocument();
      expect(screen.getByText('Latencia Media')).toBeInTheDocument();
      expect(screen.getByText('Taxa Sucesso')).toBeInTheDocument();
    });
  });

  it('deve exibir secao de mapeamento rota-sistema', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      expect(screen.getByText(/Mapeamento Rota/)).toBeInTheDocument();
    });

    // Botao de adicionar
    expect(screen.getByText('Adicionar')).toBeInTheDocument();
  });

  it('deve exibir botao Limpar Cache no header', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      expect(screen.getByText('Limpar Cache')).toBeInTheDocument();
    });
  });
});
