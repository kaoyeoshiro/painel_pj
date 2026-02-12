import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { C } from '@/lib/designTokens'
import { FileText, RotateCw } from 'lucide-react'
import type { UsePrestacaoContasReturn } from '../hooks/usePrestacaoContas'

// =====================================================
// DIALOG DE CONFIRMACAO (processo ja analisado)
// =====================================================

interface ConfirmacaoDialogProps {
  vm: UsePrestacaoContasReturn
}

export function ConfirmacaoDialog({ vm }: ConfirmacaoDialogProps) {
  return (
    <Dialog open={vm.showConfirmacao} onOpenChange={vm.setShowConfirmacao}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ color: C.text900 }}>Processo ja analisado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm" style={{ color: C.text500 }}>
            Este processo ja possui uma analise registrada.
          </p>
          {vm.verificacaoExistente && (
            <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: C.gray200 }}>
              <p className="text-sm" style={{ color: C.text700 }}>
                <strong>Processo:</strong> {vm.verificacaoExistente.numero_cnj_formatado}
              </p>
              <p className="text-sm" style={{ color: C.text700 }}>
                <strong>Analisado em:</strong> {vm.verificacaoExistente.criado_em}
              </p>
              {vm.verificacaoExistente.parecer && (
                <p className="text-sm" style={{ color: C.text700 }}>
                  <strong>Parecer:</strong>{' '}
                  <Badge variant="outline" className="text-xs" style={vm.parecerBadgeStyle(vm.verificacaoExistente.parecer)}>
                    {vm.parecerTexto(vm.verificacaoExistente.parecer)}
                  </Badge>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                vm.setShowConfirmacao(false)
                if (vm.verificacaoExistente?.geracao_id) {
                  void vm.carregarDoHistorico(vm.verificacaoExistente.geracao_id)
                }
              }}
              className="text-white"
              style={{ background: C.navy950 }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Ver analise existente
            </Button>
            <Button
              variant="outline"
              style={{ borderColor: C.gray200, color: C.text700 }}
              onClick={() => {
                vm.setShowConfirmacao(false)
                void vm.iniciarAnalise(true)
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Refazer analise
            </Button>
            <Button
              variant="ghost"
              style={{ color: C.text500 }}
              onClick={() => vm.setShowConfirmacao(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
