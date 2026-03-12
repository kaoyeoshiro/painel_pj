/**
 * Converte regras AST JSON em nós e edges do React Flow.
 */

import type { Node, Edge } from '@xyflow/react'
import type { ASTRule, ModuloDTO } from '../types'

/** Cria gerador de IDs determinísticos por escopo de módulo */
function createIdGenerator(moduleId: string) {
  const counters = new Map<string, number>()
  return (prefix: string): string => {
    const count = (counters.get(prefix) ?? 0) + 1
    counters.set(prefix, count)
    return `${moduleId}-${prefix}-${count}`
  }
}

interface RuleNodesResult {
  nodes: Node[]
  edges: Edge[]
}

/**
 * Converte a regra AST de um módulo em nós React Flow.
 */
export function ruleToNodes(
  moduleNodeId: string,
  regra: ASTRule | null,
  label?: string,
): RuleNodesResult {
  if (!regra) return { nodes: [], edges: [] }

  const nextId = createIdGenerator(moduleNodeId)
  const nodes: Node[] = []
  const edges: Edge[] = []
  const edgeKeys = new Set<string>()

  function addEdge(edge: Edge): void {
    const key = `${edge.source}→${edge.target}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push(edge)
  }

  function processNode(rule: ASTRule, parentId: string, edgeLabel?: string): void {
    if (rule.type === 'condition') {
      const condId = nextId('cond')
      nodes.push({
        id: condId,
        type: 'condition',
        position: { x: 0, y: 0 },
        data: {
          operator: rule.operator,
          value: rule.value,
          variable: rule.variable,
        },
      })
      addEdge({
        id: `${parentId}-${condId}`,
        source: parentId,
        target: condId,
        type: 'rule',
        label: edgeLabel,
      })

      const varId = `var-${rule.variable}`
      if (!nodes.find((n) => n.id === varId)) {
        nodes.push({
          id: varId,
          type: 'variable',
          position: { x: 0, y: 0 },
          data: {
            slug: rule.variable,
            label: rule.variable,
            tipo: '',
            isOrfa: false,
          },
        })
      }
      addEdge({
        id: `${condId}-${varId}`,
        source: condId,
        target: varId,
        type: 'yes-no',
        data: { resultado: 'sim' },
      })
    } else if (rule.type === 'and' || rule.type === 'or') {
      const connId = nextId('conn')
      nodes.push({
        id: connId,
        type: 'connector',
        position: { x: 0, y: 0 },
        data: { connectorType: rule.type },
      })
      addEdge({
        id: `${parentId}-${connId}`,
        source: parentId,
        target: connId,
        type: 'rule',
        label: edgeLabel,
      })
      for (const cond of rule.conditions) {
        processNode(cond, connId)
      }
    } else if (rule.type === 'not') {
      const connId = nextId('conn')
      nodes.push({
        id: connId,
        type: 'connector',
        position: { x: 0, y: 0 },
        data: { connectorType: 'not' },
      })
      addEdge({
        id: `${parentId}-${connId}`,
        source: parentId,
        target: connId,
        type: 'rule',
        label: edgeLabel,
      })
      processNode(rule.condition, connId)
    }
  }

  processNode(regra, moduleNodeId, label)
  return { nodes, edges }
}

/**
 * Gera todos os nós e edges de decisão para um módulo.
 */
export function moduleRuleToNodes(modulo: ModuloDTO): RuleNodesResult {
  const moduleNodeId = `module-${modulo.id}`
  const allNodes: Node[] = []
  const allEdges: Edge[] = []

  const primary = ruleToNodes(moduleNodeId, modulo.regra)
  allNodes.push(...primary.nodes)
  allEdges.push(...primary.edges)

  if (modulo.fallback_habilitado && modulo.regra_secundaria) {
    const fallback = ruleToNodes(moduleNodeId, modulo.regra_secundaria, 'Fallback')
    allNodes.push(...fallback.nodes)
    allEdges.push(...fallback.edges)
  }

  return { nodes: allNodes, edges: allEdges }
}
