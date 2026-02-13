// Tipos TypeScript para o sistema de Treinamento BERT
//
// Estes tipos espelham os schemas Pydantic do backend:
// - DatasetListItem, RunListItem, MetricResponse, etc.
// Adaptadores em useBertTraining.ts convertem as respostas da API.

/** Dataset disponivel para treinamento (espelha DatasetListItem do backend) */
export interface Dataset {
  id: number
  filename: string
  sha256_hash: string
  task_type: string
  total_rows: number
  total_labels: number | null
  uploaded_at: string
}

/** Run de treinamento BERT (espelha RunListItem do backend) */
export interface TrainingJob {
  id: number
  name: string
  task_type: string
  base_model: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopping' | 'stopped'
  final_accuracy: number | null
  final_macro_f1: number | null
  created_at: string
  completed_at: string | null
}

/** Metrica individual por epoca (espelha MetricResponse do backend) */
export interface EpochMetric {
  id: number
  run_id: number
  epoch: number
  train_loss: number | null
  val_loss: number | null
  val_accuracy: number | null
  val_macro_f1: number | null
  val_weighted_f1: number | null
  recorded_at: string
}

/** Metricas agregadas para graficos (derivado de EpochMetric[]) */
export interface TrainingMetrics {
  accuracy: number
  f1_score: number
  precision: number
  recall: number
  loss: number
  val_accuracy?: number
  val_loss?: number
  historico_loss: number[]
  historico_accuracy: number[]
  historico_val_loss?: number[]
  historico_val_accuracy?: number[]
  confusion_matrix?: number[][]
  labels?: string[]
}

/** Modelo treinado disponivel para inferencia (espelha /models/completed) */
export interface ModelInfo {
  id: number
  name: string
  description: string | null
  base_model: string
  final_accuracy: number | null
  f1_score: number | null
  completed_at: string | null
  dataset_name: string | null
  total_labels: number | null
  labels: string[]
}

/** Resultado de predicao individual */
export interface PredictionResult {
  texto: string
  categoria_predita: string
  confianca: number
  todas_categorias: Array<{ categoria: string; probabilidade: number }>
}

/** Resultado de comparacao BERT vs LLM */
export interface ComparisonResult {
  texto: string
  bert_resultado: { categoria: string; confianca: number }
  llm_resultado: { categoria: string; confianca: number }
  concordam: boolean
}

/** Configuracao de hiperparametros para treinamento */
export interface TrainingConfig {
  modelo_base: string
  learning_rate: number
  batch_size: number
  num_epochs: number
  max_length: number
}
