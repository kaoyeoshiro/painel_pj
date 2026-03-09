/** Tipos compartilhados para o dashboard de feedbacks. */

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface EvolucaoSemana {
  semana: string
  total: number
  feedbacks: number
  taxa: number | null
  corretos?: number
  taxa_acerto?: number | null
  satisfacao?: number | null
}

export interface AvaliacaoContagem {
  correto: number
  parcial: number
  incorreto: number
  erro_ia: number
}

export interface SistemaStats {
  total: number
  feedbacks: number
}

export interface UserFeedbackSummary {
  nome: string
  total: number
  corretos: number
}

export interface PendingItem {
  id: number
  sistema: string
  identificador: string
  usuario: string
  data: string
  modo_ativacao?: string | null
}

export interface GrupoOption {
  slug: string
  name: string
}

export interface DashboardData {
  total_consultas: number
  total_feedbacks: number
  taxa_acerto: number
  media_estrelas: number
  distribuicao_estrelas: Record<string, number>
  consultas_sem_feedback: number
  avaliacoes: AvaliacaoContagem
  feedbacks_por_usuario: UserFeedbackSummary[]
  pendentes_feedback: PendingItem[]
  por_sistema: Record<string, SistemaStats>
  evolucao_por_sistema: Record<string, EvolucaoSemana[]>
  grupos_disponiveis: GrupoOption[]
  filtro_aplicado: {
    mes: number | null
    ano: number | null
    sistema: string | null
    grupo: string | null
  }
}

// ---------------------------------------------------------------------------
// Lista de feedbacks (paginada)
// ---------------------------------------------------------------------------

export interface ModoAtivacao {
  modo: 'semi_automatico' | 'automatico' | 'fast_path' | 'misto' | 'llm'
  total_preview?: number
  total_curados?: number
  total_manuais?: number
  total_excluidos?: number
  categorias_ordem?: string[]
  modulos_det?: number
  modulos_llm?: number
}

export interface FeedbackItem {
  id: number
  consulta_id: number
  sistema: string
  identificador: string
  cnj: string | null
  modelo: string
  usuario: string
  username: string
  avaliacao: string
  nota: number
  comentario: string | null
  campos_incorretos: string | null
  criado_em: string
  modo_ativacao: ModoAtivacao | null
}

export interface FeedbackListResponse {
  total: number
  page: number
  per_page: number
  total_pages: number
  feedbacks: FeedbackItem[]
}

// ---------------------------------------------------------------------------
// Consulta / Relatorio completo
// ---------------------------------------------------------------------------

export interface FeedbackInfo {
  avaliacao: string | null
  comentario: string | null
  campos_incorretos: string | null
  criado_em: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Versao {
  id: number
  numero_versao: number
  origem: string
  descricao_alteracao: string
  conteudo: string
  criado_em: string
}

export interface ConsultaReport {
  id: number
  sistema: string
  identificador: string
  cnj: string | null
  tipo_peca?: string
  dados: Record<string, unknown> | null
  relatorio: string
  modelo: string
  usuario: string
  criado_em: string
  consultado_em?: string
  analisado_em?: string
  historico_chat?: ChatMessage[]
  edicoes_chat?: ChatMessage[]
  total_edicoes_chat?: number
  modo_ativacao?: ModoAtivacao | null
  versoes?: Versao[]
  total_versoes?: number
  feedback: FeedbackInfo | null
}

// ---------------------------------------------------------------------------
// Modelos IA
// ---------------------------------------------------------------------------

export interface AIModelConfig {
  id: number | null
  modelo: string
  descricao: string
  modelo_analise?: string
  modelo_relatorio?: string
}

export type AIModelsMap = Record<string, AIModelConfig>

// ---------------------------------------------------------------------------
// Auditoria de Curadoria
// ---------------------------------------------------------------------------

export interface CuradoriaModulo {
  id: number
  titulo: string
  categoria: string
  subcategoria: string | null
  conteudo: string
  modo_ativacao_modulo: string
  origem: string
  tag: string
  tipo_decisao: string
  decisao_explicacao: string
  motivo_inclusao?: string
  motivo_exclusao?: string
  decision_trace: Record<string, unknown> | null
  ordem?: number
  status_final: string
}

export interface CuradoriaAuditData {
  geracao_id: number
  modo: string
  metadata: {
    total_preview: number
    total_incluidos: number
    total_confirmados: number
    total_manuais: number
    total_excluidos: number
    preview_timestamp: string | null
    categorias_ordem: string[]
  }
  glossario: Record<string, string>
  explicacao_processo: {
    titulo: string
    etapas: string[]
    garantia: string
  }
  modulos_incluidos: CuradoriaModulo[]
  modulos_excluidos: CuradoriaModulo[]
  variaveis_snapshot: Record<string, unknown> | null
}
