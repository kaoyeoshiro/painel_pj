/** Constantes compartilhadas para o dashboard de feedbacks. */

// ---------------------------------------------------------------------------
// Sistemas
// ---------------------------------------------------------------------------

export interface SistemaOption {
  value: string
  label: string
  shortLabel: string
  color: string
  bgColor: string
}

export const SISTEMAS: SistemaOption[] = [
  { value: 'assistencia_judiciaria', label: 'Assistência Judiciária', shortLabel: 'Assist. Jud.', color: '#3b82f6', bgColor: 'bg-blue-50' },
  { value: 'matriculas', label: 'Matrículas Confrontantes', shortLabel: 'Matrículas', color: '#22c55e', bgColor: 'bg-green-50' },
  { value: 'gerador_pecas', label: 'Gerador de Peças', shortLabel: 'Ger. Peças', color: '#a855f7', bgColor: 'bg-purple-50' },
  { value: 'pedido_calculo', label: 'Pedido de Cálculo', shortLabel: 'Ped. Cálculo', color: '#f59e0b', bgColor: 'bg-amber-50' },
  { value: 'prestacao_contas', label: 'Prestação de Contas', shortLabel: 'Prest. Contas', color: '#14b8a6', bgColor: 'bg-teal-50' },
  { value: 'relatorio_cumprimento', label: 'Relatório de Cumprimento', shortLabel: 'Rel. Cumpr.', color: '#6366f1', bgColor: 'bg-indigo-50' },
]

export const SISTEMA_MAP = Object.fromEntries(
  SISTEMAS.map((s) => [s.value, s])
) as Record<string, SistemaOption>

// ---------------------------------------------------------------------------
// Avaliações
// ---------------------------------------------------------------------------

export const AVALIACAO_CONFIG: Record<string, { label: string; bgClass: string; textClass: string }> = {
  correto: { label: 'Correta', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  parcial: { label: 'Parcial', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
  incorreto: { label: 'Incorreta', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  erro_ia: { label: 'Erro IA', bgClass: 'bg-gray-100', textClass: 'text-gray-700' },
}

export const AVALIACAO_OPTIONS = [
  { value: '', label: 'Todas avaliações' },
  { value: 'correto', label: 'Corretas' },
  { value: 'parcial', label: 'Parciais' },
  { value: 'incorreto', label: 'Incorretas' },
  { value: 'erro_ia', label: 'Erro da IA' },
]

// ---------------------------------------------------------------------------
// Cores do gráfico de pizza
// ---------------------------------------------------------------------------

export const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444', '#6b7280']

// ---------------------------------------------------------------------------
// Evolução — cores por sistema (linhas do gráfico)
// ---------------------------------------------------------------------------

export const EVOLUCAO_CORES: Record<string, { border: string; bg: string }> = {
  assistencia_judiciaria: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
  matriculas: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
  gerador_pecas: { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)' },
  pedido_calculo: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
  prestacao_contas: { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.2)' },
  relatorio_cumprimento: { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)' },
}

// ---------------------------------------------------------------------------
// Período (meses/anos)
// ---------------------------------------------------------------------------

export const MESES = [
  { value: '', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const currentYear = new Date().getFullYear()
export const ANOS = [
  { value: '', label: 'Todos os anos' },
  { value: String(currentYear), label: String(currentYear) },
  { value: String(currentYear - 1), label: String(currentYear - 1) },
  { value: String(currentYear - 2), label: String(currentYear - 2) },
]

// ---------------------------------------------------------------------------
// Evolução — opções de filtro
// ---------------------------------------------------------------------------

export const EVOLUCAO_SEMANAS_OPTIONS = [
  { value: '8', label: 'Últimas 8 semanas' },
  { value: '12', label: 'Últimas 12 semanas' },
  { value: '16', label: 'Últimas 16 semanas' },
  { value: '24', label: 'Últimas 24 semanas' },
  { value: '52', label: 'Último ano' },
]

export const EVOLUCAO_METRICA_OPTIONS = [
  { value: 'taxa_acerto', label: 'Taxa de Acerto (%)' },
  { value: 'total', label: 'Total de Feedbacks' },
  { value: 'corretos', label: 'Feedbacks Corretos' },
]

// ---------------------------------------------------------------------------
// Fuso horário
// ---------------------------------------------------------------------------

export const TIMEZONE = 'America/Campo_Grande'

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

export function formatarData(dataISO: string | null | undefined): string {
  if (!dataISO) return '-'
  return new Date(dataISO).toLocaleDateString('pt-BR', { timeZone: TIMEZONE })
}

export function formatarHora(dataISO: string | null | undefined): string {
  if (!dataISO) return ''
  return new Date(dataISO).toLocaleTimeString('pt-BR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })
}

export function formatarDataHora(dataISO: string | null | undefined): string {
  if (!dataISO) return '-'
  return new Date(dataISO).toLocaleString('pt-BR', { timeZone: TIMEZONE })
}
