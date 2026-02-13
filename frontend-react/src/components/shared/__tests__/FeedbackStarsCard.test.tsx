import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { FeedbackStarsCard } from '../FeedbackStarsCard'

describe('FeedbackStarsCard', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isSubmitting: false,
    isSubmitted: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 5 stars', () => {
    render(<FeedbackStarsCard {...defaultProps} />)
    const stars = screen.getAllByRole('radio')
    expect(stars).toHaveLength(5)
  })

  it('renders title', () => {
    render(<FeedbackStarsCard {...defaultProps} />)
    expect(screen.getByText('Avalie esta geracao')).toBeInTheDocument()
  })

  it('shows comment field after selecting a star', async () => {
    render(<FeedbackStarsCard {...defaultProps} />)

    // No comment field initially
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    // Click star 4
    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[3])

    // Comment field should appear
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows "Comentario (opcional)" for nota >= 4', async () => {
    render(<FeedbackStarsCard {...defaultProps} />)

    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[3]) // star 4

    expect(screen.getByText('Comentario (opcional)')).toBeInTheDocument()
  })

  it('shows "Comentario obrigatorio" for nota <= 3', async () => {
    render(<FeedbackStarsCard {...defaultProps} />)

    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[1]) // star 2

    expect(screen.getByText('Comentario obrigatorio')).toBeInTheDocument()
  })

  it('submit button is disabled when nota <= 3 and no comment', async () => {
    render(<FeedbackStarsCard {...defaultProps} />)

    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[1]) // star 2

    const btn = screen.getByRole('button', { name: /enviar/i })
    expect(btn).toBeDisabled()
  })

  it('submit button is enabled when nota >= 4 without comment', async () => {
    render(<FeedbackStarsCard {...defaultProps} />)

    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[3]) // star 4

    const btn = screen.getByRole('button', { name: /enviar/i })
    expect(btn).toBeEnabled()
  })

  it('submit button is enabled when nota <= 3 with comment', async () => {
    render(<FeedbackStarsCard {...defaultProps} />)

    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[0]) // star 1

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'motivo do feedback')

    const btn = screen.getByRole('button', { name: /enviar/i })
    expect(btn).toBeEnabled()
  })

  it('calls onSubmit with correct data', async () => {
    const onSubmit = vi.fn()
    render(<FeedbackStarsCard {...defaultProps} onSubmit={onSubmit} />)

    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[4]) // star 5

    const btn = screen.getByRole('button', { name: /enviar/i })
    await userEvent.click(btn)

    expect(onSubmit).toHaveBeenCalledWith({
      nota: 5,
      comentario: null,
    })
  })

  it('calls onSubmit with comment when provided', async () => {
    const onSubmit = vi.fn()
    render(<FeedbackStarsCard {...defaultProps} onSubmit={onSubmit} />)

    const stars = screen.getAllByRole('radio')
    await userEvent.click(stars[1]) // star 2

    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'precisa melhorar')

    const btn = screen.getByRole('button', { name: /enviar/i })
    await userEvent.click(btn)

    expect(onSubmit).toHaveBeenCalledWith({
      nota: 2,
      comentario: 'precisa melhorar',
    })
  })

  it('shows success state when isSubmitted', () => {
    render(<FeedbackStarsCard {...defaultProps} isSubmitted />)

    expect(screen.getByText(/enviada com sucesso/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('shows loading state when isSubmitting', async () => {
    render(<FeedbackStarsCard {...defaultProps} isSubmitting />)

    // Stars should be disabled
    const stars = screen.getAllByRole('radio')
    stars.forEach((star) => {
      expect(star).toBeDisabled()
    })
  })

  it('has proper aria-labels on stars', () => {
    render(<FeedbackStarsCard {...defaultProps} />)

    expect(screen.getByLabelText('1 estrela')).toBeInTheDocument()
    expect(screen.getByLabelText('2 estrelas')).toBeInTheDocument()
    expect(screen.getByLabelText('5 estrelas')).toBeInTheDocument()
  })

  it('has radiogroup role', () => {
    render(<FeedbackStarsCard {...defaultProps} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })
})
