import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Guard de autenticação
 * Verifica se o usuário está autenticado. Se não, redireciona para /login.
 * Exibe skeleton enquanto verifica a sessão.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  const isLoading = useAuthStore(s => s.isLoading)
  const initialize = useAuthStore(s => s.initialize)
  const navigate = useNavigate()

  useEffect(() => {
    // Verifica autenticação ao montar
    initialize()
  }, [initialize])

  useEffect(() => {
    // Se não está loading e não tem usuário, redireciona para login
    if (!isLoading && !user) {
      navigate({ to: '/login' })
    }
  }, [user, isLoading, navigate])

  // Exibe loading enquanto verifica
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-4 p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  // Se não tem usuário, não renderiza nada (está redirecionando)
  if (!user) {
    return null
  }

  // Usuário autenticado: renderiza children
  return <>{children}</>
}
