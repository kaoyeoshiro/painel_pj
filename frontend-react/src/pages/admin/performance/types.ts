import type { Bot, Code, Database, CircleHelp } from 'lucide-react'

// ============================================================
// Tipos de dados retornados pela API de Performance
// ============================================================

export interface PerformanceSummary {
  period_hours: number
  total_logs: number
  bottleneck_summary: Record<string, number>
  avg_times: { llm: number; db: number; parse: number; total: number }
  slowest_by_bottleneck: Record<string, Array<{
    route: string
    action?: string
    total_ms: number
    llm_ms?: number
    db_ms?: number
    parse_ms?: number
  }>>
  recent_errors: Array<{
    route: string
    action?: string
    error_type?: string
    error_message?: string
    created_at: string
  }>
}

export interface PerformanceLog {
  id: number
  created_at: string
  system_name: string
  route: string
  method?: string
  action?: string
  total_ms: number
  llm_request_ms?: number
  db_total_ms?: number
  json_parse_ms?: number
  bottleneck: string
  status: string
  error_type?: string
  error_message_short?: string
}

export interface GeminiSummary {
  total_calls: number
  stats: {
    success_count: number
    error_count: number
    avg_latency_ms: number
    min_latency_ms?: number
    max_latency_ms?: number
    success_rate: number
    total_prompt_tokens: number
    total_response_tokens: number
    total_retries?: number
    avg_ttft_ms?: number
    avg_generation_ms?: number
    cache_hits?: number
    cache_hit_rate?: number
    with_images?: number
    with_search?: number
  }
  by_sistema: Array<{ sistema: string; count: number }>
  by_model: Array<{ model: string; count: number }>
  slowest_calls: Array<{
    id: number
    sistema: string
    time_total_ms: number
    model: string
    error?: string
  }>
  recent_errors: Array<{
    created_at: string
    sistema: string
    error?: string
    model?: string
  }>
}

export interface GeminiLog {
  id: number
  created_at: string
  sistema: string
  model: string
  time_total_ms: number
  time_ttft_ms?: number
  time_generation_ms?: number
  success: boolean
  cached: boolean
  prompt_tokens_estimated?: number
  response_tokens?: number
  error?: string
  username?: string
  has_images?: boolean
  has_search?: boolean
  retry_count?: number
}

export interface RouteMap {
  id: number
  route_pattern: string
  system_name: string
  match_type: string
  priority: number
  created_at?: string
  updated_at?: string
}

export interface TopRoute {
  route: string
  count: number
  system_name: string
  has_mapping: boolean
}

export interface RequestPerfLog {
  id: number
  created_at: string
  request_id: string
  sistema: string
  route?: string
  total_ms: number
  ttft_ms?: number
  generation_ms?: number
  agente1_ms?: number
  agente2_ms?: number
  prompt_build_ms?: number
  postprocess_ms?: number
  db_save_ms?: number
  overhead_ms?: number
  streaming_chunks?: number
  avg_chunk_interval_ms?: number
  numero_cnj?: string
  tipo_peca?: string
  modelo_llm?: string
  success: boolean
  error?: string
}

export interface RequestPerfSummary {
  total_requests: number
  success_count: number
  error_count: number
  avg_total_ms: number
  min_total_ms?: number
  max_total_ms?: number
  avg_ttft_ms?: number
  avg_generation_ms?: number
  breakdown?: {
    agente1_ms: number
    agente2_ms: number
    prompt_build_ms: number
    postprocess_ms: number
    db_save_ms: number
    overhead_ms: number
  }
  streaming?: {
    avg_chunks: number
    avg_chunk_interval_ms: number
  }
}

// ============================================================
// Tipos internos da pagina
// ============================================================

export type TabValue = 'sistema' | 'gemini' | 'avancado'

export interface BottleneckStyleEntry {
  color: string
  icon: typeof Bot | typeof Database | typeof Code | typeof CircleHelp
}

export interface MapFormData {
  route_pattern: string
  system_name: string
  match_type: string
  priority: number
}
