// Utilitários para testes com TanStack Query

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'

// Cria um QueryClient para testes com configurações otimizadas
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Não retry em testes
        gcTime: 0, // Limpa cache imediatamente
        staleTime: 0, // Sempre considera stale
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Wrapper que provê o QueryClientProvider para componentes em teste
interface WrapperProps {
  children: React.ReactNode
}

export function createTestWrapper() {
  const queryClient = createTestQueryClient()
  
  return function TestWrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

// Render customizado que já inclui o QueryClientProvider
export function renderWithQuery(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const queryClient = createTestQueryClient()
  
  function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  }
}
