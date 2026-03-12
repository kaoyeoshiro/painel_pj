import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export const DependencyEdge = memo(function DependencyEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      style={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '6 4' }}
    />
  )
})
