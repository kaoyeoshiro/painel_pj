/**
 * Tela de curadoria de modulos do Gerador de Pecas.
 *
 * Layout side-by-side (70/30):
 *   - Esquerda: Modulos Selecionados (com scroll independente e footer sticky)
 *   - Direita:  Adicionar Modulos (com busca fixa no topo e scroll independente)
 */

import { Layers, X } from 'lucide-react'
import { C } from '@/lib/designTokens'
import type { ModuloPreview, ModuloDisponivel } from '@/types/gerador-pecas'
import { SelectedModulesPanel } from './SelectedModulesPanel'
import { AvailableModulesPanel } from './AvailableModulesPanel'

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
  const selectedCount = curadoriaSelected.size
  const previewCount = curadoriaModulos.filter((m) => !curadoriaManualIds.has(m.id)).length
  const manualCount = curadoriaManualIds.size

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }}
          >
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: C.text900 }}>
              Curadoria de Módulos
            </h2>
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

      {/* Side-by-side columns */}
      <div className="flex min-h-0 flex-1 gap-6">
        {/* Left: Selected Modules (70%) */}
        <div className="w-[60%] min-w-0">
          <SelectedModulesPanel
            curadoriaModulos={curadoriaModulos}
            curadoriaSelected={curadoriaSelected}
            curadoriaManualIds={curadoriaManualIds}
            removeModulo={removeModulo}
            gerarComCuradoria={gerarComCuradoria}
          />
        </div>

        {/* Right: Available Modules (30%) */}
        <div className="w-[40%] min-w-0">
          <AvailableModulesPanel
            curadoriaAvailableModulos={curadoriaAvailableModulos}
            isLoadingAvailable={isLoadingAvailable}
            curadoriaSearchResults={curadoriaSearchResults}
            isSearching={isSearching}
            curadoriaSelected={curadoriaSelected}
            addManualModulo={addManualModulo}
            searchModulos={searchModulos}
          />
        </div>
      </div>
    </div>
  )
}
