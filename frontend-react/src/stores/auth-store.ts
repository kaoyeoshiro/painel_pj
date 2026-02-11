import { create } from 'zustand'
import { getToken, setToken, clearToken, apiRequest } from '@/lib/api'
import { assertSchema } from '@/lib/schema-validator'
import { TokenSchema, UserMeSchema } from '@/types/generated/schemas.gen'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Estado explicito de autenticacao — evita UI zombie/flicker */
export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

interface User {
  id: number
  username: string
  full_name: string
  role: string
  is_admin: boolean
}

interface AuthState {
  status: AuthStatus
  token: string | null
  user: User | null
  error: string | null

  // Derivados (compat) — sempre em sincronia com `status`
  isAuthenticated: boolean
  isLoading: boolean

  // Acoes
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  initialize: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveFromStatus(status: AuthStatus) {
  return {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'unknown',
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let _initialized = false

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'unknown',
  token: getToken(),
  user: null,
  error: null,
  ...deriveFromStatus('unknown'),

  /** Faz login com username e senha */
  login: async (username: string, password: string) => {
    set({ status: 'unknown', error: null, ...deriveFromStatus('unknown') })
    try {
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)

      const response = await apiRequest<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: formData,
        skipAuth: true,
      })

      // Validacao runtime — garante que o backend retornou o shape esperado
      assertSchema(response, TokenSchema, 'POST /auth/login')

      setToken(response.access_token)
      set({ token: response.access_token })

      await get().loadUser()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login'
      set({ error: message, status: 'unauthenticated', ...deriveFromStatus('unauthenticated') })
      throw error
    }
  },

  /** Faz logout, limpa estado e redireciona */
  logout: () => {
    clearToken()
    _initialized = false
    set({
      token: null,
      user: null,
      status: 'unauthenticated',
      error: null,
      ...deriveFromStatus('unauthenticated'),
    })
    window.location.href = '/login'
  },

  /** Carrega dados do usuario a partir do token */
  loadUser: async () => {
    try {
      const data = await apiRequest<{ id: number; username: string; full_name: string; role: string }>('/auth/me', { method: 'GET' })

      // Validacao runtime — garante shape esperado da resposta de usuario
      assertSchema(data, UserMeSchema, 'GET /auth/me')

      set({
        user: { ...data, is_admin: data.role === 'admin' },
        status: 'authenticated',
        error: null,
        ...deriveFromStatus('authenticated'),
      })
    } catch {
      clearToken()
      set({
        token: null,
        user: null,
        status: 'unauthenticated',
        ...deriveFromStatus('unauthenticated'),
      })
    }
  },

  /** Inicializa o store — chamada uma unica vez no boot do app */
  initialize: async () => {
    if (_initialized) return
    _initialized = true

    const token = getToken()
    if (!token) {
      set({ status: 'unauthenticated', ...deriveFromStatus('unauthenticated') })
      return
    }
    set({ status: 'unknown', token, ...deriveFromStatus('unknown') })
    await get().loadUser()
  },
}))
