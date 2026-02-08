import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformancePage } from '../PerformancePage';
import { adminApi } from '@/lib/api';

// Mock do adminApi
vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
  },
}));

// Mock do toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
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
      return Promise.resolve({});
    });
  });

  it('deve renderizar a página e carregar dados iniciais', async () => {
    render(<PerformancePage />);

    // Verifica se o título está presente
    expect(screen.getByText('Performance do Sistema')).toBeInTheDocument();

    // Aguarda o carregamento dos dados
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/summary?hours=24');
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/logs?hours=24&limit=50');
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/gemini-logs/summary?hours=24');
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/gemini-logs?hours=24&limit=50');
    });

    // Verifica se os cards de resumo foram renderizados
    await waitFor(() => {
      expect(screen.getByText('1200ms')).toBeInTheDocument(); // LLM médio
      expect(screen.getByText('300ms')).toBeInTheDocument(); // DB médio
      expect(screen.getByText('100ms')).toBeInTheDocument(); // Parse médio
      expect(screen.getByText('1600ms')).toBeInTheDocument(); // Total médio
    });
  });

  it('deve exibir dados da tab Performance Sistema corretamente', async () => {
    render(<PerformancePage />);

    // Aguarda o carregamento
    await waitFor(() => {
      expect(screen.getByText('1200ms')).toBeInTheDocument();
    });

    // Verifica se o gráfico de bottlenecks está presente
    expect(screen.getByText('Distribuição de Bottlenecks')).toBeInTheDocument();

    // Verifica se os erros recentes estão visíveis
    expect(screen.getByText('Erros Recentes')).toBeInTheDocument();
    expect(screen.getByText('/api/test')).toBeInTheDocument();
    expect(screen.getByText('Timeout')).toBeInTheDocument();

    // Verifica se a tabela de logs está presente
    expect(screen.getByText('Logs de Performance')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('gerador_pecas')).toBeInTheDocument();
      expect(screen.getByText('/api/gerar')).toBeInTheDocument();
    });
  });

  it('deve alternar para a tab Logs Gemini e exibir dados', async () => {
    const user = userEvent.setup();
    render(<PerformancePage />);

    // Aguarda o carregamento inicial
    await waitFor(() => {
      expect(screen.getByText('1200ms')).toBeInTheDocument();
    });

    // Clica na tab Logs Gemini
    const geminiTab = screen.getByRole('tab', { name: /logs gemini/i });
    await user.click(geminiTab);

    // Verifica se os cards de resumo Gemini estão visíveis
    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument(); // Total de chamadas
      expect(screen.getByText('1250ms')).toBeInTheDocument(); // Latência média
      expect(screen.getByText('96.7%')).toBeInTheDocument(); // Taxa de sucesso
    });

    // Verifica se as distribuições estão presentes
    expect(screen.getByText('Chamadas por Sistema')).toBeInTheDocument();
    expect(screen.getByText('Chamadas por Modelo')).toBeInTheDocument();

    // Verifica se a tabela de logs Gemini está presente
    expect(screen.getByText('Logs de Chamadas Gemini')).toBeInTheDocument();
    await waitFor(() => {
      // Usa getAllByText porque o texto aparece na tabela e no gráfico
      const modelElements = screen.getAllByText('gemini-1.5-pro');
      expect(modelElements.length).toBeGreaterThan(0);
    });
  });

  it('deve ter seletor de período de tempo', async () => {
    render(<PerformancePage />);

    // Aguarda o carregamento inicial
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/summary?hours=24');
    });

    // Verifica se o seletor está presente com o valor padrão
    expect(screen.getByText('24 horas')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('deve clicar no botão Atualizar e recarregar dados', async () => {
    const user = userEvent.setup();
    render(<PerformancePage />);

    // Aguarda o carregamento inicial
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalled();
    });

    // Limpa os mocks
    vi.clearAllMocks();

    // Clica no botão Atualizar
    const updateButton = screen.getByRole('button', { name: /atualizar/i });
    await user.click(updateButton);

    // Verifica se os dados foram recarregados
    await waitFor(() => {
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/summary?hours=24');
      expect(adminApi.get).toHaveBeenCalledWith('/admin/api/performance/logs?hours=24&limit=50');
    });
  });

  it('deve exibir mensagem quando não houver dados de bottleneck', async () => {
    // Mock com bottleneck vazio
    (adminApi.get as any).mockImplementation((url: string) => {
      if (url.includes('/admin/api/performance/summary')) {
        return Promise.resolve({
          bottleneck_summary: {},
          avg_times: { llm: 0, db: 0, parse: 0, total: 0 },
          recent_errors: [],
        });
      }
      if (url.includes('/admin/api/performance/logs')) {
        return Promise.resolve({ logs: [] });
      }
      if (url.includes('/admin/api/gemini-logs/summary')) {
        return Promise.resolve(mockGeminiSummary);
      }
      if (url.includes('/admin/api/gemini-logs')) {
        return Promise.resolve({ logs: [] });
      }
      return Promise.resolve({});
    });

    render(<PerformancePage />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum dado disponível')).toBeInTheDocument();
    });
  });
});
