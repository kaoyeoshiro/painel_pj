/**
 * Pagina principal do Extrator de Autos.
 *
 * Camada de composicao fina que orquestra as secoes da pagina com base
 * no estado da maquina de estados (pageState). A logica e estado ficam
 * no hook useExtratorAutos; os visuais nos componentes da pasta components/.
 */

import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { FolderSearch } from 'lucide-react'

import { useExtratorAutos } from './hooks/useExtratorAutos'
import { BertStatusAction } from './components/BertStatusAction'
import { InputSection, LoadingSection } from './components/InputSection'
import { SelectionSection } from './components/SelectionSection'
import { PreviewSection } from './components/PreviewSection'
import { DownloadOptionsSection, DownloadProgressSection, DownloadCompleteSection } from './components/DownloadSection'
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
        {h.pageState === 'selecionando' && <SelectionSection h={h} />}

        {/* Secao 3: Preview de documentos (modo individual) */}
        {h.pageState === 'preview' && !h.modoLote && <PreviewSection h={h} />}

        {/* Secao 4: Opcoes de download */}
        {(h.pageState === 'preview' || (h.pageState === 'selecionando' && h.modoLote)) && (
          <DownloadOptionsSection h={h} />
        )}

        {/* Secao 5: Progresso do download */}
        {h.pageState === 'baixando' && <DownloadProgressSection h={h} />}

        {/* Secao 6: Download concluido */}
        {h.pageState === 'concluido' && <DownloadCompleteSection h={h} />}

        {/* Secao 7: Historico (sempre visivel, colapsavel) */}
        <HistoricoSection h={h} />

      </ContentArea>
    </>
  )
}
