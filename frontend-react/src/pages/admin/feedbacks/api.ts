/** Chamadas API centralizadas para o dashboard de feedbacks. */

import { adminApi } from '@/lib/api'
import type {
  DashboardData,
  FeedbackListResponse,
  ConsultaReport,
  AIModelsMap,
  CuradoriaAuditData,
} from './types'

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

interface DashboardParams {
  mes?: string
  ano?: string
  sistema?: string
  semanas_evolucao?: string
}

export async function fetchDashboard(params: DashboardParams): Promise<DashboardData> {
  const qs = new URLSearchParams()
  if (params.mes) qs.append('mes', params.mes)
  if (params.ano) qs.append('ano', params.ano)
  if (params.sistema) qs.append('sistema', params.sistema)
  if (params.semanas_evolucao) qs.append('semanas_evolucao', params.semanas_evolucao)

  return adminApi.get<DashboardData>(`/admin/api/feedbacks/dashboard?${qs.toString()}`)
}

// ---------------------------------------------------------------------------
// Lista paginada
// ---------------------------------------------------------------------------

interface FeedbackListParams {
  page?: number
  per_page?: number
  avaliacao?: string
  sistema?: string
  mes?: string
  ano?: string
}

export async function fetchFeedbackList(params: FeedbackListParams): Promise<FeedbackListResponse> {
  const qs = new URLSearchParams()
  qs.append('page', String(params.page ?? 1))
  qs.append('per_page', String(params.per_page ?? 20))
  if (params.avaliacao) qs.append('avaliacao', params.avaliacao)
  if (params.sistema) qs.append('sistema', params.sistema)
  if (params.mes) qs.append('mes', params.mes)
  if (params.ano) qs.append('ano', params.ano)

  return adminApi.get<FeedbackListResponse>(`/admin/api/feedbacks/lista?${qs.toString()}`)
}

// ---------------------------------------------------------------------------
// Consulta / Relatório completo
// ---------------------------------------------------------------------------

export async function fetchConsultaReport(consultaId: number, sistema: string): Promise<ConsultaReport> {
  return adminApi.get<ConsultaReport>(
    `/admin/api/feedbacks/consulta/${consultaId}?sistema=${encodeURIComponent(sistema)}`
  )
}

// ---------------------------------------------------------------------------
// Modelos IA
// ---------------------------------------------------------------------------

export async function fetchAIModels(): Promise<AIModelsMap> {
  return adminApi.get<AIModelsMap>('/admin/modelos-ia')
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------

export async function exportFeedbacks(): Promise<Blob> {
  return adminApi.blob('/admin/api/feedbacks/exportar')
}

// ---------------------------------------------------------------------------
// Auditoria de Curadoria
// ---------------------------------------------------------------------------

export async function fetchCuradoriaAudit(geracaoId: number): Promise<CuradoriaAuditData> {
  return adminApi.get<CuradoriaAuditData>(
    `/api/gerador-pecas/admin/geracoes/${geracaoId}/curadoria`
  )
}
