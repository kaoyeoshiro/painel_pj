/**
 * Hook para gerenciar expansão/colapso de módulos.
 */

import { useCallback } from 'react'
import type { NodeMouseHandler } from '@xyflow/react'
import { useArvoreStore } from '../store/useArvoreStore'

export function useNodeExpansion() {
  const { data, toggleModule, setDetailPanel } = useArvoreStore()

  /** Click simples: expande/colapsa árvore de decisão */
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'module') {
      const id = (node.data as { id: number }).id
      toggleModule(id)
    }
  }, [toggleModule])

  /** Duplo click: abre detail panel */
  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    if (!data) return

    if (node.type === 'module') {
      const id = (node.data as { id: number }).id
      const modulo = data.modulos.find((m) => m.id === id)
      if (modulo) setDetailPanel({ type: 'module', data: modulo })
    } else if (node.type === 'variable' || node.type === 'orphan-variable') {
      const slug = (node.data as { slug: string }).slug
      const variavel = data.variaveis.find((v) => v.slug === slug)
      if (variavel) setDetailPanel({ type: 'variable', data: variavel })
    }
  }, [data, setDetailPanel])

  return { onNodeClick, onNodeDoubleClick }
}
