// Tipos globais da API do Portal PGE-MS

/** Usuario autenticado */
export interface User {
  id: number
  username: string
  nome: string
  is_admin: boolean
}

/** Resposta de login */
export interface LoginResponse {
  access_token: string
  token_type: string
}

/** Resposta paginada generica */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

/** Resposta de erro da API */
export interface ApiError {
  detail: string
}
