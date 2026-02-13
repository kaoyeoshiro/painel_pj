import { describe, it, expect, beforeEach } from 'vitest'
import { getToken, setToken, clearToken } from '../api'

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('getToken retorna null quando nao ha token', () => {
    expect(getToken()).toBeNull()
  })

  it('setToken salva e getToken recupera o token', () => {
    setToken('meu-token-123')
    expect(getToken()).toBe('meu-token-123')
    // Token e salvo apenas na chave principal (access_token)
    expect(localStorage.getItem('access_token')).toBe('meu-token-123')
  })

  it('getToken le chave legada auth_token como fallback', () => {
    localStorage.setItem('auth_token', 'legacy-token')
    expect(getToken()).toBe('legacy-token')
  })

  it('clearToken remove o token', () => {
    setToken('meu-token-123')
    clearToken()
    expect(getToken()).toBeNull()
  })
})
