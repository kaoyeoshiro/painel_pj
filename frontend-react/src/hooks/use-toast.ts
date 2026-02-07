import { useContext } from 'react'
import { ToastContext } from '@/components/ui/toast'

// Hook para usar o sistema de notificacoes toast
export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    // Fallback caso nao esteja dentro do ToastProvider (como em testes)
    return {
      toast: ({ title, description, variant }: { title?: string; description?: string; variant?: string }) => {
        console.log('[Toast]', { title, description, variant })
      },
      dismiss: (id: string) => {
        console.log('[Toast dismiss]', id)
      },
    }
  }

  return context
}
