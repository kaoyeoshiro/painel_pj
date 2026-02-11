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
