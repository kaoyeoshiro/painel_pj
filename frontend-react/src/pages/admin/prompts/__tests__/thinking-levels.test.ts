import { describe, it, expect } from 'vitest'
import {
  THINKING_LEVELS,
  THINKING_LEVELS_DIRETO,
  MODEL_THINKING_SUPPORT,
  NORMALIZE_THINKING_LEVEL,
  INHERIT_VALUE,
  getSupportedLevels,
} from '../constants'

describe('THINKING_LEVELS', () => {
  it('tem 6 opções (herdar, none, minimal, low, medium, high)', () => {
    expect(THINKING_LEVELS).toHaveLength(6)
  })

  it('primeira opção é Herdar com value __inherit__', () => {
    expect(THINKING_LEVELS[0].value).toBe(INHERIT_VALUE)
    expect(THINKING_LEVELS[0].label).toBe('Herdar')
  })

  it('contém todas as opções esperadas', () => {
    const values = THINKING_LEVELS.map(t => t.value)
    expect(values).toContain(INHERIT_VALUE)
    expect(values).toContain('none')
    expect(values).toContain('minimal')
    expect(values).toContain('low')
    expect(values).toContain('medium')
    expect(values).toContain('high')
  })

  it('labels mostram valor EN da API entre parênteses', () => {
    const noneOption = THINKING_LEVELS.find(t => t.value === 'none')
    expect(noneOption?.label).toContain('(none)')

    const minimalOption = THINKING_LEVELS.find(t => t.value === 'minimal')
    expect(minimalOption?.label).toContain('(minimal)')

    const lowOption = THINKING_LEVELS.find(t => t.value === 'low')
    expect(lowOption?.label).toContain('(low)')

    const mediumOption = THINKING_LEVELS.find(t => t.value === 'medium')
    expect(mediumOption?.label).toContain('(medium)')

    const highOption = THINKING_LEVELS.find(t => t.value === 'high')
    expect(highOption?.label).toContain('(high)')
  })
})

describe('THINKING_LEVELS_DIRETO', () => {
  it('tem 4 opções (sem Herdar, sem none)', () => {
    expect(THINKING_LEVELS_DIRETO).toHaveLength(4)
  })

  it('não contém __inherit__ nem none', () => {
    const values = THINKING_LEVELS_DIRETO.map(t => t.value)
    expect(values).not.toContain(INHERIT_VALUE)
    expect(values).not.toContain('none')
  })
})

describe('MODEL_THINKING_SUPPORT', () => {
  it('Gemini 3 Flash suporta todos os 4 níveis', () => {
    const flash = MODEL_THINKING_SUPPORT['gemini-3-flash']
    expect(flash).toEqual(['minimal', 'low', 'medium', 'high'])
  })

  it('Gemini 3 Pro suporta apenas low e high', () => {
    const pro = MODEL_THINKING_SUPPORT['gemini-3-pro']
    expect(pro).toEqual(['low', 'high'])
  })

  it('não lista modelos Gemini 2.x ou 1.5', () => {
    const keys = Object.keys(MODEL_THINKING_SUPPORT)
    expect(keys.every(k => k.startsWith('gemini-3'))).toBe(true)
  })
})

describe('NORMALIZE_THINKING_LEVEL', () => {
  it('mapeia baixo → low', () => {
    expect(NORMALIZE_THINKING_LEVEL['baixo']).toBe('low')
  })

  it('mapeia médio e medio → medium', () => {
    expect(NORMALIZE_THINKING_LEVEL['médio']).toBe('medium')
    expect(NORMALIZE_THINKING_LEVEL['medio']).toBe('medium')
  })

  it('mapeia alto → high', () => {
    expect(NORMALIZE_THINKING_LEVEL['alto']).toBe('high')
  })

  it('mapeia nenhum → none', () => {
    expect(NORMALIZE_THINKING_LEVEL['nenhum']).toBe('none')
  })

  it('mapeia mínimo e minimo → minimal', () => {
    expect(NORMALIZE_THINKING_LEVEL['mínimo']).toBe('minimal')
    expect(NORMALIZE_THINKING_LEVEL['minimo']).toBe('minimal')
  })

  it('tem 7 entradas (com/sem acento)', () => {
    expect(Object.keys(NORMALIZE_THINKING_LEVEL)).toHaveLength(7)
  })
})

describe('getSupportedLevels', () => {
  it('retorna todos os níveis para gemini-3-flash-preview', () => {
    expect(getSupportedLevels('gemini-3-flash-preview')).toEqual(
      ['minimal', 'low', 'medium', 'high']
    )
  })

  it('retorna low/high para gemini-3-pro-preview', () => {
    expect(getSupportedLevels('gemini-3-pro-preview')).toEqual(['low', 'high'])
  })

  it('retorna minimal/low/medium/high para gemini-3.1-flash-lite-preview', () => {
    expect(getSupportedLevels('gemini-3.1-flash-lite-preview')).toEqual(['minimal', 'low', 'medium', 'high'])
  })

  it('retorna array vazio para string vazia', () => {
    expect(getSupportedLevels('')).toEqual([])
  })

  it('retorna array vazio para modelo desconhecido', () => {
    expect(getSupportedLevels('gpt-4')).toEqual([])
  })
})
