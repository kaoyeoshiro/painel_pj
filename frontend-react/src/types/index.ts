// Barrel export de todos os tipos do Portal PGE-MS
// Permite imports centralizados: import type { User, SSEEvent } from '@/types'

// Tipos globais da API
export type { User, LoginResponse, PaginatedResponse, ApiError } from './api'

// Modelos compartilhados
export type { Processo, Parte } from './models'

// --- Tipos por dominio ---

export type {
  TipoPeca,
  TipoPecaResponse,
  GrupoDisponivel,
  GruposResponse,
  Subgrupo,
  SubgruposResponse,
  HistoricoItem as GeradorHistoricoItem,
  GeracaoDetalhe,
  Versao,
  SSEEvent as GeradorSSEEvent,
  SSEEventInicio as GeradorSSEEventInicio,
  SSEEventChunk as GeradorSSEEventChunk,
  SSEEventSucesso as GeradorSSEEventSucesso,
  SSEEventErro as GeradorSSEEventErro,
  ModuloPreview,
  CuradoriaPreviewResponse,
  EditorChatMessage,
  FeedbackPayload as GeradorFeedbackPayload,
  ParecerUploadResponse,
  PageState as GeradorPageState,
  AgentStatus,
  AgentInfo,
} from './gerador-pecas'

export type {
  DadosProcesso as AssistenciaDadosProcesso,
  ConsultaResponse,
  HistoricoItem as AssistenciaHistoricoItem,
  ConsultaRequest,
  FeedbackRequest as AssistenciaFeedbackRequest,
  FeedbackResponse as AssistenciaFeedbackResponse,
  DocumentRequest,
} from './assistencia'

export type {
  Dataset,
  TrainingJob,
  TrainingMetrics,
  ModelInfo,
  PredictionResult,
  ComparisonResult,
  TrainingConfig,
} from './bert-training'

export type {
  StatusAPI,
  Prompt,
  PromptPayload,
  Projeto,
  ProjetoPayload,
  CodigoDocumento,
  Execucao,
  Resultado,
  ClassificacaoAvulsa,
  SSEEvent as ClassificadorSSEEvent,
  PageTab as ClassificadorPageTab,
} from './classificador'

export type {
  SessionStatus,
  RelevanceStatus,
  MessageRole,
  AccessResponse,
  CreateSessionResponse,
  SessionResponse,
  SessionListResponse,
  DocumentResponse as CumprimentoDocumentResponse,
  ProcessData,
  PieceSuggestion,
  ConsolidationResponse,
  ChatMessageResponse,
  ChatHistoryResponse,
  GeneratePieceRequest,
  GeneratedPieceResponse,
  SSEEvent as CumprimentoSSEEvent,
  ChatSSEEvent,
} from './cumprimento-beta'

export type {
  ProcessoInfo,
  DocumentoInfo,
  ResolverConfig,
  CategoriaDocumento,
  ResolucaoEspecial,
  PreviewDocumento,
  BertStatus as ExtratorBertStatus,
  DownloadOptions,
  DownloadSSEEvent,
  HistoricoDownload,
  LoteResultados,
  ModoSelecao,
  PageState as ExtratorPageState,
} from './extrator-autos'

export type {
  FileInfo,
  FileUploadResponse,
  LoteConfrontante,
  AnaliseResponse,
  MatriculaEncontrada,
  ResultadoAnalise,
  AnaliseStatusResponse,
  BatchStatusResponse,
  RelatorioResponse,
  ConfigResponse,
  LogEntry,
  FeedbackRequest as MatriculasFeedbackRequest,
  FeedbackResponse as MatriculasFeedbackResponse,
  AnaliseLoteRequest,
} from './matriculas'

export type {
  DadosBasicos,
  DadosExtracao,
  DocumentoBaixado,
  ChatMessage as PedidoCalculoChatMessage,
  HistoricoItem as PedidoCalculoHistoricoItem,
  VerificacaoExistente as PedidoCalculoVerificacaoExistente,
  StreamEvent as PedidoCalculoStreamEvent,
  ProcessarStreamRequest,
  EditarPedidoRequest,
  EditarPedidoResponse,
  ExportarDocxRequest as PedidoCalculoExportarDocxRequest,
  ExportarDocxResponse as PedidoCalculoExportarDocxResponse,
  DocumentoResponse as PedidoCalculoDocumentoResponse,
  FeedbackRequest as PedidoCalculoFeedbackRequest,
} from './pedido-calculo'

export type {
  StatusAnalise,
  TipoParecer,
  TipoAvaliacao as PrestacaoTipoAvaliacao,
  GeracaoHistorico,
  GeracaoDetalhada,
  DocumentoAnexo,
  HistoricoResponse as PrestacaoHistoricoResponse,
  VerificacaoExistente as PrestacaoVerificacaoExistente,
  EventoSSE as PrestacaoEventoSSE,
  AnalisarProcessoPayload,
  FeedbackPayload as PrestacaoFeedbackPayload,
  ExportarParecerPayload,
  EstadoPagina,
  EtapaPipeline as PrestacaoEtapaPipeline,
} from './prestacao-contas'

export type {
  StatusProcessamento,
  AvaliacaoFeedback,
  DadosProcesso as RelatorioDadosProcesso,
  DocumentoClassificado,
  InfoTransitoJulgado,
  HistoricoItem as RelatorioHistoricoItem,
  GeracaoDetalhes as RelatorioGeracaoDetalhes,
  ChatHistoricoItem,
  VerificacaoExistente as RelatorioVerificacaoExistente,
  FeedbackPayload as RelatorioFeedbackPayload,
  ExportarPayload as RelatorioExportarPayload,
  SSEEvent as RelatorioSSEEvent,
  PageState as RelatorioPageState,
  EtapaPipeline as RelatorioEtapaPipeline,
} from './relatorio-cumprimento'
