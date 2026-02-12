/* eslint-disable react-refresh/only-export-components -- Arquivo de utilitário de teste; exporta wrapper + re-export de @testing-library */
/**
 * Utilitario de teste que fornece QueryClientProvider para componentes
 * que usam useQuery diretamente do @tanstack/react-query.
 *
 * Uso: import { render, screen } from '@/test/test-utils'
 */

import { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestProviders, ...options })
}

// Re-exporta tudo de @testing-library/react, sobrescrevendo render
export * from '@testing-library/react'
export { customRender as render }
