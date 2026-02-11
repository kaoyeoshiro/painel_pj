import '@testing-library/jest-dom'
import { vi } from 'vitest'

/**
 * Mock global do TanStack Router para testes unitários.
 * Fornece implementações mínimas de Link, useNavigate e useRouterState
 * usados por componentes de layout (PageHeader, AdminSubNav).
 *
 * Testes que precisam de comportamento específico podem sobrescrever
 * este mock com vi.mock() local (que tem precedência).
 */
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) => {
    const state = { location: { pathname: '/test' } }
    return opts?.select ? opts.select(state) : state
  },
  Link: ({ children, to, ...props }: Record<string, unknown>) => {
    const { createElement } = require('react')
    return createElement('a', { href: to, ...props }, children)
  },
}))

// useApiQuery removido (era @deprecated, nunca usado em producao)

/**
 * Mock dos hooks customizados do TanStack Query.
 * Retorna dados vazios/default para evitar chamadas de API reais.
 */
vi.mock('@/hooks/useQueries', () => ({
  useTiposPeca: vi.fn().mockReturnValue({
    data: { tipos: [], permite_auto: true },
    isLoading: false,
    isError: false,
  }),
  useHistoricoGerador: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useGruposDisponiveis: vi.fn().mockReturnValue({
    data: { grupos: [] },
    isLoading: false,
  }),
  useSubcategorias: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useVersoesGeracao: vi.fn().mockReturnValue({
    data: { versoes: [] },
    refetch: vi.fn(),
  }),
  useExcluirGeracao: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useEnviarFeedback: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUploadParecer: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useExportarDocx: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useAtualizarMinuta: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRestaurarVersao: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useInvalidateQueries: vi.fn().mockReturnValue({
    invalidateGeradorHistorico: vi.fn(),
    invalidateByKey: vi.fn(),
  }),
  useHistoricoClassificador: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useHistoricoExtrator: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useHistoricoPedidoCalculo: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useHistoricoPrestacaoContas: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useHistoricoRelatorioCumprimento: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useHistoricoCumprimentoBeta: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useHistoricoAssistencia: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useHistoricoMatriculas: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useBertStatus: vi.fn().mockReturnValue({
    data: { status: 'idle' },
    isLoading: false,
  }),
  useBertModelos: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useAdminStats: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
  }),
  useAdminUsers: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useGeracaoDetalhe: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
  }),
}))
