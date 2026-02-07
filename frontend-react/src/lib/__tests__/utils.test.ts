import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn()', () => {
  it('combina classes simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('resolve conflitos do Tailwind', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('ignora valores falsy', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz')
  })

  it('funciona com objetos condicionais', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('retorna string vazia sem argumentos', () => {
    expect(cn()).toBe('')
  })
})
