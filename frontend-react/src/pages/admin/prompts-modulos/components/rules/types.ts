// Tipos para o sistema de regras deterministicas (AST JSON)

// --- Operadores ---

export type ComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'exists'
  | 'not_exists'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_list'
  | 'not_in_list'
  | 'matches_regex'

export type LogicalOperator = 'and' | 'or'

// --- Nos da AST ---

export interface RuleCondition {
  type: 'condition'
  variable: string
  operator: ComparisonOperator
  value: unknown
}

export interface RuleGroup {
  type: 'and' | 'or'
  conditions: RuleNode[]
}

export interface RuleNot {
  type: 'not'
  condition: RuleNode
}

export type RuleNode = RuleCondition | RuleGroup | RuleNot

// --- Variaveis disponiveis ---

export interface RuleVariable {
  slug: string
  label: string
  tipo: 'text' | 'number' | 'boolean' | 'choice' | 'list' | 'currency' | 'date'
  opcoes?: string[]
  fonte: 'extracao' | 'processo'
}

// --- Resposta da geracao de regra via IA ---

export interface GerarRegraResponse {
  success: boolean
  regra: RuleNode | null
  variaveis_usadas: string[] | null
  regra_texto_original: string | null
  erro: string | null
  variaveis_faltantes: string[] | null
  sugestoes_variaveis: SugestaoVariavel[] | null
}

export interface SugestaoVariavel {
  slug: string
  label_sugerido: string
  tipo_sugerido: string
}

// --- Validacao ---

export interface ValidarRegraResponse {
  valid: boolean
  errors: string[]
  warnings: string[]
  variaveis_faltantes: string[]
}

// --- Regras por tipo de peca ---

export interface RegraTipoPeca {
  id: number
  modulo_id: number
  tipo_peca: string
  regra_deterministica: RuleNode
  regra_texto_original: string | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface RegraTipoPecaCreate {
  tipo_peca: string
  regra_deterministica: RuleNode
  regra_texto_original?: string
  ativo?: boolean
}

// --- Resposta completa de regras do modulo ---

export interface RegrasTipoPecaResponse {
  modulo_id: number
  modulo_nome: string
  modulo_titulo: string
  regra_global: {
    primaria: RuleNode | null
    primaria_texto: string | null
    secundaria: RuleNode | null
    fallback_habilitado: boolean
  }
  regras_tipo_peca: RegraTipoPeca[]
  tipos_peca_disponiveis: string[]
  validacao_integridade: {
    valido: boolean
    variaveis_invalidas: string[]
    resumo: string
  }
}
