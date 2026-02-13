import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfigPecasPage } from '../ConfigPecasPage'
import { createApiClient } from '@/lib/api'

// Mock do createApiClient with actual mock functions created in factory
vi.mock('@/lib/api', () => {
  const mockApiInstance = {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({})
  }

  return {
    createApiClient: vi.fn(() => mockApiInstance),
    getToken: vi.fn(() => null),
  }
})

// Mock do useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock do window.confirm
vi.stubGlobal('confirm', vi.fn(() => true))

describe('ConfigPecasPage', () => {
  it('deve renderizar a página com estrutura básica', () => {
    render(<ConfigPecasPage />)

    expect(screen.getByText('Configuração de Peças')).toBeInTheDocument()
    // Subtítulo removido na refatoração visual — verificar tab "Categorias de Documentos"
    expect(screen.getByRole('tab', { name: /categorias de documentos/i })).toBeInTheDocument()
  })

  it('deve renderizar as tabs de categorias e tipos', () => {
    render(<ConfigPecasPage />)

    expect(screen.getByRole('tab', { name: /categorias de documentos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /tipos de peça/i })).toBeInTheDocument()
  })

  it('deve renderizar botão Nova Categoria', () => {
    render(<ConfigPecasPage />)

    expect(screen.getByRole('button', { name: /nova categoria/i })).toBeInTheDocument()
  })

  it('deve chamar createApiClient com o endpoint correto', () => {
    render(<ConfigPecasPage />)

    expect(vi.mocked(createApiClient)).toHaveBeenCalledWith('/api/gerador-pecas/config')
  })

  it('deve criar instância do cliente API ao montar', () => {
    render(<ConfigPecasPage />)

    expect(createApiClient).toHaveBeenCalled()
  })
})
