/**
 * Tela de curadoria de modulos do Gerador de Pecas.
 *
 * Exibe os modulos detectados pelo Agente 2, agrupados por categoria,
 * permitindo ao usuario selecionar quais incluir na geracao.
 */

import { X, Check, Layers, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import type { ModuloPreview } from '@/types/gerador-pecas'

// ============================================================================
// Props
// ============================================================================

interface CuradoriaPreviewProps {
  curadoriaModulos: ModuloPreview[]
  curadoriaSelected: Set<number>
  toggleModulo: (id: number) => void
  gerarComCuradoria: () => void
  voltarParaInicio: () => void
}

// ============================================================================
// Componente
// ============================================================================

export function CuradoriaPreview({
  curadoriaModulos,
  curadoriaSelected,
  toggleModulo,
  gerarComCuradoria,
  voltarParaInicio,
}: CuradoriaPreviewProps) {
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
              {curadoriaModulos.length} modulo(s) detectado(s) &mdash; selecione os que deseja incluir
            </p>
          </div>
        </div>
        <button
          onClick={voltarParaInicio}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>
      </div>

      {/* Module groups */}
      {(() => {
        const categorias = new Map<string, ModuloPreview[]>()
        for (const modulo of curadoriaModulos) {
          const cat = modulo.categoria || 'Geral'
          if (!categorias.has(cat)) categorias.set(cat, [])
          categorias.get(cat)!.push(modulo)
        }

        return Array.from(categorias.entries()).map(([categoria, modulos]) => (
          <div key={categoria} className="mb-6">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{categoria}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600">
                {modulos.length}
              </span>
            </div>
            <div className="space-y-2">
              {modulos.map((modulo) => {
                const isSelected = curadoriaSelected.has(modulo.id)
                return (
                  <div
                    key={modulo.id}
                    className={cn(
                      'cursor-pointer rounded-xl border p-4 transition-all',
                      isSelected
                        ? 'border-slate-300 bg-slate-50/50 ring-1 ring-slate-200/50'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                    onClick={() => toggleModulo(modulo.id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModulo(modulo.id) } }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all',
                          isSelected
                            ? 'border-[#253D52] bg-[#253D52] text-white'
                            : 'border-slate-300 bg-white',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{modulo.titulo}</span>
                          {modulo.tag && (
                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              {modulo.tag}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{modulo.conteudo}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      })()}

      {/* Footer actions */}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10" style={{ borderColor: C.gray200, background: C.gray50 }}>
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: C.text500 }}>
            <span className="font-semibold" style={{ color: C.text900 }}>{curadoriaSelected.size}</span> de {curadoriaModulos.length} selecionado(s)
          </p>
          <Button
            onClick={gerarComCuradoria}
            disabled={curadoriaSelected.size === 0}
            className="h-10 gap-2 rounded-xl px-5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            style={{ background: C.navy950 }}
          >
            <Zap className="h-3.5 w-3.5" />
            Gerar com Selecionados
          </Button>
        </div>
      </div>
    </div>
  )
}
