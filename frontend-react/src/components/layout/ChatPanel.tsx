import { useRef, useEffect, useCallback } from 'react'
import { Bot, Send, Sparkles } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { C } from '@/lib/designTokens'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  messages: ChatMessage[]
  inputValue: string
  onInputChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  placeholder?: string
  title?: string
  subtitle?: string
}

/**
 * Painel de chat lateral do PGE Design System.
 * Usado dentro do ContentDialog (prop chatPanel).
 * Header navy com icone laranja, mensagens estilo chat, input na base.
 */
export function ChatPanel({
  messages,
  inputValue,
  onInputChange,
  onSend,
  isSending,
  placeholder = 'Peca uma alteracao...',
  title = 'Assistente de Edicao',
  subtitle = 'Peca alteracoes no documento',
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages, isSending])

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [])

  return (
    <div className="flex w-96 flex-col bg-white">
      {/* Header navy */}
      <div
        className="border-b border-white/10 px-4 py-3"
        style={{ background: C.navy950 }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: C.orange500 }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/95">
              {title}
            </p>
            <p className="text-xs text-white/50">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {/* Mensagem inicial quando vazio */}
          {messages.length === 0 && (
            <div className="flex gap-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: C.navy950 }}
              >
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="max-w-[85%] rounded-lg px-4 py-3" style={{ background: C.gray100 }}>
                <p className="text-sm" style={{ color: C.text700 }}>
                  Ola! Sou o assistente de edicao. Voce pode me pedir alteracoes no documento.
                </p>
              </div>
            </div>
          )}

          {/* Historico de mensagens */}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: C.navy950 }}
                >
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className="max-w-[85%] rounded-lg px-4 py-3"
                style={{
                  background: msg.role === 'user' ? C.navy950 : C.gray100,
                  color: msg.role === 'user' ? 'white' : C.text700,
                }}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: C.orange500 }}
                >
                  <span className="text-xs font-bold text-white">U</span>
                </div>
              )}
            </div>
          ))}

          {/* Indicador de digitacao */}
          {isSending && (
            <div className="flex gap-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: C.navy950 }}
              >
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-lg px-4 py-3" style={{ background: C.gray100 }}>
                <div className="flex gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: C.gray500 }} />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full [animation-delay:0.2s]"
                    style={{ background: C.gray500 }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full [animation-delay:0.4s]"
                    style={{ background: C.gray500 }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4" style={{ background: C.gray50, borderColor: C.gray200 }}>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            onInput={autoResize}
            placeholder={placeholder}
            disabled={isSending}
            rows={2}
            className="w-full resize-none rounded-xl border bg-white py-3 pl-4 pr-12 text-sm leading-relaxed placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2"
            style={{
              borderColor: C.gray200,
              color: C.text700,
              // @ts-expect-error CSS custom focus ring
              '--tw-ring-color': 'rgba(37, 61, 82, 0.10)',
            }}
          />
          <button
            onClick={onSend}
            disabled={isSending || !inputValue.trim()}
            className="absolute bottom-2.5 right-2.5 rounded-lg p-2 text-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
            style={inputValue.trim() ? { background: C.navy950 } : undefined}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs" style={{ color: C.text400 }}>
          Enter para enviar &middot; Shift+Enter para nova linha
        </p>
      </div>
    </div>
  )
}
