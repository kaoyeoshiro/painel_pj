/**
 * Helpers de formatacao e estilos locais do Extrator de Autos.
 *
 * Tipos de dominio (ProcessoInfo, CategoriaDocumento, etc.) ficam em
 * @/types/extrator-autos — aqui ficam apenas funcoes utilitarias.
 */

import { C } from '@/lib/designTokens'

// ============================================================================
// Helpers de formatacao
// ============================================================================

/** Data ISO -> dd/mm/aaaa (ou "-" se invalida) */
export function formatarData(iso: string | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return '-'
  }
}

/** Retorna a hora atual formatada (HH:MM:SS) */
export function timestamp(): string {
  return new Date().toLocaleTimeString('pt-BR')
}

// ============================================================================
// Badge de status do historico com tokens
// ============================================================================

/** Retorna estilos inline para badges de status do historico */
export function statusBadgeStyle(status: string): React.CSSProperties {
  if (status === 'concluido') {
    return { background: C.successBgStrong, color: C.statusSuccess, border: 'none' }
  }
  if (status === 'erro') {
    return { background: C.errorBg, color: C.statusError, border: 'none' }
  }
  if (status === 'processando') {
    return { background: C.navy100, color: C.navy700, border: 'none' }
  }
  // pendente ou outros
  return { background: C.gray100, color: C.text500, border: 'none' }
}
