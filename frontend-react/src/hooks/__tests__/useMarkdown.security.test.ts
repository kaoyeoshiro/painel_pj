/**
 * Testes de seguranca para useMarkdown e sanitizeHtml.
 *
 * Valida que payloads XSS comuns sao removidos pela sanitizacao DOMPurify.
 * Estes testes sao a ultima linha de defesa contra regressoes de seguranca.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml, PURIFY_CONFIG } from '../useMarkdown'

describe('sanitizeHtml — XSS prevention', () => {
  // -----------------------------------------------------------------------
  // Script injection
  // -----------------------------------------------------------------------
  it('remove <script> tags', () => {
    const result = sanitizeHtml('<p>Texto</p><script>alert("xss")</script>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
    expect(result).toContain('<p>Texto</p>')
  })

  it('remove script tags com variantes de case', () => {
    const result = sanitizeHtml('<ScRiPt>alert(1)</ScRiPt>')
    expect(result).not.toContain('alert')
  })

  // -----------------------------------------------------------------------
  // Event handler injection (on*)
  // -----------------------------------------------------------------------
  it('remove onerror em img', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('onerror')
    // img e permitida, mas sem o handler
    expect(result).toContain('<img')
  })

  it('remove onclick em elementos', () => {
    const result = sanitizeHtml('<p onclick="alert(1)">Texto</p>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('Texto')
  })

  it('remove onload em body/img', () => {
    const result = sanitizeHtml('<img src="x" onload="fetch(\'http://evil.com\')">')
    expect(result).not.toContain('onload')
  })

  it('remove onmouseover', () => {
    const result = sanitizeHtml('<span onmouseover="alert(1)">hover me</span>')
    expect(result).not.toContain('onmouseover')
  })

  // -----------------------------------------------------------------------
  // Protocol injection (javascript:, data:, vbscript:)
  // -----------------------------------------------------------------------
  it('remove href com javascript: protocol', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    // DOMPurify remove o href perigoso
    expect(result).not.toContain('javascript:')
  })

  it('remove href com javascript: ofuscado por entidades', () => {
    const result = sanitizeHtml('<a href="&#106;avascript:alert(1)">click</a>')
    expect(result).not.toContain('javascript')
  })

  it('remove href com data: protocol', () => {
    const result = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">click</a>')
    expect(result).not.toContain('data:')
  })

  it('remove src com javascript: protocol em img', () => {
    const result = sanitizeHtml('<img src="javascript:alert(1)">')
    expect(result).not.toContain('javascript:')
  })

  it('remove vbscript: protocol', () => {
    const result = sanitizeHtml('<a href="vbscript:MsgBox(1)">click</a>')
    expect(result).not.toContain('vbscript:')
  })

  // -----------------------------------------------------------------------
  // Tags perigosas removidas
  // -----------------------------------------------------------------------
  it('remove <iframe>', () => {
    const result = sanitizeHtml('<iframe src="http://evil.com"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  it('remove <object>', () => {
    const result = sanitizeHtml('<object data="http://evil.com"></object>')
    expect(result).not.toContain('<object')
  })

  it('remove <embed>', () => {
    const result = sanitizeHtml('<embed src="http://evil.com">')
    expect(result).not.toContain('<embed')
  })

  it('remove <form>', () => {
    const result = sanitizeHtml('<form action="http://evil.com"><input></form>')
    expect(result).not.toContain('<form')
  })

  it('remove <svg> com onload', () => {
    const result = sanitizeHtml('<svg onload="alert(1)"><circle></circle></svg>')
    expect(result).not.toContain('<svg')
    expect(result).not.toContain('onload')
  })

  it('remove <math> (usado em ataques de mutacao XSS)', () => {
    const result = sanitizeHtml('<math><mi><!--</mi><mo>--></mo></math>')
    expect(result).not.toContain('<math')
  })

  it('remove <style> tags', () => {
    const result = sanitizeHtml('<style>body{background:red}</style><p>Texto</p>')
    expect(result).not.toContain('<style')
    expect(result).toContain('Texto')
  })

  // -----------------------------------------------------------------------
  // Atributo style removido
  // -----------------------------------------------------------------------
  it('remove atributo style inline', () => {
    const result = sanitizeHtml('<p style="background:url(javascript:alert(1))">Texto</p>')
    expect(result).not.toContain('style=')
    expect(result).toContain('Texto')
  })

  // -----------------------------------------------------------------------
  // Links seguros (noopener noreferrer)
  // -----------------------------------------------------------------------
  it('adiciona rel="noopener noreferrer" e target="_blank" em links', () => {
    const result = sanitizeHtml('<a href="https://example.com">Link</a>')
    expect(result).toContain('rel="noopener noreferrer"')
    expect(result).toContain('target="_blank"')
  })

  // -----------------------------------------------------------------------
  // Conteudo legitimo preservado
  // -----------------------------------------------------------------------
  it('preserva HTML seguro', () => {
    const safeHtml = '<h1>Titulo</h1><p>Paragrafo com <strong>negrito</strong> e <em>italico</em>.</p>'
    const result = sanitizeHtml(safeHtml)
    expect(result).toContain('<h1>Titulo</h1>')
    expect(result).toContain('<strong>negrito</strong>')
    expect(result).toContain('<em>italico</em>')
  })

  it('preserva tabelas', () => {
    const tableHtml = '<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>'
    const result = sanitizeHtml(tableHtml)
    expect(result).toContain('<table>')
    expect(result).toContain('<th>Col</th>')
    expect(result).toContain('<td>Val</td>')
  })

  it('preserva links https', () => {
    const result = sanitizeHtml('<a href="https://pge.ms.gov.br">PGE</a>')
    expect(result).toContain('href="https://pge.ms.gov.br"')
  })

  it('preserva imagens com src https', () => {
    const result = sanitizeHtml('<img src="https://example.com/img.png" alt="Foto">')
    expect(result).toContain('src="https://example.com/img.png"')
    expect(result).toContain('alt="Foto"')
  })
})

describe('PURIFY_CONFIG', () => {
  it('nao permite protocolos desconhecidos', () => {
    expect(PURIFY_CONFIG.ALLOW_UNKNOWN_PROTOCOLS).toBe(false)
  })

  it('proibe atributos on* criticos', () => {
    expect(PURIFY_CONFIG.FORBID_ATTR).toContain('style')
    expect(PURIFY_CONFIG.FORBID_ATTR).toContain('onerror')
    expect(PURIFY_CONFIG.FORBID_ATTR).toContain('onclick')
  })
})
