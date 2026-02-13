import { create } from 'zustand'

// Store de estado da UI (sidebar, tema, etc.)
interface UiState {
  /** Mobile sheet sidebar open/close */
  sidebarOpen: boolean
  /** Desktop sidebar collapsed (icon-only) by default */
  sidebarCollapsed: boolean

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: true,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
