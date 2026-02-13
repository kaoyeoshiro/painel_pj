// Hooks customizados do TanStack Query para o Portal PGE-MS
// Centraliza chamadas de API com cache, loading, error handling automáticos

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import {
  geradorApi,
  classificadorApi,
  extratorApi,
  pedidoCalculoApi,
  prestacaoContasApi,
  relatorioCumprimentoApi,
  cumprimentoBetaApi,
  assistenciaApi,
  matriculasApi,
  bertApi,
  adminApi,
  usersApi,
} from '@/lib/api'
import type { TipoPecaResponse, HistoricoItem, GeracaoDetalhe } from '@/types/gerador-pecas'

// ============================================================
// AUTH
// ============================================================
// Dados do usuario autenticado vivem EXCLUSIVAMENTE no Zustand (auth-store).
// O auth-store.loadUser() busca GET /auth/me e valida com JSON Schema.
// NAO criar hooks Query para /auth/me — ver STATE_ARCHITECTURE_RULES.md.

// ============================================================
// GERADOR DE PEÇAS HOOKS
// ============================================================

export function useTiposPeca(groupId?: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.geradorPecas.tiposPeca(groupId),
    queryFn: () => {
      const params = groupId ? `?group_id=${groupId}` : ''
      return geradorApi.get<TipoPecaResponse>(`/tipos-peca${params}`)
    },
    staleTime: 1000 * 60 * 60, // 1 hora - tipos de peça raramente mudam
    ...options,
  })
}

export function useHistoricoGerador(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.geradorPecas.historico(),
    queryFn: () => geradorApi.get<HistoricoItem[]>('/historico'),
    ...options,
  })
}

export function useGeracaoDetalhe(
  id: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.geradorPecas.historicoDetail(id),
    queryFn: () => geradorApi.get<GeracaoDetalhe>(`/historico/${id}`),
    enabled: !!id,
    ...options,
  })
}

interface GruposResponse {
  grupos: Array<{ id: number; nome: string; slug: string }>
  default_group_id: number | null
  requires_selection: boolean
}

export function useGruposDisponiveis(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.geradorPecas.grupos(),
    queryFn: () => geradorApi.get<GruposResponse>('/grupos-disponiveis'),
    staleTime: 1000 * 60 * 30, // 30 minutos
    ...options,
  })
}

interface Subcategoria {
  id: number
  nome: string
}

export function useSubcategorias(
  grupoId: number | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.geradorPecas.subcategorias(grupoId!),
    queryFn: () => geradorApi.get<Subcategoria[]>(`/grupos/${grupoId}/subcategorias`),
    enabled: !!grupoId,
    ...options,
  })
}

interface Versao {
  versao_id: number
  numero_versao: number
  linhas_adicionadas: number
  linhas_removidas: number
  descricao_alteracao: string
  created_at: string
}

export function useVersoesGeracao(
  geracaoId: number | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.geradorPecas.versoes(geracaoId!),
    queryFn: () => geradorApi.get<{ versoes: Versao[] }>(`/historico/${geracaoId}/versoes`),
    enabled: !!geracaoId,
    ...options,
  })
}

// Mutations para Gerador
export function useExcluirGeracao() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => geradorApi.delete(`/historico/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.geradorPecas.historico() })
    },
  })
}

export function useEnviarFeedback() {
  return useMutation({
    mutationFn: (data: {
      geracao_id: number
      avaliacao: 'correto' | 'parcial' | 'incorreto'
      nota: number
      comentario?: string | null
    }) => geradorApi.post('/feedback', data),
  })
}

export function useAtualizarMinuta() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { 
      id: number
      data: {
        minuta_markdown: string
        historico_chat?: Array<{ role: string; content: string }>
        descricao_alteracao?: string
      }
    }) => geradorApi.put(`/historico/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.geradorPecas.historicoDetail(variables.id) 
      })
    },
  })
}

export function useRestaurarVersao() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ geracaoId, versaoId }: { geracaoId: number; versaoId: number }) => 
      geradorApi.post<{ minuta_markdown: string }>(`/historico/${geracaoId}/versoes/${versaoId}/restaurar`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.geradorPecas.historicoDetail(variables.geracaoId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.geradorPecas.versoes(variables.geracaoId) 
      })
    },
  })
}

export function useUploadParecer() {
  return useMutation({
    mutationFn: (formData: FormData) => 
      geradorApi.post<{ upload_id: string }>('/parecer/upload', formData),
  })
}

export function useExportarDocx() {
  return useMutation({
    mutationFn: (data: {
      markdown: string
      numero_cnj?: string
      tipo_peca?: string
    }) => geradorApi.post<{ status: string; url_download?: string; filename?: string }>('/exportar-docx', data),
  })
}

