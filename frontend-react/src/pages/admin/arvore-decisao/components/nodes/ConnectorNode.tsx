import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConnectorNodeData } from '../../types'

const LABELS: Record<string, string> = {
  and: '&',
  or: '∥',
  not: '!',
}

export const ConnectorNode = memo(function ConnectorNode({ data }: NodeProps) {
  const d = data as ConnectorNodeData
  const isNot = d.connectorType === 'not'

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: isNot ? 'rgba(239, 68, 68, 0.1)' : 'rgba(148, 163, 184, 0.15)',
        border: `2px solid ${isNot ? 'rgba(239, 68, 68, 0.5)' : 'rgba(148, 163, 184, 0.4)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        fontWeight: 700,
        color: isNot ? '#dc2626' : '#64748b',
      }}
    >
      {LABELS[d.connectorType]}
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
