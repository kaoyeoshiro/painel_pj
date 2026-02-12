/**
 * Secao de entrada do Extrator de Autos.
 *
 * Exibe o formulario de consulta (processo individual ou lote),
 * toggle de modo, e mensagem de erro quando aplicavel.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { C } from '@/lib/designTokens'
import type { UseExtratorAutosReturn } from '../hooks/useExtratorAutos'

// ============================================================================
// Props
// ============================================================================

interface InputSectionProps {
  h: UseExtratorAutosReturn
}

// ============================================================================
// Componente
// ============================================================================

export function InputSection({ h }: InputSectionProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <div className="p-6">
        <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
          Consultar Processo
        </h3>
        <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
          Informe o numero CNJ para buscar documentos do processo
        </p>

        <div className="mt-5 space-y-4">
          {/* Toggle Modo Lote */}
          <div className="flex items-center gap-3">
            <Label htmlFor="modo-lote" className="text-sm" style={{ color: C.text700 }}>
              Modo Lote
            </Label>
            <button
              id="modo-lote"
              role="switch"
              type="button"
              aria-checked={h.modoLote}
              onClick={() => h.setModoLote(!h.modoLote)}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
              style={{ background: h.modoLote ? C.navy950 : C.gray300 }}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
                  h.modoLote ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
            <span style={{ fontSize: 12, color: C.text400 }}>
              {h.modoLote ? 'Varios processos' : 'Processo individual'}
            </span>
          </div>

          {!h.modoLote ? (
            /* Input individual */
            <div className="space-y-2">
              <Label htmlFor="cnj-input" style={{ color: C.text700 }}>Numero CNJ</Label>
              <div className="flex gap-2">
                <Input
                  id="cnj-input"
                  value={h.cnjInput}
                  onChange={(e) => h.setCnjInput(e.target.value)}
                  onKeyDown={h.handleCnjKeyDown}
                  placeholder="0000000-00.0000.0.00.0000"
                  className="flex-1"
                  style={{ borderColor: C.gray200 }}
                />
                <Button
                  onClick={h.consultarProcesso}
                  disabled={!h.cnjInput.trim() || h.pageState === 'consultando'}
                  style={{ background: C.navy950, color: '#fff' }}
                >
                  Consultar
                </Button>
              </div>
            </div>
          ) : (
            /* Textarea lote */
            <div className="space-y-2">
              <Label htmlFor="lote-input" style={{ color: C.text700 }}>
                Numeros CNJ (um por linha)
              </Label>
              <Textarea
                id="lote-input"
                value={h.loteCnjInput}
                onChange={(e) => h.setLoteCnjInput(e.target.value)}
                placeholder={'0000000-00.0000.0.00.0000\n1111111-11.2024.8.12.0001'}
                rows={6}
                data-testid="lote-textarea"
                style={{ borderColor: C.gray200 }}
              />
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: C.text400 }}>
                  {h.contarProcessosLote()} processo(s) informado(s)
                </span>
                <Button
                  onClick={h.consultarLote}
                  disabled={h.contarProcessosLote() === 0 || h.pageState === 'consultando'}
                  style={{ background: C.navy950, color: '#fff' }}
                >
                  Consultar Lote
                </Button>
              </div>
            </div>
          )}

          {/* Erro */}
          {h.pageState === 'erro' && h.erroMensagem && (
            <div
              className="rounded-lg p-3 text-sm"
              style={{ background: '#fef2f2', color: C.statusError }}
            >
              {h.erroMensagem}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Loading state (consultando)
// ============================================================================

export function LoadingSection() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
      <div className="flex flex-col items-center justify-center py-12">
        <div
          className="mb-4 h-10 w-10 animate-spin rounded-full border-4"
          style={{ borderColor: C.gray200, borderTopColor: C.navy700 }}
        />
        <p className="font-medium" style={{ color: C.text700 }}>Consultando processo...</p>
        <p className="mt-1 text-sm" style={{ color: C.text400 }}>Isso pode levar alguns segundos</p>
      </div>
    </div>
  )
}
