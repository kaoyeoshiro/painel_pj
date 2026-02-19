/**
 * GroupSelector — seletor de grupo reutilizavel (PS, PP, DETRAN).
 * Usa useGruposDisponiveis() para carregar grupos do backend.
 * Auto-seleciona default_group_id do usuario no primeiro render.
 */

import { useEffect, useRef } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGruposDisponiveis } from '@/hooks/useQueries'
import { Loader2 } from 'lucide-react'

interface GroupSelectorProps {
  selectedGroupId: number | null
  onGroupChange: (groupId: number) => void
  /** Classes CSS adicionais no container */
  className?: string
  /** Label exibido antes do select */
  label?: string
}

export function GroupSelector({ selectedGroupId, onGroupChange, className, label = 'Grupo' }: GroupSelectorProps) {
  const { data, isLoading } = useGruposDisponiveis()
  const initialized = useRef(false)

  // Auto-seleciona default_group_id na primeira carga
  useEffect(() => {
    if (!initialized.current && data && !selectedGroupId) {
      const defaultId = data.default_group_id
      if (defaultId) {
        onGroupChange(defaultId)
        initialized.current = true
      } else if (data.grupos.length > 0) {
        onGroupChange(data.grupos[0].id)
        initialized.current = true
      }
    }
  }, [data, selectedGroupId, onGroupChange])

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        <span className="text-sm text-gray-500">{label}:</span>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!data || data.grupos.length === 0) return null

  // Se so tem 1 grupo, nao mostra seletor (auto-seleciona)
  if (data.grupos.length === 1) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{label}:</span>
      <Select
        value={selectedGroupId?.toString() ?? ''}
        onValueChange={(val) => onGroupChange(Number(val))}
      >
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {data.grupos.map((g) => (
            <SelectItem key={g.id} value={g.id.toString()}>
              {g.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
