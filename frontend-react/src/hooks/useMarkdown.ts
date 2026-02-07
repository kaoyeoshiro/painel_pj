import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Hook para renderizar Markdown com sanitizacao
interface UseMarkdownOptions {
  sanitize?: boolean
}

export function useMarkdown(text: string, options: UseMarkdownOptions = {}) {
  const { sanitize = true } = options

  const html = useMemo(() => {
    if (!text) return ''

    const rawHtml = marked.parse(text, { async: false }) as string

    if (sanitize) {
      return DOMPurify.sanitize(rawHtml)
    }

    return rawHtml
  }, [text, sanitize])

  return { html }
}
