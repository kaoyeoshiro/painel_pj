// Modal de pre-visualizacao e aprovacao de regra gerada pela IA
// Exibe loading, erro ou preview (visual + JSON) com aprovacao/rejeicao

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { C } from '@/lib/designTokens'
import {
  Loader2,
  AlertTriangle,
  Eye,
  Code,
  RefreshCw,
  CheckCircle,
  X,
} from 'lucide-react'
import { humanizeRule, countConditions, extractVariables } from './humanize'
import type { RuleNode, RuleVariable } from './types'

interface RulePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateRule: RuleNode | null
  candidateTexto: string | null
  isLoading: boolean
  error: string | null
  variaveis: RuleVariable[]
  onApprove: () => void
  onReject: () => void
  onRetry: () => void
}

export function RulePreviewModal({
  open,
  onOpenChange,
  candidateRule,
  candidateTexto,
  isLoading,
  error,
  variaveis,
  onApprove,
  onReject,
  onRetry,
}: RulePreviewModalProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual')

  const condCount = candidateRule ? countConditions(candidateRule) : 0
  const usedVars = candidateRule ? extractVariables(candidateRule) : []

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onReject() ; onOpenChange(v) }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Regra Gerada pela IA
          </DialogTitle>
          <DialogDescription>
            Revise a regra antes de aplicar ao formulário
          </DialogDescription>
        </DialogHeader>

        {/* Texto original */}
        {candidateTexto && (
          <div
            className="text-xs px-3 py-2 rounded"
            style={{ background: C.gray50, color: C.text500 }}
          >
            <span className="font-medium">Condição informada:</span>{' '}
            &ldquo;{candidateTexto}&rdquo;
          </div>
        )}

        {/* Estado: Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: C.navy700 }}
            />
            <span className="text-sm" style={{ color: C.text500 }}>
              Gerando regra via IA...
            </span>
          </div>
        )}

        {/* Estado: Erro */}
        {!isLoading && error && (
          <div className="space-y-3 py-4">
            <div
              className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: C.statusError,
              }}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Estado: Sucesso — preview da regra */}
        {!isLoading && !error && candidateRule && (
          <div className="space-y-3">
            {/* Badges de info */}
            <div className="flex items-center gap-2">
              {condCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {condCount} {condCount === 1 ? 'condição' : 'condições'}
                </Badge>
              )}
              {usedVars.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ color: C.navy700, borderColor: C.navy100 }}
                >
                  {usedVars.length} {usedVars.length === 1 ? 'variável' : 'variáveis'}
                  : {usedVars.join(', ')}
                </Badge>
              )}
            </div>

            {/* Toggle Visual / JSON */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="px-2 py-1 text-xs rounded-l-md border transition-colors"
                style={{
                  background: viewMode === 'visual' ? C.navy950 : 'transparent',
                  color: viewMode === 'visual' ? 'white' : C.text500,
                  borderColor: C.gray300,
                }}
                onClick={() => setViewMode('visual')}
              >
                <Eye className="h-3 w-3 inline mr-1" />
                Visual
              </button>
              <button
                type="button"
                className="px-2 py-1 text-xs rounded-r-md border border-l-0 transition-colors"
                style={{
                  background: viewMode === 'json' ? C.navy950 : 'transparent',
                  color: viewMode === 'json' ? 'white' : C.text500,
                  borderColor: C.gray300,
                }}
                onClick={() => setViewMode('json')}
              >
                <Code className="h-3 w-3 inline mr-1" />
                JSON
              </button>
            </div>

            {/* Conteudo */}
            {viewMode === 'visual' ? (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  background: C.navy50,
                  border: `1px solid ${C.navy100}`,
                  color: C.navy700,
                }}
              >
                {humanizeRule(candidateRule, variaveis)}
              </div>
            ) : (
              <pre
                className="text-xs p-3 rounded-lg overflow-auto max-h-64 font-mono"
                style={{
                  background: C.gray50,
                  border: `1px solid ${C.gray200}`,
                  color: C.text700,
                }}
              >
                {JSON.stringify(candidateRule, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Footer com botoes */}
        <DialogFooter className="mt-4 pt-4 border-t gap-2">
          {!isLoading && error && (
            <Button variant="outline" onClick={onReject}>
              <X className="h-4 w-4 mr-1.5" />
              Fechar
            </Button>
          )}

          {!isLoading && !error && candidateRule && (
            <>
              <Button variant="outline" onClick={onReject}>
                <X className="h-4 w-4 mr-1.5" />
                Rejeitar
              </Button>
              <Button
                onClick={onApprove}
                style={{ background: C.navy950, color: 'white' }}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Aprovar e Substituir
              </Button>
            </>
          )}

          {isLoading && (
            <Button variant="outline" onClick={onReject}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
