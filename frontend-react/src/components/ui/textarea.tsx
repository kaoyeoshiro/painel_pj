import * as React from "react"
import { useCallback, useEffect, useRef, useImperativeHandle } from "react"

import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

// Componente Textarea com estilizacao padrao shadcn/ui
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-gray-300 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

// Props estendidas para o textarea com auto-resize
export interface AutoResizeTextareaProps extends TextareaProps {
  /** Altura maxima em pixels antes de ativar scroll interno (padrao: 144 ~ 6 linhas) */
  maxHeight?: number
  /** Callback quando usuario pressiona Enter sem Shift (para envio de mensagem) */
  onSubmit?: () => void
}

/**
 * Textarea com auto-resize estilo ChatGPT.
 * - Exibe pelo menos 3 linhas por padrao
 * - Cresce automaticamente ate maxHeight
 * - Ativa scroll interno apos maxHeight
 * - Enter envia, Shift+Enter quebra linha
 */
const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, maxHeight = 144, onSubmit, onChange, onKeyDown, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement)

    const resize = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      el.style.height = "auto"
      if (el.scrollHeight > maxHeight) {
        el.style.height = `${maxHeight}px`
        el.style.overflowY = "auto"
      } else {
        el.style.height = `${el.scrollHeight}px`
        el.style.overflowY = "hidden"
      }
    }, [maxHeight])

    // Resetar altura quando valor muda externamente (ex: limpar campo apos envio)
    useEffect(() => {
      resize()
    }, [props.value, resize])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(e)
        resize()
      },
      [onChange, resize]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && onSubmit) {
          e.preventDefault()
          onSubmit()
        }
        onKeyDown?.(e)
      },
      [onKeyDown, onSubmit]
    )

    return (
      <textarea
        className={cn(
          "flex w-full rounded-xl border border-gray-200 bg-background px-4 py-3 text-sm shadow-sm ring-offset-background transition-all leading-relaxed",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          className
        )}
        ref={innerRef}
        rows={3}
        style={{ minHeight: "72px", maxHeight: `${maxHeight}px`, overflowY: "hidden", ...props.style }}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    )
  }
)
AutoResizeTextarea.displayName = "AutoResizeTextarea"

export { Textarea, AutoResizeTextarea }
