// Cliente API tipado para o Portal PGE-MS

const API_BASE = ''

/** Busca token do localStorage */
export function getToken(): string | null {
  return (
    localStorage.getItem('access_token') ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token')
  )
}

/** Salva token no localStorage */
export function setToken(token: string): void {
  localStorage.setItem('access_token', token)
  localStorage.setItem('auth_token', token)
}

/** Remove token do localStorage */
export function clearToken(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth_token')
}

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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers,
    body: processedBody,
  })

  // Trata 401 — token invalido/expirado
  if (response.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Sessao expirada')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }))
    const detail = errorData.detail
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg || String(d)).join('; ')
      : detail || `Erro ${response.status}`
    throw new Error(message)
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
