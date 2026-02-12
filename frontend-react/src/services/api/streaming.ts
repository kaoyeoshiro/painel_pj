/**
 * Servico compartilhado para streaming SSE via POST (fetch + ReadableStream).
 *
 * Diferente do hook useSSE (que usa EventSource para GET), este modulo
 * trata o padrao POST-based SSE usado pelos pipelines do Portal PGE:
 *   fetch → getReader → TextDecoder → split linhas → parse "data: {...}"
 *
 * Uso:
 *   const { start, abort } = useStreamingFetch<MeuEvento>({
 *     onEvent: (evento) => { ... },
 *     onError: (err) => { ... },
 *     onComplete: () => { ... },
 *   })
 *
 *   await start('/api/processar-stream', { numero_cnj: '...' })
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/api'

// ---------------------------------------------------------------------------
// Tipos publicos
// ---------------------------------------------------------------------------

/** Evento SSE parseado de uma linha "data: {...}" */
export interface SSEParsedLine {
  raw: string
  data: unknown
}

/** Opcoes para uma chamada de streaming */
export interface StreamingFetchOptions {
  /** Metodo HTTP (padrao: POST) */
  method?: 'POST' | 'GET'
  /** Headers adicionais */
  headers?: Record<string, string>
  /** AbortSignal externo (opcional — o hook ja cria um interno) */
  signal?: AbortSignal
}

/** Configuracao do hook useStreamingFetch */
export interface UseStreamingFetchConfig<T> {
  /** Callback chamado para cada evento SSE parseado */
  onEvent: (event: T) => void
  /** Callback de erro (fetch falhou, stream quebrou, etc) */
  onError?: (error: Error) => void
  /** Callback chamado quando o stream termina normalmente */
  onComplete?: () => void
}

/** Retorno do hook useStreamingFetch */
export interface UseStreamingFetchReturn {
  /** Inicia o streaming para uma URL com body JSON */
  start: (url: string, body?: Record<string, unknown>, options?: StreamingFetchOptions) => Promise<void>
  /** Inicia o streaming para uma URL com FormData (ex: upload de PDF) */
  startFormData: (url: string, formData: FormData, options?: StreamingFetchOptions) => Promise<void>
  /** Aborta o streaming em andamento */
  abort: () => void
  /** Indica se ha um streaming ativo */
  isStreaming: boolean
}

// ---------------------------------------------------------------------------
// Funcoes utilitarias puras (exportadas para uso direto sem hook)
// ---------------------------------------------------------------------------

/**
 * Parseia uma unica linha SSE no formato "data: {...}".
 * Retorna o objeto parseado ou null se a linha nao for valida.
 *
 * Ignora linhas vazias, comentarios (":") e sentinelas como "[DONE]".
 */
export function parseSSELine<T = unknown>(line: string): T | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':')) return null
  if (!trimmed.startsWith('data: ')) return null

  const jsonStr = trimmed.slice(6).trim()
  if (!jsonStr || jsonStr === '[DONE]') return null

  try {
    return JSON.parse(jsonStr) as T
  } catch {
    return null
  }
}

/**
 * Le um ReadableStream de SSE e chama onEvent para cada evento parseado.
 *
 * Esta e a funcao core que elimina a duplicacao de:
 *   getReader → TextDecoder → buffer → split → parse "data:" → callback
 *
 * Suporta ambos os formatos de separador usados no backend:
 *   - "\n\n" (padrao SSE — PedidoCalculo, PrestacaoContas, GeradorPecas)
 *   - "\n" simples (RelatorioCumprimento, ExtratorAutos)
 *
 * A heuristica e: splitamos por "\n", e linhas "data: " sao parseadas individualmente.
 * Linhas vazias entre blocos sao simplesmente ignoradas pelo parseSSELine.
 */
export async function readSSEStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: T) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Separa por "\n" — funciona tanto para "\n\n" quanto para "\n" simples.
    // Linhas "data: {...}" sao parseadas; linhas vazias sao ignoradas.
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const parsed = parseSSELine<T>(line)
      if (parsed !== null) {
        onEvent(parsed)
      }
    }
  }

  // Processa buffer residual (pode conter ultimo evento sem newline final)
  if (buffer.trim()) {
    const parsed = parseSSELine<T>(buffer)
    if (parsed !== null) {
      onEvent(parsed)
    }
  }
}

