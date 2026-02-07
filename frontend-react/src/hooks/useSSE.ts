import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/api'

// Hook para conexoes Server-Sent Events (streaming de IA)
interface SSEOptions<T> {
  url: string
  token?: string
  onMessage: (data: T) => void
  onError?: (error: Event) => void
  onComplete?: () => void
  enabled?: boolean
  reconnect?: boolean
  maxRetries?: number
}

interface SSEReturn {
  isConnected: boolean
  isLoading: boolean
  error: string | null
  connect: () => void
  disconnect: () => void
}

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
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)
  const mountedRef = useRef(true)

  // Refs estáveis para callbacks
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  const onCompleteRef = useRef(onComplete)
  onMessageRef.current = onMessage
  onErrorRef.current = onError
  onCompleteRef.current = onComplete

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

      // Verifica se e mensagem de finalizacao
      if (event.data === '[DONE]') {
        onCompleteRef.current?.()
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

      // Tenta reconectar se habilitado
      if (reconnect && retriesRef.current < maxRetries) {
        retriesRef.current++
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000)
        setTimeout(() => {
          if (mountedRef.current) connect()
        }, delay)
      } else {
        setError('Conexao SSE perdida')
        disconnect()
      }
    }
  }, [url, customToken, disconnect, reconnect, maxRetries])

  // Conecta automaticamente quando enabled
  useEffect(() => {
    if (enabled) {
      connect()
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
