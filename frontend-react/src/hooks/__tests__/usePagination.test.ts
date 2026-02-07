import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { usePagination } from '../usePagination'

describe('usePagination', () => {
  const dados = Array.from({ length: 50 }, (_, i) => `item-${i + 1}`)

  it('retorna primeira pagina por padrao', () => {
    const { result } = renderHook(() => usePagination(dados, { pageSize: 10 }))
    expect(result.current.currentPage).toBe(1)
    expect(result.current.totalPages).toBe(5)
    expect(result.current.paginatedData).toHaveLength(10)
    expect(result.current.paginatedData[0]).toBe('item-1')
  })

  it('navega para proxima pagina', () => {
    const { result } = renderHook(() => usePagination(dados, { pageSize: 10 }))
    act(() => result.current.nextPage())
    expect(result.current.currentPage).toBe(2)
    expect(result.current.paginatedData[0]).toBe('item-11')
  })

  it('navega para pagina anterior', () => {
    const { result } = renderHook(() => usePagination(dados, { pageSize: 10 }))
    act(() => result.current.goToPage(3))
    act(() => result.current.prevPage())
    expect(result.current.currentPage).toBe(2)
  })

  it('nao vai alem da ultima pagina', () => {
    const { result } = renderHook(() => usePagination(dados, { pageSize: 10 }))
    act(() => result.current.goToPage(100))
    expect(result.current.currentPage).toBe(5)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('nao vai antes da primeira pagina', () => {
    const { result } = renderHook(() => usePagination(dados, { pageSize: 10 }))
    act(() => result.current.prevPage())
    expect(result.current.currentPage).toBe(1)
    expect(result.current.hasPrevPage).toBe(false)
  })

  it('funciona com array vazio', () => {
    const { result } = renderHook(() => usePagination([], { pageSize: 10 }))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.paginatedData).toHaveLength(0)
  })
})
