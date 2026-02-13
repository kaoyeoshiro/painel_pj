/**
 * Tela de curadoria de modulos do Gerador de Pecas.
 *
 * Exibe os modulos detectados pelo Agente 2, agrupados por categoria,
 * permitindo ao usuario selecionar, adicionar ou remover modulos.
 * Replica o comportamento completo do legado (curadoria.js).
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Check, Layers, Zap, Plus, Search, ChevronDown, ChevronRight, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import type { ModuloPreview, ModuloDisponivel } from '@/types/gerador-pecas'

// ============================================================================
// Helpers
// ============================================================================

function groupByCategoria(modulos: ModuloPreview[]): Map<string, ModuloPreview[]> {
  const map = new Map<string, ModuloPreview[]>()
  for (const m of modulos) {
    const cat = m.categoria || 'Outros'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(m)
  }
  return map
}

function getTagStyle(tag: string): { bg: string; text: string; border: string } {
  switch (tag) {
    case 'deterministic':
      return { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' }
    case 'llm':
      return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
    case 'manual':
    case 'busca':
      return { bg: '#fffbeb', text: '#92400e', border: '#fde68a' }
    default:
      return { bg: C.gray100, text: C.text500, border: C.gray300 }
  }
}

function getTagLabel(tag: string): string {
  switch (tag) {
    case 'deterministic': return 'DET'
    case 'llm': return 'LLM'
    case 'manual': return 'MANUAL'
    case 'busca': return 'BUSCA'
    default: return tag.toUpperCase()
  }
}

// ============================================================================
// Props
// ============================================================================

interface CuradoriaPreviewProps {
  curadoriaModulos: ModuloPreview[]
  curadoriaSelected: Set<number>
  curadoriaManualIds: Set<number>
  curadoriaAvailableModulos: ModuloDisponivel[]
  isLoadingAvailable: boolean
  curadoriaSearchResults: ModuloPreview[]
  isSearching: boolean
  toggleModulo: (id: number) => void
  addManualModulo: (modulo: ModuloPreview) => void
  removeModulo: (id: number) => void
  searchModulos: (query: string) => void
  gerarComCuradoria: () => void
  voltarParaInicio: () => void
}

// ============================================================================
// Componente
// ============================================================================

export function CuradoriaPreview({
  curadoriaModulos,
  curadoriaSelected,
  curadoriaManualIds,
  curadoriaAvailableModulos,
  isLoadingAvailable,
  curadoriaSearchResults,
  isSearching,
  toggleModulo,
  addManualModulo,
  removeModulo,
  searchModulos,
  gerarComCuradoria,
  voltarParaInicio,
}: CuradoriaPreviewProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [collapsedAvailable, setCollapsedAvailable] = useState<Set<string>>(new Set())
  const [showAvailable, setShowAvailable] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      searchModulos(value)
    }, 300)
  }, [searchModulos])

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Derived data
  const selectedGroups = groupByCategoria(
    curadoriaModulos.filter((m) => curadoriaSelected.has(m.id))
  )
  const selectedCount = curadoriaSelected.size
  const previewCount = curadoriaModulos.filter((m) => !curadoriaManualIds.has(m.id)).length
  const manualCount = curadoriaManualIds.size

  // Available modules: exclude already selected
  const availableFiltered = curadoriaAvailableModulos.filter(
    (m) => !curadoriaSelected.has(m.id)
  )
  const availableGroups = new Map<string, ModuloDisponivel[]>()
  for (const m of availableFiltered) {
    const cat = m.categoria || 'Outros'
    if (!availableGroups.has(cat)) availableGroups.set(cat, [])
    availableGroups.get(cat)!.push(m)
  }

  const toggleSection = (cat: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const toggleAvailableSection = (cat: string) => {
    setCollapsedAvailable((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const convertDisponivel = (m: ModuloDisponivel): ModuloPreview => ({
    id: m.id,
    titulo: m.titulo,
    categoria: m.categoria || 'Outros',
    conteudo: m.conteudo,
    tag: 'manual',
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }}>
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>Curadoria de Modulos</h2>
            <p className="mt-0.5 text-sm" style={{ color: C.text500 }}>
              {selectedCount} selecionado(s)
              {previewCount > 0 && <> &mdash; {previewCount} do preview</>}
              {manualCount > 0 && <>, {manualCount} adicionado(s) manualmente</>}
            </p>
          </div>
        </div>
        <button
          onClick={voltarParaInicio}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors hover:bg-slate-100"
          style={{ color: C.text500 }}
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>
      </div>

      {/* ============================================================ */}
      {/* Section 1: Selected modules */}
      {/* ============================================================ */}
      <div className="mb-6">
        {selectedCount === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: C.gray300 }}>
            <Layers className="mx-auto mb-2 h-8 w-8" style={{ color: C.gray400 }} />
            <p className="text-sm font-medium" style={{ color: C.text500 }}>Nenhum modulo selecionado</p>
            <p className="mt-1 text-xs" style={{ color: C.text400 }}>Adicione modulos da secao abaixo ou clique nos checkboxes dos modulos detectados.</p>
          </div>
        ) : (
          Array.from(selectedGroups.entries()).map(([categoria, modulos]) => {
            const isCollapsed = collapsedSections.has(categoria)
            return (
              <div key={categoria} className="mb-4">
                <button
                  onClick={() => toggleSection(categoria)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5" style={{ color: C.text400 }} />
                    : <ChevronDown className="h-3.5 w-3.5" style={{ color: C.text400 }} />
                  }
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.text400 }}>{categoria}</span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold" style={{ background: C.gray200, color: C.gray600 }}>
                    {modulos.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {modulos.map((modulo) => {
                      const isManual = curadoriaManualIds.has(modulo.id)
                      const tagStyle = getTagStyle(isManual ? 'manual' : modulo.tag)
                      return (
                        <div
                          key={modulo.id}
                          className="group rounded-xl border p-3.5 transition-all"
                          style={{ borderColor: C.gray200, background: 'white' }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleModulo(modulo.id)}
                              className={cn(
                                'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all',
                                curadoriaSelected.has(modulo.id)
                                  ? 'text-white'
                                  : 'bg-white',
                              )}
                              style={curadoriaSelected.has(modulo.id)
                                ? { borderColor: C.navy950, background: C.navy950 }
                                : { borderColor: C.gray300 }
                              }
                              aria-label={`Selecionar ${modulo.titulo}`}
                            >
                              {curadoriaSelected.has(modulo.id) && <Check className="h-3 w-3" />}
                            </button>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: C.text900 }}>{modulo.titulo}</span>
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ background: tagStyle.bg, color: tagStyle.text, border: `1px solid ${tagStyle.border}` }}
                                >
                                  {getTagLabel(isManual ? 'manual' : modulo.tag)}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: C.text500 }}>{modulo.conteudo}</p>
                            </div>

                            {/* Remove button */}
                            <button
                              onClick={() => removeModulo(modulo.id)}
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
                              title="Remover modulo"
                            >
                              <Trash2 className="h-3.5 w-3.5" style={{ color: C.statusError }} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* Section 2: Available modules (Add Modules) */}
      {/* ============================================================ */}
      <div className="rounded-xl border" style={{ borderColor: C.gray200 }}>
        {/* Section header */}
        <button
          onClick={() => setShowAvailable((v) => !v)}
          className="flex w-full items-center justify-between rounded-t-xl px-4 py-3 text-left transition-colors hover:bg-slate-50"
          style={{ background: C.gray50 }}
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" style={{ color: C.navy700 }} />
            <span className="text-sm font-semibold" style={{ color: C.text900 }}>Adicionar Modulos</span>
            {availableFiltered.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: C.navy100, color: C.navy700 }}>
                {availableFiltered.length} disponivel(is)
              </span>
            )}
          </div>
          {showAvailable
            ? <ChevronDown className="h-4 w-4" style={{ color: C.text400 }} />
            : <ChevronRight className="h-4 w-4" style={{ color: C.text400 }} />
          }
        </button>

        {showAvailable && (
          <div className="border-t" style={{ borderColor: C.gray200 }}>
            {/* Search input */}
            <div className="border-b px-4 py-3" style={{ borderColor: C.gray200 }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.text400 }} />
                <input
                  type="text"
                  placeholder="Buscar modulos por titulo..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-9 w-full rounded-lg border pl-9 pr-9 text-sm outline-none transition-colors focus:ring-2"
                  style={{
                    borderColor: C.gray300,
                    color: C.text900,
                    background: 'white',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); searchModulos('') }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5" style={{ color: C.text400 }} />
                  </button>
                )}
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" style={{ color: C.navy500 }} />
                )}
              </div>
            </div>

            {/* Content area */}
            <div className="max-h-[400px] overflow-y-auto p-4">
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
                      <AvailableModuleCard
                        key={m.id}
                        titulo={m.titulo}
                        categoria={m.categoria}
                        conteudo={m.conteudo}
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
                Array.from(availableGroups.entries()).map(([cat, mods]) => {
                  const isCollapsed = collapsedAvailable.has(cat)
                  return (
                    <div key={cat} className="mb-3">
                      <button
                        onClick={() => toggleAvailableSection(cat)}
                        className="mb-1.5 flex w-full items-center gap-1.5 text-left"
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
                            <AvailableModuleCard
                              key={m.id}
                              titulo={m.titulo}
                              categoria={m.categoria || 'Outros'}
                              conteudo={m.conteudo}
                              onAdd={() => addManualModulo(convertDisponivel(m))}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="py-6 text-center">
                  <Layers className="mx-auto mb-2 h-6 w-6" style={{ color: C.gray400 }} />
                  <p className="text-sm" style={{ color: C.text500 }}>
                    Nenhum modulo adicional disponivel
                  </p>
                  <p className="mt-1 text-xs" style={{ color: C.text400 }}>
                    Use a busca acima para encontrar argumentos adicionais.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Footer actions (sticky) */}
      {/* ============================================================ */}
      <div className="sticky bottom-0 -mx-4 mt-6 border-t px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10" style={{ borderColor: C.gray200, background: C.gray50 }}>
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: C.text500 }}>
            <span className="font-semibold" style={{ color: C.text900 }}>{selectedCount}</span> selecionado(s)
            {manualCount > 0 && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                +{manualCount} manual
              </span>
            )}
          </p>
          <Button
            onClick={gerarComCuradoria}
            disabled={selectedCount === 0}
            className="h-10 gap-2 rounded-xl px-5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            style={{ background: selectedCount > 0 ? C.navy950 : C.gray400 }}
          >
            <Zap className="h-3.5 w-3.5" />
            Gerar com Selecionados ({selectedCount})
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function AvailableModuleCard({
  titulo,
  categoria,
  conteudo,
  onAdd,
}: {
  titulo: string
  categoria: string
  conteudo: string
  onAdd: () => void
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50"
      style={{ borderColor: C.gray200 }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: C.text900 }}>{titulo}</span>
          <span className="rounded px-1 py-0.5 text-[9px] font-medium" style={{ background: C.gray100, color: C.text400 }}>
            {categoria}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed" style={{ color: C.text400 }}>{conteudo}</p>
      </div>
      <button
        onClick={onAdd}
        className="flex h-7 flex-shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-white transition-colors hover:opacity-90"
        style={{ background: C.navy700 }}
        title="Adicionar modulo"
      >
        <Plus className="h-3 w-3" />
        Adicionar
      </button>
    </div>
  )
}

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
