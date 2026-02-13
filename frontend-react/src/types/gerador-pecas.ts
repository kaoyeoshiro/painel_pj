// Tipos para o sistema Gerador de Pecas Juridicas

// --- Configuracao e opcoes ---

export interface TipoPeca {
  valor: string
  label: string
  descricao: string
}

export interface TipoPecaResponse {
  tipos: TipoPeca[]
  permite_auto: boolean
}

export interface GrupoDisponivel {
  id: number
  nome: string
  slug: string
}

export interface GruposResponse {
  grupos: GrupoDisponivel[]
  default_group_id: number | null
  requires_selection: boolean
}

export interface Subgrupo {
  id: number
  nome: string
  slug: string
}

export interface SubgruposResponse {
  subgrupos: Subgrupo[]
}

// --- Historico ---

export interface HistoricoItem {
  id: number
  cnj: string
  tipo_peca: string
  data: string
}

export interface GeracaoDetalhe {
  id: number
  cnj: string
  tipo_peca: string
  data: string
  minuta_markdown: string | null
  conteudo_json: unknown | null
  resumo_consolidado: string | null
  modelo_usado: string | null
  tempo_processamento: number | null
  historico_chat: EditorChatMessage[]
  has_markdown: boolean
}

// --- Versoes ---

export interface Versao {
  id: number
  numero_versao: number
  origem: string
  descricao_alteracao: string | null
  resumo_diff: string | null
  criado_em: string
}

// --- SSE Events (discriminated union) ---

export interface SSEEventInicio {
  tipo: 'inicio'
  mensagem: string
  request_id?: string
}

export interface SSEEventInfo {
  tipo: 'info'
  mensagem: string
}

export interface SSEEventAgente {
  tipo: 'agente'
  agente: number
  status: 'ativo' | 'concluido' | 'erro'
  mensagem: string
}

export interface SSEEventChunk {
  tipo: 'geracao_chunk'
  content: string
}

export interface SSEEventParecerAusente {
  tipo: 'parecer_natjus_ausente'
  mensagem: string
  codigos_documento?: string[]
}

export interface SSEEventSucesso {
  tipo: 'sucesso'
  geracao_id: number
  tipo_peca: string
  minuta_markdown: string
}

export interface SSEEventErro {
  tipo: 'erro'
  mensagem: string
}

export type SSEEvent =
  | SSEEventInicio
  | SSEEventInfo
  | SSEEventAgente
  | SSEEventChunk
  | SSEEventParecerAusente
  | SSEEventSucesso
  | SSEEventErro

// --- Curadoria ---

export interface ModuloPreview {
  id: number
  titulo: string
  categoria: string
  conteudo: string
  tag: string
}

/** Módulo disponível para adição manual (do endpoint /admin/api/prompts-modulos) */
export interface ModuloDisponivel {
  id: number
  nome: string
  titulo: string
  tipo: string
  categoria: string | null
  subcategoria: string | null
  condicao_ativacao: string | null
  conteudo: string
  modo_ativacao: string | null
  ativo: boolean
  ordem: number
  group_id: number | null
}

/** Resposta do endpoint /curadoria/buscar */
export interface BuscaModulosResponse {
  success: boolean
  query: string
  metodo: string
  total: number
  argumentos: ModuloCuradoBackend[]
}

/** Módulo como retornado pelo backend (ModuloCurado.to_dict()) */
export interface ModuloCuradoBackend {
  id: number
  nome: string
  titulo: string
  categoria: string
  subcategoria: string | null
  condicao_ativacao: string | null
  conteudo: string
  ordem: number
  origem_ativacao: string
  validado: boolean
  selecionado: boolean
  score_busca: number | null
  metodo_busca: string | null
}

/** Resposta real do endpoint /curadoria/preview */
export interface CuradoriaPreviewResponse {
  success: boolean
  modo_ativacao: string
  curadoria: {
    numero_processo: string
    tipo_peca: string
    modulos_por_secao: Record<string, ModuloCuradoBackend[]>
    resumo_consolidado: string | null
    dados_processo: Record<string, unknown> | null
    dados_extracao: Record<string, unknown> | null
    estatisticas: {
      total_modulos: number
      modulos_det: number
      modulos_llm: number
      modulos_manual: number
    }
  }
  decision_traces?: Record<string, unknown>
  variaveis_snapshot?: Record<string, unknown>
  parecer_context?: Record<string, unknown>
}

// --- Chat/Editor ---

export interface EditorChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// --- Feedback ---

export interface FeedbackPayload {
  geracao_id: number
  avaliacao: string
  nota: number | null
  comentario: string | null
}

// --- Parecer Upload ---

export interface ParecerUploadResponse {
  upload_id: string
  filename: string
  size_bytes: number
  numero_cnj: string
  tipo_peca: string | null
  message: string
}

// --- Page State ---

export type PageState =
  | 'idle'
  | 'streaming'
  | 'curadoria_preview'
  | 'curadoria_gerando'
  | 'resultado'
  | 'editando'
  | 'erro'

// --- Agent progress ---

export type AgentStatus = 'aguardando' | 'ativo' | 'concluido' | 'erro'

export interface AgentInfo {
  numero: number
  nome: string
  descricao: string
  status: AgentStatus
}
