/**
 * Hook de gerenciamento de estado e dados da fila de revisão.
 * Centraliza filtros, paginação e busca dos itens e estatísticas.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchItens, fetchEstatisticas } from '../api'
import type { ItemRevisao, Estatisticas } from '../types'

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface FiltrosState {
  tab: string
  status: string
  urgencia: string
  acao: string
  periodo: string
  ordenarPor: string
  ordem: string
}

interface UseFilaRevisaoReturn {
  itens: ItemRevisao[]
  total: number
  estatisticas: Estatisticas | null
  loading: boolean

  // Filtros — getters e setters
  tab: string
  setTab: (v: string) => void
  status: string
  setStatus: (v: string) => void
  urgencia: string
  setUrgencia: (v: string) => void
  acao: string
  setAcao: (v: string) => void
  periodo: string
  setPeriodo: (v: string) => void
  ordenarPor: string
  setOrdenarPor: (v: string) => void
  ordem: string
  setOrdem: (v: string) => void

  // Paginação
  pagina: number
  setPagina: (v: number) => void

  refetch: () => void
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useFilaRevisao(): UseFilaRevisaoReturn {
  // Filtros
  const [tab, setTab] = useState('minha_fila')
  const [status, setStatus] = useState('')
  const [urgencia, setUrgencia] = useState('')
  const [acao, setAcao] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [ordenarPor, setOrdenarPor] = useState('')
  const [ordem, setOrdem] = useState('desc')

  // Paginação
  const [pagina, setPagina] = useState(1)

  // Dados
  const [itens, setItens] = useState<ItemRevisao[]>([])
  const [total, setTotal] = useState(0)
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null)
  const [loading, setLoading] = useState(false)

  // Constrói o objeto de filtros para a API a partir do estado atual
  const buildFiltros = useCallback(
    (filtrosState: FiltrosState, paginaAtual: number) => {
      const filtros: Record<string, string | number> = { pagina: paginaAtual }

      // Envia o tab diretamente para o backend, que tem sua própria lógica de filtro por aba
      if (filtrosState.tab) filtros.tab = filtrosState.tab

      // Filtro de status — sempre enviado junto com tab
      if (filtrosState.status) {
        filtros.status = filtrosState.status
      }

      if (filtrosState.urgencia) filtros.urgencia = filtrosState.urgencia
      if (filtrosState.acao) filtros.acao_sugerida = filtrosState.acao
      if (filtrosState.periodo) filtros.periodo = filtrosState.periodo
      if (filtrosState.ordenarPor) filtros.ordenar_por = filtrosState.ordenarPor
      if (filtrosState.ordem) filtros.ordem = filtrosState.ordem

      return filtros
    },
    [],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const filtros = buildFiltros({ tab, status, urgencia, acao, periodo, ordenarPor, ordem }, pagina)
      const [respItens, respStats] = await Promise.all([
        fetchItens(filtros),
        fetchEstatisticas(),
      ])
      setItens(respItens.itens)
      setTotal(respItens.total)
      setEstatisticas(respStats)
    } catch (err) {
      console.error('Erro ao carregar fila de revisão:', err)
    } finally {
      setLoading(false)
    }
  }, [tab, status, urgencia, acao, periodo, ordenarPor, ordem, pagina, buildFiltros])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return {
    itens,
    total,
    estatisticas,
    loading,

    tab,
    setTab,
    status,
    setStatus,
    urgencia,
    setUrgencia,
    acao,
    setAcao,
    periodo,
    setPeriodo,
    ordenarPor,
    setOrdenarPor,
    ordem,
    setOrdem,

    pagina,
    setPagina,

    refetch: loadData,
  }
}
