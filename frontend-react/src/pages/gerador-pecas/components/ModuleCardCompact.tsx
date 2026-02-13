/**
 * ModuleCardCompact — Compact module card for curadoria.
 *
 * Displays title + tag badge inline. Clicking opens a detail dialog
 * with full content, activation rule, etc.
 *
 * Two variants:
 *   - "selected": green border, "Selecionado" badge, remove icon on hover
 *   - "available": gray border, "+ Adicionar" button
 */

import React, { useState } from 'react'
import { Trash2, Plus, CheckCircle2 } from 'lucide-react'
import { C } from '@/lib/designTokens'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// ============================================================
// Helpers
// ============================================================

function getTagStyle(tag: string): { bg: string; text: string; border: string } {
  switch (tag) {
    case 'deterministic':
      return { bg: C.successBg, text: C.successText, border: C.successBorder }
    case 'llm':
      return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
    case 'manual':
    case 'busca':
      return { bg: C.warningBgAlt, text: C.warningText, border: C.warningBorder }
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

// ============================================================
// Props
// ============================================================

interface ModuleCardCompactProps {
  modulo: {
    id: number
    titulo: string
    categoria: string
    conteudo: string
    tag: string
    condicao_ativacao?: string | null
  }
  variant: 'selected' | 'available'
  isManual?: boolean
  onRemove?: () => void
  onAdd?: () => void
}

// ============================================================
// Component
// ============================================================

export const ModuleCardCompact = React.memo(function ModuleCardCompact({
  modulo,
  variant,
  isManual = false,
  onRemove,
  onAdd,
}: ModuleCardCompactProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const effectiveTag = isManual ? 'manual' : modulo.tag
  const tagStyle = getTagStyle(effectiveTag)
  const tagLabel = getTagLabel(effectiveTag)
  const isSelected = variant === 'selected'

  const handleCardClick = () => setIsDetailOpen(true)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <>
      {/* Compact Card */}
      <div
        onClick={handleCardClick}
        className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-all hover:bg-gray-50/80"
        style={{
          borderColor: isSelected ? `${C.statusSuccess}4D` : C.gray200,
          background: 'white',
        }}
      >
        {/* Left: Title + Tag */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="truncate text-[13px] font-semibold"
            style={{ color: C.text900 }}
          >
            {modulo.titulo}
          </span>
          <span
            className="whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: tagStyle.bg,
              color: tagStyle.text,
              borderColor: tagStyle.border,
            }}
          >
            {tagLabel}
          </span>
        </div>

        {/* Right: Action */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isSelected ? (
            <>
              <div
                className="flex items-center gap-1 rounded-md px-2 py-0.5"
                style={{ backgroundColor: C.successBg, color: C.successText }}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span className="text-[11px] font-medium">Selecionado</span>
              </div>
              <button
                onClick={(e) => { stop(e); onRemove?.() }}
                className="rounded-md p-1 opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
                aria-label="Remover módulo"
              >
                <Trash2 className="h-3.5 w-3.5" style={{ color: C.statusError }} />
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { stop(e); onAdd?.() }}
              className="flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-white transition-colors hover:opacity-90"
              style={{ background: C.navy700 }}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 text-lg font-semibold" style={{ color: C.text900 }}>
              {modulo.titulo}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detalhes do módulo jurídico
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-4">
            {/* Categoria + Tag inline */}
            <div className="flex items-center gap-3">
              <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: C.gray100, color: C.text500 }}>
                {modulo.categoria}
              </span>
              <span
                className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: tagStyle.bg, color: tagStyle.text, borderColor: tagStyle.border }}
              >
                {tagLabel}
              </span>
            </div>

            {/* Conteúdo */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase" style={{ color: C.text400 }}>Conteúdo</p>
              <div
                className="whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed"
                style={{ backgroundColor: C.gray50, borderColor: C.gray200, color: C.text700 }}
              >
                {modulo.conteudo}
              </div>
            </div>

            {/* Condição de Ativação */}
            {modulo.condicao_ativacao && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase" style={{ color: C.text400 }}>Condição de Ativação</p>
                <div
                  className="whitespace-pre-wrap rounded-lg border p-3 text-sm"
                  style={{ backgroundColor: C.warningBgAlt, borderColor: C.warningBorder, color: C.warningText }}
                >
                  {modulo.condicao_ativacao}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
