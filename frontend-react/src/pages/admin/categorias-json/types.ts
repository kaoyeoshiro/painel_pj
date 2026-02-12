/**
 * Tipos para o modulo de Categorias JSON.
 * Espelham os schemas Pydantic do backend (router_categorias_json.py).
 */

/** Resposta completa do GET /categorias-resumo-json e GET /{id} */
export interface CategoriaJSON {
  id: number
  nome: string
  titulo: string
  descricao: string | null
  codigos_documento: number[]
  formato_json: string
  instrucoes_extracao: string | null
  is_residual: boolean
  ativo: boolean
  ordem: number
  // Fonte de documentos
  source_type: 'code' | 'special'
  source_special_type: string | null
  usa_fonte_especial: boolean
  // Origem do JSON
  json_gerado_por_ia: boolean
  json_gerado_em: string | null
  // Auditoria
  criado_em: string
  atualizado_em: string | null
}

/** Payload para POST /categorias-resumo-json */
export interface CategoriaCreatePayload {
  nome: string
  titulo: string
  descricao: string | null
  codigos_documento: number[]
  formato_json: string
  instrucoes_extracao: string | null
  is_residual: boolean
  ativo: boolean
  source_type: 'code' | 'special'
  source_special_type: string | null
}

/** Payload para PUT /categorias-resumo-json/{id} */
export interface CategoriaUpdatePayload {
  titulo?: string
  descricao?: string | null
  codigos_documento?: number[]
  formato_json?: string
  instrucoes_extracao?: string | null
  is_residual?: boolean
  ativo?: boolean
  source_type?: 'code' | 'special'
  source_special_type?: string | null
  motivo: string
}

/** Item retornado por GET /codigos-disponiveis */
export interface CodigoDisponivel {
  codigo: number
  descricao: string
  categoria: {
    categoria_id: number
    categoria_nome: string
    categoria_titulo: string
  } | null
}

/** Item retornado por GET /fontes-especiais */
export interface FonteEspecial {
  key: string
  nome: string
  descricao: string
}

/** Estado interno do formulario de criacao/edicao */
export interface CategoriaFormData {
  nome: string
  titulo: string
  descricao: string
  codigos_documento: number[]
  formato_json: string
  instrucoes_extracao: string
  is_residual: boolean
  ativo: boolean
  source_type: 'code' | 'special'
  source_special_type: string
  motivo: string
}

/** Resposta do endpoint GET/PUT /config/codigos-ignorados */
export interface CodigosIgnoradosResponse {
  codigos: number[]
  descricao?: string
}

// ============================================================================
// TIPOS PARA PERGUNTAS DE EXTRACAO (router_extraction.py)
// ============================================================================

/** Tipos de dado sugeridos para uma pergunta */
export type TipoSugerido = 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'choice' | 'list' | ''

/** Operadores de dependencia condicional */
export type DependencyOperator = 'equals' | 'not_equals' | 'exists' | 'not_exists' | 'contains' | 'greater_than' | 'less_than'

/** Resposta do GET /extraction/categorias/{id}/perguntas */
export interface ExtractionQuestion {
  id: number
  categoria_id: number
  categoria_nome: string | null
  pergunta: string
  nome_variavel_sugerido: string | null
  tipo_sugerido: string | null
  opcoes_sugeridas: string[] | null
  descricao: string | null
  // Dependencias condicionais
  depends_on_variable: string | null
  dependency_operator: string | null
  dependency_value: unknown
  dependency_inferred: boolean
  ativo: boolean
  ordem: number
  criado_por: number | null
  criado_em: string
  atualizado_em: string
}

/** Payload para POST /extraction/perguntas */
export interface ExtractionQuestionCreate {
  categoria_id: number
  pergunta: string
  nome_variavel_sugerido?: string | null
  tipo_sugerido?: string | null
  opcoes_sugeridas?: string[] | null
  descricao?: string | null
  depends_on_variable?: string | null
  dependency_operator?: string | null
  dependency_value?: unknown
  dependency_inferred?: boolean
  ativo?: boolean
  ordem?: number
}

/** Payload para PUT /extraction/perguntas/{id} */
export interface ExtractionQuestionUpdate {
  pergunta?: string
  nome_variavel_sugerido?: string | null
  tipo_sugerido?: string | null
  opcoes_sugeridas?: string[] | null
  descricao?: string | null
  depends_on_variable?: string | null
  dependency_operator?: string | null
  dependency_value?: unknown
  dependency_inferred?: boolean
  ativo?: boolean
  ordem?: number
}

