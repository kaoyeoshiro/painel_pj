import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ApiError } from '@/lib/api'

// Utilidade para mesclar classes CSS com Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Retorna mensagem amigavel para exibir ao usuario.
 *
 * Erros de servidor (5xx) retornam mensagem generica para evitar exposicao de detalhes internos.
 * Erros de cliente (4xx) preservam a mensagem da API (ja formatada pelo backend).
 * Erros desconhecidos retornam fallback generico.
 */
export function getUserFriendlyError(error: unknown, fallback = 'Erro inesperado'): string {
  if (error instanceof ApiError) {
    if (error.isServerError) {
      return 'Erro interno do servidor. Tente novamente em alguns minutos.'
    }
    return error.detail || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}
