/**
 * Dialog para criacao de perguntas em lote.
 * Replica o modal-perguntas-lote do legado (admin_categorias_json.html).
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { C } from '@/lib/designTokens'

interface PerguntasLoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoriaId: number | null
  onCriar: (perguntas: string[], analisarDependencias: boolean) => Promise<void>
}

export function PerguntasLoteDialog({
  open,
  onOpenChange,
  categoriaId,
  onCriar,
}: PerguntasLoteDialogProps) {
  const [texto, setTexto] = useState('')
  const [analisarDeps, setAnalisarDeps] = useState(true)
  const [criando, setCriando] = useState(false)
  const [status, setStatus] = useState<{ text: string; type: 'info' | 'success' | 'error' }>({ text: '', type: 'info' })

  const linhas = useMemo(() =>
    texto.split('\n').map(l => l.trim()).filter(Boolean),
    [texto]
  )

  useEffect(() => {
    if (!open) return
    setTexto('')
    setStatus({ text: '', type: 'info' })
    setCriando(false)
  }, [open])

  const handleCriar = async () => {
    if (!categoriaId) {
      setStatus({ text: 'Salve a categoria primeiro', type: 'error' })
      return
    }

    if (linhas.length === 0) {
      setStatus({ text: 'Digite pelo menos uma pergunta', type: 'error' })
      return
    }

    setCriando(true)
    setStatus({
      text: analisarDeps
        ? 'Normalizando perguntas e analisando dependencias com IA...'
        : 'Criando perguntas...',
      type: 'info',
    })

    try {
      await onCriar(linhas, analisarDeps)
      setStatus({ text: `${linhas.length} perguntas criadas com sucesso!`, type: 'success' })
      setTimeout(() => onOpenChange(false), 1500)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar perguntas'
      setStatus({ text: msg, type: 'error' })
    } finally {
      setCriando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="lote-dialog">
        <DialogHeader>
          <DialogTitle>Adicionar Varias Perguntas</DialogTitle>
          <DialogDescription>Uma pergunta por linha</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Perguntas (uma por linha)</Label>
            <Textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder={'e acao de medicamento? (pergunta mae)\ntem registro anvisa? (so se for medicamento)\ne incorporado ao SUS? (depende da anterior)\nse nao incorporado, qual alternativa tentada?\nqual o valor da causa?'}
              rows={10}
              className="font-mono text-sm"
              data-testid="textarea-perguntas-lote"
            />
            <p className="text-xs mt-1" style={{ color: C.text400 }}>
              {linhas.length} pergunta{linhas.length !== 1 ? 's' : ''} detectada{linhas.length !== 1 ? 's' : ''}
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={analisarDeps}
              onChange={e => setAnalisarDeps(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-analisar-deps"
            />
            <span className="text-sm" style={{ color: C.text700 }}>
              Processar com IA (normalizacao + dependencias)
            </span>
          </label>

          <p className="text-xs" style={{ color: C.text500 }}>
            A IA pode reescrever, mas o numero de perguntas sera mantido.
          </p>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            {status.text && (
              <span
                className="text-sm"
                style={{
                  color: status.type === 'success' ? C.statusSuccess
                    : status.type === 'error' ? '#dc2626'
                    : '#3b82f6',
                }}
              >
                {status.text}
              </span>
            )}
            <div className="flex gap-3 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={criando}>
                Cancelar
              </Button>
              <Button
                onClick={handleCriar}
                disabled={criando || linhas.length === 0}
                style={{ background: C.navy950, color: 'white' }}
                data-testid="btn-criar-lote"
              >
                {criando ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando...</>
                ) : (
                  'Criar Perguntas'
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