/**
 * Executa um fetch SSE completo: fetch → valida resposta → le stream.
 *
 * Parametros:
 *   - url: endpoint SSE
 *   - body: BodyInit (string JSON ou FormData)
 *   - headers: headers da requisicao
 *   - signal: AbortSignal para cancelamento
 *   - onEvent: callback para cada evento parseado
 *
 * Lanca erro em caso de:
 *   - response.ok === false (com mensagem do backend)
 *   - response.body nulo (navegador sem suporte a streams)
 *   - AbortError (cancelamento intencional — propagado para o chamador tratar)
 */
export async function fetchSSEStream<T>(options: {
  url: string
  body: BodyInit
  headers: Record<string, string>
  signal?: AbortSignal
  onEvent: (event: T) => void
}): Promise<void> {
  const { url, body, headers, signal, onEvent } = options

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(errorData.detail || `Erro ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Erro ao iniciar streaming')
  }

  await readSSEStream(reader, onEvent)
}

// ---------------------------------------------------------------------------
// Hook React: useStreamingFetch
// ---------------------------------------------------------------------------

/**
 * Hook que encapsula todo o boilerplate de streaming SSE via POST.
 *
 * Gerencia:
 *   - AbortController (criacao e limpeza)
 *   - Estado isStreaming
 *   - Token de autenticacao (via getToken())
 *   - Tratamento de AbortError vs erros reais
 *
 * Exemplo:
 *   const { start, abort, isStreaming } = useStreamingFetch<SSEEvent>({
 *     onEvent: (ev) => processarEvento(ev),
 *     onError: (err) => toast({ title: 'Erro', description: err.message }),
 *     onComplete: () => refetchHistorico(),
 *   })
 */
export function useStreamingFetch<T>(
  config: UseStreamingFetchConfig<T>,
): UseStreamingFetchReturn {
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Refs estaveis para callbacks (evita re-renders desnecessarios)
  const onEventRef = useRef(config.onEvent)
  const onErrorRef = useRef(config.onError)
  const onCompleteRef = useRef(config.onComplete)
  onEventRef.current = config.onEvent
  onErrorRef.current = config.onError
  onCompleteRef.current = config.onComplete

  /** Aborta streaming em andamento */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  // Cleanup: aborta stream ativo ao desmontar o componente
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  /** Execucao interna do fetch SSE */
  const executeStream = useCallback(async (
    url: string,
    body: BodyInit,
    extraHeaders: Record<string, string>,
    externalSignal?: AbortSignal,
  ) => {
    // Aborta streaming anterior se existir
    abort()

    const controller = new AbortController()
    abortControllerRef.current = controller

    // Combina signal interno com signal externo (se fornecido)
    const signal = externalSignal
      ? composeAbortSignals(controller.signal, externalSignal)
      : controller.signal

    setIsStreaming(true)

    try {
      const token = getToken()
      const headers: Record<string, string> = {
        ...extraHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      await fetchSSEStream<T>({
        url,
        body,
        headers,
        signal,
        onEvent: (event) => onEventRef.current(event),
      })

      onCompleteRef.current?.()
    } catch (error) {
      // AbortError = cancelamento intencional, nao propaga como erro
      if ((error as Error).name === 'AbortError') {
        return
      }
      onErrorRef.current?.(error as Error)
      throw error
    } finally {
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }, [abort])

  /** Inicia streaming com body JSON */
  const start = useCallback(async (
    url: string,
    body?: Record<string, unknown>,
    options?: StreamingFetchOptions,
  ) => {
    await executeStream(
      url,
      JSON.stringify(body ?? {}),
      { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
      options?.signal,
    )
  }, [executeStream])

  /** Inicia streaming com FormData (upload de arquivos) */
  const startFormData = useCallback(async (
    url: string,
    formData: FormData,
    options?: StreamingFetchOptions,
  ) => {
    // Nao seta Content-Type — o browser define com boundary automaticamente
    await executeStream(
      url,
      formData,
      options?.headers ?? {},
      options?.signal,
    )
  }, [executeStream])

  return { start, startFormData, abort, isStreaming }
}

// ---------------------------------------------------------------------------
// Utilitario interno
// ---------------------------------------------------------------------------

/**
 * Combina dois AbortSignals — aborta quando qualquer um dos dois for abortado.
 * Necessario para suportar AbortController interno + signal externo do chamador.
 */
function composeAbortSignals(
  signal1: AbortSignal,
  signal2: AbortSignal,
): AbortSignal {
  // Se algum ja esta abortado, retorna ele direto
  if (signal1.aborted) return signal1
  if (signal2.aborted) return signal2

  const controller = new AbortController()

  const onAbort = () => controller.abort()
  signal1.addEventListener('abort', onAbort, { once: true })
  signal2.addEventListener('abort', onAbort, { once: true })

  return controller.signal
}
