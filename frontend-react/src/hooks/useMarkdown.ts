import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Configuracao estrita do DOMPurify com allowlist explicita.
 *
 * Tags e atributos NAO listados aqui sao removidos automaticamente.
 * Isso impede injecao de script, iframe, object, embed, form, style, svg, math, etc.
 */
const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'strong', 'em', 'b', 'i',
    'a', 'code', 'pre', 'blockquote',
    'br', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'img',
    'sup', 'sub', 'del',
    'dd', 'dt', 'dl',
    'details', 'summary',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel',
    'src', 'alt',
    'class', 'id', 'title',
    'colspan', 'rowspan',
    'open',
  ],
  // Bloqueia URIs perigosas em href/src (javascript:, data:, vbscript:)
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  // Impede atributo style inline (mesmo que nao esteja no ALLOWED_ATTR, e uma seguranca extra)
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
}

/**
 * Hook para forcar links seguros apos sanitizacao.
 * Garante que todo <a> com href abra em nova aba de forma segura,
 * prevenindo ataques via window.opener (tabnabbing).
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

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
      return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG) as string
    }

    return rawHtml
  }, [text, sanitize])

  return { html }
}
