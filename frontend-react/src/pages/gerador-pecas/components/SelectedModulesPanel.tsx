/**
 * SelectedModulesPanel — Left panel showing selected modules in curadoria.
 *
 * Displays modules grouped by category, with collapsible sections,
 * using ModuleCardCompact for each module. Includes sticky footer
 * with "Gerar com Selecionados" button.
 */

import { useState } from 'react'
import { Layers, Zap, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import type { ModuloPreview } from '@/types/gerador-pecas'
import { ModuleCardCompact } from './ModuleCardCompact'

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

// ============================================================================
// Props
// ============================================================================

interface SelectedModulesPanelProps {
  curadoriaModulos: ModuloPreview[]
  curadoriaSelected: Set<number>
  curadoriaManualIds: Set<number>
  removeModulo: (id: number) => void
  gerarComCuradoria: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SelectedModulesPanel({
  curadoriaModulos,
  curadoriaSelected,
  curadoriaManualIds,
  removeModulo,
  gerarComCuradoria,
}: SelectedModulesPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Derived data
  const selectedModules = curadoriaModulos.filter((m) => curadoriaSelected.has(m.id))
  const selectedGroups = groupByCategoria(selectedModules)
  const selectedCount = curadoriaSelected.size
  const manualCount = curadoriaManualIds.size

  const toggleSection = (cat: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable module list */}
      <div className="flex-1 overflow-y-auto pr-1">
        {selectedCount === 0 ? (
          <div
            className="rounded-xl border border-dashed p-8 text-center"
            style={{ borderColor: C.gray300 }}
          >
            <Layers className="mx-auto mb-2 h-8 w-8" style={{ color: C.gray400 }} />
            <p className="text-sm font-medium" style={{ color: C.text500 }}>
              Nenhum módulo selecionado
            </p>
            <p className="mt-1 text-xs" style={{ color: C.text400 }}>
              Adicione módulos pelo painel ao lado ou busque argumentos adicionais.
            </p>
          </div>
        ) : (
          Array.from(selectedGroups.entries()).map(([categoria, modulos]) => {
            const isCollapsed = collapsedSections.has(categoria)
            return (
              <div key={categoria} className="mb-3">
                {/* Category header */}
                <button
                  onClick={() => toggleSection(categoria)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: C.text400 }} />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" style={{ color: C.text400 }} />
                  )}
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: C.text400 }}
                  >
                    {categoria}
                  </span>
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                    style={{ background: C.gray200, color: C.gray600 }}
                  >
                    {modulos.length}
                  </span>
                </button>

                {/* Module cards */}
                {!isCollapsed && (
                  <div className="space-y-1">
                    {modulos.map((modulo) => {
                      const isManual = curadoriaManualIds.has(modulo.id)
                      return (
                        <ModuleCardCompact
                          key={modulo.id}
                          modulo={modulo}
                          variant="selected"
                          isManual={isManual}
                          onRemove={() => removeModulo(modulo.id)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Sticky footer */}
      <div
        className="mt-auto shrink-0 border-t pt-4"
        style={{ borderColor: C.gray200 }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: C.text500 }}>
            <span className="font-semibold" style={{ color: C.text900 }}>
              {selectedCount}
            </span>{' '}
            selecionado(s)
            {manualCount > 0 && (
              <span
                className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: C.warningBgAlt,
                  color: C.warningText,
                  border: `1px solid ${C.warningBorder}`,
                }}
              >
                +{manualCount} manual
              </span>
            )}
          </p>
          <Button
            onClick={gerarComCuradoria}
            disabled={selectedCount === 0}
            className={cn(
              'h-10 gap-2 rounded-xl px-5 text-sm font-medium text-white shadow-sm',
              'hover:opacity-90 disabled:opacity-50'
            )}
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
