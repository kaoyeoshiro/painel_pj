/**
 * Pagina principal do Extrator de Autos.
 *
 * Camada de composicao fina que orquestra as secoes da pagina com base
 * no estado da maquina de estados (pageState). A logica e estado ficam
 * no hook useExtratorAutos; os visuais nos componentes da pasta components/.
 */

import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { Button } from '@/components/ui/button'
import { FolderSearch } from 'lucide-react'
import { C } from '@/lib/designTokens'

import { useExtratorAutos } from './hooks/useExtratorAutos'
import { BertStatusAction } from './components/BertStatusAction'
import { InputSection, LoadingSection } from './components/InputSection'
import { SelectionSection } from './components/SelectionSection'
import { PreviewSection } from './components/PreviewSection'
import { DownloadModal } from './components/DownloadModal'
import { HistoricoSection } from './components/HistoricoSection'

// ============================================================================
// Componente principal
// ============================================================================

export function ExtratorAutosPage() {
  const h = useExtratorAutos()

  return (
    <>
      {/* Breadcrumb com status BERT */}
      <BreadcrumbBar
        title="Extrator de Autos"
        icon={<FolderSearch className="w-3.5 h-3.5" />}
        actions={<BertStatusAction bertStatus={h.bertStatus} />}
      />

      {/* Conteudo principal — secoes condicionais por pageState */}
      <ContentArea className="space-y-6">

        {/* Secao 1: Input (idle ou erro) */}
        {(h.pageState === 'idle' || h.pageState === 'erro') && (
          <InputSection h={h} />
        )}

        {/* Loading */}
        {h.pageState === 'consultando' && <LoadingSection />}

        {/* Secao 2: Selecao de categorias/codigos */}
        {h.pageState === 'selecionando' && (
          <>
            <SelectionSection h={h} />
            {/* No modo lote, botao de download direto (sem preview de docs individuais) */}
            {h.modoLote && (
              <div className="flex justify-end">
                <Button
                  onClick={() => h.setDownloadModalOpen(true)}
                  style={{ background: C.navy950, color: 'white' }}
                >
                  Baixar Documentos
                </Button>
              </div>
            )}
          </>
        )}

        {/* Secao 3: Preview de documentos (modo individual) + botao download */}
        {h.pageState === 'preview' && !h.modoLote && (
          <>
            <PreviewSection h={h} />
            <div className="flex justify-end">
              <Button
                onClick={() => h.setDownloadModalOpen(true)}
                style={{ background: C.navy950, color: 'white' }}
              >
                Baixar Documentos
              </Button>
            </div>
          </>
        )}

        {/* Secao 3b: Resumo do lote (modo lote) */}
        {h.pageState === 'preview' && h.modoLote && h.loteResultados && (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
            <div className="p-6">
              <h3 className="font-bold" style={{ fontSize: 17, color: C.text900 }}>
                Resumo do Lote
              </h3>
              <p className="mt-1" style={{ fontSize: 14, color: C.text500 }}>
                Pronto para download de {h.loteResultados.consultados} processos
              </p>

              <div className="mt-5 grid grid-cols-3 gap-4 rounded-lg border p-4" style={{ borderColor: C.gray200 }}>
                <div>
                  <span style={{ fontSize: 12, color: C.text400 }}>Total Processos</span>
                  <p className="font-medium" style={{ fontSize: 16, color: C.text900 }}>
                    {h.loteResultados.total_processos}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: C.text400 }}>Consultados</span>
                  <p className="font-medium" style={{ fontSize: 16, color: C.statusSuccess }}>
                    {h.loteResultados.consultados}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: C.text400 }}>Com Erro</span>
                  <p className="font-medium" style={{ fontSize: 16, color: C.statusError }}>
                    {h.loteResultados.com_erro}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => h.setDownloadModalOpen(true)}
                  style={{ background: C.navy950, color: 'white' }}
                >
                  Baixar Documentos
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Secao 4: Historico (sempre visivel, colapsavel) */}
        <HistoricoSection h={h} />

      </ContentArea>

      {/* Download Modal */}
      <DownloadModal
        open={h.downloadModalOpen}
        onOpenChange={h.setDownloadModalOpen}
        h={h}
      />
    </>
  )
}
