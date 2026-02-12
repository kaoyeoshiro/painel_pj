/**
 * Secoes de download do Extrator de Autos.
 *
 * Inclui: opcoes de download (formato, checkboxes), barra de progresso
 * com logs SSE, e tela de download concluido.
 */

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { C } from '@/lib/designTokens'
import type { UseExtratorAutosReturn } from '../hooks/useExtratorAutos'

// ============================================================================
// Opcoes de Download
// ============================================================================

interface DownloadOptionsSectionProps {
  h: UseExtratorAutosReturn
}

export function DownloadOptionsSection({ h }: DownloadOptionsSectionProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
      <div className="p-6">
        <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
          Opcoes de Download
        </h3>
        <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
          Configure o formato e opcoes de saida
        </p>

        <div className="mt-5 space-y-6">
          {/* Formato */}
          <div className="space-y-2">
            <Label className="font-medium" style={{ fontSize: 14, color: C.text700 }}>
              Formato de Saida
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                { value: 'pdf_txt', label: 'PDF + TXT' },
                { value: 'pdf', label: 'Somente PDF' },
                { value: 'txt', label: 'Somente TXT' },
                { value: 'xml_only', label: 'Somente XML' },
              ] as const).map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
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

          <div className="flex justify-end">
            <Button
              onClick={h.iniciarDownload}
              style={{ background: C.navy950, color: 'white' }}
            >
              Baixar Documentos
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Progresso do Download
// ============================================================================

interface DownloadProgressSectionProps {
  h: UseExtratorAutosReturn
}

export function DownloadProgressSection({ h }: DownloadProgressSectionProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <div className="p-6 space-y-4">
        <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
          Baixando Documentos
        </h3>

        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: C.text500 }}>{h.downloadMensagem}</span>
            <span className="font-medium" style={{ color: C.text900 }}>{h.downloadPercentual}%</span>
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
    </div>
  )
}

// ============================================================================
// Download Concluido
// ============================================================================

interface DownloadCompleteSectionProps {
  h: UseExtratorAutosReturn
}

export function DownloadCompleteSection({ h }: DownloadCompleteSectionProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: C.successBorder }}
    >
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.statusSuccess}, ${C.successAccentMuted})` }} />
      <div className="flex flex-col items-center justify-center py-10" style={{ background: C.successBg }}>
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: C.successBgStrong }}
        >
          <span className="text-2xl" style={{ color: C.statusSuccess }}>&#10003;</span>
        </div>
        <h2 className="mb-2 text-xl font-semibold" style={{ color: C.successTextLight }}>
          Download concluido!
        </h2>
        <p className="mb-6 text-sm" style={{ color: C.statusSuccess }}>{h.downloadMensagem}</p>
        <div className="flex gap-3">
          {h.jobId && (
            <Button
              onClick={h.baixarZip}
              style={{ background: C.statusSuccess, color: 'white' }}
            >
              Baixar ZIP
            </Button>
          )}
          <Button
            variant="outline"
            onClick={h.novaConsulta}
            style={{ borderColor: C.gray200, color: C.text500 }}
          >
            Nova Consulta
          </Button>
        </div>
      </div>
    </div>
  )
}
