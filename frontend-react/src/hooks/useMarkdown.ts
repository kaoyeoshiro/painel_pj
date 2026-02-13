import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Configuracao estrita do DOMPurify com allowlist explicita.
 *
 * Tags e atributos NAO listados aqui sao removidos automaticamente.
 * Isso impede injecao de script, iframe, object, embed, form, style, svg, math, etc.
 *
 * SEGURANCA: Sanitizacao e SEMPRE ativa. Nao existe opcao de bypass.
 */
export const PURIFY_CONFIG: DOMPurify.Config = {
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
  // Allowlist explicita de protocolos seguros. Bloqueia javascript:, data:, vbscript:, etc.
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
  // Impede atributo style inline (mesmo que nao esteja no ALLOWED_ATTR, e uma seguranca extra)
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
  // Protocolos desconhecidos sao bloqueados
  ALLOW_UNKNOWN_PROTOCOLS: false,
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

/**
 * Sanitiza HTML cru usando DOMPurify com allowlist estrita.
 * Funcao pura exportada para uso fora de componentes React (ex: testes, utils).
 */
export function sanitizeHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG) as string
}

/**
 * Hook para renderizar Markdown com sanitizacao obrigatoria.
 * SEGURANCA: Nao existe opcao de desabilitar sanitizacao.
 */
export function useMarkdown(text: string) {
  const html = useMemo(() => {
    if (!text) return ''
    const rawHtml = marked.parse(text, { async: false }) as string
    return sanitizeHtml(rawHtml)
  }, [text])

  return { html }
}
