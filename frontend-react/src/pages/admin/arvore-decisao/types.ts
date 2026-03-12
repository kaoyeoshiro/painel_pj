/**
 * Tipos para a visualização de árvore de decisão.
 * Espelha os DTOs do backend (schemas_arvore.py).
 */

// --- API Response Types ---

export interface SwimlaneDTO {
  id: string
  label: string
  modulos_count: number
  variaveis_count: number
  pct_deterministico: number
}

export interface ModuloDTO {
  id: number
  titulo: string
  categoria: string
  modo_ativacao: 'deterministic' | 'llm'
  regra: ASTRule | null
  regra_secundaria: ASTRule | null
  fallback_habilitado: boolean
  variaveis_usadas: string[]
  tipos_peca: string[]
  regras_tipo_peca: Record<string, ASTRule>
}

export interface VariavelDTO {
  slug: string
  label: string
  tipo: string
  fonte: 'extraction' | 'process'
  pergunta: string | null
  is_orfa: boolean
  modulos_ids: number[]
  depends_on: string | null
  dependency_operator: string | null
  dependency_value: string | null
}

export interface StatsDTO {
  total_modulos: number
  total_variaveis: number
  total_orfas: number
  total_vinculos: number
}

export interface ArvoreDecisaoResponse {
  swimlanes: SwimlaneDTO[]
  modulos: ModuloDTO[]
  variaveis: VariavelDTO[]
  stats: StatsDTO
}

// --- AST Rule Types ---

export type ASTRule = ASTCondition | ASTAnd | ASTOr | ASTNot

export interface ASTCondition {
  type: 'condition'
  variable: string
  operator: string
  value: unknown
}

export interface ASTAnd {
  type: 'and'
  conditions: ASTRule[]
}

export interface ASTOr {
  type: 'or'
  conditions: ASTRule[]
}

export interface ASTNot {
  type: 'not'
  condition: ASTRule
}

// --- React Flow Node Types ---

export type CustomNodeType = 'swimlane' | 'module' | 'condition' | 'connector' | 'variable' | 'orphan-variable'
export type CustomEdgeType = 'rule' | 'yes-no' | 'dependency' | 'shared-var'

export type ZoomLevel = 'macro' | 'medium' | 'detail'

// --- Node Data Types ---

export interface SwimLaneNodeData {
  label: string
  modulosCount: number
  variaveisCount: number
  pctDeterministico: number
  isCollapsed: boolean
}

export interface ModuleNodeData {
  id: number
  titulo: string
  modoAtivacao: 'deterministic' | 'llm'
  variaveisCount: number
  isExpanded: boolean
}

export interface ConditionNodeData {
  operator: string
  value: unknown
  variable?: string
}

export interface ConnectorNodeData {
  connectorType: 'and' | 'or' | 'not'
}

export interface VariableNodeData {
  slug: string
  label: string
  tipo: string
  isOrfa: boolean
}

// --- Detail Panel Types ---

export type DetailPanelContent =
  | { type: 'module'; data: ModuloDTO }
  | { type: 'variable'; data: VariavelDTO }
  | null
