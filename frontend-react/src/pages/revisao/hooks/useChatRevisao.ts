/**
 * Hook de gerenciamento do chat de edição de peças via IA.
 * Gerencia histórico de mensagens, streaming SSE e estado de envio.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useStreamingFetch } from '@/services/api/streaming'
import { fetchChatHistorico } from '../api'
import type { ChatMensagem, SSERevisaoEvent } from '../types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface UseChatRevisaoReturn {
  mensagens: ChatMensagem[]
  isStreaming: boolean
  respostaAtual: string
  enviarMensagem: (texto: string, conteudoAtual: string) => Promise<void>
  abort: () => void
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

/**
 * Gerencia o estado do chat de edição de uma peça específica.
 *
 * @param itemId - ID do item de revisão
 * @param onConteudoAtualizado - Callback disparado ao receber peça atualizada da IA
 */
export function useChatRevisao(
  itemId: number,
  onConteudoAtualizado: (conteudo: string) => void,
): UseChatRevisaoReturn {
  const { toast } = useToast()

  const [mensagens, setMensagens] = useState<ChatMensagem[]>([])
  const [respostaAtual, setRespostaAtual] = useState('')

  // Ref para acessar o conteúdo acumulado no evento sucesso
  // (evita stale closure no onEvent do streaming)
  const respostaAtualRef = useRef('')

  const { start, abort, isStreaming } = useStreamingFetch<SSERevisaoEvent>({
    onEvent: (event) => {
      if (event.tipo === 'chunk') {
        const chunk = event.texto || ''
        respostaAtualRef.current += chunk
        setRespostaAtual((prev) => prev + chunk)
      } else if (event.tipo === 'sucesso') {
        const conteudo = event.conteudo || respostaAtualRef.current

        setMensagens((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant',
            conteudo,
            conteudo_peca_snapshot: conteudo,
            criado_em: new Date().toISOString(),
          },
        ])

        respostaAtualRef.current = ''
        setRespostaAtual('')
        onConteudoAtualizado(conteudo)
      } else if (event.tipo === 'erro') {
        toast({
          title: 'Erro no chat',
          description: event.mensagem || 'Ocorreu um erro ao processar sua solicitação.',
          variant: 'destructive',
        })
        respostaAtualRef.current = ''
        setRespostaAtual('')
      }
    },
    onError: (err) => {
      toast({
        title: 'Erro no chat',
        description: err.message,
        variant: 'destructive',
      })
      respostaAtualRef.current = ''
      setRespostaAtual('')
    },
  })

  // ---------------------------------------------------------------------------
  // Carrega histórico ao montar o componente
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function carregarHistorico() {
      try {
        const data = await fetchChatHistorico(itemId)
        setMensagens(data)
      } catch {
        // Histórico vazio não é erro — apenas ignora
      }
    }

    void carregarHistorico()
  }, [itemId])

  // ---------------------------------------------------------------------------
  // Envio de mensagem
  // ---------------------------------------------------------------------------

  const enviarMensagem = useCallback(
    async (texto: string, conteudoAtual: string) => {
      if (!texto.trim()) return

      // Adiciona mensagem do usuário ao estado local imediatamente
      setMensagens((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'user',
          conteudo: texto,
          conteudo_peca_snapshot: null,
          criado_em: new Date().toISOString(),
        },
      ])

      respostaAtualRef.current = ''
      setRespostaAtual('')

      await start(`/revisao/api/itens/${itemId}/chat`, {
        mensagem: texto,
        conteudo_atual: conteudoAtual,
      })
    },
    [itemId, start],
  )

  return {
    mensagens,
    isStreaming,
    respostaAtual,
    enviarMensagem,
    abort,
  }
}
