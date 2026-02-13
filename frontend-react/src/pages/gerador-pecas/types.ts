/**
 * Tipos locais, constantes e helpers do modulo Gerador de Pecas.
 *
 * Tipos de dominio (SSEEvent, ModuloPreview, PageState, etc.) ficam em
 * @/types/gerador-pecas — aqui ficam apenas itens da camada de apresentacao.
 */

import { Search, Layers, Pen, type LucideIcon } from 'lucide-react'

// ============================================================================
// Helpers de formatacao
// ============================================================================

/** Mascara CNJ: 0000000-00.0000.0.00.0000 */
export function formatCNJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 20)
  let result = ''
  for (let i = 0; i < digits.length; i++) {
    if (i === 7) result += '-'
    if (i === 9) result += '.'
    if (i === 13) result += '.'
    if (i === 14) result += '.'
    if (i === 16) result += '.'
    result += digits[i]
  }
  return result
}

/** Data ISO -> dd/mm/aaaa */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

/** Data ISO -> dd/mm/aaaa HH:MM */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

// ============================================================================
// Constantes de UI
// ============================================================================

export interface AgentMeta {
  numero: number
  nome: string
  descricao: string
  icon: LucideIcon
}

/** Metadados visuais dos 3 agentes do pipeline */
export const AGENT_META: readonly AgentMeta[] = [
  { numero: 1, nome: 'Coletor', descricao: 'Busca documentos no TJ-MS', icon: Search },
  { numero: 2, nome: 'Analisador', descricao: 'Identifica argumentos', icon: Layers },
  { numero: 3, nome: 'Redator', descricao: 'Gera a peca juridica', icon: Pen },
] as const

// ============================================================================
// Tipos locais de UI
// ============================================================================

/** Item do historico de versoes (formato retornado pela query) */
export interface VersionItem {
  versao_id: number
  numero_versao: number
  linhas_adicionadas: number
  linhas_removidas: number
  descricao_alteracao: string
  created_at: string
}

/** Sugestao fixa para o chat */
export interface ChatSugestao {
  text: string
  color: string
  iconColor: string
}

/** Sugestoes padrao exibidas quando nao ha mensagens no chat */
export const CHAT_SUGESTOES: readonly ChatSugestao[] = [
  { text: 'Adicionar argumento sobre prescricao', color: 'hover:border-amber-300 hover:bg-amber-50/60', iconColor: 'text-amber-500' },
  { text: 'Reescrever topico sobre competencia', color: 'hover:border-sky-300 hover:bg-sky-50/60', iconColor: 'text-sky-500' },
  { text: 'Remover secao de preliminares', color: 'hover:border-rose-300 hover:bg-rose-50/60', iconColor: 'text-rose-400' },
  { text: 'Reforcar fundamentacao juridica', color: 'hover:border-teal-300 hover:bg-teal-50/60', iconColor: 'text-teal-500' },
] as const
