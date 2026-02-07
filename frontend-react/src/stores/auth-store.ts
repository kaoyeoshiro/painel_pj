import { create } from 'zustand'
import { getToken, setToken, clearToken, apiRequest } from '@/lib/api'

// Tipos do usuario autenticado
interface User {
  id: number
  username: string
  nome: string
  is_admin: boolean
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Acoes
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getToken(),
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  /** Faz login com username e senha */
  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      // O endpoint /auth/token espera FormData (x-www-form-urlencoded)
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)

      const response = await apiRequest<{ access_token: string }>('/auth/token', {
        method: 'POST',
        body: formData,
        skipAuth: true,
      })

      setToken(response.access_token)
      set({ token: response.access_token })

      // Carrega dados do usuario apos login
      await get().loadUser()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  /** Faz logout, limpa estado e redireciona */
  logout: () => {
    clearToken()
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      error: null,
    })
    window.location.href = '/login'
  },

  /** Carrega dados do usuario a partir do token */
  loadUser: async () => {
    try {
      const user = await apiRequest<User>('/auth/me', { method: 'GET' })
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch {
      // Token invalido — limpa tudo
      clearToken()
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  /** Inicializa o store — chamada no inicio do app */
  initialize: async () => {
    const token = getToken()
    if (!token) {
      set({ isLoading: false })
      return
    }
    set({ isLoading: true, token })
    await get().loadUser()
  },
}))
