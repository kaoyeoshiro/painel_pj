import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { SwimLaneNodeData } from '../../types'
import { C } from '@/lib/designTokens'

const SWIMLANE_COLORS: Record<string, string> = {
  'Mérito': 'rgba(59, 130, 246, 0.08)',
  'Preliminar': 'rgba(249, 115, 22, 0.08)',
  'Eventualidade': 'rgba(34, 197, 94, 0.08)',
  'honorarios': 'rgba(168, 85, 247, 0.08)',
  'Tutela de Urgência': 'rgba(239, 68, 68, 0.08)',
}

const BORDER_COLORS: Record<string, string> = {
  'Mérito': 'rgba(59, 130, 246, 0.3)',
  'Preliminar': 'rgba(249, 115, 22, 0.3)',
  'Eventualidade': 'rgba(34, 197, 94, 0.3)',
  'honorarios': 'rgba(168, 85, 247, 0.3)',
  'Tutela de Urgência': 'rgba(239, 68, 68, 0.3)',
}

export const SwimLaneNode = memo(function SwimLaneNode({ data }: NodeProps) {
  const d = data as SwimLaneNodeData
  const bg = SWIMLANE_COLORS[d.label] ?? 'rgba(148, 163, 184, 0.08)'
  const border = BORDER_COLORS[d.label] ?? 'rgba(148, 163, 184, 0.3)'

  return (
    <div
      style={{
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 200,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: C.text700 }}>{d.label}</span>
        <span style={{ fontSize: 12, color: C.text400 }}>{d.modulosCount} módulos</span>
      </div>
      {d.isCollapsed && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.text400 }}>
          <span>{d.variaveisCount} variáveis</span>
          <span style={{ marginLeft: 12 }}>{d.pctDeterministico.toFixed(0)}% determinístico</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
