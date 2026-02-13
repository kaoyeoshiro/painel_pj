/**
 * AvailableModulesPanel — Right column of curadoria layout.
 *
 * Displays available modules for manual addition, grouped by category,
 * with sticky search input and independent scrolling.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, Search, X, ChevronDown, ChevronRight, Loader2, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { C } from '@/lib/designTokens'
import type { ModuloPreview, ModuloDisponivel } from '@/types/gerador-pecas'
import { ModuleCardCompact } from './ModuleCardCompact'

// ============================================================================
// Props
// ============================================================================

interface AvailableModulesPanelProps {
  curadoriaAvailableModulos: ModuloDisponivel[]
  isLoadingAvailable: boolean
  curadoriaSearchResults: ModuloPreview[]
  isSearching: boolean
  curadoriaSelected: Set<number>
  addManualModulo: (modulo: ModuloPreview) => void
  searchModulos: (query: string) => void
}

// ============================================================================
// Converter
// ============================================================================

const convertDisponivel = (m: ModuloDisponivel): ModuloPreview => ({
  id: m.id,
  titulo: m.titulo,
  categoria: m.categoria || 'Outros',
  conteudo: m.conteudo,
  tag: m.tag || 'busca',
})

// ============================================================================
// Component
// ============================================================================

export function AvailableModulesPanel({
  curadoriaAvailableModulos,
  isLoadingAvailable,
  curadoriaSearchResults,
  isSearching,
  curadoriaSelected,
  addManualModulo,
  searchModulos,
}: AvailableModulesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounced search (300ms)
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      searchModulos(value)
    }, 300)
  }, [searchModulos])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Filter out already-selected modules
  const availableFiltered = curadoriaAvailableModulos.filter(
    (m) => !curadoriaSelected.has(m.id)
  )

  // Group by category
  const availableGroups = new Map<string, ModuloDisponivel[]>()
  for (const m of availableFiltered) {
    const cat = m.categoria || 'Outros'
    if (!availableGroups.has(cat)) availableGroups.set(cat, [])
    availableGroups.get(cat)!.push(m)
  }

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const clearSearch = () => {
    setSearchQuery('')
    searchModulos('')
  }

  return (
    <div className="flex h-full flex-col rounded-xl border bg-white" style={{ borderColor: C.gray200 }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: C.gray200 }}>
        <Plus className="h-4 w-4" style={{ color: C.navy700 }} />
        <span className="text-sm font-semibold" style={{ color: C.text900 }}>Adicionar Módulos</span>
        {availableFiltered.length > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: C.navy100, color: C.navy700 }}>
            {availableFiltered.length}
          </span>
        )}
      </div>

      {/* Sticky search input */}
      <div className="border-b px-3 py-2.5" style={{ borderColor: C.gray200 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.text400 }} />
          <input
            type="text"
            placeholder="Buscar módulos por título..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 w-full rounded-lg border pl-9 pr-9 text-sm outline-none transition-colors focus:ring-2"
            style={{
              borderColor: C.gray300,
              color: C.text900,
              background: 'white',
            }}
          />
          {searchQuery && !isSearching && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" style={{ color: C.text400 }} />
            </button>
          )}
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" style={{ color: C.navy500 }} />
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Search results mode */}
        {searchQuery.trim() ? (
          isSearching ? (
            <SearchSkeleton />
          ) : curadoriaSearchResults.length > 0 ? (
            <div className="space-y-2">
              <p className="mb-3 text-xs font-medium" style={{ color: C.text400 }}>
                {curadoriaSearchResults.length} resultado(s) para &ldquo;{searchQuery}&rdquo;
              </p>
              {curadoriaSearchResults.map((m) => (
                <ModuleCardCompact
                  key={m.id}
                  modulo={m}
                  variant="available"
                  onAdd={() => addManualModulo(m)}
                />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Search className="mx-auto mb-2 h-6 w-6" style={{ color: C.gray400 }} />
              <p className="text-sm" style={{ color: C.text500 }}>
                Nenhum resultado para &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          )
        ) : isLoadingAvailable ? (
          <SearchSkeleton />
        ) : availableGroups.size > 0 ? (
          /* Browse available modules by category */
          <div className="space-y-3">
            {Array.from(availableGroups.entries()).map(([cat, mods]) => {
              const isCollapsed = collapsedCategories.has(cat)
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="mb-1.5 flex w-full items-center gap-1.5 text-left hover:opacity-70"
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-3 w-3" style={{ color: C.text400 }} />
                      : <ChevronDown className="h-3 w-3" style={{ color: C.text400 }} />
                    }
                    <span className="text-xs font-semibold" style={{ color: C.text500 }}>{cat}</span>
                    <span className="text-[10px]" style={{ color: C.text400 }}>({mods.length})</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1.5 pl-4">
                      {mods.map((m) => (
                        <ModuleCardCompact
                          key={m.id}
                          modulo={convertDisponivel(m)}
                          variant="available"
                          onAdd={() => addManualModulo(convertDisponivel(m))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-6 text-center">
            <Layers className="mx-auto mb-2 h-6 w-6" style={{ color: C.gray400 }} />
            <p className="text-sm" style={{ color: C.text500 }}>
              Nenhum módulo adicional disponível
            </p>
            <p className="mt-1 text-xs" style={{ color: C.text400 }}>
              Use a busca acima para encontrar argumentos adicionais.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function SearchSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded" style={{ background: C.gray200 }} />
            <div className="h-3 w-full animate-pulse rounded" style={{ background: C.gray100 }} />
          </div>
          <div className="h-7 w-20 animate-pulse rounded-lg" style={{ background: C.gray200 }} />
        </div>
      ))}
    </div>
  )
}
