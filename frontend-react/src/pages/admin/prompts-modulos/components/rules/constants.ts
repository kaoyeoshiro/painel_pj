// Constantes do sistema de regras deterministicas

import type { ComparisonOperator } from './types'

// Labels dos operadores para exibicao na UI
export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  equals: 'igual a',
  not_equals: 'diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  starts_with: 'começa com',
  ends_with: 'termina com',
  greater_than: 'maior que',
  less_than: 'menor que',
  greater_or_equal: 'maior ou igual a',
  less_or_equal: 'menor ou igual a',
  exists: 'existe (tem valor)',
  not_exists: 'não existe (vazio)',
  is_empty: 'está vazio',
  is_not_empty: 'não está vazio',
  in_list: 'está na lista',
  not_in_list: 'não está na lista',
  matches_regex: 'corresponde ao regex',
}

// Operadores validos por tipo de variavel
export const OPERATORS_BY_TYPE: Record<string, ComparisonOperator[]> = {
  boolean: ['equals', 'not_equals', 'exists', 'not_exists'],
  text: [
    'equals', 'not_equals', 'contains', 'not_contains',
    'starts_with', 'ends_with', 'exists', 'not_exists',
    'is_empty', 'is_not_empty', 'matches_regex',
  ],
  number: [
    'equals', 'not_equals', 'greater_than', 'less_than',
    'greater_or_equal', 'less_or_equal', 'exists', 'not_exists',
  ],
  currency: [
    'equals', 'not_equals', 'greater_than', 'less_than',
    'greater_or_equal', 'less_or_equal', 'exists', 'not_exists',
  ],
  date: [
    'equals', 'not_equals', 'greater_than', 'less_than',
    'greater_or_equal', 'less_or_equal', 'exists', 'not_exists',
  ],
  choice: [
    'equals', 'not_equals', 'contains', 'in_list', 'not_in_list',
    'exists', 'not_exists',
  ],
  list: [
    'contains', 'not_contains', 'is_empty', 'is_not_empty',
    'in_list', 'not_in_list', 'exists', 'not_exists',
  ],
}

// Operadores que NAO precisam de campo de valor
export const VALUELESS_OPERATORS: ComparisonOperator[] = [
  'exists', 'not_exists', 'is_empty', 'is_not_empty',
]

// Labels de tipos de peca
export const TIPO_PECA_LABELS: Record<string, string> = {
  contestacao: 'Contestação',
  recurso_apelacao: 'Recurso de Apelação',
  contrarrazoes: 'Contrarrazões',
  recurso_especial: 'Recurso Especial',
  recurso_extraordinario: 'Recurso Extraordinário',
  agravo_instrumento: 'Agravo de Instrumento',
  embargos_declaracao: 'Embargos de Declaração',
  manifestacao: 'Manifestação',
  parecer: 'Parecer',
  informacoes: 'Informações em MS',
}
