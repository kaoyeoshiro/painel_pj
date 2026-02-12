/**
 * Modais do Gerador de Pecas.
 *
 * Contem: ProgressModal, ParecerDialog, FeedbackDialog, VersionHistoryDialog.
 */

import {
  Loader2,
  Check,
  X,
  Upload,
  Star,
  Send,
  RotateCcw,
  History,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { C } from '@/lib/designTokens'
import type { AgentStatus } from '@/types/gerador-pecas'
import { AGENT_META, formatDateTime } from '../types'
import type { VersionItem } from '../types'

// ============================================================================
// 1. ProgressModal
// ============================================================================

interface ProgressModalProps {
  open: boolean
  onCancel: () => void
  agentStatuses: Record<number, AgentStatus>
  progressMessage: string
  streamingContent: string
  minutaHtml: string
}

export function ProgressModal({
  open,
  onCancel,
  agentStatuses,
  progressMessage,
  streamingContent,
  minutaHtml,
}: ProgressModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent
        className="max-w-md rounded-2xl border-slate-200 p-0 shadow-xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="rounded-t-2xl px-6 py-5" style={{ background: C.navy950 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base text-white">
              <Loader2 className="h-4 w-4 animate-spin text-white/70" />
              Gerando Peca
            </DialogTitle>
            <DialogDescription className="sr-only">Progresso da geracao da peca juridica</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          <p className="mt-4 text-sm" style={{ color: C.text500 }}>{progressMessage || 'Iniciando...'}</p>

          {/* Agent pipeline */}
          <div className="mt-5 space-y-2">
            {AGENT_META.map((agent) => {
              const status = agentStatuses[agent.numero]
              const Icon = agent.icon
              return (
                <div
                  key={agent.numero}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition-all',
                    status === 'ativo' && 'border-slate-300 bg-slate-50',
                    status === 'concluido' && 'border-emerald-200 bg-emerald-50/50',
                    status === 'erro' && 'border-red-200 bg-red-50/50',
                    status === 'aguardando' && 'border-slate-100 bg-slate-50/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all',
                      status === 'concluido' && 'bg-emerald-500 text-white',
                      status === 'erro' && 'bg-red-500 text-white',
                      status === 'aguardando' && 'text-white',
                    )}
                    style={{
                      background: status === 'ativo' ? C.navy950
                        : status === 'aguardando' ? C.gray200
                        : undefined,
                      color: status === 'aguardando' ? C.text400 : undefined,
                    }}
                  >
                    {status === 'ativo' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : status === 'concluido' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : status === 'erro' ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">{agent.nome}</p>
                    <p className="text-[11px] text-slate-400">{agent.descricao}</p>
                  </div>
                  {status === 'ativo' && (
                    <span className="flex-shrink-0 text-[11px] font-medium text-slate-500">Ativo</span>
                  )}
                  {status === 'concluido' && (
                    <span className="flex-shrink-0 text-[11px] font-medium text-emerald-600">OK</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Streaming preview */}
          {streamingContent && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-slate-400" />
                <span className="text-[11px] font-medium text-slate-500">Preview em tempo real</span>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: minutaHtml }}
                />
              </div>
            </div>
          )}

          <Separator className="my-4" />

          <button
            onClick={onCancel}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// 2. ParecerDialog
// ============================================================================

interface ParecerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parecerFile: File | null
  onParecerFileChange: (file: File | null) => void
  isUploading: boolean
  onUpload: () => void
  onContinuarSem: () => void
}

export function ParecerDialog({
  open,
  onOpenChange,
  parecerFile,
  onParecerFileChange,
  isUploading,
  onUpload,
  onContinuarSem,
}: ParecerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Parecer NATJus ausente
          </DialogTitle>
          <DialogDescription className="sr-only">Opcoes para anexar parecer NATJus</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Nao foi encontrado parecer NATJus no processo. Ele e essencial para a geracao adequada desta peca.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="parecer-file" className="font-medium text-slate-600" style={{ fontSize: 15 }}>
                Anexar Parecer (PDF)
              </Label>
              <Input
                id="parecer-file"
                type="file"
                accept=".pdf"
                onChange={(e) => onParecerFileChange(e.target.files?.[0] || null)}
                className="mt-2"
              />
            </div>
            <Button
              onClick={onUpload}
              disabled={!parecerFile || isUploading}
              className="w-full gap-2 rounded-xl text-white hover:opacity-90"
              style={{ background: C.navy950 }}
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Enviando...' : 'Enviar Parecer'}
            </Button>
            <Separator />
            <button
              onClick={onContinuarSem}
              className="w-full rounded-xl py-2.5 text-sm text-slate-400 transition-colors hover:text-slate-600"
            >
              Continuar sem Parecer
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// 3. FeedbackDialog
// ============================================================================

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nota: number | null
  onNotaChange: (nota: number) => void
  comentario: string
  onComentarioChange: (value: string) => void
  onEnviar: () => void
}

export function FeedbackDialog({
  open,
  onOpenChange,
  nota,
  onNotaChange,
  comentario,
  onComentarioChange,
  onEnviar,
}: FeedbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-center text-base">Como foi a experiencia?</DialogTitle>
          <DialogDescription className="sr-only">Avalie a qualidade da geracao</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => onNotaChange(n)}
                className="rounded-lg p-1.5 transition-transform hover:scale-110"
                aria-label={`Nota ${n}`}
              >
                <Star
                  className={cn(
                    'h-7 w-7 transition-colors',
                    nota && n <= nota
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 hover:text-amber-300',
                  )}
                />
              </button>
            ))}
          </div>
          <Textarea
            value={comentario}
            onChange={(e) => onComentarioChange(e.target.value)}
            placeholder="Comentarios (opcional)"
            rows={3}
            className="rounded-xl border-slate-200"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-600"
            >
              Pular
            </button>
            <Button
              onClick={onEnviar}
              disabled={!nota}
              className="gap-1.5 rounded-xl px-4 text-white hover:opacity-90"
              style={{ background: C.navy950 }}
            >
              <Send className="h-3.5 w-3.5" />
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// 4. VersionHistoryDialog
// ============================================================================

interface VersionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionList: VersionItem[]
  onRestaurar: (versaoId: number) => void
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  versionList,
  onRestaurar,
}: VersionHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="h-4 w-4 text-slate-400" />
            Historico de Versoes
          </DialogTitle>
          <DialogDescription className="sr-only">Lista de versoes anteriores da peca</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {versionList.length === 0 ? (
            <div className="py-12 text-center">
              <History className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">Nenhuma versao anterior</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versionList.map((v) => (
                <div key={v.versao_id} className="rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">v{v.numero_versao}</span>
                    <span className="text-[11px] text-slate-400">{formatDateTime(v.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{v.descricao_alteracao || 'Sem descricao'}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      +{v.linhas_adicionadas}
                    </span>
                    <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                      -{v.linhas_removidas}
                    </span>
                    <button
                      onClick={() => onRestaurar(v.versao_id)}
                      className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
