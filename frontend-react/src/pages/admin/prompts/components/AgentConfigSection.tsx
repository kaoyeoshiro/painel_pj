import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import type { PerAgentResponse } from '../types'
import { SOURCE_COLORS } from '../constants'
import { AgentConfigCard } from './AgentConfigCard'

interface AgentConfigSectionProps {
  perAgentData: PerAgentResponse | null
  isLoading: boolean
  onSave: (edits: Record<string, Record<string, string>>) => Promise<void>
  onReset: (agente: string) => Promise<void>
}

/**
 * Container da seção "Configuração por Agente".
 * Inclui legenda de hierarquia, grid de AgentConfigCards e botão Salvar.
 */
export function AgentConfigSection({
  perAgentData,
  isLoading,
  onSave,
  onReset,
}: AgentConfigSectionProps) {
  /** edits[agente][campo] = valor editado localmente */
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [resettingAgent, setResettingAgent] = useState<string | null>(null)

  if (isLoading) {
    return <div className="text-center py-6 text-sm" style={{ color: C.text400 }}>Carregando agentes...</div>
  }

  if (!perAgentData || Object.keys(perAgentData.agentes).length === 0) {
    return <div className="text-center py-6 text-sm" style={{ color: C.text400 }}>Nenhum agente configurado para este sistema</div>
  }

  const handleFieldChange = (agente: string, campo: string, valor: string) => {
    setEdits(prev => ({
      ...prev,
      [agente]: { ...prev[agente], [campo]: valor },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(edits)
      setEdits({})
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async (agente: string) => {
    setResettingAgent(agente)
    try {
      await onReset(agente)
      setEdits(prev => {
        const next = { ...prev }
        delete next[agente]
        return next
      })
    } finally {
      setResettingAgent(null)
    }
  }

  const hasDirtyEdits = Object.values(edits).some(e => Object.keys(e).length > 0)

  return (
    <div className="space-y-4">
      {/* Legenda de hierarquia */}
      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: C.text500 }}>
        <span className="font-medium">Hierarquia:</span>
        {Object.entries(SOURCE_COLORS).map(([key, colors], idx, arr) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text}`}>
              {colors.label}
            </span>
            {idx < arr.length - 1 && <span style={{ color: C.text400 }}>{'>'}</span>}
          </span>
        ))}
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(perAgentData.agentes).map(([slug, config]) => (
          <AgentConfigCard
            key={slug}
            slug={slug}
            config={config}
            edits={edits[slug] || {}}
            onFieldChange={(campo, valor) => handleFieldChange(slug, campo, valor)}
            onReset={() => handleReset(slug)}
            isResetting={resettingAgent === slug}
          />
        ))}
      </div>

      {/* Botão Salvar */}
      <Button
        onClick={handleSave}
        disabled={isSaving || !hasDirtyEdits}
        style={{ background: C.navy950, color: 'white' }}
      >
        {isSaving ? 'Salvando agentes...' : 'Salvar Agentes'}
      </Button>
    </div>
  )
}
