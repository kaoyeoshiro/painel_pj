import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export const SharedVarEdge = memo(function SharedVarEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      style={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
    />
  )
})
