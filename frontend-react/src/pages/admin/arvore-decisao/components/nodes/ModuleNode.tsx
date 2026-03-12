import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ModuleNodeData } from '../../types'
import { C } from '@/lib/designTokens'

export const ModuleNode = memo(function ModuleNode({ data }: NodeProps) {
  const d = data as ModuleNodeData
  const isDet = d.modoAtivacao === 'deterministic'

  return (
    <div
      style={{
        background: '#fff',
        border: `2px solid ${isDet ? '#22c55e' : '#8b5cf6'}`,
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 160,
        maxWidth: 220,
        cursor: 'pointer',
        boxShadow: d.isExpanded ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: C.text700, lineHeight: 1.3 }}>
        {d.titulo.length > 40 ? d.titulo.slice(0, 40) + '…' : d.titulo}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: isDet ? 'rgba(34, 197, 94, 0.1)' : 'rgba(139, 92, 246, 0.1)',
            color: isDet ? '#16a34a' : '#7c3aed',
          }}
        >
          {isDet ? 'determinístico' : 'LLM'}
        </span>
        {d.variaveisCount > 0 && (
          <span style={{ fontSize: 10, color: C.text400 }}>{d.variaveisCount} vars</span>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
