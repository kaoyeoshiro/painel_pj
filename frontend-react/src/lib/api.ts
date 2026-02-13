// Cliente API tipado para o Portal PGE-MS

const API_BASE = ''

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/** Chave principal de armazenamento do token */
const TOKEN_KEY = 'access_token'

/** Chaves legadas mantidas para leitura (compatibilidade com sessoes existentes) */
const LEGACY_KEYS = ['auth_token'] as const

/** Busca token do localStorage */
export function getToken(): string | null {
  return (
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(LEGACY_KEYS[0]) ||
    sessionStorage.getItem(LEGACY_KEYS[0])
  )
}

/** Salva token no localStorage (apenas chave principal) */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Remove token de todas as chaves conhecidas */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  // Limpa chaves legadas tambem
  localStorage.removeItem(LEGACY_KEYS[0])
  sessionStorage.removeItem(LEGACY_KEYS[0])
}

// ---------------------------------------------------------------------------
// Guard contra redirect duplicado em 401
// ---------------------------------------------------------------------------

let _redirectingTo401 = false

/** Reseta flag de redirect (usado em testes) */
export function _resetRedirectGuard(): void {
  _redirectingTo401 = false
}

// ---------------------------------------------------------------------------
// ApiError — erro tipado para respostas HTTP
// ---------------------------------------------------------------------------

export interface ValidationError {
  loc: (string | number)[]
  msg: string
  type: string
}

/**
 * Erro estruturado da API. Captura status HTTP, mensagem e erros de validacao.
 *
 * Uso em catch:
 * ```ts
 * try { await apiRequest(...) }
 * catch (e) {
 *   if (e instanceof ApiError && e.status === 422) { ... }
 * }
 * ```
 */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly validationErrors: ValidationError[]

  constructor(
    status: number,
    detail: string,
    validationErrors: ValidationError[] = [],
  ) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.validationErrors = validationErrors
  }

  get isUnauthorized(): boolean { return this.status === 401 }
  get isValidation(): boolean { return this.status === 422 }
  get isServerError(): boolean { return this.status >= 500 }
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

type ResponseType = 'json' | 'blob' | 'text'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  responseType?: ResponseType
  skipAuth?: boolean
}

/** Faz uma requisicao API com autenticacao automatica */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, responseType = 'json', skipAuth = false, headers: customHeaders, ...rest } = options

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  }

  // Adiciona autorizacao se houver token
  if (!skipAuth) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  // Se body for objeto, serializa como JSON
  let processedBody: BodyInit | undefined
  if (body !== undefined) {
    if (body instanceof FormData || body instanceof URLSearchParams) {
      processedBody = body
    } else {
      headers['Content-Type'] = 'application/json'
      processedBody = JSON.stringify(body)
    }
  }

  const fetchOptions: RequestInit = { ...rest, headers }
  if (processedBody !== undefined) {
    fetchOptions.body = processedBody
  }

  const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions)

  // Trata 401 — token invalido/expirado (com guard contra redirect duplicado)
  if (response.status === 401) {
    clearToken()
    if (!_redirectingTo401) {
      _redirectingTo401 = true
      window.location.href = '/login'
    }
    throw new ApiError(401, 'Sessao expirada')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    const detail = errorData.detail

    // 422 — erros de validacao (FastAPI retorna array em detail)
    if (response.status === 422 && Array.isArray(detail)) {
      const validationErrors: ValidationError[] = detail.map(
        (d: { loc?: (string | number)[]; msg?: string; type?: string }) => ({
          loc: d.loc ?? [],
          msg: d.msg ?? String(d),
          type: d.type ?? 'value_error',
        }),
      )
      const message = validationErrors.map(v => v.msg).join('; ')
      throw new ApiError(422, message, validationErrors)
    }

    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg || String(d)).join('; ')
      : detail || `Erro ${response.status}`
    throw new ApiError(response.status, message)
  }

  // Retorna conforme o tipo solicitado
  if (responseType === 'blob') {
    return response.blob() as Promise<T>
  }
  if (responseType === 'text') {
    return response.text() as Promise<T>
  }
  return response.json() as Promise<T>
}

/** Cria um cliente API com baseUrl pre-configurado */
export function createApiClient(baseUrl: string) {
  return {
    get<T>(path: string, options?: RequestOptions) {
      return apiRequest<T>(`${baseUrl}${path}`, { ...options, method: 'GET' })
    },
    post<T>(path: string, body?: unknown, options?: RequestOptions) {
      return apiRequest<T>(`${baseUrl}${path}`, { ...options, method: 'POST', body })
    },
    put<T>(path: string, body?: unknown, options?: RequestOptions) {
      return apiRequest<T>(`${baseUrl}${path}`, { ...options, method: 'PUT', body })
    },
    patch<T>(path: string, body?: unknown, options?: RequestOptions) {
      return apiRequest<T>(`${baseUrl}${path}`, { ...options, method: 'PATCH', body })
    },
    delete<T>(path: string, options?: RequestOptions) {
      return apiRequest<T>(`${baseUrl}${path}`, { ...options, method: 'DELETE' })
    },
    blob(path: string, options?: RequestOptions) {
      return apiRequest<Blob>(`${baseUrl}${path}`, { ...options, method: 'GET', responseType: 'blob' })
    },
  }
}

// Clientes pre-configurados para cada sistema
export const authApi = createApiClient('/auth')
export const usersApi = createApiClient('/users')
export const adminApi = createApiClient('')
export const geradorApi = createApiClient('/gerador-pecas/api')
export const geradorAdminApi = createApiClient('/gerador-pecas-admin')
export const classificadorApi = createApiClient('/classificador/api')
export const extratorApi = createApiClient('/extrator-autos/api')
export const pedidoCalculoApi = createApiClient('/pedido-calculo/api')
export const pedidoCalculoAdminApi = createApiClient('/pedido-calculo-admin')
export const prestacaoContasApi = createApiClient('/prestacao-contas/api')
export const relatorioCumprimentoApi = createApiClient('/relatorio-cumprimento/api')
export const cumprimentoBetaApi = createApiClient('/cumprimento-beta/api')
export const assistenciaApi = createApiClient('/assistencia/api')
export const matriculasApi = createApiClient('/matriculas/api')
export const bertApi = createApiClient('/bert-training/api')