/** Estado local de uma pergunta (inclui perguntas nao salvas) */
export interface PerguntaLocal {
  id?: number
  pergunta: string
  nome_variavel_sugerido: string | null
  tipo_sugerido: string | null
  opcoes_sugeridas: string[] | null
  depends_on_variable: string | null
  dependency_operator: string | null
  dependency_value: unknown
  dependency_inferred: boolean
  ativo: boolean
  ordem: number
}

/** Payload para POST /extraction/perguntas/lote */
export interface BulkQuestionsCreate {
  categoria_id: number
  perguntas: { pergunta: string; nome_variavel_sugerido?: string | null; tipo_sugerido?: string | null; opcoes_sugeridas?: string[] | null }[]
  analisar_dependencias: boolean
}

/** Resposta do POST /extraction/perguntas/lote */
export interface BulkQuestionsResponse {
  success: boolean
  total_enviadas: number
  total_criadas: number
  total_com_dependencias: number
  perguntas: {
    index: number
    pergunta_texto: string
    id: number | null
    slug_sugerido: string | null
    depends_on_variable: string | null
    dependency_operator: string | null
    dependency_value: unknown
    erro: string | null
  }[]
  grafo_dependencias: Record<string, unknown> | null
  erro: string | null
}

/** Resposta do POST /extraction/categorias/{id}/gerar-schema */
export interface GenerateSchemaResponse {
  success: boolean
  schema_json: Record<string, unknown> | null
  mapeamento_variaveis: Record<string, unknown> | null
  variaveis_criadas: { slug: string; tipo: string }[] | null
  erro: string | null
}

/** Resposta do POST /extraction/categorias/{id}/sincronizar-json */
export interface SyncJsonResponse {
  success: boolean
  schema_json: Record<string, unknown> | null
  variaveis_adicionadas: number
  variaveis_adicionadas_lista: string[] | null
  variaveis_modificadas: number
  variaveis_removidas: number
  houve_alteracao: boolean
  mensagem: string | null
  erro: string | null
  perguntas_incompletas: { pergunta: string; problema: string }[] | null
}

/** Resposta do GET /extraction/categorias/{id}/verificar-consistencia */
export interface ConsistenciaResponse {
  consistente: boolean
  total_campos_json: number
  total_perguntas_ativas: number
  variaveis_sem_pergunta: { slug: string; tipo: string | null; descricao: string | null }[]
  perguntas_sem_variavel_json: Record<string, unknown>[]
  mensagem: string
}

/** Resposta do POST /extraction/categorias/{id}/aplicar-json */
export interface AplicarJsonResponse {
  success: boolean
  perguntas_criadas: number
  perguntas_atualizadas: number
  perguntas_removidas: number
  variaveis_criadas: number
  variaveis_atualizadas: number
  variaveis_removidas: number
  criadas: string[]
  atualizadas: string[]
  removidas: string[]
  mensagem: string | null
  erro: string | null
  erros_validacao: { slug: string; erro: string; sugestao?: string }[] | null
  tempo_ms: number | null
  requer_confirmacao: boolean
  variaveis_em_uso_condicoes: { slug: string; label: string; prompts: Record<string, unknown>[] }[]
}

/** Resposta do POST /extraction/perguntas/ordenar-ia */
export interface OrdenarIAResponse {
  success: boolean
  ordem: { pergunta: string; motivo: string }[]
  erro: string | null
}

/** Resposta do POST /extraction/perguntas/agrupar-por-dependencias */
export interface AgruparDependenciasResponse {
  success: boolean
  message: string
  atualizadas: number
  nova_ordem: { id: number; ordem: number }[]
  ciclos_detectados: string[]
}

/** Resposta do POST /extraction/dependencias/inferir */
export interface InferirDependenciasResponse {
  success: boolean
  dependencias_inferidas: {
    pergunta_id: number
    depends_on_variable: string
    operator: string
    value: unknown
  }[]
  erro: string | null
}

/** Resposta do POST /extraction/dependencias/aplicar */
export interface AplicarDependenciasResponse {
  success: boolean
  aplicadas: number
  erro: string | null
}

/** Resposta do POST /extraction/categorias/{id}/sincronizar-perguntas-json */
export interface SincronizarPerguntasJsonResponse {
  success: boolean
  perguntas_criadas: number
  perguntas_reativadas: number
  variaveis_criadas: number
  variaveis_reativadas: number
  detalhes: Record<string, unknown>[]
  mensagem: string | null
  erro: string | null
}

/** Payload para PUT /extraction/perguntas/ordem-lote */
export interface OrdemLotePayload {
  categoria_id: number
  perguntas: { id: number; ordem: number }[]
}
