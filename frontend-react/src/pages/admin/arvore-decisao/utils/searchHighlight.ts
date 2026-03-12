/**
 * Lógica de busca e highlight para nós do grafo.
 */

import type { ModuloDTO, VariavelDTO } from '../types'

export function moduloMatchesSearch(modulo: ModuloDTO, term: string): boolean {
  if (!term) return true
  const lower = term.toLowerCase()
  return (
    modulo.titulo.toLowerCase().includes(lower) ||
    modulo.categoria.toLowerCase().includes(lower)
  )
}

export function variavelMatchesSearch(variavel: VariavelDTO, term: string): boolean {
  if (!term) return true
  const lower = term.toLowerCase()
  return (
    variavel.slug.toLowerCase().includes(lower) ||
    variavel.label.toLowerCase().includes(lower) ||
    (variavel.pergunta?.toLowerCase().includes(lower) ?? false)
  )
}

export function getMatchClass(isMatch: boolean, hasSearch: boolean): string {
  if (!hasSearch) return ''
  return isMatch ? 'node-match' : 'node-no-match'
}
