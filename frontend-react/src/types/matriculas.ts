// Types para o sistema Matriculas Confrontantes

export interface FileInfo {
  id: string
  name: string
  path: string
  type: 'pdf' | 'image'
  size: string
  date: string
  analyzed: boolean
}

export interface FileUploadResponse {
  success: boolean
  file?: FileInfo
  error?: string
  message?: string
}

export interface LoteConfrontante {
  descricao?: string
  identificador?: string
  direcao?: string
  tipo?: string
  matricula_anexada?: string
  proprietarios?: string[]
}

export interface AnaliseResponse {
  id: string
  matricula: string
  lote: string
  dataOperacao: string
  tipo: string
  proprietario: string
  estado: string
  confianca: number
  confrontantes: LoteConfrontante[]
  num_confrontantes: number
}

export interface MatriculaEncontrada {
  numero?: string
  lote?: string
  quadra?: string
  proprietarios?: string[]
  descricao?: string
}

export interface ResultadoAnalise {
  analise_id?: number
  matricula_principal?: string
  confidence?: number
  confrontacao_completa?: boolean | null
  matriculas_encontradas?: MatriculaEncontrada[]
  lotes_confrontantes?: LoteConfrontante[]
  proprietarios_identificados?: Record<string, string[]>
  matriculas_confrontantes?: string[]
  matriculas_nao_confrontantes?: string[]
  lotes_sem_matricula?: string[]
  reasoning?: string
  grupo_id?: number
}

export interface AnaliseStatusResponse {
  processing: boolean
  analyzed: boolean
  has_result: boolean
}

export interface BatchStatusResponse {
  id: number
  nome: string
  status: 'processando' | 'concluido' | 'erro'
  total_arquivos?: number
  arquivos?: string[]
  criado_em?: string
  has_result?: boolean
}

export interface RelatorioResponse {
  success: boolean
  report?: string
  payload?: string
  error?: string
  cached?: boolean
}

export interface ConfigResponse {
  version: string
  model: string
  hasApiKey: boolean
  has_api_key: boolean
  analysis_available: boolean
}

export interface LogEntry {
  time: string
  status: 'success' | 'info' | 'warning' | 'error'
  message: string
}

export interface FeedbackRequest {
  analise_id: number
  avaliacao: 'correto' | 'parcial' | 'incorreto' | 'erro_ia'
  comentario?: string
  campos_incorretos?: string[]
}

export interface FeedbackResponse {
  success?: boolean
  has_feedback?: boolean
  avaliacao?: string
  comentario?: string
  campos_incorretos?: string[]
  criado_em?: string
}

export interface AnaliseLoteRequest {
  file_ids: string[]
  nome_grupo?: string
  matricula_principal?: string
}
