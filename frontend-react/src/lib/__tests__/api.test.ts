import { describe, it, expect, beforeEach } from 'vitest'
import { getToken, setToken, clearToken } from '../api'

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('getToken retorna null quando nao ha token', () => {
    expect(getToken()).toBeNull()
  })

  it('setToken salva e getToken recupera o token', () => {
    setToken('meu-token-123')
    expect(getToken()).toBe('meu-token-123')
  })

  it('clearToken remove o token', () => {
    setToken('meu-token-123')
    clearToken()
    expect(getToken()).toBeNull()
  })
})
