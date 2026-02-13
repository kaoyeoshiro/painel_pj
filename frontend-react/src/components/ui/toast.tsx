/* eslint-disable react-refresh/only-export-components -- Arquivo exporta contexto, provider, hook e variantes (padrão shadcn/ui) */
import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

// Variantes de estilo para notificacoes toast
const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive group border-destructive bg-destructive text-destructive-foreground",
        success: "border-green-500 bg-green-50 text-green-900",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

// Contexto e provider para o sistema de notificacoes toast
interface ToastMessage {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
}

interface ToastContextType {
  toasts: ToastMessage[]
  toast: (msg: Omit<ToastMessage, "id">) => void
  dismiss: (id: string) => void
}

export const ToastContext = React.createContext<ToastContextType | null>(null)

// Provider que gerencia o estado das notificacoes e renderiza o container
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  const toast = React.useCallback((msg: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...msg, id }])
    // Remove automaticamente apos 5 segundos
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-[420px]">
        {toasts.map((t) => (
          <div key={t.id} className={cn(toastVariants({ variant: t.variant }), "mb-2")}>
            <div className="grid gap-1">
              {t.title && <div className="text-sm font-semibold">{t.title}</div>}
              {t.description && <div className="text-sm opacity-90">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Hook para acessar o sistema de notificacoes toast
export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error("useToast deve ser usado dentro de ToastProvider")
  return context
}

export { toastVariants }
export type { ToastMessage, ToastContextType, VariantProps }
