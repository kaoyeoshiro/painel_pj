import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { VariableNodeData } from '../../types'
import { C } from '@/lib/designTokens'

export const VariableNode = memo(function VariableNode({ data }: NodeProps) {
  const d = data as VariableNodeData

  return (
    <div
      style={{
        background: 'rgba(59, 130, 246, 0.08)',
        border: '2px solid rgba(59, 130, 246, 0.4)',
        borderRadius: 20,
        padding: '6px 14px',
        maxWidth: 200,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text700, wordBreak: 'break-all' }}>
        {d.slug.length > 30 ? d.slug.slice(0, 30) + '…' : d.slug}
      </div>
      <div style={{ fontSize: 10, color: C.text400, marginTop: 2 }}>{d.tipo}</div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  )
})
