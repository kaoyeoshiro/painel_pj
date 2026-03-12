// Tipos compartilhados da pagina de Modulos de Prompts

export interface PromptModulo {
  id: number
  titulo: string
  nome: string
  conteudo: string
  categoria: string
  subcategoria: string | null
  subcategoria_ids?: number[]
  subcategorias_nomes?: string[]
  group_id: number | null
  subgroup_id: number | null
  tags: string[]
  tipo: 'base' | 'peca' | 'conteudo'
  ordem: number
  ativo: boolean
  modo_ativacao: 'llm' | 'deterministic'
  effective_activation_mode?: string
  // Campos de regra deterministica
  regra_deterministica?: Record<string, unknown> | null
  regra_texto_original?: string | null
  regra_deterministica_secundaria?: Record<string, unknown> | null
  regra_secundaria_texto_original?: string | null
  fallback_habilitado?: boolean | null
  versao: number
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface PromptGroup {
  id: number
  nome: string
  descricao: string | null
  ordem: number
  ativo: boolean
}

export interface PromptSubgroup {
  id: number
  group_id: number
  nome: string
  descricao: string | null
  ordem: number
  ativo: boolean
}

export interface HistoricoVersao {
  versao: number
  conteudo: string
  titulo: string
  categoria: string
  tipo: string
  modo_ativacao: string
  atualizado_em: string
  atualizado_por: string | null
}

export interface Subcategoria {
  id: number
  group_id: number
  nome: string
  slug: string
  descricao: string | null
}

export type TipoPrompt = 'base' | 'peca' | 'conteudo'
export type TipoFiltro = TipoPrompt | null
export type ModoFiltro = 'llm' | 'deterministic' | null

// ============================================================
// Ranking de ativações
// ============================================================

export interface RankingItem {
  posicao: number
  modulo_id: number
  nome: string
  titulo: string
  categoria: string
  total_ativacoes: number
  nunca_ativado: boolean
}

export interface RankingMetadata {
  total_modulos_ativos: number
  total_geracoes_analisadas: number
  modulos_nunca_ativados: number
}

export interface RankingResponse {
  ranking: RankingItem[]
  metadata: RankingMetadata
}

export interface ModuloFormData {
  titulo: string
  nome: string
  conteudo: string
  categoria: string
  group_id: number | null
  subgroup_id: number | null
  tags: string
  tipo: TipoPrompt
  ordem: number
  ativo: boolean
  modo_ativacao: 'llm' | 'deterministic'
  // Campos de regra deterministica
  regra_deterministica: Record<string, unknown> | null
  regra_texto_original: string | null
  regra_deterministica_secundaria: Record<string, unknown> | null
  regra_secundaria_texto_original: string | null
  fallback_habilitado: boolean
}
