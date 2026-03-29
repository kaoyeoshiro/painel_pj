/**
 * Sidebar com lista clicável de documentos TJ-MS.
 * Exibe tipo, descrição e data de juntada de cada documento.
 */

import { Skeleton } from '@/components/ui/skeleton'
import type { DocumentoTJMS } from '../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formata data ISO para dd/mm/aaaa */
function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

/** Retorna o label mais descritivo disponível no documento */
function labelDocumento(doc: DocumentoTJMS): string {
  return doc.descricao || doc.tipo_descricao || `Tipo ${doc.tipo_codigo ?? '?'}`
}

// ---------------------------------------------------------------------------
// Subcomponente — item individual
// ---------------------------------------------------------------------------

interface ItemProps {
  doc: DocumentoTJMS
  selecionado: boolean
  onSelect: (doc: DocumentoTJMS) => void
}

function ItemDocumento({ doc, selecionado, onSelect }: ItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(doc)}
      className={[
        'w-full text-left px-3 py-2 border-b border-gray-100',
        'transition-colors',
        selecionado
          ? 'bg-blue-50 border-l-2 border-l-blue-500'
          : 'hover:bg-gray-50 border-l-2 border-l-transparent',
        'cursor-pointer',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-gray-800 leading-snug truncate">
        {labelDocumento(doc)}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {formatarData(doc.data_juntada)}
      </p>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface ListaDocumentosProps {
  documentos: DocumentoTJMS[]
  docSelecionado: DocumentoTJMS | null
  onSelect: (doc: DocumentoTJMS) => void
  loading: boolean
}

/**
 * Lista lateral de documentos com indicador visual de seleção.
 */
export function ListaDocumentos({
  documentos,
  docSelecionado,
  onSelect,
  loading,
}: ListaDocumentosProps) {
  return (
    <div className="flex flex-col h-full w-44 border-r border-gray-200 bg-white overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Documentos {!loading && `(${documentos.length})`}
        </p>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : documentos.length === 0 ? (
          <p className="p-3 text-xs text-gray-400 italic">
            Nenhum documento encontrado.
          </p>
        ) : (
          documentos.map((doc) => (
            <ItemDocumento
              key={doc.id}
              doc={doc}
              selecionado={docSelecionado?.id === doc.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
