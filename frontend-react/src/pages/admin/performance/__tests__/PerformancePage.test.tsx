import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformancePage } from '../PerformancePage';
import { adminApi } from '@/lib/api';

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
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
  Pie: () => <div />,
  Cell: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

describe('PerformancePage', () => {
  const mockPerfSummary = {
    bottleneck_summary: { llm: 15, db: 8, parse: 3 },
    avg_times: { llm: 1200, db: 300, parse: 100, total: 1600 },
    recent_errors: [
      {
        id: 1,
        route: '/api/test',
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
        bottleneck: 'llm',
        status: 'success',
      },
      {
        id: 2,
        created_at: '2024-01-01T11:00:00Z',
        system_name: 'bert_training',
        route: '/api/train',
        total_ms: 500,
        bottleneck: 'db',
        status: 'error',
        error_message: 'Connection failed',
      },
    ],
  };

  const mockGeminiSummary = {
    total_calls: 150,
    stats: {
      success_count: 145,
      error_count: 5,
      avg_latency_ms: 1250,
      success_rate: 96.7,
      total_prompt_tokens: 50000,
      total_response_tokens: 30000,
    },
    by_sistema: [
      { sistema: 'gerador_pecas', count: 100 },
      { sistema: 'bert_training', count: 50 },
    ],
    by_model: [
      { model: 'gemini-1.5-pro', count: 120 },
      { model: 'gemini-1.5-flash', count: 30 },
    ],
  };

  const mockGeminiLogs = {
    logs: [
      {
        id: 1,
        created_at: '2024-01-01T10:00:00Z',
        sistema: 'gerador_pecas',
        model: 'gemini-1.5-pro',
        time_total_ms: 1300,
        success: true,
        prompt_tokens_estimated: 500,
        response_tokens: 300,
      },
      {
        id: 2,
        created_at: '2024-01-01T11:00:00Z',
        sistema: 'bert_training',
        model: 'gemini-1.5-flash',
        time_total_ms: 800,
        success: false,
        error: 'Rate limit exceeded',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock padrão para todas as chamadas
    (adminApi.get as any).mockImplementation((url: string) => {
      if (url.includes('/admin/api/performance/summary')) {
        return Promise.resolve(mockPerfSummary);
      }
      if (url.includes('/admin/api/performance/logs')) {
        return Promise.resolve(mockPerfLogs);
      }
      if (url.includes('/admin/api/gemini-logs/summary')) {
        return Promise.resolve(mockGeminiSummary);
      }
      if (url.includes('/admin/api/gemini-logs')) {
        return Promise.resolve(mockGeminiLogs);
      }
      if (url.includes('/admin/api/performance/route-mapping')) {
        return Promise.resolve({ mappings: [] });
      }
      return Promise.resolve({});
    });
  });

  it('deve renderizar a página e carregar dados iniciais', async () => {
    render(<PerformancePage />);

    // Verifica se o título está presente
    expect(screen.getByText('Performance & Logs')).toBeInTheDocument();

    // Aguarda o carregamento dos dados
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/performance/summary')
      );
      expect(adminApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/performance/logs')
      );
    });

    // Verifica se os cards de gargalo foram renderizados
    await waitFor(() => {
      expect(screen.getByText('Gargalo LLM')).toBeInTheDocument();
      expect(screen.getByText('Gargalo DB')).toBeInTheDocument();
      expect(screen.getByText('Gargalo Parse')).toBeInTheDocument();
    });
  });

  it('deve exibir dados da tab Performance Sistema corretamente', async () => {
    render(<PerformancePage />);

    // Aguarda o carregamento
    await waitFor(() => {
      expect(screen.getByText('Gargalo LLM')).toBeInTheDocument();
    });

    // Verifica se o gráfico de gargalos está presente
    expect(screen.getByText('Distribuicao de Gargalos')).toBeInTheDocument();

    // Verifica se a tabela de logs está presente
    expect(screen.getByText('Logs de Performance')).toBeInTheDocument();
  });

  it('deve alternar para a tab Logs Gemini e exibir dados', async () => {
    const user = userEvent.setup();
    render(<PerformancePage />);

    // Aguarda o carregamento inicial
    await waitFor(() => {
      expect(screen.getByText('Gargalo LLM')).toBeInTheDocument();
    });

    // Clica na tab Logs Gemini (custom button, not role="tab")
    const geminiTab = screen.getByText('Logs Gemini API');
    await user.click(geminiTab);

    // Verifica se os cards de resumo Gemini estão visíveis
    await waitFor(() => {
      expect(screen.getByText('Total Chamadas')).toBeInTheDocument();
      expect(screen.getByText('Latencia Media')).toBeInTheDocument();
      expect(screen.getByText('Taxa Sucesso')).toBeInTheDocument();
    });

    // Verifica se a tabela de logs Gemini está presente (text appears in tab + heading)
    expect(screen.getAllByText('Logs Gemini API').length).toBeGreaterThanOrEqual(2);
  });

  it('deve ter as três tabs navegáveis', async () => {
    render(<PerformancePage />);

    // Aguarda o carregamento inicial
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled();
    });

    // Verifica se as tabs estão presentes
    expect(screen.getByText('Performance Sistema')).toBeInTheDocument();
    expect(screen.getByText('Logs Gemini API')).toBeInTheDocument();
    expect(screen.getByText('Logs Avancados')).toBeInTheDocument();
  });

  it('deve exibir os filtros na tab Performance Sistema', async () => {
    render(<PerformancePage />);

    // Aguarda o carregamento
    await waitFor(() => {
      expect(screen.getByText('Gargalo LLM')).toBeInTheDocument();
    });

    // Verifica filtros
    expect(screen.getByText('Filtrar')).toBeInTheDocument();
  });

  it('deve exibir o botão Limpar antigos na tabela de logs', async () => {
    render(<PerformancePage />);

    await waitFor(() => {
      expect(screen.getByText('Logs de Performance')).toBeInTheDocument();
    });

    expect(screen.getByText('Limpar antigos')).toBeInTheDocument();
  });
});
