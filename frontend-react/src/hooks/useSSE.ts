import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/api'
import type { QueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface SSEOptions<T> {
  url: string
  token?: string
  onMessage: (data: T) => void
  onError?: (error: Event) => void
  onComplete?: () => void
  enabled?: boolean
  reconnect?: boolean
  maxRetries?: number

  /**
   * Integracao com TanStack Query.
   * Ao final do streaming ([DONE]), invalida as query keys listadas.
   *
   * Politica:
   * - Durante o streaming: componente atualiza estado local via onMessage
   * - Ao completar: invalida queries para sincronizar cache server-side
   */
  queryClient?: QueryClient
  invalidateOnComplete?: readonly (readonly unknown[])[]
}

interface SSEReturn {
  isConnected: boolean
  isLoading: boolean
  error: string | null
  connect: () => void
  disconnect: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSSE<T>(options: SSEOptions<T>): SSEReturn {
  const {
    url,
    token: customToken,
    onMessage,
    onError,
    onComplete,
    enabled = true,
    reconnect = false,
    maxRetries = 3,
    queryClient,
    invalidateOnComplete,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)
  const mountedRef = useRef(true)

  // Refs estaveis para callbacks (atualizados via effect — React 19)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  const onCompleteRef = useRef(onComplete)
  const queryClientRef = useRef(queryClient)
  const invalidateKeysRef = useRef(invalidateOnComplete)
  const connectRef = useRef<() => void>(() => {})

  useEffect(() => {
    onMessageRef.current = onMessage
    onErrorRef.current = onError
    onCompleteRef.current = onComplete
    queryClientRef.current = queryClient
    invalidateKeysRef.current = invalidateOnComplete
  })

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
    setIsLoading(false)
  }, [])

  const connect = useCallback(() => {
    // Fecha conexao anterior se existir
    disconnect()

    const token = customToken || getToken()
    const separator = url.includes('?') ? '&' : '?'
    const fullUrl = token ? `${url}${separator}token=${token}` : url

    setIsLoading(true)
    setError(null)

    const es = new EventSource(fullUrl)
    eventSourceRef.current = es

    es.onopen = () => {
      if (!mountedRef.current) return
      setIsConnected(true)
      retriesRef.current = 0
    }

    es.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return
      setIsLoading(false)

      // Mensagem de finalizacao
      if (event.data === '[DONE]') {
        onCompleteRef.current?.()

        // Invalida queries relacionadas ao final do streaming
        if (queryClientRef.current && invalidateKeysRef.current) {
          for (const key of invalidateKeysRef.current) {
            queryClientRef.current.invalidateQueries({ queryKey: key as unknown[] })
          }
        }

        disconnect()
        return
      }

      try {
        const data = JSON.parse(event.data) as T
        onMessageRef.current(data)
      } catch {
        // Se nao for JSON, passa como string
        onMessageRef.current(event.data as unknown as T)
      }
    }

    es.onerror = (event: Event) => {
      if (!mountedRef.current) return

      setIsConnected(false)
      setIsLoading(false)

      onErrorRef.current?.(event)

      // Tenta reconectar se habilitado via ref (evita referencia circular)
      if (reconnect && retriesRef.current < maxRetries) {
        retriesRef.current++
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000)
        setTimeout(() => {
          if (mountedRef.current) connectRef.current()
        }, delay)
      } else {
        setError('Conexao SSE perdida')
        disconnect()
      }
    }
  }, [url, customToken, disconnect, reconnect, maxRetries])

  // Mantém ref atualizado para reconexao sem referencia circular
  useEffect(() => {
    connectRef.current = connect
  })

  // Conecta automaticamente quando enabled (setState no connect e intencional)
  useEffect(() => {
    if (enabled) {
      connect() // eslint-disable-line react-hooks/set-state-in-effect -- SSE precisa setar loading ao conectar
    }
    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  // Cleanup no unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { isConnected, isLoading, error, connect, disconnect }
}
