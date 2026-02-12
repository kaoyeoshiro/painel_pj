/**
 * Vista de resultado do Gerador de Pecas (split view).
 *
 * Coluna esquerda: documento gerado com barra de acoes e feedback inline.
 * Coluna direita: painel de chat com sugestoes e historico de mensagens.
 */

import {
  Download,
  Copy,
  RotateCcw,
  Star,
  Send,
  Bot,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { C, FONT_DOC, FONT_UI } from '@/lib/designTokens'
import type { UseGeradorPecasReturn } from '../hooks/useGeradorPecas'
import { CHAT_SUGESTOES } from '../types'

// ============================================================================
// Props
// ============================================================================

interface ResultadoViewProps {
  h: UseGeradorPecasReturn
}

// ============================================================================
// Componente
// ============================================================================

export function ResultadoView({ h }: ResultadoViewProps) {
  return (
    <div className="-mx-4 flex h-full min-h-0 sm:-mx-6 lg:-mx-8">

      {/* -- Coluna do documento -- */}
      <main className="flex min-w-0 flex-1 flex-col p-5 pb-3">
        {/* Meta bar */}
        <div className="mb-3 flex flex-shrink-0 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Peca gerada
            </span>
            <span className="text-xs text-slate-400">
              {h.tipoPecaResultado && <>{h.tipoPecaResultado} &middot; </>}
              {h.numeroCNJ_raw && <>{h.numeroCNJ_raw} &middot; </>}
              {new Date().toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div className="flex items-center">
            {[
              { icon: Download, label: 'DOCX', action: h.exportarDocx, tooltip: 'Exportar como Word' },
              { icon: Copy, label: 'Copiar', action: h.copiarMinuta, tooltip: 'Copiar texto' },
              { icon: RotateCcw, label: 'Versoes', action: h.abrirHistoricoVersoes, tooltip: 'Historico de versoes' },
            ].map((btn) => (
              <Tooltip key={btn.label}>
                <TooltipTrigger asChild>
                  <button
                    onClick={btn.action}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-700 hover:shadow-sm"
                  >
                    <btn.icon className="h-3.5 w-3.5" />
                    {btn.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{btn.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Document card */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
          <div className="custom-scroll h-full overflow-y-auto px-10 py-10" style={{ fontFamily: FONT_DOC }}>
            <div
              className="prose-legal max-w-none"
              dangerouslySetInnerHTML={{ __html: h.minutaHtml }}
            />

            {/* Feedback — below document */}
            {!h.showFeedback && h.geracaoId && (
              <div className="mt-12 border-t border-slate-100 pt-8">
                <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-5 text-center" style={{ fontFamily: FONT_UI }}>
                  <p className="text-[15px] font-medium text-slate-600">Qual a qualidade desta geracao?</p>
                  <p className="mt-1 text-xs text-slate-400">Sua avaliacao ajuda a melhorar o sistema</p>
                  <div className="mt-3 flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((nota) => (
                      <button
                        key={nota}
                        onClick={() => { h.setFeedbackNota(nota); h.setShowFeedback(true) }}
                        className="rounded-lg p-1.5 transition-transform hover:scale-110"
                        aria-label={`Nota ${nota}`}
                      >
                        <Star
                          className={cn(
                            'h-6 w-6 transition-colors',
                            h.feedbackNota && nota <= h.feedbackNota
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300 hover:text-amber-300',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="h-10" />
          </div>
        </div>
      </main>

      {/* -- Painel de chat -- */}
      <div className="hidden w-80 flex-shrink-0 py-5 pr-5 sm:flex">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>

          {/* Panel header — navy */}
          <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl px-5 py-4" style={{ background: C.navy950 }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: C.orange500 }}>
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Assistente</h2>
                <p className="text-xs text-white/50">Edicao da peca</p>
              </div>
            </div>
          </div>

          {/* Chat content */}
          <div className="custom-scroll flex-1 overflow-y-auto px-4 py-4" ref={h.chatScrollRef}>
            {h.chatMessages.length === 0 ? (
              <div className="space-y-2">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Sugestoes de edicao
                </p>
                {CHAT_SUGESTOES.map((sugestao) => (
                  <button
                    key={sugestao.text}
                    onClick={() => h.setChatInput(sugestao.text)}
                    className={cn(
                      'group w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3.5 text-left transition-all duration-200',
                      sugestao.color,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className={cn('h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110', sugestao.iconColor)} />
                      <span className="text-sm leading-snug text-slate-600 transition-colors group-hover:text-slate-800">
                        {sugestao.text}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {h.chatMessages.map((msg, idx) => (
                  <div key={idx} className={cn('flex gap-2.5', msg.role === 'user' && 'justify-end')}>
                    {msg.role === 'assistant' && (
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                        <Bot className="h-3 w-3 text-slate-500" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2.5',
                        msg.role === 'user'
                          ? 'rounded-br-md text-white'
                          : 'rounded-bl-md bg-slate-100 text-slate-700',
                      )}
                      style={msg.role === 'user' ? { background: C.navy950 } : undefined}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {h.isSendingChat && (
                  <div className="flex gap-2.5">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                      <Bot className="h-3 w-3 text-slate-500" />
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="flex-shrink-0 border-t border-slate-100 bg-slate-50/50 p-4">
            <div className="relative">
              <textarea
                value={h.chatInput}
                onChange={(e) => h.setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    h.enviarMensagemChat()
                  }
                }}
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 140) + 'px'
                }}
                placeholder="Descreva a alteracao desejada..."
                disabled={h.isSendingChat}
                rows={1}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white py-3.5 pl-4 pr-12 text-sm leading-relaxed text-slate-700 placeholder:text-slate-400 transition-all focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#253D52]/10"
              />
              <button
                onClick={h.enviarMensagemChat}
                disabled={h.isSendingChat || !h.chatInput.trim()}
                className={cn(
                  'absolute bottom-2.5 right-2.5 rounded-lg p-2 transition-all duration-200',
                  h.chatInput.trim()
                    ? 'text-white shadow-sm hover:opacity-90'
                    : 'cursor-not-allowed bg-slate-100 text-slate-300',
                )}
                style={h.chatInput.trim() ? { background: C.navy950 } : undefined}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
