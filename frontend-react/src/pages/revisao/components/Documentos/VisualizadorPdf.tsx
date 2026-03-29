/**
 * Visualizador inline de PDF usando react-pdf.
 * Busca o documento via proxy autenticado e renderiza todas as páginas.
 */

import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Skeleton } from '@/components/ui/skeleton'
import { getToken } from '@/lib/api'

// Configura o worker do PDF.js via import local (Vite resolve o path)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ESCALA_MIN = 0.5
const ESCALA_MAX = 2.0
const ESCALA_PASSO = 0.25
const ESCALA_PADRAO = 1.0

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VisualizadorPdfProps {
  /** Número CNJ do processo (para montar a URL) */
  processo: string
  /** ID do documento no TJ-MS */
  docId: string
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Renderiza um PDF autenticado em todas as páginas com controles de zoom.
 */
export function VisualizadorPdf({ processo, docId }: VisualizadorPdfProps) {
  const [numPaginas, setNumPaginas] = useState<number>(0)
  const [escala, setEscala] = useState<number>(ESCALA_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Monta o objeto de arquivo para o react-pdf a cada mudança de documento
  const token = getToken()
  const pdfUrl = `/revisao/api/documentos/${encodeURIComponent(processo)}/${encodeURIComponent(docId)}`
  const pdfFile = {
    url: pdfUrl,
    httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  }

  // Reseta estado ao trocar de documento
  useEffect(() => {
    setNumPaginas(0)
    setCarregando(true)
    setErro(null)
  }, [processo, docId])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function aoCarregar({ numPages }: { numPages: number }) {
    setNumPaginas(numPages)
    setCarregando(false)
  }

  function aoErrar(err: Error) {
    setErro(`Não foi possível carregar o documento: ${err.message}`)
    setCarregando(false)
  }

  function diminuirZoom() {
    setEscala((e) => Math.max(ESCALA_MIN, parseFloat((e - ESCALA_PASSO).toFixed(2))))
  }

  function aumentarZoom() {
    setEscala((e) => Math.min(ESCALA_MAX, parseFloat((e + ESCALA_PASSO).toFixed(2))))
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Barra de controles */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          type="button"
          onClick={diminuirZoom}
          disabled={escala <= ESCALA_MIN}
          className="px-2 py-0.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          −
        </button>
        <span className="text-xs text-gray-600 w-12 text-center">
          {Math.round(escala * 100)}%
        </span>
        <button
          type="button"
          onClick={aumentarZoom}
          disabled={escala >= ESCALA_MAX}
          className="px-2 py-0.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      {/* Área do documento */}
      <div className="flex-1 overflow-auto p-3">
        {erro ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-red-500 text-center px-4">{erro}</p>
          </div>
        ) : (
          <>
            {carregando && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 w-full rounded" />
                ))}
              </div>
            )}
            <Document
              file={pdfFile}
              onLoadSuccess={aoCarregar}
              onLoadError={aoErrar}
              loading={null}
            >
              {Array.from({ length: numPaginas }, (_, i) => (
                <div key={i} className="mb-3">
                  <Page
                    pageNumber={i + 1}
                    scale={escala}
                    renderAnnotationLayer
                    renderTextLayer
                    loading={<Skeleton className="h-64 w-full rounded" />}
                  />
                </div>
              ))}
            </Document>
          </>
        )}
      </div>
    </div>
  )
}