// ============================================================
// CLASSIFICADOR HOOKS
// ============================================================

interface ClassificadorHistoricoItem {
  id: number
  documento: string
  categoria: string
  confianca: number
  data: string
}

export function useHistoricoClassificador(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.classificador.historico(),
    queryFn: () => classificadorApi.get<ClassificadorHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// EXTRATOR DE AUTOS HOOKS
// ============================================================

interface ExtratorHistoricoItem {
  id: number
  cnj: string
  status: string
  data: string
}

export function useHistoricoExtrator(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.extrator.historico(),
    queryFn: () => extratorApi.get<ExtratorHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// PEDIDO DE CÁLCULO HOOKS
// ============================================================

interface PedidoCalculoHistoricoItem {
  id: number
  cnj: string
  tipo: string
  status: string
  data: string
}

export function useHistoricoPedidoCalculo(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.pedidoCalculo.historico(),
    queryFn: () => pedidoCalculoApi.get<PedidoCalculoHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// PRESTAÇÃO DE CONTAS HOOKS
// ============================================================

interface PrestacaoContasHistoricoItem {
  id: number
  processo: string
  status: string
  data: string
}

export function useHistoricoPrestacaoContas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.prestacaoContas.historico(),
    queryFn: () => prestacaoContasApi.get<PrestacaoContasHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// RELATÓRIO DE CUMPRIMENTO HOOKS
// ============================================================

interface RelatorioCumprimentoHistoricoItem {
  id: number
  cnj: string
  status: string
  data: string
}

export function useHistoricoRelatorioCumprimento(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.relatorioCumprimento.historico(),
    queryFn: () => relatorioCumprimentoApi.get<RelatorioCumprimentoHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// CUMPRIMENTO BETA HOOKS
// ============================================================

interface CumprimentoBetaHistoricoItem {
  id: number
  cnj: string
  status: string
  data: string
}

export function useHistoricoCumprimentoBeta(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.cumprimentoBeta.historico(),
    queryFn: () => cumprimentoBetaApi.get<CumprimentoBetaHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// ASSISTÊNCIA HOOKS
// ============================================================

interface AssistenciaHistoricoItem {
  id: number
  processo: string
  status: string
  data: string
}

export function useHistoricoAssistencia(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.assistencia.historico(),
    queryFn: () => assistenciaApi.get<AssistenciaHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// MATRÍCULAS HOOKS
// ============================================================

interface MatriculasHistoricoItem {
  id: number
  matricula: string
  status: string
  data: string
}

export function useHistoricoMatriculas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.matriculas.historico(),
    queryFn: () => matriculasApi.get<MatriculasHistoricoItem[]>('/historico'),
    ...options,
  })
}

// ============================================================
// BERT TRAINING HOOKS
// ============================================================

interface BertStatus {
  status: string
  progress?: number
  current_epoch?: number
  total_epochs?: number
}

export function useBertStatus(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.bert.status(),
    queryFn: () => bertApi.get<BertStatus>('/status'),
    // Poll a cada 5s APENAS se o caller solicitar (ex: pagina de treinamento ativa).
    // Antes era incondicional, desperdicando bandwidth quando nao havia treinamento.
    refetchInterval: options?.refetchInterval ?? false,
    ...options,
  })
}

interface BertModelo {
  id: number
  nome: string
  accuracy: number
  created_at: string
}

export function useBertModelos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.bert.modelos(),
    queryFn: () => bertApi.get<BertModelo[]>('/modelos'),
    ...options,
  })
}

// ============================================================
// ADMIN HOOKS
// ============================================================

interface AdminStats {
  total_users: number
  total_geracoes: number
  geracoes_hoje: number
  geracoes_semana: number
}

export function useAdminStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: () => adminApi.get<AdminStats>('/admin/stats'),
    ...options,
  })
}

interface AdminUser {
  id: number
  username: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export function useAdminUsers(
  filters?: Record<string, unknown>,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.admin.users(filters),
    queryFn: () => usersApi.get<AdminUser[]>('/'),
    ...options,
  })
}

// ============================================================
// UTILITY HOOKS
// ============================================================

/**
 * Hook para invalidar queries manualmente apos operacoes que nao usam useMutation
 * (ex: SSE streaming que finaliza com resultado no servidor).
 *
 * REGRA: Sempre invalidar queries ESPECIFICAS — nunca usar invalidacao global.
 * Ver Design System/STATE_ARCHITECTURE_RULES.md para politica completa.
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient()

  return {
    invalidateGeradorHistorico: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.geradorPecas.historico() }),
    invalidateByKey: (key: readonly unknown[]) =>
      queryClient.invalidateQueries({ queryKey: key }),
  }
}
