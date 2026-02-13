// Tipos para o sistema Pedido de Cálculo

export interface DadosBasicos {
  numero_processo?: string
  autor?: string
  cpf_autor?: string
  reu?: string
  comarca?: string
  vara?: string
  data_ajuizamento?: string
  [key: string]: unknown
}

export interface DadosExtracao {
  objeto_condenacao?: string
  valor_solicitado_parte?: string
  criterios_calculo?: string[]
  periodo_condenacao?: {
    inicio?: string
    fim?: string
  }
  correcao_monetaria?: {
    indice?: string
    termo_inicial?: string
    termo_final?: string
    observacao?: string
  }
  juros_moratorios?: {
    taxa?: string
    termo_inicial?: string
    termo_final?: string
    observacao?: string
  }
  datas?: {
    citacao_recebimento?: string
    transito_julgado?: string
    intimacao_impugnacao_recebimento?: string
  }
  calculo_exequente?: {
    valor_total?: string
    data_base?: string
  }
  [key: string]: unknown
}

export interface DocumentoBaixado {
  id: string
  tipo?: string
  descricao?: string
  processo?: 'principal' | 'origem'
  numero_processo?: string
  classificacao_ia?: string
  confianca_ia?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface HistoricoItem {
  id: number
  numero_cnj?: string
  numero_cnj_formatado?: string
  dados_processo?: DadosBasicos
  dados_agente1?: { dados_basicos?: DadosBasicos }
  dados_agente2?: DadosExtracao
  conteudo_gerado?: string
  pedido_markdown?: string
  documentos_baixados?: DocumentoBaixado[]
  historico_chat?: ChatMessage[]
  criado_em?: string
  tempo_processamento?: number
}

export interface VerificacaoExistente {
  existe: boolean
  geracao_id?: number
  numero_cnj_formatado?: string
  autor?: string
  criado_em?: string
}

// Eventos de streaming SSE
export type StreamEventTipo =
  | 'inicio'
  | 'agente'
  | 'info'
  | 'geracao_chunk'
  | 'sucesso'
  | 'erro'

export interface StreamEventBase {
  tipo: StreamEventTipo
}

export interface StreamEventInicio extends StreamEventBase {
  tipo: 'inicio'
  mensagem: string
}

export interface StreamEventAgente extends StreamEventBase {
  tipo: 'agente'
  agente: number
  status: 'ativo' | 'concluido' | 'erro'
  mensagem: string
}

export interface StreamEventInfo extends StreamEventBase {
  tipo: 'info'
  mensagem: string
}

export interface StreamEventChunk extends StreamEventBase {
  tipo: 'geracao_chunk'
  content: string
}

export interface StreamEventSucesso extends StreamEventBase {
  tipo: 'sucesso'
  geracao_id: number
  pedido_markdown?: string
  dados_basicos?: DadosBasicos
  dados_extracao?: DadosExtracao
  documentos_baixados?: DocumentoBaixado[]
}

export interface StreamEventErro extends StreamEventBase {
  tipo: 'erro'
  mensagem: string
}

export type StreamEvent =
  | StreamEventInicio
  | StreamEventAgente
  | StreamEventInfo
  | StreamEventChunk
  | StreamEventSucesso
  | StreamEventErro

// Request/Response types
export interface ProcessarStreamRequest {
  numero_cnj: string
  sobrescrever_existente?: boolean
}

export interface EditarPedidoRequest {
  pedido_markdown: string
  mensagem_usuario: string
  historico_chat?: ChatMessage[]
  dados_basicos?: DadosBasicos
  dados_extracao?: DadosExtracao
}

export interface EditarPedidoResponse {
  status: 'sucesso' | 'erro'
  pedido_markdown?: string
  mensagem?: string
}

export interface ExportarDocxRequest {
  markdown: string
  numero_processo?: string
}

export interface ExportarDocxResponse {
  status: 'sucesso' | 'erro'
  url_download?: string
  filename?: string
  mensagem?: string
}

export interface DocumentoResponse {
  id: string
  conteudo_base64: string
  tipo: string
}

export interface FeedbackRequest {
  geracao_id: number
  avaliacao: 'correto' | 'parcial' | 'incorreto' | 'erro_ia'
  nota?: number
  comentario?: string
  campos_incorretos?: string[]
}
