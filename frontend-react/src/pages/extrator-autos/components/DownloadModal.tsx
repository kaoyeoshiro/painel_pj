/**
 * Modal de download do Extrator de Autos.
 *
 * Gerencia o fluxo completo de download em 3 etapas:
 * - options: Configuracao de formato e opcoes
 * - downloading: Progresso do download com logs SSE
 * - complete: Tela de sucesso com botao de download
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { C } from '@/lib/designTokens'
import type { UseExtratorAutosReturn } from '../hooks/useExtratorAutos'

// ============================================================================
// Tipos
// ============================================================================

type ModalStep = 'options' | 'downloading' | 'complete'

interface DownloadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  h: UseExtratorAutosReturn
}

// ============================================================================
// Componente principal
// ============================================================================

export function DownloadModal({ open, onOpenChange, h }: DownloadModalProps) {
  const [modalStep, setModalStep] = useState<ModalStep>('options')

  // Watch pageState para transicoes automaticas
  useEffect(() => {
    if (!open) {
      // Reset ao fechar
      setModalStep('options')
      return
    }

    if (h.pageState === 'concluido') {
      setModalStep('complete')
    } else if (h.pageState === 'erro') {
      // Fecha modal em caso de erro (toast ja foi mostrado)
      onOpenChange(false)
    }
  }, [h.pageState, open, onOpenChange])

  // Contadores para regras de exibicao
  const docsSelecionados = h.previewDocs.filter((d) => d.selecionado).length
  const exatamenteUmDoc = docsSelecionados === 1
  const formatoPermitePdfDireto = h.downloadOpcoes.formato === 'pdf' || h.downloadOpcoes.formato === 'pdf_txt'
  const pdfDiretoDisponivel = exatamenteUmDoc && formatoPermitePdfDireto

  // Reset para ZIP quando PDF direto fica indisponivel
  useEffect(() => {
    if (!pdfDiretoDisponivel && h.formatoSaidaFinal === 'pdf_direto') {
      h.setFormatoSaidaFinal('zip')
    }
  }, [pdfDiretoDisponivel, h.formatoSaidaFinal, h.setFormatoSaidaFinal])

  // Handler para iniciar download
  const handleIniciarDownload = () => {
    setModalStep('downloading')
    h.iniciarDownload()
  }

  // Previne fechamento durante download
  const handleOpenChange = (newOpen: boolean) => {
    if (modalStep === 'downloading') return // Bloqueia fechamento
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-xl"
        hideCloseButton={modalStep === 'downloading'}
      >
        {modalStep === 'options' && (
          <OptionsStep
            h={h}
            exatamenteUmDoc={exatamenteUmDoc}
            formatoPermitePdfDireto={formatoPermitePdfDireto}
            onIniciar={handleIniciarDownload}
            onCancelar={() => onOpenChange(false)}
          />
        )}

        {modalStep === 'downloading' && <DownloadingStep h={h} />}

        {modalStep === 'complete' && (
          <CompleteStep
            h={h}
            onNovaConsulta={() => {
              h.novaConsulta()
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Step 1: Opcoes
// ============================================================================

interface OptionsStepProps {
  h: UseExtratorAutosReturn
  exatamenteUmDoc: boolean
  formatoPermitePdfDireto: boolean
  onIniciar: () => void
  onCancelar: () => void
}

function OptionsStep({
  h,
  exatamenteUmDoc,
  formatoPermitePdfDireto,
  onIniciar,
  onCancelar,
}: OptionsStepProps) {
  const pdfDiretoHabilitado = exatamenteUmDoc && formatoPermitePdfDireto

  return (
    <>
      <DialogHeader>
        <DialogTitle style={{ color: C.text900 }}>Opcoes de Download</DialogTitle>
        <DialogDescription style={{ color: C.text500 }}>
          Configure o formato e opcoes de saida
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Formato */}
        <div className="space-y-2">
          <Label className="font-medium" style={{ fontSize: 14, color: C.text700 }}>
            Formato de Saida
          </Label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato de saida">
            {([
              { value: 'pdf_txt', label: 'PDF + TXT' },
              { value: 'pdf', label: 'Somente PDF' },
              { value: 'txt', label: 'Somente TXT' },
              { value: 'xml_only', label: 'Somente XML' },
            ] as const).map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                role="radio"
                aria-checked={h.downloadOpcoes.formato === fmt.value}
                onClick={() => h.setDownloadOpcoes((prev) => ({ ...prev, formato: fmt.value }))}
                className="rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{
                  borderColor: h.downloadOpcoes.formato === fmt.value ? C.navy500 : C.gray200,
                  background: h.downloadOpcoes.formato === fmt.value ? C.navy50 : 'white',
                  color: h.downloadOpcoes.formato === fmt.value ? C.navy700 : C.text500,
                  fontWeight: h.downloadOpcoes.formato === fmt.value ? 600 : 400,
                }}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo de entrega (somente modo individual) */}
        {!h.modoLote && (
          <div className="space-y-2">
            <Label className="font-medium" style={{ fontSize: 14, color: C.text700 }}>
              Tipo de Entrega
            </Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de entrega">
              <button
                type="button"
                role="radio"
                aria-checked={h.formatoSaidaFinal === 'zip'}
                onClick={() => h.setFormatoSaidaFinal('zip')}
                className="rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{
                  borderColor: h.formatoSaidaFinal === 'zip' ? C.navy500 : C.gray200,
                  background: h.formatoSaidaFinal === 'zip' ? C.navy50 : 'white',
                  color: h.formatoSaidaFinal === 'zip' ? C.navy700 : C.text500,
                  fontWeight: h.formatoSaidaFinal === 'zip' ? 600 : 400,
                }}
              >
                ZIP
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={h.formatoSaidaFinal === 'pdf_direto'}
                disabled={!pdfDiretoHabilitado}
                onClick={() => h.setFormatoSaidaFinal('pdf_direto')}
                className="rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: h.formatoSaidaFinal === 'pdf_direto' ? C.navy500 : C.gray200,
                  background: h.formatoSaidaFinal === 'pdf_direto' ? C.navy50 : 'white',
                  color: h.formatoSaidaFinal === 'pdf_direto' ? C.navy700 : C.text500,
                  fontWeight: h.formatoSaidaFinal === 'pdf_direto' ? 600 : 400,
                }}
              >
                PDF direto
              </button>
            </div>
            {!pdfDiretoHabilitado && (
              <p className="text-xs" style={{ color: C.text400 }}>
                PDF direto disponivel apenas com 1 documento selecionado e formato PDF
              </p>
            )}
          </div>
        )}

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
            <input
              type="checkbox"
              checked={h.downloadOpcoes.mesclar_pdfs}
              onChange={(e) =>
                h.setDownloadOpcoes((prev) => ({ ...prev, mesclar_pdfs: e.target.checked }))
              }
              className="h-4 w-4 rounded"
              style={{ borderColor: C.gray300 }}
            />
            Mesclar PDFs
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
            <input
              type="checkbox"
              checked={h.downloadOpcoes.salvar_xml}
              onChange={(e) =>
                h.setDownloadOpcoes((prev) => ({ ...prev, salvar_xml: e.target.checked }))
              }
              className="h-4 w-4 rounded"
              style={{ borderColor: C.gray300 }}
            />
            Salvar XML completo
          </label>

          {/* Opcoes exclusivas do lote */}
          {h.modoLote && (
            <>
              <label className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
                <input
                  type="checkbox"
                  checked={h.downloadOpcoes.pasta_unica}
                  onChange={(e) =>
                    h.setDownloadOpcoes((prev) => ({ ...prev, pasta_unica: e.target.checked }))
                  }
                  className="h-4 w-4 rounded"
                  style={{ borderColor: C.gray300 }}
                />
                Pasta unica
              </label>
              <div className="flex items-center gap-3">
                <Label style={{ fontSize: 14, color: C.text700 }}>Processos simultaneos:</Label>
                <select
                  value={h.downloadOpcoes.processos_paralelos}
                  onChange={(e) =>
                    h.setDownloadOpcoes((prev) => ({
                      ...prev,
                      processos_paralelos: parseInt(e.target.value, 10),
                    }))
                  }
                  className="rounded-lg border px-2 py-1 text-sm"
                  style={{ borderColor: C.gray200, color: C.text700 }}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <Separator style={{ background: C.gray200 }} />

        {/* Botoes */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancelar} style={{ borderColor: C.gray200, color: C.text500 }}>
            Cancelar
          </Button>
          <Button onClick={onIniciar} style={{ background: C.navy950, color: 'white' }}>
            Iniciar Download
          </Button>
        </div>
      </div>
    </>
  )
}

