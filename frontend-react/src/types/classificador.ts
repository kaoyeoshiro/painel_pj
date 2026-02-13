// Tipos TypeScript para o sistema Classificador de Documentos

/** Status da API de classificacao */
export interface StatusAPI {
  disponivel: boolean
  modelo_padrao: string
  modelos_disponiveis: string[]
}

/** Prompt de classificacao armazenado no sistema */
export interface Prompt {
  id: number
  nome: string
  descricao?: string
  conteudo: string
  codigos_documento?: string
  ativo: boolean
  criado_em: string
}

/** Payload para criar/atualizar um prompt */
export interface PromptPayload {
  nome: string
  descricao?: string
  conteudo: string
  codigos_documento?: string
}

/** Projeto (lote) de classificacao */
export interface Projeto {
  id: number
  nome: string
  descricao?: string
  prompt_id?: number
  modelo: string
  modo_processamento: 'chunk' | 'completo'
  posicao_chunk: 'inicio' | 'fim'
  tamanho_chunk: number
  max_concurrent: number
  criado_em: string
  atualizado_em: string
  total_codigos?: number
  total_execucoes?: number
}

/** Payload para criar/atualizar um projeto */
export interface ProjetoPayload {
  nome: string
  descricao?: string
  prompt_id?: number
  modelo: string
  modo_processamento: 'chunk' | 'completo'
  posicao_chunk: 'inicio' | 'fim'
  tamanho_chunk: number
  max_concurrent: number
}

/** Codigo de documento vinculado a um projeto */
export interface CodigoDocumento {
  id: number
  codigo: string
  numero_processo?: string
  tipo_documento?: string
  arquivo_nome?: string
  fonte: 'upload' | 'tjms'
  criado_em: string
}

/** Execucao de classificacao em lote */
export interface Execucao {
  id: number
  projeto_id: number
  status: 'pendente' | 'em_andamento' | 'concluido' | 'erro' | 'travado' | 'cancelado'
  total_arquivos: number
  arquivos_processados: number
  arquivos_sucesso: number
  arquivos_erro: number
  modelo_usado: string
  progresso_percentual?: number
  ultimo_heartbeat?: string
  esta_travada?: boolean
  pode_retomar?: boolean
  iniciado_em?: string
  finalizado_em?: string
}

/** Resultado de classificacao de um documento individual */
export interface Resultado {
  codigo_documento: string
  nome_arquivo: string
  categoria: string
  subcategoria: string
  confianca: 'alta' | 'media' | 'baixa'
  justificativa: string
  status: 'pendente' | 'processando' | 'concluido' | 'erro' | 'pulado'
  erro_mensagem?: string
  processado_em?: string
}

/** Resultado de classificacao avulsa (teste rapido) */
export interface ClassificacaoAvulsa {
  sucesso: boolean
  categoria?: string
  subcategoria?: string
  confianca?: 'alta' | 'media' | 'baixa'
  justificativa?: string
  erro?: string
}

/** Eventos SSE de execucao (discriminated union por tipo) */
export type SSEEvent =
  | { tipo: 'inicio'; execucao_id: number; mensagem: string }
  | { tipo: 'progresso'; processados: number; total: number; mensagem: string }
  | { tipo: 'concluido'; sucesso: number; erros: number; execucao_id: number; mensagem: string }
  | { tipo: 'erro'; mensagem: string }

/** Abas da pagina principal */
export type PageTab = 'novo-lote' | 'meus-lotes' | 'prompts' | 'teste-rapido'
