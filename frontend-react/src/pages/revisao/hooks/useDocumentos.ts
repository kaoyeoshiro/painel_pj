/**
 * Hook para buscar e gerenciar documentos TJ-MS de um item de revisão.
 * Faz a listagem dos metadados dos documentos e controla qual está selecionado.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchDocumentos } from '../api'
import type { DocumentoTJMS } from '../types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface UseDocumentosReturn {
  documentos: DocumentoTJMS[]
  loading: boolean
  erro: string | null
  docSelecionado: DocumentoTJMS | null
  selecionarDoc: (doc: DocumentoTJMS) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Carrega a lista de documentos do item informado e mantém seleção.
 *
 * @param itemId - ID do item de revisão
 */
export function useDocumentos(itemId: number): UseDocumentosReturn {
  const [documentos, setDocumentos] = useState<DocumentoTJMS[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [docSelecionado, setDocSelecionado] = useState<DocumentoTJMS | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const resp = await fetchDocumentos(itemId)
      const lista = resp.documentos ?? []
      setDocumentos(lista)
      // Seleciona automaticamente o primeiro documento
      if (lista.length > 0) {
        setDocSelecionado(lista[0])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar documentos'
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return {
    documentos,
    loading,
    erro,
    docSelecionado,
    selecionarDoc: setDocSelecionado,
  }
}
