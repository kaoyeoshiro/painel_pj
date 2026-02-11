import '@testing-library/jest-dom'
import { vi } from 'vitest'

/**
 * Mock global do TanStack Router para testes unitários.
 * Fornece implementações mínimas de Link, useNavigate e useRouterState
 * usados por componentes de layout (PageHeader, AdminSubNav).
 *
 * Testes que precisam de comportamento específico podem sobrescrever
 * este mock com vi.mock() local (que tem precedência).
 */
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) => {
    const state = { location: { pathname: '/test' } }
    return opts?.select ? opts.select(state) : state
  },
  Link: ({ children, to, ...props }: Record<string, unknown>) => {
    const { createElement } = require('react')
    return createElement('a', { href: to, ...props }, children)
  },
}))
