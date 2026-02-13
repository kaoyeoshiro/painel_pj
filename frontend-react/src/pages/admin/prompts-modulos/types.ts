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
