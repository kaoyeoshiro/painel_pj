// Modelos de dados compartilhados

/** Processo judicial */
export interface Processo {
  numero_cnj: string
  classe?: string
  assuntos?: string[]
  partes?: Parte[]
}

/** Parte processual */
export interface Parte {
  nome: string
  tipo: string
  polo: 'ativo' | 'passivo'
}