// ============================================================================
// Step 2: Downloading
// ============================================================================

interface DownloadingStepProps {
  h: UseExtratorAutosReturn
}

function DownloadingStep({ h }: DownloadingStepProps) {
  return (
    <>
      <div className="h-1 -mx-6 -mt-6" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />

      <DialogHeader>
        <DialogTitle style={{ color: C.text900 }}>Baixando Documentos</DialogTitle>
        <DialogDescription style={{ color: C.text500 }}>
          Por favor, aguarde enquanto processamos sua solicitacao
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: C.text500 }}>{h.downloadMensagem}</span>
            <span className="font-medium" style={{ color: C.text900 }}>
              {h.downloadPercentual}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: C.gray200 }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${h.downloadPercentual}%`,
                background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})`,
              }}
            />
          </div>
        </div>

        {/* Logs */}
        <ScrollArea className="h-48 rounded-lg border p-3" style={{ background: C.terminalBg, borderColor: C.gray200 }}>
          <div className="space-y-1 font-mono text-xs" style={{ color: C.gray400 }}>
            {h.downloadLogs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
            <div ref={h.logsEndRef} />
          </div>
        </ScrollArea>
      </div>
    </>
  )
}

// ============================================================================
// Step 3: Complete
// ============================================================================

interface CompleteStepProps {
  h: UseExtratorAutosReturn
  onNovaConsulta: () => void
}

function CompleteStep({ h, onNovaConsulta }: CompleteStepProps) {
  return (
    <>
      <div className="h-1 -mx-6 -mt-6" style={{ background: `linear-gradient(90deg, ${C.statusSuccess}, ${C.successAccentMuted})` }} />

      <div className="flex flex-col items-center justify-center py-8" style={{ background: C.successBg }}>
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: C.successBgStrong }}
        >
          <span className="text-2xl" style={{ color: C.statusSuccess }}>
            &#10003;
          </span>
        </div>
        <h2 className="mb-2 text-xl font-semibold" style={{ color: C.successTextLight }}>
          Download concluido!
        </h2>
        <p className="mb-6 text-sm" style={{ color: C.statusSuccess }}>{h.downloadMensagem}</p>
        <div className="flex gap-3">
          {h.jobId && (
            <Button onClick={h.baixarZip} style={{ background: C.statusSuccess, color: 'white' }}>
              Baixar Arquivo
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onNovaConsulta}
            style={{ borderColor: C.gray200, color: C.text500 }}
          >
            Nova Consulta
          </Button>
        </div>
      </div>
    </>
  )
}
