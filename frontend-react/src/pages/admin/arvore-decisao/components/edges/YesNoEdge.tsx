import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export const YesNoEdge = memo(function YesNoEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const resultado = (data as { resultado?: string })?.resultado ?? 'sim'
  const color = resultado === 'sim' ? '#22c55e' : '#ef4444'

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  return <BaseEdge path={edgePath} style={{ stroke: color, strokeWidth: 2 }} />
})
