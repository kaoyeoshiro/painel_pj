/**
 * ConfigPecasPage — DEPRECADA.
 *
 * Esta pagina foi substituida por:
 * - /admin/categorias-json (obrigatoriedade e categorias de extracao)
 * - /admin/filtro-documentos (categorias de documento e tipos de peca)
 *
 * Rota mantida apenas para retrocompatibilidade (bookmarks, links antigos).
 */

import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

export function ConfigPecasPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: '/admin/categorias-json', replace: true })
  }, [navigate])

  return null
}
