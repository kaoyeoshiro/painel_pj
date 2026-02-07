/**
 * DataTable reutilizavel para paginas admin.
 *
 * Funcionalidades:
 * - Paginacao integrada (usePagination)
 * - Ordenacao ao clicar no header
 * - Busca/filtro por texto
 * - Loading skeleton
 * - Estado vazio
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePagination } from '@/hooks/usePagination'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Definicao de uma coluna da tabela */
export interface ColumnDef<T> {
  /** Chave usada como accessor nos dados */
  accessor: string
  /** Texto exibido no header */
  header: string
  /** Funcao customizada de renderizacao da celula */
  render?: (value: unknown, row: T) => React.ReactNode
  /** Se a coluna e ordenavel (default: false) */
  sortable?: boolean
}

/** Direcao da ordenacao */
type SortDirection = 'asc' | 'desc'

/** Estado de ordenacao */
interface SortState {
  column: string
  direction: SortDirection
}

/** Props do DataTable */
export interface DataTableProps<T> {
  /** Definicao das colunas */
  columns: ColumnDef<T>[]
  /** Dados a exibir */
  data: T[]
  /** Se esta carregando */
  isLoading?: boolean
  /** Se deve mostrar campo de busca */
  searchable?: boolean
  /** Tamanho da pagina (default: 20) */
  pageSize?: number
  /** Callback ao clicar numa linha */
  onRowClick?: (row: T) => void
  /** Mensagem quando nao ha dados */
  emptyMessage?: string
  /** Placeholder do campo de busca */
  searchPlaceholder?: string
}

// ---------------------------------------------------------------------------
// Funcao utilitaria para acessar valor aninhado (ex: "user.name")
// ---------------------------------------------------------------------------
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

// ---------------------------------------------------------------------------
// Componente DataTable
// ---------------------------------------------------------------------------
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  searchable = false,
  pageSize = 20,
  onRowClick,
  emptyMessage = 'Nenhum resultado encontrado',
  searchPlaceholder = 'Buscar...',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)

  // Filtragem por texto
  const filteredData = useMemo(() => {
    if (!search.trim()) return data
    const term = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const val = getNestedValue(row, col.accessor)
        if (val == null) return false
        return String(val).toLowerCase().includes(term)
      })
    )
  }, [data, search, columns])

  // Ordenacao
  const sortedData = useMemo(() => {
    if (!sort) return filteredData
    const { column, direction } = sort
    return [...filteredData].sort((a, b) => {
      const aVal = getNestedValue(a, column)
      const bVal = getNestedValue(b, column)
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      const aStr = String(aVal)
      const bStr = String(bVal)

      // Tenta comparar como numero
      const aNum = Number(aStr)
      const bNum = Number(bStr)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum
      }

      // Compara como string
      const cmp = aStr.localeCompare(bStr, 'pt-BR')
      return direction === 'asc' ? cmp : -cmp
    })
  }, [filteredData, sort])

  // Paginacao
  const {
    currentPage,
    totalPages,
    paginatedData,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    goToPage,
  } = usePagination(sortedData, { pageSize })

  // Handler de ordenacao
  const handleSort = useCallback(
    (accessor: string) => {
      setSort((prev) => {
        if (prev?.column === accessor) {
          // Inverte direcao ou remove
          if (prev.direction === 'asc') return { column: accessor, direction: 'desc' }
          return null // Remove ordenacao
        }
        return { column: accessor, direction: 'asc' }
      })
    },
    []
  )

  // Indicador de direcao
  const getSortIndicator = (accessor: string) => {
    if (!sort || sort.column !== accessor) return ''
    return sort.direction === 'asc' ? ' \u2191' : ' \u2193'
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {searchable && <Skeleton className="h-10 w-64" />}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.accessor}>{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.accessor}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Campo de busca */}
      {searchable && (
        <div className="flex items-center gap-2">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              goToPage(1)
            }}
            className="max-w-sm"
          />
          {search && (
            <span className="text-sm text-muted-foreground">
              {filteredData.length} resultado{filteredData.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.accessor}
                  className={col.sortable ? 'cursor-pointer select-none hover:bg-muted/50' : ''}
                  onClick={col.sortable ? () => handleSort(col.accessor) : undefined}
                >
                  {col.header}
                  {col.sortable && getSortIndicator(col.accessor)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <span className="text-2xl">&#x1F50D;</span>
                    <span>{emptyMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => {
                    const val = getNestedValue(row, col.accessor)
                    return (
                      <TableCell key={col.accessor}>
                        {col.render ? col.render(val, row) : val != null ? String(val) : ''}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-muted-foreground">
            Pagina {currentPage} de {totalPages} ({sortedData.length} registro
            {sortedData.length !== 1 ? 's' : ''})
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevPage} disabled={!hasPrevPage}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={nextPage} disabled={!hasNextPage}>
              Proximo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
