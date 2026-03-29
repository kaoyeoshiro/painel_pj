/**
 * Painel direito do RevisaoItemPage.
 * Compõe a lista lateral de documentos e o visualizador de PDF.
 */

import { useDocumentos } from '../../hooks/useDocumentos'
import { ListaDocumentos } from './ListaDocumentos'
import { VisualizadorPdf } from './VisualizadorPdf'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PainelDocumentosProps {
  /** ID do item de revisão (usado para buscar os documentos) */
  itemId: number
  /** Número CNJ do processo (usado na URL de download do PDF) */
  numeroCnj: string
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Painel de documentos: lista clicável à esquerda + viewer de PDF à direita.
 */
export function PainelDocumentos({ itemId, numeroCnj }: PainelDocumentosProps) {
  const { documentos, loading, docSelecionado, selecionarDoc } = useDocumentos(itemId)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar de listagem */}
      <ListaDocumentos
        documentos={documentos}
        docSelecionado={docSelecionado}
        onSelect={selecionarDoc}
        loading={loading}
      />

      {/* Visualizador de PDF */}
      <div className="flex-1 overflow-hidden">
        {docSelecionado ? (
          <VisualizadorPdf
            processo={numeroCnj}
            docId={docSelecionado.id}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            {loading ? 'Carregando documentos...' : 'Selecione um documento para visualizar.'}
          </div>
        )}
      </div>
    </div>
  )
}
