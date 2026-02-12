// Tipos compartilhados da página de Configurações de IA / Prompts

export interface Prompt {
  id: number
  sistema: string
  tipo: string
  nome: string
  descricao?: string
  conteudo: string
  is_active: boolean
  updated_at: string
  updated_by?: string
}

export interface ConfigIA {
  sistema: string
  chave: string
  valor: string
}

/** Fonte de resolução do parâmetro na hierarquia */
export type SourceType = 'agent' | 'system' | 'global' | 'default'

/** Dados de um agente retornados pelo endpoint per-agent */
export interface AgentConfig {
  descricao: string
  modelo: string
  modelo_fonte: SourceType
  temperatura: number | null
  temperatura_fonte: SourceType
  max_tokens: number | null
  max_tokens_fonte: SourceType
  thinking_level: string | null
  thinking_level_fonte: SourceType
}

/** Resposta do endpoint GET /admin/config-ia/per-agent/{sistema} */
export interface PerAgentResponse {
  sistema: string
  agentes: Record<string, AgentConfig>
}

/** Agrupamento de chaves de configuração por propósito, com cor */
export interface ConfigGroup {
  label: string
  color: string
  /** Padrões para match de chaves (suporta * como wildcard) */
  patterns: string[]
}

/** Informação de um campo de agente editado localmente */
export interface AgentFieldEdit {
  agente: string
  campo: 'modelo' | 'temperatura' | 'max_tokens' | 'thinking_level'
  valor: string
}
