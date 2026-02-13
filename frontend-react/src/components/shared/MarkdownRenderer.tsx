import { useMarkdown } from '@/hooks/useMarkdown'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  /** Markdown text to render */
  content: string
  /** Use small typography variant */
  small?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Renders markdown content with consistent prose typography.
 * Wraps useMarkdown hook with proper .prose styling.
 */
export function MarkdownRenderer({ content, small, className }: MarkdownRendererProps) {
  const { html } = useMarkdown(content)

  return (
    <div
      className={cn('prose max-w-none', small && 'prose-sm', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
