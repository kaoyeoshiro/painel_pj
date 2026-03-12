import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { RankingResponse } from '../types'

/**
 * Hook que busca o ranking de ativações de módulos para um grupo.
 * Refetch automático quando groupId muda.
 */
export function useRankingModulos(groupId: number) {
  const { toast } = useToast()
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRanking = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminApi.get<RankingResponse>(
        `/admin/api/prompts-modulos/ranking?group_id=${groupId}`
      )
      setData(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(msg)
      toast({
        title: 'Erro ao carregar ranking',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [groupId, toast])

  useEffect(() => {
    fetchRanking()
  }, [fetchRanking])

  return {
    ranking: data?.ranking ?? [],
    metadata: data?.metadata ?? {
      total_modulos_ativos: 0,
      total_geracoes_analisadas: 0,
      modulos_nunca_ativados: 0,
    },
    loading,
    error,
    refetch: fetchRanking,
  }
}
