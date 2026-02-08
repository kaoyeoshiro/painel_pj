import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RestaurarSlugsPage } from '../RestaurarSlugsPage'

vi.mock('@/lib/api', () => ({
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getToken: vi.fn(() => null),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe('RestaurarSlugsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page with title and button', () => {
    render(<RestaurarSlugsPage />)

    expect(screen.getByRole('heading', { name: 'Restaurar Slugs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restaurar Slugs' })).toBeInTheDocument()
  })

  it('has default categoria_id of 5', () => {
    render(<RestaurarSlugsPage />)

    const input = screen.getByLabelText('ID da Categoria') as HTMLInputElement
    expect(input.value).toBe('5')
  })

  it('button shows correct text', () => {
    render(<RestaurarSlugsPage />)

    const button = screen.getByRole('button', { name: 'Restaurar Slugs' })
    expect(button).toHaveTextContent('Restaurar Slugs')
  })

  it('displays warning alert about recovery tool', () => {
    render(<RestaurarSlugsPage />)

    expect(screen.getByText(/Esta é uma ferramenta de recuperação/i)).toBeInTheDocument()
    expect(screen.getByText(/Use apenas se houver perda de dados/i)).toBeInTheDocument()
  })

  it('allows changing categoria_id input', () => {
    render(<RestaurarSlugsPage />)

    const input = screen.getByLabelText('ID da Categoria') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('number')
  })
})
