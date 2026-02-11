import { useContext } from 'react'
import { ToastContext } from '@/components/ui/toast'

// Hook para usar o sistema de notificacoes toast
export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    // Fallback caso nao esteja dentro do ToastProvider (como em testes)
    return {
      toast: ({ variant }: { title?: string; description?: string; variant?: string }) => {
        if (import.meta.env.DEV) {
          console.warn('[Toast] Chamado fora do ToastProvider (variant:', variant, ')')
        }
      },
      dismiss: () => {
        // noop fora do provider
      },
    }
  }

  return context
}
