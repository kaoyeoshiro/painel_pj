/**
 * Hook de gerenciamento de estado e ações do item de revisão individual.
 * Centraliza o carregamento, refresh e todas as ações disponíveis sobre o item.
 */

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  fetchItem,
  iniciarRevisao,
  aprovarItem,
  rejeitarItem,
  encaminharItem,
  marcarInserido,
  desfazerItem,
} from '../api'
import type { ItemRevisao } from '../types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface UseRevisaoItemReturn {
  item: ItemRevisao | null
  loading: boolean
  refetch: () => void
  handleIniciarRevisao: () => Promise<void>
  handleAprovar: (conteudo: string) => Promise<void>
  handleRejeitar: (motivo: string, acao: string) => Promise<void>
  handleEncaminhar: (assessorId: number) => Promise<void>
  handleMarcarInserido: () => Promise<void>
  handleDesfazer: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

/**
 * Gerencia o estado e as ações de um item de revisão específico.
 *
 * @param itemId - ID do item a ser carregado e gerenciado
 * @returns Estado do item, flag de carregamento e funções de ação
 */
export function useRevisaoItem(itemId: number): UseRevisaoItemReturn {
  const { toast } = useToast()

  const [item, setItem] = useState<ItemRevisao | null>(null)
  const [loading, setLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // Carregamento
  // ---------------------------------------------------------------------------

  const loadItem = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchItem(itemId)
      setItem(data)
    } catch (err) {
      console.error('Erro ao carregar item de revisão:', err)
      toast({
        title: 'Erro ao carregar item',
        description: 'Não foi possível buscar os dados do item. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [itemId, toast])

  useEffect(() => {
    void loadItem()
  }, [loadItem])

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  const handleIniciarRevisao = useCallback(async () => {
    try {
      const updated = await iniciarRevisao(itemId)
      setItem(updated)
      toast({ title: 'Revisão iniciada', description: 'O item está em revisão.' })
    } catch (err) {
      console.error('Erro ao iniciar revisão:', err)
      toast({
        title: 'Erro ao iniciar revisão',
        description: 'Não foi possível iniciar a revisão. Tente novamente.',
        variant: 'destructive',
      })
    }
  }, [itemId, toast])

  const handleAprovar = useCallback(
    async (conteudo: string) => {
      try {
        const updated = await aprovarItem(itemId, conteudo)
        setItem(updated)
        toast({ title: 'Item aprovado', description: 'A peça foi aprovada com sucesso.' })
      } catch (err) {
        console.error('Erro ao aprovar item:', err)
        toast({
          title: 'Erro ao aprovar',
          description: 'Não foi possível aprovar o item. Tente novamente.',
          variant: 'destructive',
        })
      }
    },
    [itemId, toast],
  )

  const handleRejeitar = useCallback(
    async (motivo: string, acao: string) => {
      try {
        const updated = await rejeitarItem(itemId, motivo, acao)
        setItem(updated)
        toast({ title: 'Item rejeitado', description: 'O item foi rejeitado.' })
      } catch (err) {
        console.error('Erro ao rejeitar item:', err)
        toast({
          title: 'Erro ao rejeitar',
          description: 'Não foi possível rejeitar o item. Tente novamente.',
          variant: 'destructive',
        })
      }
    },
    [itemId, toast],
  )

  const handleEncaminhar = useCallback(
    async (assessorId: number) => {
      try {
        const updated = await encaminharItem(itemId, assessorId)
        setItem(updated)
        toast({
          title: 'Item encaminhado',
          description: 'O item foi encaminhado ao assessor selecionado.',
        })
      } catch (err) {
        console.error('Erro ao encaminhar item:', err)
        toast({
          title: 'Erro ao encaminhar',
          description: 'Não foi possível encaminhar o item. Tente novamente.',
          variant: 'destructive',
        })
      }
    },
    [itemId, toast],
  )

  const handleMarcarInserido = useCallback(async () => {
    try {
      const updated = await marcarInserido(itemId)
      setItem(updated)
      toast({
        title: 'Marcado como inserido',
        description: 'O item foi concluído com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao marcar como inserido:', err)
      toast({
        title: 'Erro ao marcar inserido',
        description: 'Não foi possível marcar o item como inserido. Tente novamente.',
        variant: 'destructive',
      })
    }
  }, [itemId, toast])

  const handleDesfazer = useCallback(async () => {
    try {
      const updated = await desfazerItem(itemId)
      setItem(updated)
      toast({
        title: 'Aprovação desfeita',
        description: 'O item voltou para revisão.',
      })
    } catch (err) {
      console.error('Erro ao desfazer aprovação:', err)
      toast({
        title: 'Erro ao desfazer',
        description: 'Não foi possível desfazer a ação. Tente novamente.',
        variant: 'destructive',
      })
    }
  }, [itemId, toast])

  return {
    item,
    loading,
    refetch: loadItem,
    handleIniciarRevisao,
    handleAprovar,
    handleRejeitar,
    handleEncaminhar,
    handleMarcarInserido,
    handleDesfazer,
  }
}
