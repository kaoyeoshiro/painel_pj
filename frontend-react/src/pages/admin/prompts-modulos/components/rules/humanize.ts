// Converte AST de regra para texto legivel

import type { RuleNode, RuleCondition, RuleVariable } from './types'
import { OPERATOR_LABELS } from './constants'

/** Formata o valor para exibicao */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'nulo'
  if (typeof value === 'boolean') return value ? 'verdadeiro' : 'falso'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return `"${value}"`
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`
  return String(value)
}

/** Resolve o label de uma variavel (usa label se disponivel, senao slug) */
function resolveVarLabel(slug: string, variaveis: RuleVariable[]): string {
  const found = variaveis.find((v) => v.slug === slug)
  return found ? found.label : slug
}

/** Converte uma condicao simples para texto */
function humanizeCondition(
  cond: RuleCondition,
  variaveis: RuleVariable[],
): string {
  const varLabel = resolveVarLabel(cond.variable, variaveis)
  const opLabel = OPERATOR_LABELS[cond.operator] || cond.operator

  // Operadores sem valor
  if (['exists', 'not_exists', 'is_empty', 'is_not_empty'].includes(cond.operator)) {
    return `${varLabel} ${opLabel}`
  }

  return `${varLabel} ${opLabel} ${formatValue(cond.value)}`
}

/** Converte um no da AST para texto humanizado */
export function humanizeRule(
  node: RuleNode | null | undefined,
  variaveis: RuleVariable[] = [],
  depth: number = 0,
): string {
  if (!node) return 'Nenhuma regra configurada'

  if (node.type === 'condition') {
    return humanizeCondition(node, variaveis)
  }

  if (node.type === 'not') {
    const inner = humanizeRule(node.condition, variaveis, depth + 1)
    return `NÃO (${inner})`
  }

  if (node.type === 'and' || node.type === 'or') {
    const connector = node.type === 'and' ? ' E ' : ' OU '
    const parts = node.conditions.map((c) => humanizeRule(c, variaveis, depth + 1))

    if (parts.length === 0) return 'Nenhuma condição'
    if (parts.length === 1) return parts[0]

    // Adiciona parenteses para clareza em niveis aninhados
    if (depth > 0) {
      return `(${parts.join(connector)})`
    }
    return parts.join(connector)
  }

  return 'Regra desconhecida'
}

/** Conta o numero total de condicoes em uma regra */
export function countConditions(node: RuleNode | null | undefined): number {
  if (!node) return 0
  if (node.type === 'condition') return 1
  if (node.type === 'not') return countConditions(node.condition)
  if (node.type === 'and' || node.type === 'or') {
    return node.conditions.reduce((sum, c) => sum + countConditions(c), 0)
  }
  return 0
}

/** Extrai todas as variaveis usadas em uma regra */
export function extractVariables(node: RuleNode | null | undefined): string[] {
  if (!node) return []
  if (node.type === 'condition') return [node.variable]
  if (node.type === 'not') return extractVariables(node.condition)
  if (node.type === 'and' || node.type === 'or') {
    const vars = new Set<string>()
    for (const c of node.conditions) {
      for (const v of extractVariables(c)) vars.add(v)
    }
    return Array.from(vars)
  }
  return []
}
