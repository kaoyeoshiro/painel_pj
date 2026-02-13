// Tipos para o sistema Prestacao de Contas

// =====================================================
// MODELOS PRINCIPAIS
// =====================================================

/** Status possíveis de uma análise */
export type StatusAnalise =
  | 'processando'
  | 'concluida'
  | 'erro'
  | 'aguardando_documentos'
  | 'aguardando_nota_fiscal'
  | 'documentos_recebidos'
  | 'expirado_com_documentos'
  | 'continuando_sem_nota_fiscal'
  | 'reprocessando'

/** Tipo do parecer emitido pela IA */
export type TipoParecer = 'favoravel' | 'desfavoravel' | 'duvida'

/** Tipo de avaliacao no feedback */
export type TipoAvaliacao = 'correto' | 'parcial' | 'incorreto' | 'erro_ia'

/** Item do historico de analises */
export interface GeracaoHistorico {
  id: number
  numero_cnj: string
  numero_cnj_formatado?: string
  status: string
  parecer?: string
  fundamentacao?: string
  irregularidades?: string[]
  perguntas_usuario?: string[]
  valor_bloqueado?: number
  valor_utilizado?: number
  valor_devolvido?: number
  medicamento_pedido?: string
  medicamento_comprado?: string
  modelo_usado?: string
  tempo_processamento_ms?: number
  erro?: string
  criado_em: string

  // Campos para retomada de analise
  documentos_faltantes?: string[]
  mensagem_erro_usuario?: string
  estado_expira_em?: string
  estado_expirado?: boolean
  permite_anexar?: boolean
}

/** Detalhes completos de uma analise */
export interface GeracaoDetalhada extends GeracaoHistorico {
  extrato_subconta_texto?: string
  extrato_subconta_pdf_base64?: string
  peticao_inicial_id?: string
  peticao_inicial_texto?: string
  peticao_prestacao_id?: string
  peticao_prestacao_texto?: string
  documentos_anexos?: DocumentoAnexo[]
  peticoes_relevantes?: Record<string, unknown>[]
  dados_processo_xml?: Record<string, unknown>
  prompt_identificacao?: string
  prompt_analise?: string
  resposta_ia_bruta?: string
  respostas_usuario?: Record<string, string>
}

/** Documento anexo a analise */
export interface DocumentoAnexo {
  id: string
  tipo?: string
  codigo_tipo?: string
  data?: string
  texto?: string
  imagens?: string[]
}

/** Resposta do endpoint de historico */
export interface HistoricoResponse {
  total: number
  geracoes: GeracaoHistorico[]
}

/** Verificacao se processo ja existe */
export interface VerificacaoExistente {
  existe: boolean
  geracao_id?: number
  numero_cnj_formatado?: string
  criado_em?: string
  parecer?: string
  status?: string
  erro?: string
}

// =====================================================
// EVENTOS SSE (Server-Sent Events)
// =====================================================

/** Tipos possiveis de evento SSE */
export type TipoEventoSSE =
  | 'inicio'
  | 'etapa'
  | 'progresso'
  | 'info'
  | 'aviso'
  | 'erro'
  | 'sucesso'
  | 'resultado'
  | 'fim'
  | 'solicitar_documentos'

/** Evento recebido via SSE durante o processamento */
export interface EventoSSE {
  tipo: TipoEventoSSE
  etapa?: number
  etapa_nome?: string
  mensagem?: string
  dados?: Record<string, unknown>
  progresso?: number
}

// =====================================================
// REQUESTS
// =====================================================

/** Payload para iniciar analise */
export interface AnalisarProcessoPayload {
  numero_cnj: string
  sobrescrever_existente?: boolean
}

/** Payload para responder duvidas da IA */
export interface ResponderDuvidaPayload {
  geracao_id: number
  respostas: Record<string, string>
}

/** Payload para feedback */
export interface FeedbackPayload {
  geracao_id: number
  avaliacao: TipoAvaliacao
  nota?: number
  comentario?: string
  parecer_correto?: boolean
  valores_corretos?: boolean
  medicamento_correto?: boolean
}

/** Payload para exportar parecer */
export interface ExportarParecerPayload {
  geracao_id: number
}

/** Payload para cancelar por falta de documentos */
export interface CancelarPorFaltaPayload {
  geracao_id: number
  motivo: string
}

/** Payload para continuar sem nota fiscal */
export interface ContinuarSemNotaFiscalPayload {
  geracao_id: number
}

/** Payload para reprocessar com documentos */
export interface ReprocessarComDocumentosPayload {
  geracao_id: number
}

// =====================================================
// RESPONSES
// =====================================================

/** Resposta generica de sucesso */
export interface RespostaSucesso {
  sucesso: boolean
  mensagem: string
}

/** Resposta do feedback */
export interface FeedbackResponse {
  sucesso: boolean
  mensagem: string
  feedback_id?: number
}

/** Resposta ao responder duvidas */
export interface ResponderDuvidaResponse {
  sucesso: boolean
  parecer?: string
  fundamentacao?: string
  irregularidades?: string[]
  perguntas?: string[]
}

/** Resposta do upload de documentos */
export interface UploadDocumentosResponse {
  sucesso: boolean
  mensagem: string
  arquivos_processados: string[]
  reprocessando: boolean
  estado_expirado: boolean
  numero_cnj: string
}

// =====================================================
// ESTADO DA PAGINA
// =====================================================

/** Etapas do pipeline de processamento */
export interface EtapaPipeline {
  numero: number
  nome: string
  descricao: string
  icone: string
  status: 'aguardando' | 'ativo' | 'concluido' | 'erro'
}

/** Estados possiveis da maquina de estados da pagina */
export type EstadoPagina =
  | 'idle'
  | 'verificando'
  | 'processando'
  | 'aguardando_documentos'
  | 'resultado'
  | 'duvidas'
  | 'erro'
