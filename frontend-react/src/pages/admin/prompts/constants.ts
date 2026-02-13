import type { ConfigGroup } from './types'

/** Sistemas disponíveis com rótulos para UI */
export const SISTEMAS = [
  { value: 'matriculas', label: 'Matrículas' },
  { value: 'assistencia_judiciaria', label: 'Assistência Judiciária' },
  { value: 'gerador_pecas', label: 'Gerador de Peças' },
  { value: 'pedido_calculo', label: 'Pedido de Cálculo' },
  { value: 'prestacao_contas', label: 'Prestação de Contas' },
  { value: 'relatorio_cumprimento', label: 'Relatório de Cumprimento' },
  { value: 'sistemas_acessorios', label: 'Sistemas Acessórios' },
  { value: 'global', label: 'Global' },
] as const

/** Badges de tipo para prompts */
export const TIPO_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  system: { label: 'Sistema', variant: 'default' },
  analise: { label: 'Análise', variant: 'secondary' },
  relatorio: { label: 'Relatório', variant: 'outline' },
  resumo: { label: 'Resumo', variant: 'outline' },
}

/** Agrupamento de chaves extras (não-agente) por propósito */
export const CONFIG_GROUPS: ConfigGroup[] = [
  { label: 'Modelo de IA', color: 'blue', patterns: ['modelo', 'thinking_level'] },
  { label: 'Critérios de Relevância', color: 'amber', patterns: ['prompt_criterios_relevancia', '*criterio*'] },
  { label: 'Limites de Processamento', color: 'indigo', patterns: ['competencia_999_*', 'max_*', 'limite_*'] },
  { label: 'Busca Vetorial', color: 'emerald', patterns: ['busca_vetorial_*', '*embedding*'] },
  { label: 'Chat de Edição', color: 'violet', patterns: ['prompt_chat_*', 'chat_*'] },
]

/** Cores CSS para os grupos de config extras */
export const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  violet: { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-700' },
  gray: { border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-700' },
}

/** Cores por fonte de resolução de parâmetro */
export const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  agent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'agente' },
  system: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'sistema' },
  global: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'global' },
  default: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'padrão' },
}

/** Valor sentinel para "herdar do nível superior" (Radix Select não aceita value="") */
export const INHERIT_VALUE = '__inherit__'

/** Opções de thinking_level para Select */
export const THINKING_LEVELS = [
  { value: INHERIT_VALUE, label: 'Herdar' },
  { value: 'none', label: 'Nenhum (none)' },
  { value: 'minimal', label: 'Mínimo (minimal)' },
  { value: 'low', label: 'Baixo (low)' },
  { value: 'medium', label: 'Médio (medium)' },
  { value: 'high', label: 'Alto (high)' },
]

/** Modelos de IA disponíveis para Select */
export const MODELOS_IA = [
  { value: INHERIT_VALUE, label: 'Herdar' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (padrão)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
]

/** Modelos de IA para selects diretos (sem opção "Herdar") */
export const MODELOS_IA_DIRETO = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (padrão)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview (avançado)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (econômico)' },
]

/** Opções de thinking_level sem "Herdar" (para configurações diretas) */
export const THINKING_LEVELS_DIRETO = [
  { value: 'low', label: 'Low - Direto e objetivo (Recomendado)' },
  { value: 'minimal', label: 'Minimal - Pensamento mínimo' },
  { value: 'medium', label: 'Medium - Análise moderada' },
  { value: 'high', label: 'High - Análise profunda' },
]

/**
 * Chaves que pertencem à configuração de agente e NÃO devem aparecer em Extras.
 * Inclui padrões legados (modelo_*, temperatura_*) e os 4 campos por agente.
 */
const AGENT_KEY_PATTERNS = [
  /^modelo_/,
  /^temperatura_/,
  /^max_tokens_/,
  /^thinking_level_/,
  // Chaves bare dos 4 campos base (usadas como config de sistema)
  /^modelo$/,
  /^temperatura$/,
  /^max_tokens$/,
  /^thinking_level$/,
]

/** Mapa de suporte de thinking levels por modelo (apenas modelos compatíveis com thinkingLevel) */
export const MODEL_THINKING_SUPPORT: Record<string, string[]> = {
  'gemini-3-flash': ['minimal', 'low', 'medium', 'high'],
  'gemini-3-pro': ['low', 'high'],
}
// gemini-2.5-flash-lite usa thinkingBudget (inteiro), não thinkingLevel — dropdown não se aplica

/** Mapa de normalização de valores legados PT-BR para API EN */
export const NORMALIZE_THINKING_LEVEL: Record<string, string> = {
  'baixo': 'low',
  'médio': 'medium',
  'medio': 'medium',
  'alto': 'high',
  'nenhum': 'none',
  'mínimo': 'minimal',
  'minimo': 'minimal',
}

/**
 * Retorna os níveis de thinking suportados por um modelo.
 * Faz matching por substring (ex: 'gemini-3-flash-preview' → 'gemini-3-flash').
 * Retorna array vazio se o modelo não suportar thinking levels.
 */
export function getSupportedLevels(modelValue: string): string[] {
  if (!modelValue) return []

  for (const [key, levels] of Object.entries(MODEL_THINKING_SUPPORT)) {
    if (modelValue.includes(key)) {
      return levels
    }
  }

  return []
}

/** Verifica se uma chave é de configuração de agente */
export function isAgentKey(key: string): boolean {
  return AGENT_KEY_PATTERNS.some(re => re.test(key))
}

/** Verifica se uma chave corresponde a um padrão com wildcard */
export function matchPattern(key: string, pattern: string): boolean {
  if (pattern === key) return true
  if (!pattern.includes('*')) return false
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
  return regex.test(key)
}

/** Retorna o grupo de uma chave, ou null se não pertencer a nenhum */
export function getConfigGroup(key: string): ConfigGroup | null {
  for (const group of CONFIG_GROUPS) {
    if (group.patterns.some(p => matchPattern(key, p))) return group
  }
  return null
}
