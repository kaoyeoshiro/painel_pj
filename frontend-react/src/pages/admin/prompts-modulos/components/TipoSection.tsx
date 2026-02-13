import { useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { C } from '@/lib/designTokens'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Settings, FileText, Lightbulb } from 'lucide-react'
import type { PromptModulo, TipoPrompt } from '../types'
import { ModuloItem } from './ModuloItem'

// ---- Configuracao visual por tipo (alinhado ao legado) ----
// eslint-disable-next-line react-refresh/only-export-components -- constante de config usada junto com componentes
export const TIPO_CONFIG: Record<TipoPrompt, {
  label: string
  Icon: typeof Settings
  bgHeader: string
  borderHeader: string
  iconBg: string
  iconColor: string
  titleColor: string
  countBg: string
  countColor: string
}> = {
  base: {
    label: 'Base (Prompt do Sistema)',
    Icon: Settings,
    bgHeader: C.navy50,
    borderHeader: C.navy200,
    iconBg: C.navy100,
    iconColor: C.navy700,
    titleColor: C.navy950,
    countBg: C.navy200,
    countColor: C.navy800,
  },
  peca: {
    label: 'Peças (Estrutura/Template)',
    Icon: FileText,
    bgHeader: C.gray50,
    borderHeader: C.gray200,
    iconBg: C.navy100,
    iconColor: C.navy600,
    titleColor: C.text900,
    countBg: C.gray200,
    countColor: C.text700,
  },
  conteudo: {
    label: 'Conteúdo (Teses e Argumentos)',
    Icon: Lightbulb,
    bgHeader: C.orange50,
    borderHeader: C.orange200,
    iconBg: C.orange100,
    iconColor: C.orange600,
    titleColor: C.text900,
    countBg: C.orange200,
    countColor: C.orange600,
  },
}

// ---- Secao de tipo simples (Base e Peca) ----

export interface TipoSectionProps {
  tipo: TipoPrompt
  modulos: PromptModulo[]
  onEdit: (m: PromptModulo) => void
  onDelete: (m: PromptModulo) => void
  onToggle: (m: PromptModulo) => void
  onHistory: (m: PromptModulo) => void
  onMoveUp: (m: PromptModulo) => void
  onMoveDown: (m: PromptModulo) => void
  onDragReorder: (reordered: { id: number; ordem: number }[]) => void
}

export function TipoSection({ tipo, modulos, onEdit, onDelete, onToggle, onHistory, onMoveUp, onMoveDown, onDragReorder }: TipoSectionProps) {
  const config = TIPO_CONFIG[tipo]
  const { Icon } = config
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )
  const sorted = [...modulos].sort((a, b) => a.ordem - b.ordem)
  const ids = sorted.map(m => m.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sorted.findIndex(m => m.id === active.id)
    const newIndex = sorted.findIndex(m => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(sorted, oldIndex, newIndex)
    onDragReorder(reordered.map((m, i) => ({ id: m.id, ordem: i })))
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${C.gray200}` }}>
      {/* Header do tipo */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: config.bgHeader, borderBottom: `1px solid ${config.borderHeader}` }}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: config.iconBg }}>
          <Icon className="h-4 w-4" style={{ color: config.iconColor }} />
        </div>
        <h3 className="font-semibold" style={{ color: config.titleColor }}>{config.label}</h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: config.countBg, color: config.countColor }}>
          {modulos.length}
        </span>
      </div>

      {/* Lista de modulos */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="divide-y" style={{ borderColor: C.gray100 }}>
            {sorted.map((modulo, idx) => (
              <ModuloItem
                key={modulo.id}
                modulo={modulo}
                showCategoria={true}
                showSubcategoria={true}
                showModoBadge={false}
                isFirst={idx === 0}
                isLast={idx === sorted.length - 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onHistory={onHistory}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ---- Secao de Conteudo com categorias colapsaveis ----

export interface CategoriaGroupProps {
  categoria: string
  modulos: PromptModulo[]
  subcategoriasNomes: string[]
  onEdit: (m: PromptModulo) => void
  onDelete: (m: PromptModulo) => void
  onToggle: (m: PromptModulo) => void
  onHistory: (m: PromptModulo) => void
  onMoveUp: (m: PromptModulo) => void
  onMoveDown: (m: PromptModulo) => void
  onDragReorder: (reordered: { id: number; ordem: number }[]) => void
}

export function CategoriaGroup({ categoria, modulos, subcategoriasNomes, onEdit, onDelete, onToggle, onHistory, onMoveUp, onMoveDown, onDragReorder }: CategoriaGroupProps) {
  const [aberto, setAberto] = useState(true)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )
  const sorted = [...modulos].sort((a, b) => a.ordem - b.ordem)
  const ids = sorted.map(m => m.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sorted.findIndex(m => m.id === active.id)
    const newIndex = sorted.findIndex(m => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(sorted, oldIndex, newIndex)
    onDragReorder(reordered.map((m, i) => ({ id: m.id, ordem: i })))
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.gray200}` }}>
      {/* Cabecalho da categoria — clicavel para colapsar */}
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center gap-2 px-4 py-3 transition-colors text-left"
        style={{ background: C.gray50 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
        onMouseLeave={(e) => { e.currentTarget.style.background = C.gray50 }}
      >
        {aberto ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: C.text500 }} />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: C.text500 }} />
        )}
        <span className="font-semibold" style={{ color: C.text900 }}>{categoria}</span>
        <Badge variant="secondary" className="text-xs">
          {modulos.length} módulo{modulos.length !== 1 ? 's' : ''}
        </Badge>
        {/* Subcategorias unicas como tags no cabecalho */}
        {subcategoriasNomes.length > 0 && (
          <div className="flex items-center gap-1 ml-2 flex-wrap">
            {subcategoriasNomes.map((nome, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] rounded-full" style={{ background: C.navy50, color: C.navy600 }}>
                {nome}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Lista de modulos */}
      {aberto && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="divide-y" style={{ borderColor: C.gray100 }}>
              {sorted.map((modulo, idx) => (
                <ModuloItem
                  key={modulo.id}
                  modulo={modulo}
                  showCategoria={false}
                  showSubcategoria={true}
                  showModoBadge={true}
                  isFirst={idx === 0}
                  isLast={idx === sorted.length - 1}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggle={onToggle}
                  onHistory={onHistory}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
