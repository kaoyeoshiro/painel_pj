// Tipos TypeScript para o sistema Extrator de Autos

/** Informacoes basicas de um processo */
export interface ProcessoInfo {
  numero_cnj: string
  numero_formatado: string
  classe_processual: string
  comarca: string
  vara: string
  assunto: string
  total_documentos: number
}

/** Informacoes de um documento do processo */
export interface DocumentoInfo {
  id: string
  tipo_codigo: number
  tipo_descricao: string
  descricao: string
  data_juntada: string
  tamanho: number
}

/** Configuracao de resolucao para uma categoria */
export interface ResolverConfig {
  type: 'bert' | 'primeiro_doc' | 'codigo'
  label_match?: string
}

/** Categoria de documento configurada no sistema */
export interface CategoriaDocumento {
  id: number
  nome: string
  descricao: string
  codigos: number[]
  resolver_config?: ResolverConfig
}

/** Informacoes de resolucao especial para um documento */
export interface ResolucaoEspecial {
  metodo: 'primeiro_cronologico' | 'codigo' | 'bert'
  categoria: number
  bert_status?: string
  resolucoes_todas?: ResolucaoEspecial[]
}

/** Documento no preview com estado de selecao */
export interface PreviewDocumento {
  id: string
  tipo_codigo: number
  tipo_descricao: string
  descricao: string
  data_juntada: string
  selecionado: boolean
  resolucao_especial?: ResolucaoEspecial
}

/** Status de disponibilidade do BERT */
export interface BertStatus {
  available: boolean
  mode: string
  endpoint: string
  error?: string
}

/** Opcoes de download configuradas pelo usuario */
export interface DownloadOptions {
  formato: 'pdf_txt' | 'pdf' | 'txt' | 'xml_only'
  mesclar_pdfs: boolean
  salvar_xml: boolean
  pasta_unica: boolean
  processos_paralelos: number
  filtro_ano?: string
  filtro_mes?: number
}

/** Evento SSE durante download */
export interface DownloadSSEEvent {
  tipo: 'progresso' | 'concluido' | 'erro'
  percentual?: number
  mensagem?: string
  job_id?: string
  total_docs?: number
}

/** Item do historico de downloads */
export interface HistoricoDownload {
  id: number
  numero_cnj: string
  modo: string
  formato: string
  total_docs: number
  status: string
  criado_em: string
}

/** Resultado de consulta em lote */
export interface LoteResultados {
  total_processos: number
  consultados: number
  com_erro: number
  resultados: ProcessoInfo[]
}

/** Modo de selecao de documentos */
export type ModoSelecao = 'categoria' | 'manual' | 'hibrido'

/** Estado da maquina de estados da pagina */
export type PageState = 'idle' | 'consultando' | 'selecionando' | 'preview' | 'baixando' | 'concluido' | 'erro'
