/**
 * Chatbot colapsável para edição de peças via IA com streaming SSE.
 *
 * Estados:
 *  - Recolhido: barra compacta (~50px) com input e botão de envio.
 *  - Expandido: painel completo (~320px) com histórico de mensagens.
 */

import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { MessageCircle, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react'
import { C } from '@/lib/designTokens'
import { useChatRevisao } from '../../hooks/useChatRevisao'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatRevisaoProps {
  /** ID do item de revisão (usado para historico e streaming) */
  itemId: number
  /** Conteúdo atual da peça (enviado ao backend para contexto) */
  conteudoAtual: string
  /** Callback disparado quando a IA retorna a peça atualizada */
  onConteudoAtualizado: (conteudo: string) => void
  /** Desabilita o chat em estados não editáveis */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Chat de edição colapsável posicionado na parte inferior do painel esquerdo.
 * Permite ao revisor solicitar alterações na peça diretamente à IA via chat.
 */
export function ChatRevisao({
  itemId,
  conteudoAtual,
  onConteudoAtualizado,
  disabled = false,
}: ChatRevisaoProps) {
  const [expandido, setExpandido] = useState(false)
  const [inputText, setInputText] = useState('')

  const mensagensEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { mensagens, isStreaming, respostaAtual, enviarMensagem } = useChatRevisao(
    itemId,
    onConteudoAtualizado,
  )

  // Auto-scroll para o final quando chegam novas mensagens
  useEffect(() => {
    if (expandido) {
      mensagensEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensagens, respostaAtual, expandido])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleEnviar = () => {
    if (!inputText.trim() || disabled || isStreaming) return
    void enviarMensagem(inputText.trim(), conteudoAtual)
    setInputText('')
    setExpandido(true)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const handleInputClick = () => {
    if (!expandido) setExpandido(true)
    inputRef.current?.focus()
  }

  // ---------------------------------------------------------------------------
  // Render — estado recolhido
  // ---------------------------------------------------------------------------

  if (!expandido) {
    return (
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t"
        style={{ borderColor: C.gray200, background: C.gray50, height: 50 }}
      >
        {/* Ícone de chat */}
        <MessageCircle
          className="flex-shrink-0"
          size={16}
          style={{ color: C.navy500 }}
        />

        {/* Input compacto */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={handleInputClick}
          disabled={disabled}
          placeholder={disabled ? 'Chat disponível durante a revisão' : 'Peça uma alteração à IA...'}
          className="flex-1 text-xs rounded-full border px-3 py-1.5 outline-none focus:ring-1"
          style={{
            borderColor: C.gray300,
            color: C.text700,
            background: 'white',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />

        {/* Botão enviar */}
        <button
          onClick={handleEnviar}
          disabled={disabled || !inputText.trim() || isStreaming}
          className="flex-shrink-0 flex items-center justify-center rounded-full w-7 h-7 transition-opacity"
          style={{
            background: disabled || !inputText.trim() ? C.gray200 : C.navy600,
            color: 'white',
            cursor: disabled || !inputText.trim() ? 'not-allowed' : 'pointer',
          }}
          title="Enviar"
        >
          <Send size={12} />
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render — estado expandido
  // ---------------------------------------------------------------------------

  const temConteudo = mensagens.length > 0 || Boolean(respostaAtual)

  return (
    <div
      className="flex-shrink-0 flex flex-col border-t"
      style={{ borderColor: C.gray200, background: 'white', height: 320 }}
    >
      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: C.gray200, background: C.gray50 }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={14} style={{ color: C.navy500 }} />
          <span className="text-xs font-semibold" style={{ color: C.text700 }}>
            Chat de Edição
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs" style={{ color: C.navy500 }}>
              <Loader2 size={10} className="animate-spin" />
              Gerando...
            </span>
          )}
        </div>

        <button
          onClick={() => setExpandido(false)}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          title="Recolher chat"
        >
          <ChevronDown size={14} style={{ color: C.text400 }} />
        </button>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {!temConteudo && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ChevronUp size={20} style={{ color: C.gray300 }} />
            <p className="text-xs text-center" style={{ color: C.text400 }}>
              Envie uma mensagem para editar a peça com IA.
            </p>
          </div>
        )}

        {/* Mensagens do histórico */}
        {mensagens.map((msg) => (
          <MensagemBubble key={msg.id} role={msg.role} conteudo={msg.conteudo} />
        ))}

        {/* Resposta sendo gerada (streaming) */}
        {respostaAtual && (
          <MensagemBubble role="assistant" conteudo={respostaAtual} streaming />
        )}

        {/* Âncora para auto-scroll */}
        <div ref={mensagensEndRef} />
      </div>

      {/* Área de input */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-t flex-shrink-0"
        style={{ borderColor: C.gray200 }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          placeholder={disabled ? 'Chat disponível durante a revisão' : 'Solicite uma alteração na peça...'}
          className="flex-1 text-xs rounded-lg border px-3 py-1.5 outline-none focus:ring-1"
          style={{
            borderColor: C.gray300,
            color: C.text700,
            background: 'white',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          autoFocus
        />

        <button
          onClick={handleEnviar}
          disabled={disabled || !inputText.trim() || isStreaming}
          className="flex-shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity"
          style={{
            background: disabled || !inputText.trim() || isStreaming ? C.gray200 : C.navy600,
            color: disabled || !inputText.trim() || isStreaming ? C.text400 : 'white',
            cursor: disabled || !inputText.trim() || isStreaming ? 'not-allowed' : 'pointer',
          }}
        >
          {isStreaming ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          <span>Enviar</span>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponente: bolha de mensagem
// ---------------------------------------------------------------------------

interface MensagemBubbleProps {
  role: 'user' | 'assistant'
  conteudo: string
  streaming?: boolean
}

function MensagemBubble({ role, conteudo, streaming = false }: MensagemBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed"
        style={{
          background: isUser ? '#eff6ff' : '#f0fdf4',
          color: isUser ? '#1e3a8a' : '#166534',
          border: `1px solid ${isUser ? '#bfdbfe' : '#bbf7d0'}`,
        }}
      >
        <div className="whitespace-pre-wrap break-words">{conteudo}</div>
        {streaming && (
          <span
            className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse rounded-sm"
            style={{ background: '#166534', verticalAlign: 'text-bottom' }}
          />
        )}
      </div>
    </div>
  )
}
