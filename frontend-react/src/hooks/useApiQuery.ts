import { useCallback, useEffect, useRef, useState } from 'react'

// Hook generico para chamadas API com estado de loading/error/data
interface UseApiQueryOptions<T> {
  enabled?: boolean
  refetchInterval?: number
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
}

interface UseApiQueryReturn<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useApiQuery<T>(
  queryFn: () => Promise<T>,
  options: UseApiQueryOptions<T> = {}
): UseApiQueryReturn<T> {
  const { enabled = true, refetchInterval, onSuccess, onError } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const queryFnRef = useRef(queryFn)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  queryFnRef.current = queryFn
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await queryFnRef.current()
      if (mountedRef.current) {
        setData(result)
        setIsLoading(false)
        onSuccessRef.current?.(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        setError(message)
        setIsLoading(false)
        onErrorRef.current?.(message)
      }
    }
  }, [])

  // Executa ao montar (se enabled)
  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [enabled, fetchData])

  // Refetch periodico
  useEffect(() => {
    if (!refetchInterval || !enabled) return

    const interval = setInterval(fetchData, refetchInterval)
    return () => clearInterval(interval)
  }, [refetchInterval, enabled, fetchData])

  // Cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { data, isLoading, error, refetch: fetchData }
}
