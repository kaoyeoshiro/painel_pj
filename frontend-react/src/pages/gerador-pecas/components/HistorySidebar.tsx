/**
 * Sidebar de historico do Gerador de Pecas.
 *
 * Overlay fixo a direita com lista completa de geracoes anteriores.
 */

import { X, History, FileText, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { C } from '@/lib/designTokens'
import type { HistoricoItem } from '@/types/gerador-pecas'
import { formatDate } from '../types'

// ============================================================================
// Props
// ============================================================================

interface HistorySidebarProps {
  show: boolean
  onClose: () => void
  historico: HistoricoItem[] | undefined
  isLoading: boolean
  onCarregar: (id: number) => void
  onExcluir: (id: number, e: React.MouseEvent) => void
}

// ============================================================================
// Componente
// ============================================================================

export function HistorySidebar({
  show,
  onClose,
  historico,
  isLoading,
  onCarregar,
  onExcluir,
}: HistorySidebarProps) {
  if (!show) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-16 z-50 flex h-[calc(100vh-4rem)] w-80 flex-col border-l bg-white shadow-xl" style={{ borderColor: C.gray200 }}>
        <div className="flex h-12 flex-shrink-0 items-center justify-between px-4" style={{ background: C.navy950 }}>
          <span className="text-sm font-semibold text-white">Historico</span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : !historico || historico.length === 0 ? (
            <div className="py-16 text-center">
              <History className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">Nenhuma geracao</p>
            </div>
          ) : (
            <div className="space-y-0.5 p-2">
              {historico.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onCarregar(item.id)}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onCarregar(item.id) }}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: C.navy100, color: C.navy700 }}>
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: C.text700 }}>{item.cnj}</p>
                    <p className="mt-0.5 text-xs" style={{ color: C.text400 }}>
                      {item.tipo_peca || 'Peca'} &middot; {formatDate(item.data)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => onExcluir(item.id, e)}
                    className="flex-shrink-0 rounded p-1 text-slate-300 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </aside>
    </>
  )
}
