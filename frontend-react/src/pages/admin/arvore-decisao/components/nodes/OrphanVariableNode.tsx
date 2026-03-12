import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { VariableNodeData } from '../../types'
import { C } from '@/lib/designTokens'

export const OrphanVariableNode = memo(function OrphanVariableNode({ data }: NodeProps) {
  const d = data as VariableNodeData

  return (
    <div
      style={{
        background: 'rgba(251, 146, 60, 0.06)',
        border: '2px dashed rgba(251, 146, 60, 0.5)',
        borderRadius: 20,
        padding: '6px 14px',
        maxWidth: 200,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text700, wordBreak: 'break-all' }}>
        {d.slug.length > 30 ? d.slug.slice(0, 30) + '…' : d.slug}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: C.text400 }}>{d.tipo}</span>
        <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(251, 146, 60, 0.15)', color: '#ea580c' }}>
          sem vínculo
        </span>
      </div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  )
})
