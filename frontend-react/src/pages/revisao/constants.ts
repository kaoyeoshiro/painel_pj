/**
 * Constantes de UI e configuração visual do Sistema de Revisão de Peças.
 * Centraliza labels, cores e formatadores usados nos componentes.
 */

import { C } from '@/lib/designTokens'

// ---------------------------------------------------------------------------
// Config de status principal
// ---------------------------------------------------------------------------

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  pendente: {
    label: 'Pendente',
    color: C.gray600,
    bgColor: C.gray100,
  },
  em_revisao: {
    label: 'Em Revisão',
    color: C.navy600,
    bgColor: C.navy50,
  },
  aprovado: {
    label: 'Aprovado',
    color: C.successText,
    bgColor: C.successBg,
  },
  encaminhado: {
    label: 'Encaminhado',
    color: '#92400e', // amber-800
    bgColor: '#fffbeb', // amber-50
  },
  rejeitado: {
    label: 'Rejeitado',
    color: C.errorText,
    bgColor: C.errorBg,
  },
  concluido: {
    label: 'Concluído',
    color: '#3730a3', // indigo-800
    bgColor: '#eef2ff', // indigo-50
  },
}

// ---------------------------------------------------------------------------
// Config de obs_status (aguardando inserção, inserido)
// ---------------------------------------------------------------------------

export const OBS_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aguardando_insercao: {
    label: 'Aguardando Inserção',
    color: C.statusWarning,
  },
  inserido: {
    label: 'Inserido',
    color: C.statusSuccess,
  },
}

// ---------------------------------------------------------------------------
// Config de resultado do processo
// ---------------------------------------------------------------------------

export const RESULTADO_CONFIG: Record<string, { label: string; color: string }> = {
  procedente: { label: 'Procedente', color: C.statusError },
  improcedente: { label: 'Improcedente', color: C.statusSuccess },
  parcialmente_procedente: { label: 'Parcialmente Procedente', color: C.statusWarning },
  extinto: { label: 'Extinto', color: C.gray500 },
  homologado: { label: 'Homologado', color: C.navy500 },
}

// ---------------------------------------------------------------------------
// Config de urgência
// ---------------------------------------------------------------------------

export const URGENCIA_CONFIG: Record<string, { label: string; color: string }> = {
  rotina: {
    label: 'Rotina',
    color: C.gray500,
  },
  prazo_correndo: {
    label: 'Prazo Correndo',
    color: C.statusWarning,
  },
  urgente: {
    label: 'Urgente',
    color: C.statusError,
  },
}

// ---------------------------------------------------------------------------
// Config de confiança da IA
// ---------------------------------------------------------------------------

export const CONFIANCA_CONFIG: Record<string, { label: string; color: string }> = {
  alta: {
    label: 'Alta',
    color: C.statusSuccess,
  },
  media: {
    label: 'Média',
    color: C.statusWarning,
  },
  baixa: {
    label: 'Baixa',
    color: C.statusError,
  },
}

// ---------------------------------------------------------------------------
// Opções de filtro: ações sugeridas
// ---------------------------------------------------------------------------

export const ACOES_SUGERIDAS: { value: string; label: string }[] = [
  { value: 'contestar', label: 'Contestar' },
  { value: 'recorrer', label: 'Recorrer' },
  { value: 'cumprir', label: 'Cumprir' },
  { value: 'arquivar', label: 'Arquivar' },
  { value: 'negociar', label: 'Negociar' },
  { value: 'embargos_declaracao', label: 'Embargos de Declaração' },
  { value: 'recurso_ordinario', label: 'Recurso Ordinário' },
  { value: 'agravo_instrumento', label: 'Agravo de Instrumento' },
]

// ---------------------------------------------------------------------------
// Opções de motivo de rejeição
// ---------------------------------------------------------------------------

export const ACOES_REJEICAO: { value: string; label: string }[] = [
  { value: 'peca_incorreta', label: 'Peça incorreta para o caso' },
  { value: 'informacoes_erradas', label: 'Informações erradas ou desatualizadas' },
  { value: 'fundamentacao_insuficiente', label: 'Fundamentação insuficiente' },
  { value: 'processo_arquivado', label: 'Processo já arquivado/encerrado' },
  { value: 'duplicidade', label: 'Duplicidade — peça já foi gerada' },
  { value: 'outros', label: 'Outros motivos' },
]

// ---------------------------------------------------------------------------
// Formatador de data em pt-BR (fuso America/Campo_Grande)
// ---------------------------------------------------------------------------

/**
 * Formata uma data ISO 8601 para exibição em português (Campo Grande / MS).
 *
 * @param dataISO - String ISO 8601 (ex: "2026-03-15T14:30:00")
 * @returns Data formatada, ex: "15/03/2026 14:30"
 */
export function formatarData(dataISO: string | null | undefined): string {
  if (!dataISO) return '—'

  try {
    const date = new Date(dataISO)
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Campo_Grande',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dataISO
  }
}
