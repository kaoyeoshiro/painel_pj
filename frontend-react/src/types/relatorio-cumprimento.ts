// Tipos para o sistema Relatorio de Cumprimento de Sentenca

// Status do processamento
export type StatusProcessamento =
  | 'iniciado'
  | 'baixando_documentos'
  | 'analisando'
  | 'gerando_relatorio'
  | 'concluido'
  | 'erro'

// Avaliacao de feedback
export type AvaliacaoFeedback = 'correto' | 'parcial' | 'incorreto' | 'erro_ia'

// Dados basicos do processo
export interface DadosProcesso {
  numero_processo: string
  numero_processo_formatado: string | null
  autor: string | null
  cpf_cnpj_autor: string | null
  reu: string
  advogado_autor: string | null
  oab_advogado: string | null
  comarca: string | null
  vara: string | null
  classe_processual: string | null
  assunto: string | null
  data_ajuizamento: string | null
  valor_causa: number | null
}

// Documento classificado baixado do TJ-MS
export interface DocumentoClassificado {
  id_documento: string
  categoria: string
  nome_original: string
  nome_padronizado: string
  nome: string
  tipo_documento: string | null
  data_documento: string | null
  descricao: string | null
  processo_origem: string | null
  path_local: string | null
}

// Informacoes sobre transito em julgado
export interface InfoTransitoJulgado {
  localizado: boolean
  data_transito: string | null
  fonte: string | null
  id_documento: string | null
  observacao: string | null
}

// Item do historico de geracoes
export interface HistoricoItem {
  id: number
  numero_cumprimento: string
  numero_cumprimento_formatado: string | null
  numero_principal: string | null
  numero_principal_formatado: string | null
  dados_basicos: {
    cumprimento?: DadosProcesso
    principal?: DadosProcesso | null
  } | null
  transito_julgado_localizado: boolean
  data_transito_julgado: string | null
  conteudo_gerado: string | null
  documentos_baixados: DocumentoClassificado[] | null
  criado_em: string
  tempo_processamento: number | null
}

// Detalhes completos de uma geracao
export interface GeracaoDetalhes extends HistoricoItem {
  dados_processo_cumprimento: Record<string, unknown> | null
  dados_processo_principal: Record<string, unknown> | null
  historico_chat: ChatHistoricoItem[] | null
  modelo_usado: string | null
  temperatura_usada: string | null
  thinking_level_usado: string | null
}

// Mensagem do historico de chat de edicao
export interface ChatHistoricoItem {
  role: 'user' | 'assistant'
  content: string
}

// Verificacao de processo existente
export interface VerificacaoExistente {
  existe: boolean
  geracao_id?: number
  numero_cnj_formatado?: string
  criado_em?: string
  autor?: string | null
}

// Payload para feedback
export interface FeedbackPayload {
  geracao_id: number
  avaliacao: AvaliacaoFeedback
  nota?: number
  comentario?: string
  campos_incorretos?: string[]
}

// Resposta de feedback
export interface FeedbackResponse {
  has_feedback: boolean
  avaliacao?: AvaliacaoFeedback
  nota?: number
  comentario?: string
  campos_incorretos?: string[] | null
  criado_em?: string
}

// Payload para exportacao DOCX/PDF
export interface ExportarPayload {
  markdown: string
  numero_processo?: string
}

// Resposta da exportacao
export interface ExportarResponse {
  status: string
  url_download: string
  filename: string
}

// Payload para edicao via chat
export interface EditarPayload {
  geracao_id: number
  mensagem_usuario: string
}

// Resposta da edicao
export interface EditarResponse {
  status: string
  relatorio_markdown?: string
  mensagem?: string
}

// ============================================
// Eventos SSE do streaming
// ============================================

// Evento de inicio do processamento
export interface SSEEventInicio {
  tipo: 'inicio'
  mensagem: string
}

// Evento de mudanca de etapa
export interface SSEEventEtapa {
  tipo: 'etapa'
  etapa: number
  status: 'ativo' | 'concluido'
  mensagem: string
}

// Evento informativo
export interface SSEEventInfo {
  tipo: 'info'
  mensagem: string
}

// Evento de chunk de geracao (texto do relatorio sendo gerado)
export interface SSEEventChunk {
  tipo: 'geracao_chunk'
  content: string
}

// Evento de erro
export interface SSEEventErro {
  tipo: 'erro'
  mensagem: string
}

// Evento de sucesso final
export interface SSEEventSucesso {
  tipo: 'sucesso'
  geracao_id: number
  request_id: string
  dados_cumprimento: DadosProcesso
  dados_principal: DadosProcesso | null
  relatorio_markdown: string
  documentos_baixados: DocumentoClassificado[]
  transito_julgado: InfoTransitoJulgado
}

// Uniao de todos os eventos SSE
export type SSEEvent =
  | SSEEventInicio
  | SSEEventEtapa
  | SSEEventInfo
  | SSEEventChunk
  | SSEEventErro
  | SSEEventSucesso

// Estado da maquina de estados da pagina
export type PageState =
  | 'idle'
  | 'checking'
  | 'streaming'
  | 'completed'
  | 'editing'
  | 'error'

// Etapa do pipeline de processamento
export interface EtapaPipeline {
  numero: number
  titulo: string
  status: 'pendente' | 'ativo' | 'concluido'
  mensagem?: string
}
