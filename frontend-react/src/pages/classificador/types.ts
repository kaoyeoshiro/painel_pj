/**
 * Tipos locais, constantes e helpers do modulo Classificador de Documentos.
 *
 * Tipos de dominio (Prompt, Projeto, Resultado, etc.) ficam em
 * @/types/classificador — aqui ficam apenas helpers de apresentacao.
 */

// ============================================================================
// Helpers de formatacao
// ============================================================================

/** Data ISO -> dd/mm/aaaa */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

/** Formata bytes em B / KB / MB */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Variante de badge para confianca (alta, media, baixa) */
export function confiancaBadgeVariant(c: string): 'default' | 'secondary' | 'destructive' {
  if (c === 'alta') return 'default'
  if (c === 'media') return 'secondary'
  return 'destructive'
}

/** Variante de badge para status de execucao */
export function statusBadgeVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'concluido') return 'default'
  if (s === 'em_andamento' || s === 'pendente') return 'secondary'
  if (s === 'erro' || s === 'travado') return 'destructive'
  return 'outline'
}

/** Inicia download de Blob como arquivo */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
