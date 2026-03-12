/**
 * Hook para zoom semântico com 3 níveis e debounce.
 */

import { useCallback, useRef } from 'react'
import { useOnViewportChange } from '@xyflow/react'
import { useArvoreStore } from '../store/useArvoreStore'
import type { ZoomLevel } from '../types'

function getZoomLevel(zoom: number): ZoomLevel {
  if (zoom < 0.35) return 'macro'
  if (zoom < 0.75) return 'medium'
  return 'detail'
}

export function useSemanticZoom() {
  const { zoomLevel, setZoomLevel } = useArvoreStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoomLevelRef = useRef(zoomLevel)
  zoomLevelRef.current = zoomLevel

  const onViewportChange = useCallback(({ zoom }: { zoom: number }) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const newLevel = getZoomLevel(zoom)
      if (newLevel !== zoomLevelRef.current) {
        setZoomLevel(newLevel)
      }
    }, 150)
  }, [setZoomLevel])

  useOnViewportChange({ onChange: onViewportChange })

  return { zoomLevel }
}
