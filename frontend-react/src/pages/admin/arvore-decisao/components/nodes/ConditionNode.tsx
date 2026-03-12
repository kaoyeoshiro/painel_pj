import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConditionNodeData } from '../../types'

export const ConditionNode = memo(function ConditionNode({ data }: NodeProps) {
  const d = data as ConditionNodeData
  const displayValue = typeof d.value === 'boolean' ? String(d.value) :
    Array.isArray(d.value) ? `[${d.value.length}]` :
    d.value != null ? String(d.value) : ''

  return (
    <div
      style={{
        width: 80,
        height: 80,
        transform: 'rotate(45deg)',
        background: 'rgba(250, 204, 21, 0.15)',
        border: '2px solid rgba(250, 204, 21, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ transform: 'rotate(-45deg)', textAlign: 'center', fontSize: 10 }}>
        <div style={{ fontWeight: 600 }}>{d.operator}</div>
        {displayValue && <div style={{ color: '#64748b', marginTop: 2 }}>{displayValue}</div>}
      </div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
