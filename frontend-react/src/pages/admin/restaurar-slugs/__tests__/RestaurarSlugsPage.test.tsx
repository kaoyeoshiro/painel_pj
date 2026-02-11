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

    expect(screen.getByRole('heading', { name: /Restaurar Slugs/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Restaurar Slugs/i })).toBeInTheDocument()
  })

  it('has default categoria_id of 5', () => {
    render(<RestaurarSlugsPage />)

    const input = screen.getByDisplayValue('5') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('number')
    expect(input.value).toBe('5')
  })

  it('button shows correct text', () => {
    render(<RestaurarSlugsPage />)

    const button = screen.getByRole('button', { name: /Restaurar Slugs/i })
    expect(button).toHaveTextContent('Restaurar Slugs')
  })

  it('displays warning alert about recovery tool', () => {
    render(<RestaurarSlugsPage />)

    expect(screen.getByText(/Esta ferramenta restaura os slugs/i)).toBeInTheDocument()
  })

  it('displays Categoria ID label and input', () => {
    render(<RestaurarSlugsPage />)

    expect(screen.getByText('Categoria ID:')).toBeInTheDocument()
    const input = screen.getByDisplayValue('5') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('number')
  })
})
