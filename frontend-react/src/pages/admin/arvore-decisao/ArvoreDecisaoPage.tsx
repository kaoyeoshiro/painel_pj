/**
 * Página principal da Árvore de Decisão.
 * Renderiza canvas React Flow com swimlanes, módulos e variáveis.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Background,
  Controls,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { createApiClient } from '@/lib/api'

import { SwimLaneNode } from './components/nodes/SwimLaneNode'
import { ModuleNode } from './components/nodes/ModuleNode'
import { ConditionNode } from './components/nodes/ConditionNode'
import { ConnectorNode } from './components/nodes/ConnectorNode'
import { VariableNode } from './components/nodes/VariableNode'
import { OrphanVariableNode } from './components/nodes/OrphanVariableNode'
import { YesNoEdge } from './components/edges/YesNoEdge'
import { DependencyEdge } from './components/edges/DependencyEdge'
import { SharedVarEdge } from './components/edges/SharedVarEdge'
import { Toolbar } from './components/Toolbar'
import { DetailPanel } from './components/DetailPanel'
import { useArvoreDecisaoData } from './hooks/useArvoreDecisaoData'
import { useSemanticZoom } from './hooks/useSemanticZoom'
import { useGraphLayout } from './hooks/useGraphLayout'
import { useNodeExpansion } from './hooks/useNodeExpansion'
import { useArvoreStore } from './store/useArvoreStore'
import { C } from '@/lib/designTokens'

const nodeTypes: NodeTypes = {
  swimlane: SwimLaneNode,
  module: ModuleNode,
  condition: ConditionNode,
  connector: ConnectorNode,
  variable: VariableNode,
  'orphan-variable': OrphanVariableNode,
}

const edgeTypes: EdgeTypes = {
  'yes-no': YesNoEdge,
  dependency: DependencyEdge,
  'shared-var': SharedVarEdge,
}

interface TipoPeca {
  id: number
  nome: string
  titulo: string
}

const promptsApi = createApiClient('/admin/api/prompts-modulos')

/** Componente filho que usa useOnViewportChange — precisa estar dentro do ReactFlow */
function SemanticZoomHandler() {
  useSemanticZoom()
  return null
}

function ArvoreDecisaoInner() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const { loading, error, data } = useArvoreStore()
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])

  // Carregar tipos de peça
  useEffect(() => {
    async function loadTiposPeca() {
      try {
        const resp = await promptsApi.get<TipoPeca[]>('/tipos-peca')
        setTiposPeca(resp)
      } catch {
        // Tipos de peça opcionais
      }
    }
    void loadTiposPeca()
  }, [])

  // Hooks
  useArvoreDecisaoData()
  const { nodes, edges } = useGraphLayout()
  const { onNodeClick, onNodeDoubleClick } = useNodeExpansion()

  // Exportar PNG
  const handleExport = useCallback(() => {
    if (!canvasRef.current) return
    toPng(canvasRef.current, { pixelRatio: 1 }).then((dataUrl) => {
      const link = document.createElement('a')
      link.download = 'arvore-decisao.png'
      link.href = dataUrl
      link.click()
    })
  }, [])

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.text400 }}>
        <p>Erro ao carregar árvore de decisão: {error}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar tiposPeca={tiposPeca} onExport={handleExport} />

      <div style={{ flex: 1, position: 'relative' }} ref={canvasRef}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(255,255,255,0.7)' }}>
            <span style={{ color: C.text400 }}>Carregando...</span>
          </div>
        )}

        {data && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <SemanticZoomHandler />
            <Background />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              style={{ background: '#f8fafc' }}
            />
          </ReactFlow>
        )}

        {!data && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.text400 }}>
            Selecione um grupo para visualizar a árvore de decisão
          </div>
        )}
      </div>

      <DetailPanel />

      {/* CSS para highlight de busca */}
      <style>{`
        .node-match { outline: 2px solid #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); border-radius: 8px; }
        .node-no-match { opacity: 0.2; }
      `}</style>
    </div>
  )
}

/** Wrapper com ReactFlowProvider — necessário para hooks como useOnViewportChange */
export function ArvoreDecisaoPage() {
  return (
    <ReactFlowProvider>
      <ArvoreDecisaoInner />
    </ReactFlowProvider>
  )
}
