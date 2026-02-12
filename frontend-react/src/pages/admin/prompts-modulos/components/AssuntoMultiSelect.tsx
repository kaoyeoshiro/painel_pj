import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { C } from '@/lib/designTokens'
import { ChevronDown } from 'lucide-react'
import type { Subcategoria } from '../types'

// ---- Multi-select de Assuntos ----

export interface AssuntoMultiSelectProps {
  subcategorias: Subcategoria[]
  selected: number[]
  onChange: (ids: number[]) => void
}

export function AssuntoMultiSelect({ subcategorias, selected, onChange }: AssuntoMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = subcategorias.filter(s =>
    s.nome.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-[170px] px-3 py-2 rounded-lg text-sm bg-white text-left flex items-center justify-between"
        style={{ border: `1px solid ${C.gray300}` }}
      >
        <span className="truncate">
          {selected.length > 0
            ? `${selected.length} assunto(s)`
            : 'Todos os assuntos'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: C.text400 }} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg max-h-64 overflow-hidden" style={{ border: `1px solid ${C.gray200}` }}>
          {/* Busca */}
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar assunto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Acoes rapidas */}
          {selected.length > 0 && (
            <div className="px-2 py-1.5 border-b">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs transition-colors"
                style={{ color: C.navy600 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.navy900 }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.navy600 }}
              >
                Limpar seleção
              </button>
            </div>
          )}

          {/* Lista */}
          <div className="overflow-y-auto max-h-44">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: C.text400 }}>Nenhum assunto encontrado</div>
            ) : (
              filtered.map(s => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors"
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    className="rounded accent-[--color-navy-700]"
                  />
                  <span className="truncate">{s.nome}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
