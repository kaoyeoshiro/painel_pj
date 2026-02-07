// Tipos para o sistema Cumprimento de Sentença Beta

// Status da sessão
export type SessionStatus =
  | 'iniciado'
  | 'baixando_docs'
  | 'avaliando_relevancia'
  | 'extraindo_json'
  | 'consolidando'
  | 'chatbot'
  | 'gerando_peca'
  | 'finalizado'
  | 'erro'

// Status de relevância dos documentos
export type RelevanceStatus = 'pendente' | 'relevante' | 'irrelevante' | 'ignorado'

// Role das mensagens do chat
export type MessageRole = 'user' | 'assistant' | 'system'

// Resposta de verificação de acesso
export interface AccessResponse {
  pode_acessar: boolean
  motivo?: string
}

// Resposta de criação de sessão
export interface CreateSessionResponse {
  sessao_id: number
  numero_processo: string
  numero_processo_formatado: string
  status: SessionStatus
  created_at: string
}

// Resposta detalhada da sessão
export interface SessionResponse {
  id: number
  numero_processo: string
  numero_processo_formatado: string
  status: SessionStatus
  total_documentos: number
  documentos_processados: number
  documentos_relevantes: number
  documentos_irrelevantes: number
  documentos_ignorados: number
  erro_mensagem: string | null
  created_at: string
  updated_at: string
  finalizado_em: string | null
  tem_consolidacao: boolean
  total_conversas: number
  total_pecas: number
}

// Lista de sessões
export interface SessionListResponse {
  sessoes: SessionResponse[]
  total: number
  pagina: number
  por_pagina: number
}

// Resposta de documento
export interface DocumentResponse {
  id: number
  documento_id_tjms: string
  codigo_documento: string
  descricao_documento: string | null
  data_documento: string | null
  status_relevancia: RelevanceStatus
  motivo_irrelevancia: string | null
  tem_json: boolean
}

// Dados do processo na consolidação
export interface ProcessData {
  exequente?: string
  executado?: string
  valor_execucao?: string
  objeto?: string
  status?: string
  [key: string]: unknown
}

// Sugestão de peça
export interface PieceSuggestion {
  tipo: string
  descricao: string
  prioridade: 'alta' | 'media' | 'baixa'
}

// Resposta de consolidação
export interface ConsolidationResponse {
  id: number
  sessao_id: number
  resumo_consolidado: string
  sugestoes_pecas: PieceSuggestion[]
  dados_processo: ProcessData | null
  total_jsons_consolidados: number
  modelo_usado: string
  created_at: string
}

// Mensagem do chat
export interface ChatMessageResponse {
  id: number
  role: MessageRole
  conteudo: string
  modelo_usado: string | null
  usou_busca_vetorial: boolean
  created_at: string
}

// Histórico do chat
export interface ChatHistoryResponse {
  sessao_id: number
  mensagens: ChatMessageResponse[]
  total: number
}

// Request de geração de peça
export interface GeneratePieceRequest {
  tipo_peca: string
  instrucoes_adicionais?: string
}

// Resposta de peça gerada
export interface GeneratedPieceResponse {
  id: number
  sessao_id: number
  tipo_peca: string
  titulo: string
  conteudo_markdown: string
  download_url: string | null
  modelo_usado: string
  created_at: string
}

// Eventos SSE da consolidação
export interface SSEEventInicio {
  event: 'inicio'
  data: {
    sessao_id: number
    total_jsons?: number
  }
}

export interface SSEEventChunk {
  event: 'chunk'
  data: {
    texto: string
  }
}

export interface SSEEventConcluido {
  event: 'concluido'
  data: {
    consolidacao_id: number | null
    sugestoes: PieceSuggestion[]
  }
}

export interface SSEEventErro {
  event: 'erro'
  data: {
    mensagem: string
  }
}

export type SSEEvent = SSEEventInicio | SSEEventChunk | SSEEventConcluido | SSEEventErro

// Eventos SSE do chat
export interface ChatSSEChunk {
  chunk: string
}

export interface ChatSSEDone {
  done: true
}

export type ChatSSEEvent = ChatSSEChunk | ChatSSEDone
