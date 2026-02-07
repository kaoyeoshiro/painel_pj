import { useMemo, useState } from 'react'

// Hook para paginacao de dados locais
interface UsePaginationOptions {
  pageSize?: number
}

interface UsePaginationReturn<T> {
  currentPage: number
  totalPages: number
  paginatedData: T[]
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { pageSize = 20 } = options
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  // Reseta para pagina 1 se dados mudarem e pagina atual for invalida
  const safePage = Math.min(currentPage, totalPages)

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, safePage, pageSize])

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(clamped)
  }

  const nextPage = () => goToPage(safePage + 1)
  const prevPage = () => goToPage(safePage - 1)

  return {
    currentPage: safePage,
    totalPages,
    paginatedData,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  }
}
