/**
 * Tipos locais e constantes do modulo de Treinamento BERT.
 *
 * Os tipos de dominio (Dataset, TrainingJob, TrainingMetrics, etc.)
 * ficam em @/types/bert-training. Aqui moram apenas tipos auxiliares
 * de UI e constantes de configuracao usados exclusivamente por este modulo.
 */

import { Settings, Zap, Layers, type LucideIcon } from 'lucide-react'
import type { TrainingConfig, TrainingJob } from '@/types/bert-training'

// ============================================================================
// Tipos auxiliares de UI
// ============================================================================

/** Informacoes de GPU do worker */
export interface GpuInfo {
  gpu_name: string
  gpu_memory_total: string
  gpu_memory_used: string
  gpu_memory_free: string
  gpu_utilization: string
  cuda_version: string
  driver_version: string
}

/** Status de conexao com o worker */
export interface WorkerStatus {
  connected: boolean
  url: string
  latency_ms: number
  version: string
  uptime: string
  error?: string
}

/** Resultado de validacao do dataset */
export interface DatasetValidation {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  categories_count: Record<string, number>
  warnings: string[]
  errors: string[]
  sample_rows: Array<{ texto: string; categoria: string }>
}

/** Resultado de classificacao de PDF */
export interface PdfClassificationResult {
  filename: string
  total_pages: number
  chunks: Array<{ texto: string; categoria_predita: string; confianca: number }>
}

/** Entrada de log em tempo real */
export interface LogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
}

/** Filtro de status para runs */
export type RunStatusFilter = 'all' | 'running' | 'completed' | 'failed'

/** Passo do wizard de upload de dataset */
export type UploadStep = 1 | 2 | 3 | 4

// ============================================================================
// Constantes
// ============================================================================

/** Intervalo de polling para jobs em execucao (ms) */
export const POLLING_INTERVAL = 5000

/** Intervalo de polling para logs em tempo real (ms) */
export const LOG_POLLING_INTERVAL = 3000

/** Modelos base disponiveis para treinamento */
export const MODELOS_BASE = [
  { value: 'neuralmind/bert-base-portuguese-cased', label: 'BERTimbau (Base)' },
  { value: 'neuralmind/bert-large-portuguese-cased', label: 'BERTimbau (Large)' },
  { value: 'bert-base-multilingual-cased', label: 'BERT Multilingual' },
]

/** Valores padrao de hiperparametros */
export const DEFAULT_CONFIG: TrainingConfig = {
  modelo_base: 'neuralmind/bert-base-portuguese-cased',
  learning_rate: 2e-5,
  batch_size: 16,
  num_epochs: 5,
  max_length: 256,
}

/** Preset de treinamento */
export interface TrainingPreset {
  id: string
  label: string
  description: string
  icon: LucideIcon
  config: TrainingConfig
  color: string
  iconColor: string
}

/** Presets de treinamento disponiveis */
export const TRAINING_PRESETS: readonly TrainingPreset[] = [
  {
    id: 'padrao',
    label: 'Padrao',
    description: 'Configuracao balanceada para a maioria dos casos. Bom equilibrio entre velocidade e qualidade.',
    icon: Settings,
    config: { ...DEFAULT_CONFIG },
    color: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 'rapido',
    label: 'Rapido',
    description: 'Treinamento acelerado com menos epocas. Ideal para testes rapidos e prototipagem.',
    icon: Zap,
    config: {
      modelo_base: 'neuralmind/bert-base-portuguese-cased',
      learning_rate: 5e-5,
      batch_size: 32,
      num_epochs: 2,
      max_length: 128,
    },
    color: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    id: 'completo',
    label: 'Completo',
    description: 'Treinamento extensivo com mais epocas e maior max_length. Melhor qualidade final.',
    icon: Layers,
    config: {
      modelo_base: 'neuralmind/bert-large-portuguese-cased',
      learning_rate: 1e-5,
      batch_size: 8,
      num_epochs: 10,
      max_length: 512,
    },
    color: 'border-green-200 bg-green-50 hover:bg-green-100',
    iconColor: 'text-green-600',
  },
] as const

/** Opcoes de filtro de status */
export interface StatusFilterOption {
  value: RunStatusFilter
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
}

export const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { value: 'all', label: 'Todos', variant: 'secondary' },
  { value: 'running', label: 'Em progresso', variant: 'default' },
  { value: 'completed', label: 'Concluido', variant: 'outline' },
  { value: 'failed', label: 'Erro', variant: 'destructive' },
]

// ============================================================================
// Helpers puros (sem dependencia de React)
// ============================================================================

/** Formata data ISO para formato brasileiro */
export function formatarData(dataStr: string): string {
  try {
    return new Date(dataStr).toLocaleString('pt-BR')
  } catch {
    return dataStr
  }
}

/** Formata numero como porcentagem */
export function formatarPct(valor: number): string {
  return `${(valor * 100).toFixed(2)}%`
}

/** Retorna cor do nivel de log para o terminal */
export function logLevelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-400'
    case 'warning':
      return 'text-yellow-400'
    case 'debug':
      return 'text-gray-500'
    default:
      return 'text-green-400'
  }
}

/** Configuracao visual do StatusBadge, mapeado por status do job */
export const STATUS_BADGE_CONFIG: Record<
  TrainingJob['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  queued: { label: 'Na fila', variant: 'secondary' },
  running: { label: 'Executando', variant: 'default' },
  completed: { label: 'Concluido', variant: 'outline' },
  failed: { label: 'Falhou', variant: 'destructive' },
  stopping: { label: 'Parando', variant: 'secondary' },
  stopped: { label: 'Parado', variant: 'secondary' },
}
