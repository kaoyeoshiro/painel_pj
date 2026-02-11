// Configuracao do TanStack Query para o Portal PGE-MS

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos — dados "frescos"
      gcTime: 1000 * 60 * 15, // 15 minutos — tempo no cache (reduzido de 30 para menor uso de memoria)
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ---------------------------------------------------------------------------
// Helpers para query keys estaveis
// ---------------------------------------------------------------------------

/**
 * Serializa filtros em string deterministica para uso em query keys.
 * Evita instabilidade de cache quando o mesmo objeto de filtros
 * e recriado em cada render (referencia diferente, conteudo igual).
 */
export function stableFilterKey(filters?: Record<string, unknown>): string | undefined {
  if (!filters) return undefined
  const sorted = Object.keys(filters).sort()
  if (sorted.length === 0) return undefined
  return sorted.map(k => `${k}:${JSON.stringify(filters[k])}`).join('|')
}

// ---------------------------------------------------------------------------
// Query keys factory — type-safe e com filtros estaveis
// ---------------------------------------------------------------------------

export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },

  // Usuarios
  users: {
    all: ['users'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.users.all, 'list', stableFilterKey(filters)] as const,
    detail: (id: number) => [...queryKeys.users.all, 'detail', id] as const,
  },

  // Gerador de Pecas
  geradorPecas: {
    all: ['gerador-pecas'] as const,
    tiposPeca: () => [...queryKeys.geradorPecas.all, 'tipos-peca'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.geradorPecas.all, 'historico', stableFilterKey(filters)] as const,
    historicoDetail: (id: number) => [...queryKeys.geradorPecas.all, 'historico', id] as const,
    grupos: () => [...queryKeys.geradorPecas.all, 'grupos'] as const,
    subcategorias: (grupoId: number) => [...queryKeys.geradorPecas.all, 'subcategorias', grupoId] as const,
    versoes: (geracaoId: number) => [...queryKeys.geradorPecas.all, 'versoes', geracaoId] as const,
  },

  // Classificador
  classificador: {
    all: ['classificador'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.classificador.all, 'historico', stableFilterKey(filters)] as const,
    prompts: () => [...queryKeys.classificador.all, 'prompts'] as const,
    projetos: () => [...queryKeys.classificador.all, 'projetos'] as const,
    execucoesEmAndamento: () => [...queryKeys.classificador.all, 'execucoes-em-andamento'] as const,
  },

  // Extrator de Autos
  extrator: {
    all: ['extrator'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.extrator.all, 'historico', stableFilterKey(filters)] as const,
    bertHealth: () => [...queryKeys.extrator.all, 'bert-health'] as const,
  },

  // Pedido de Calculo
  pedidoCalculo: {
    all: ['pedido-calculo'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.pedidoCalculo.all, 'historico', stableFilterKey(filters)] as const,
    historicoDetail: (id: number) => [...queryKeys.pedidoCalculo.all, 'historico', id] as const,
  },

  // Prestacao de Contas
  prestacaoContas: {
    all: ['prestacao-contas'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.prestacaoContas.all, 'historico', stableFilterKey(filters)] as const,
  },

  // Relatorio de Cumprimento
  relatorioCumprimento: {
    all: ['relatorio-cumprimento'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.relatorioCumprimento.all, 'historico', stableFilterKey(filters)] as const,
  },

  // Cumprimento Beta
  cumprimentoBeta: {
    all: ['cumprimento-beta'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.cumprimentoBeta.all, 'historico', stableFilterKey(filters)] as const,
    sessoes: () => [...queryKeys.cumprimentoBeta.all, 'sessoes'] as const,
  },

  // Assistencia
  assistencia: {
    all: ['assistencia'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.assistencia.all, 'historico', stableFilterKey(filters)] as const,
  },

  // Matriculas
  matriculas: {
    all: ['matriculas'] as const,
    historico: (filters?: Record<string, unknown>) => [...queryKeys.matriculas.all, 'historico', stableFilterKey(filters)] as const,
    files: () => [...queryKeys.matriculas.all, 'files'] as const,
    config: () => [...queryKeys.matriculas.all, 'config'] as const,
    logs: () => [...queryKeys.matriculas.all, 'logs'] as const,
  },

  // BERT Training
  bert: {
    all: ['bert'] as const,
    status: () => [...queryKeys.bert.all, 'status'] as const,
    modelos: () => [...queryKeys.bert.all, 'modelos'] as const,
  },

  // Admin
  admin: {
    all: ['admin'] as const,
    stats: () => [...queryKeys.admin.all, 'stats'] as const,
    users: (filters?: Record<string, unknown>) => [...queryKeys.admin.all, 'users', stableFilterKey(filters)] as const,
    pedidoCalculoGeracoes: () => [...queryKeys.admin.all, 'pedido-calculo-geracoes'] as const,
  },
} as const
