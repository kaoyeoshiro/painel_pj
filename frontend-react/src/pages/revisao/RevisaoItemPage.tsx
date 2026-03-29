/**
 * Página de revisão de um item específico.
 * Exibe split-panel com editor TipTap, chat e painel de documentos.
 * TODO: implementar em Task 10.
 */

import { useParams } from '@tanstack/react-router'

export function RevisaoItemPage() {
  const { itemId } = useParams({ from: '/revisao/$itemId' })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Revisar Item #{itemId}</h1>
      <p className="mt-2 text-gray-500">Em construção...</p>
    </div>
  )
}
