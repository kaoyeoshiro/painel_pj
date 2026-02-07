// Tipos TypeScript para o sistema de Assistência Judiciária

/** Dados do processo retornados pelo TJ-MS */
export interface DadosProcesso {
  numeroProcesso?: string
  classeProcessual?: string
  assunto?: string
  valorCausa?: string
  dataDistribuicao?: string
  orgaoJulgador?: string
  // Pode haver outros campos retornados pelo TJ-MS
  [key: string]: unknown
}

/** Resposta da consulta de processo */
export interface ConsultaResponse {
  consulta_id: number
  dados: DadosProcesso
  relatorio: string
  cached: boolean
  consultado_em?: string
}

/** Item do histórico de consultas */
export interface HistoricoItem {
  id: number
  cnj: string
  classe: string | null
  data: string
}

/** Request para consultar processo */
export interface ConsultaRequest {
  cnj: string
  model?: string
  force?: boolean
}

/** Request para enviar feedback */
export interface FeedbackRequest {
  consulta_id: number
  avaliacao: 'correto' | 'parcial' | 'incorreto' | 'erro_ia'
  comentario?: string | null
  campos_incorretos?: string[] | null
}

/** Response de feedback */
export interface FeedbackResponse {
  has_feedback: boolean
  avaliacao?: string
  comentario?: string | null
  campos_incorretos?: string[] | null
  criado_em?: string
}

/** Request para gerar documento */
export interface DocumentRequest {
  markdown_text: string
  cnj: string
  format: 'docx' | 'pdf'
}
