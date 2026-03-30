/**
 * Tipos de domínio do Sistema de Revisão de Peças.
 * Espelham os schemas Pydantic do backend (sistemas/revisao_pecas/schemas.py).
 */

// ---------------------------------------------------------------------------
// Enums e union types
// ---------------------------------------------------------------------------

export type StatusRevisao =
  | 'pendente'
  | 'em_revisao'
  | 'aprovado'
  | 'encaminhado'
  | 'rejeitado'
  | 'concluido'

export type ObsStatus =
  | 'aguardando_insercao'
  | 'inserido'
  | null

export type Confianca = 'alta' | 'media' | 'baixa'
export type Urgencia = 'rotina' | 'prazo_correndo' | 'urgente'
export type RoleMensagem = 'user' | 'assistant'
export type TipoSSEEvent = 'inicio' | 'chunk' | 'sucesso' | 'erro'

// ---------------------------------------------------------------------------
// Classificacao (resultado da IA)
// ---------------------------------------------------------------------------

export interface ClassificacaoData {
  acao_detalhada: string
  fundamentacao: string
  confianca: Confianca
  urgencia: Urgencia
  documentos_necessarios: string[]
}

// ---------------------------------------------------------------------------
// Item de revisao (entidade principal)
// ---------------------------------------------------------------------------

export interface ItemRevisao {
  id: number
  numero_cnj: string
  source_session: string | null
  categoria: string | null
  resultado: string | null
  acao_sugerida: string | null
  tipo_peca: string | null
  resumo_revisor: string | null
  classificacao_data: ClassificacaoData | null

  // Status
  status: StatusRevisao
  obs_status: ObsStatus

  // Conteúdo da peça
  conteudo_peca: string | null
  conteudo_editado: string | null

  // Metadados de revisão
  observacao_pge: string | null
  motivo_rejeicao: string | null
  acao_corrigida: string | null
  cdpendencia: string | null

  // Relacionamentos (IDs e nomes)
  usuario_revisor_id: number | null
  usuario_encaminhado_id: number | null
  revisor_nome: string | null
  encaminhado_nome: string | null

  // Timestamps
  criado_em: string
  revisado_em: string | null
  concluido_em: string | null
}

// ---------------------------------------------------------------------------
// Paginacao da lista
// ---------------------------------------------------------------------------

export interface ItemRevisaoListResponse {
  itens: ItemRevisao[]
  total: number
  pagina: number
  por_pagina: number
}

// ---------------------------------------------------------------------------
// Estatísticas do painel
// ---------------------------------------------------------------------------

export interface Estatisticas {
  total: number
  pendentes: number
  em_revisao: number
  aprovados: number
  encaminhados: number
  rejeitados: number
  concluidos: number
  aguardando_insercao: number
  concluidos_7d: number
}

// ---------------------------------------------------------------------------
// Assessor
// ---------------------------------------------------------------------------

export interface Assessor {
  id: number
  usuario_id: number
  nome: string
  ativo: boolean
  criado_em: string
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMensagem {
  id: number
  role: RoleMensagem
  conteudo: string
  conteudo_peca_snapshot: string | null
  criado_em: string
}

// ---------------------------------------------------------------------------
// Documento do TJ-MS
// ---------------------------------------------------------------------------

export interface DocumentoTJMS {
  id: string
  tipo_codigo: number | null
  tipo_descricao: string | null
  descricao: string | null
  data_juntada: string | null
  mimetype: string | null
  nivel_sigilo: number
  ordem: number
}

export interface DocumentosResponse {
  numero_cnj: string
  documentos: DocumentoTJMS[]
}

// ---------------------------------------------------------------------------
// SSE — eventos de streaming
// ---------------------------------------------------------------------------

export interface SSERevisaoEvent {
  tipo: TipoSSEEvent
  mensagem?: string
  texto?: string
  conteudo?: string
}

// ---------------------------------------------------------------------------
// Filtros de listagem
// ---------------------------------------------------------------------------

export interface FiltrosRevisao {
  tab?: string
  status?: StatusRevisao
  urgencia?: Urgencia
  tipo_peca?: string
  acao_sugerida?: string
  busca?: string
  periodo?: string
  ordenar_por?: string
  ordem?: string
  pagina?: number
  por_pagina?: number
}
