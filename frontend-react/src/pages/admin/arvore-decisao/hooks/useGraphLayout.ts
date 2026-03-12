/**
 * Hook para calcular layout automático do grafo usando dagre.
 */

import { useMemo } from 'react'
import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import { useArvoreStore } from '../store/useArvoreStore'
import { moduleRuleToNodes } from '../utils/ruleToNodes'
import { moduloMatchesSearch, variavelMatchesSearch } from '../utils/searchHighlight'
import type { ModuloDTO, VariavelDTO } from '../types'

const DAGRE_CONFIG = {
  rankdir: 'LR' as const,
  align: 'DL' as const,
  nodesep: 150,
  ranksep: 200,
}

/** Dimensões por tipo de nó */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  swimlane: { width: 250, height: 60 },
  module: { width: 200, height: 56 },
  condition: { width: 80, height: 80 },
  connector: { width: 36, height: 36 },
  variable: { width: 180, height: 48 },
  'orphan-variable': { width: 180, height: 48 },
}

export function useGraphLayout() {
  const { data, zoomLevel, expandedModules, searchTerm, showOrphans } = useArvoreStore()

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] }

    const allNodes: Node[] = []
    const allEdges: Edge[] = []

    // Agrupar módulos por categoria
    const categorias = new Map<string, ModuloDTO[]>()
    for (const m of data.modulos) {
      const cat = m.categoria
      if (!categorias.has(cat)) categorias.set(cat, [])
      categorias.get(cat)!.push(m)
    }

    // Criar nós de módulo
    for (const m of data.modulos) {
      const moduleId = `module-${m.id}`
      allNodes.push({
        id: moduleId,
        type: 'module',
        position: { x: 0, y: 0 },
        data: {
          id: m.id,
          titulo: m.titulo,
          modoAtivacao: m.modo_ativacao,
          variaveisCount: m.variaveis_usadas.length,
          isExpanded: expandedModules.has(m.id),
        },
        hidden: zoomLevel === 'macro',
      })

      // Se expandido, gerar árvore de decisão
      if (expandedModules.has(m.id)) {
        const { nodes: ruleNodes, edges: ruleEdges } = moduleRuleToNodes(m)
        allNodes.push(...ruleNodes)
        allEdges.push(...ruleEdges)
      }
    }

    // Criar nós de variável (não-órfãs, usadas por módulos expandidos)
    const varMap = new Map<string, VariavelDTO>()
    for (const v of data.variaveis) {
      if (!v.is_orfa) varMap.set(v.slug, v)
    }

    // Enriquecer nós de variável gerados por ruleToNodes com dados do backend
    for (const node of allNodes) {
      if (node.type === 'variable' && varMap.has(node.id.replace('var-', ''))) {
        const v = varMap.get(node.id.replace('var-', ''))!
        node.data = {
          slug: v.slug,
          label: v.label,
          tipo: v.tipo,
          isOrfa: false,
        }
      }
    }

    // Variáveis órfãs
    if (showOrphans) {
      for (const v of data.variaveis) {
        if (!v.is_orfa) continue
        allNodes.push({
          id: `orphan-${v.slug}`,
          type: 'orphan-variable',
          position: { x: 0, y: 0 },
          data: {
            slug: v.slug,
            label: v.label,
            tipo: v.tipo,
            isOrfa: true,
          },
        })
      }
    }

    // Edges de dependência entre variáveis
    for (const v of data.variaveis) {
      if (v.depends_on) {
        const sourceId = `var-${v.slug}`
        const targetId = `var-${v.depends_on}`
        if (allNodes.find((n) => n.id === sourceId) && allNodes.find((n) => n.id === targetId)) {
          allEdges.push({
            id: `dep-${v.slug}-${v.depends_on}`,
            source: sourceId,
            target: targetId,
            type: 'dependency',
          })
        }
      }
    }

    // Aplicar layout dagre
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph(DAGRE_CONFIG)

    for (const node of allNodes) {
      if (node.hidden) continue
      const dim = NODE_DIMENSIONS[node.type ?? 'module'] ?? { width: 100, height: 40 }
      g.setNode(node.id, { width: dim.width, height: dim.height })
    }
    for (const edge of allEdges) {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target)
      }
    }

    dagre.layout(g)

    // Aplicar posições calculadas
    for (const node of allNodes) {
      if (node.hidden) continue
      const pos = g.node(node.id)
      if (pos) {
        const dim = NODE_DIMENSIONS[node.type ?? 'module'] ?? { width: 100, height: 40 }
        node.position = { x: pos.x - dim.width / 2, y: pos.y - dim.height / 2 }
      }
    }

    // Aplicar classes de highlight (busca)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      for (const node of allNodes) {
        if (node.type === 'module') {
          const m = data.modulos.find((mod) => mod.id === (node.data as { id: number }).id)
          node.className = m && moduloMatchesSearch(m, searchTerm) ? 'node-match' : 'node-no-match'
        } else if (node.type === 'variable' || node.type === 'orphan-variable') {
          const slug = (node.data as { slug: string }).slug
          const v = data.variaveis.find((vr) => vr.slug === slug)
          node.className = v && variavelMatchesSearch(v, searchTerm) ? 'node-match' : 'node-no-match'
        }
      }
    }

    return { nodes: allNodes, edges: allEdges }
  }, [data, zoomLevel, expandedModules, searchTerm, showOrphans])

  return { nodes, edges }
}
