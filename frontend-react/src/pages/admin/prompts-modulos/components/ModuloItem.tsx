import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { C } from '@/lib/designTokens'
import {
  Edit2, Trash2, ToggleLeft, ToggleRight,
  History, ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react'
import type { PromptModulo } from '../types'

// ---- Configuracao de badge de modo ----

function getModoBadge(modo: string) {
  if (modo === 'deterministic') {
    return { label: 'Regra', bg: C.gray100, color: C.text700 }
  }
  return { label: 'LLM', bg: C.navy100, color: C.navy700 }
}

// ---- Componente de item de modulo ----

export interface ModuloItemProps {
  modulo: PromptModulo
  showCategoria?: boolean
  showSubcategoria?: boolean
  showModoBadge?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit: (m: PromptModulo) => void
  onDelete: (m: PromptModulo) => void
  onToggle: (m: PromptModulo) => void
  onHistory: (m: PromptModulo) => void
  onMoveUp?: (m: PromptModulo) => void
  onMoveDown?: (m: PromptModulo) => void
}

export function ModuloItem({ modulo, showCategoria, showSubcategoria = true, showModoBadge = true, isFirst, isLast, onEdit, onDelete, onToggle, onHistory, onMoveUp, onMoveDown }: ModuloItemProps) {
  const modoEfetivo = modulo.effective_activation_mode || modulo.modo_ativacao
  const modo = getModoBadge(modoEfetivo)

  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: modulo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    background: isDragging ? 'white' : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-start gap-2 px-4 py-3 transition-colors ${
        !modulo.ativo ? 'opacity-50' : ''
      }`}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = C.gray50 }}
      onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = isDragging ? 'white' : 'transparent' }}
    >
      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        type="button"
        className="flex-shrink-0 p-1 rounded cursor-grab active:cursor-grabbing touch-none mt-0.5"
        style={{ color: C.gray400 }}
        title="Arraste para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Conteudo principal */}
      <div className="flex-1 min-w-0">
        {/* Linha 1: Titulo + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium" style={{ color: C.text900 }}>{modulo.titulo}</span>

          {/* Badge de subcategoria (campo texto) */}
          {showSubcategoria && modulo.subcategoria && (
            <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: C.navy50, color: C.navy700 }}>
              {modulo.subcategoria}
            </span>
          )}

          {/* Badge de status */}
          {modulo.ativo ? (
            <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: C.successBg, color: C.statusSuccess }}>Ativo</span>
          ) : (
            <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: C.gray100, color: C.text400 }}>Inativo</span>
          )}

          {/* Badge de modo de ativacao */}
          {showModoBadge && (
            <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: modo.bg, color: modo.color }}>
              {modo.label}
            </span>
          )}

          {/* Badge de categoria (para base/peca) */}
          {showCategoria && modulo.categoria && (
            <span className="px-2 py-0.5 text-xs rounded" style={{ background: C.gray100, color: C.text500 }}>
              {modulo.categoria}
            </span>
          )}

          {/* Versao */}
          <span className="text-xs" style={{ color: C.text400 }}>v{modulo.versao}</span>
        </div>

        {/* Linha 2: Codigo (nome) + subcategorias M2M */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {modulo.nome && (
            <code className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: C.gray100, color: C.text500 }}>
              {modulo.nome}
            </code>
          )}
          {modulo.subcategorias_nomes && modulo.subcategorias_nomes.length > 0 && (
            <>
              {modulo.subcategorias_nomes.map((nome, i) => (
                <span key={i} className="px-1.5 py-0.5 text-[10px] rounded-full" style={{ background: C.navy50, color: C.navy600 }}>
                  {nome}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Acoes */}
      <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
        {/* Botoes de reordenacao */}
        <div className="flex flex-col mr-1">
          <button
            type="button"
            onClick={() => onMoveUp?.(modulo)}
            disabled={isFirst}
            title="Mover para cima"
            className="p-0.5 rounded transition-colors disabled:opacity-20 disabled:cursor-default"
            style={{ color: C.text400 }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = C.gray200 }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown?.(modulo)}
            disabled={isLast}
            title="Mover para baixo"
            className="p-0.5 rounded transition-colors disabled:opacity-20 disabled:cursor-default"
            style={{ color: C.text400 }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = C.gray200 }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggle(modulo)}
          title={modulo.ativo ? 'Desativar' : 'Ativar'}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: modulo.ativo ? C.statusSuccess : C.text400 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.gray200 }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          {modulo.ativo ? (
            <ToggleRight className="h-4 w-4" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onHistory(modulo)}
          title="Historico"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: C.text500 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.gray200 }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <History className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onEdit(modulo)}
          title="Editar"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: C.navy700 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.gray200 }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(modulo)}
          title="Excluir"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: C.statusError }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.errorBg }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}
