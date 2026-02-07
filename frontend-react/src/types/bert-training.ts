// Tipos TypeScript para o sistema de Treinamento BERT

/** Dataset disponivel para treinamento */
export interface Dataset {
  id: number
  nome: string
  descricao?: string
  total_exemplos: number
  categorias: string[]
  created_at: string
  status: 'ready' | 'processing' | 'error'
}

/** Job de treinamento BERT */
export interface TrainingJob {
  id: number
  dataset_id: number
  dataset_nome: string
  modelo_base: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopping' | 'stopped'
  progresso: number
  epoca_atual: number
  total_epocas: number
  metricas?: TrainingMetrics
  created_at: string
  updated_at: string
  erro?: string
}

/** Metricas de treinamento com historico para graficos */
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

/** Modelo treinado disponivel para inferencia */
export interface ModelInfo {
  id: number
  nome: string
  dataset_nome: string
  accuracy: number
  f1_score: number
  created_at: string
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
