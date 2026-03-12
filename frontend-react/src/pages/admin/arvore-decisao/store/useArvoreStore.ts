/**
 * Estado global da árvore de decisão.
 * Gerencia filtros, zoom, expansão e seleção.
 */

import { create } from 'zustand'
import type { ZoomLevel, DetailPanelContent, ArvoreDecisaoResponse } from '../types'

interface ArvoreState {
  // Dados da API
  data: ArvoreDecisaoResponse | null
  loading: boolean
  error: string | null

  // Filtros
  grupoId: number | null
  tipoPecaId: number | null
  searchTerm: string
  showOrphans: boolean

  // Visualização
  zoomLevel: ZoomLevel
  collapsedSwimlanes: Set<string>
  expandedModules: Set<number>

  // Detail panel
  detailPanel: DetailPanelContent

  // Ações
  setData: (data: ArvoreDecisaoResponse) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setGrupoId: (id: number) => void
  setTipoPecaId: (id: number | null) => void
  setSearchTerm: (term: string) => void
  setShowOrphans: (show: boolean) => void
  setZoomLevel: (level: ZoomLevel) => void
  toggleSwimlane: (id: string) => void
  toggleModule: (id: number) => void
  expandAll: () => void
  collapseAll: () => void
  setDetailPanel: (content: DetailPanelContent) => void
  closeDetailPanel: () => void
}

export const useArvoreStore = create<ArvoreState>((set, get) => ({
  // Estado inicial
  data: null,
  loading: false,
  error: null,
  grupoId: null,
  tipoPecaId: null,
  searchTerm: '',
  showOrphans: false,
  zoomLevel: 'medium',
  collapsedSwimlanes: new Set(),
  expandedModules: new Set(),
  detailPanel: null,

  // Ações
  setData: (data) => set({ data, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setGrupoId: (grupoId) => set({ grupoId, data: null }),
  setTipoPecaId: (tipoPecaId) => set({ tipoPecaId }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setShowOrphans: (showOrphans) => set({ showOrphans }),
  setZoomLevel: (zoomLevel) => set({ zoomLevel }),

  toggleSwimlane: (id) => set((state) => {
    const next = new Set(state.collapsedSwimlanes)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { collapsedSwimlanes: next }
  }),

  toggleModule: (id) => set((state) => {
    const next = new Set(state.expandedModules)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { expandedModules: next }
  }),

  expandAll: () => set((state) => {
    const ids = state.data?.modulos.map((m) => m.id) ?? []
    return { expandedModules: new Set(ids) }
  }),

  collapseAll: () => set({ expandedModules: new Set() }),

  setDetailPanel: (detailPanel) => set({ detailPanel }),
  closeDetailPanel: () => set({ detailPanel: null }),
}))
