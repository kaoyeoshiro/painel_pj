import { sanitizeHtml } from '@/hooks/useMarkdown'
import { cn } from '@/lib/utils'

interface SafeHtmlProps {
  /** HTML cru a ser sanitizado e renderizado */
  html: string
  /** Classes CSS adicionais */
  className?: string
}

/**
 * Componente que renderiza HTML de forma segura, aplicando DOMPurify com allowlist estrita.
 *
 * SEGURANCA: Todo HTML e sanitizado ANTES de ser injetado no DOM.
 * Use este componente em vez de `dangerouslySetInnerHTML` diretamente.
 *
 * Para Markdown, prefira o hook `useMarkdown` + `MarkdownRenderer`.
 * Use `SafeHtml` apenas quando o HTML ja estiver pronto (ex: vindo de useMarkdown().html).
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  return (
    <div
      className={cn(className)}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}
