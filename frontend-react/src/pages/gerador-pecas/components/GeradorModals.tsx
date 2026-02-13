/**
 * Modais do Gerador de Pecas.
 *
 * Contem: ProgressModal, ParecerDialog, FeedbackDialog, VersionHistoryDialog.
 */

import { useState } from 'react'
import {
  Loader2,
  Check,
  X,
  Upload,
  Star,
  Send,
  RotateCcw,
  History,
  AlertTriangle,
  Scale,
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
import { formatDateTime } from '../types'
import type { VersionItem } from '../types'

// ============================================================================
// 1. ProgressModal — Vertical Stepper
// ============================================================================

const PROGRESS_STEPS = [
  { numero: 1, label: 'Coletando documentos', description: 'Busca documentos no TJ-MS' },
  { numero: 2, label: 'Analisando argumentos', description: 'Identifica argumentos e teses' },
  { numero: 3, label: 'Redigindo peca', description: 'Gera a peca juridica' },
] as const

function computeProgress(statuses: Record<number, AgentStatus>): number {
  let p = 0
  for (let i = 1; i <= 3; i++) {
    const s = statuses[i]
    if (s === 'concluido' || s === 'erro') p += 33.33
    else if (s === 'ativo') p += 16.66
  }
  return Math.min(Math.round(p), 100)
}

interface ProgressModalProps {
  open: boolean
  onCancel: () => void
  agentStatuses: Record<number, AgentStatus>
  progressMessage: string
  numeroCNJ?: string
}

export function ProgressModal({
  open,
  onCancel,
  agentStatuses,
  progressMessage,
  numeroCNJ,
}: ProgressModalProps) {
  const completedCount = [1, 2, 3].filter((i) => agentStatuses[i] === 'concluido').length
  const progress = computeProgress(agentStatuses)
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = () => {
    setIsCancelling(true)
    setTimeout(() => {
      onCancel()
      setIsCancelling(false)
    }, 150)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent
        hideCloseButton
        className="max-w-[420px] gap-0 rounded-3xl sm:rounded-3xl border-0 bg-white p-0 shadow-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-8 pt-8">
          <DialogHeader className="space-y-0">
            <DialogTitle
              className="flex items-center gap-3 text-xl font-bold tracking-tight"
              style={{ color: C.text900 }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: C.navy950 }}
              >
                <Scale className="h-5 w-5 text-white" />
              </div>
              Gerando Peca
            </DialogTitle>
            <DialogDescription className="sr-only">
              Progresso da geracao da peca juridica
            </DialogDescription>
          </DialogHeader>
          {numeroCNJ && (
            <p className="mt-2 text-[13px] font-medium" style={{ color: C.text500 }}>
              Processo: {numeroCNJ}
            </p>
          )}
          <p className="mt-1 text-[12px]" style={{ color: C.text400 }}>
            Isso pode levar alguns segundos
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-8 pt-6">
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: C.text400 }}
            >
              Progresso
            </span>
            <span className="text-[11px] font-semibold" style={{ color: C.navy700 }}>
              {completedCount} de 3 etapas
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: C.gray100 }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${C.navy700}, ${C.navy500})`,
              }}
            />
          </div>
          <p
            className="mt-2.5 min-h-[16px] text-[12px] font-medium"
            style={{ color: C.text500 }}
          >
            {progressMessage || 'Iniciando...'}
          </p>
        </div>

        {/* Vertical Stepper */}
        <div className="px-8 pt-4 pb-2">
          {PROGRESS_STEPS.map((step, index) => {
            const status = agentStatuses[step.numero]
            const isLast = index === PROGRESS_STEPS.length - 1

            return (
              <div key={step.numero} className="flex gap-4">
                {/* Circle + connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-500',
                      status === 'concluido' && 'bg-emerald-500 text-white',
                      status === 'erro' && 'bg-red-500 text-white',
                      status === 'aguardando' && 'border-2 bg-white',
                      status === 'ativo' && 'text-white',
                    )}
                    style={{
                      ...(status === 'aguardando' ? { borderColor: C.gray300 } : {}),
                      ...(status === 'ativo'
                        ? { background: C.navy950, boxShadow: `0 0 0 4px ${C.navy100}` }
                        : {}),
                      ...(status === 'concluido'
                        ? { boxShadow: '0 1px 3px rgba(16,185,129,0.3)' }
                        : {}),
                    }}
                  >
                    {status === 'ativo' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : status === 'concluido' ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    ) : status === 'erro' ? (
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      <span className="text-[13px] font-semibold" style={{ color: C.text400 }}>
                        {step.numero}
                      </span>
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className="my-1 w-0.5 flex-1 rounded-full transition-colors duration-500"
                      style={{
                        minHeight: 20,
                        background:
                          status === 'concluido' || status === 'erro'
                            ? C.statusSuccess
                            : C.gray200,
                      }}
                    />
                  )}
                </div>

                {/* Step text */}
                <div className={cn('pt-1.5', !isLast ? 'pb-5' : 'pb-0')}>
                  <p
                    className={cn(
                      'text-[14px] font-semibold leading-tight transition-colors duration-300',
                      status === 'concluido' && 'text-emerald-700',
                      status === 'erro' && 'text-red-700',
                    )}
                    style={{
                      ...(status === 'ativo' ? { color: C.text900 } : {}),
                      ...(status === 'aguardando' ? { color: C.text400 } : {}),
                    }}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: C.text400 }}>
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 pt-3">
          <div style={{ borderTop: `1px solid ${C.gray100}` }} />
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] font-medium transition-all hover:bg-slate-50 disabled:opacity-60"
            style={{ borderColor: C.gray200, color: C.text500 }}
          >
            {isCancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {isCancelling ? 'Cancelando...' : 'Cancelar geracao'}
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
              <Label htmlFor="parecer-file" className="text-[15px] font-medium text-slate-600">
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
          {!versionList || versionList.length === 0 ? (
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
