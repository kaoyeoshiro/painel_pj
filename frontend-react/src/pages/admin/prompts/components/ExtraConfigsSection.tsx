import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import type { ConfigIA, ConfigGroup } from '../types'
import { CONFIG_GROUPS, COLOR_MAP, isAgentKey, getConfigGroup } from '../constants'

interface ExtraConfigsSectionProps {
  configs: ConfigIA[]
  editedValues: Record<string, string>
  onValueChange: (chave: string, valor: string) => void
  onSave: () => void
  isSaving: boolean
}

/**
 * Seção de configurações extras (não-agente), agrupadas por cor/propósito.
 * Filtra chaves que pertencem a agentes (modelo_*, temperatura_*, etc.).
 */
export function ExtraConfigsSection({
  configs,
  editedValues,
  onValueChange,
  onSave,
  isSaving,
}: ExtraConfigsSectionProps) {
  const grouped = useMemo(() => {
    const extraConfigs = configs.filter(c => !isAgentKey(c.chave))
    const groups: { group: ConfigGroup | null; configs: ConfigIA[] }[] = []
    const groupMap = new Map<string, ConfigIA[]>()
    const ungrouped: ConfigIA[] = []

    for (const config of extraConfigs) {
      const group = getConfigGroup(config.chave)
      if (group) {
        const key = group.label
        if (!groupMap.has(key)) groupMap.set(key, [])
        groupMap.get(key)!.push(config)
      } else {
        ungrouped.push(config)
      }
    }

    for (const cg of CONFIG_GROUPS) {
      const items = groupMap.get(cg.label)
      if (items && items.length > 0) groups.push({ group: cg, configs: items })
    }
    if (ungrouped.length > 0) groups.push({ group: null, configs: ungrouped })

    return groups
  }, [configs])

  if (grouped.length === 0) {
    return (
      <div className="text-center py-6 text-sm" style={{ color: C.text400 }}>
        Nenhuma configuração extra para este sistema
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ group, configs: groupConfigs }) => {
        const colorKey = group?.color || 'gray'
        const colors = COLOR_MAP[colorKey] || COLOR_MAP.gray

        return (
          <div key={group?.label || 'outros'} className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
            <h3 className={`text-sm font-semibold ${colors.text} mb-3`}>
              {group?.label || 'Outros'}
            </h3>
            <div className="grid gap-3">
              {groupConfigs.map(config => (
                <div key={config.chave} className="grid gap-1.5">
                  <Label
                    htmlFor={`extra-${config.sistema}-${config.chave}`}
                    className="text-xs font-medium"
                    style={{ color: C.text500 }}
                  >
                    {config.chave}
                  </Label>
                  <Input
                    id={`extra-${config.sistema}-${config.chave}`}
                    value={editedValues[config.chave] ?? config.valor}
                    onChange={(e) => onValueChange(config.chave, e.target.value)}
                    placeholder={`Digite ${config.chave}`}
                    className="bg-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <Button
        onClick={onSave}
        disabled={isSaving}
        style={{ background: C.navy950, color: 'white' }}
      >
        {isSaving ? 'Salvando...' : 'Salvar Extras'}
      </Button>
    </div>
  )
}
