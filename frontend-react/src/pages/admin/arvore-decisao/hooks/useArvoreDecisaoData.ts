/**
 * Hook para buscar dados do endpoint de árvore de decisão.
 */

import { useEffect } from 'react'
import { createApiClient } from '@/lib/api'
import { useArvoreStore } from '../store/useArvoreStore'
import type { ArvoreDecisaoResponse } from '../types'

const geradorAdminApi = createApiClient('/admin/api/gerador-pecas-admin')

export function useArvoreDecisaoData() {
  const { grupoId, tipoPecaId, showOrphans, setData, setLoading, setError } = useArvoreStore()

  useEffect(() => {
    if (!grupoId) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          grupo_id: String(grupoId),
          include_orphans: String(showOrphans),
        })
        if (tipoPecaId) params.append('tipo_peca_id', String(tipoPecaId))

        const data = await geradorAdminApi.get<ArvoreDecisaoResponse>(
          `/arvore-decisao?${params.toString()}`
        )
        if (!cancelled) setData(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchData()
    return () => { cancelled = true }
  }, [grupoId, tipoPecaId, showOrphans])
}
