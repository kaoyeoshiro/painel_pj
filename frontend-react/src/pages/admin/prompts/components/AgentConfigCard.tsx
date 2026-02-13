import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RotateCcw, HelpCircle } from 'lucide-react'
import { C } from '@/lib/designTokens'
import type { AgentConfig, SourceType } from '../types'
import { THINKING_LEVELS, MODELOS_IA, INHERIT_VALUE, MODEL_THINKING_SUPPORT, getSupportedLevels } from '../constants'
import { SourceBadge } from './SourceBadge'

interface AgentConfigCardProps {
  slug: string
  config: AgentConfig
  /** Valores locais editados (override sobre resolved) */
  edits: Record<string, string>
  onFieldChange: (campo: string, valor: string) => void
  onReset: () => void
  isResetting?: boolean
}

/** Rótulos amigáveis para os 4 campos de agente */
const FIELD_LABELS: Record<string, string> = {
  modelo: 'Modelo',
  temperatura: 'Temperatura',
  max_tokens: 'Max Tokens',
  thinking_level: 'Thinking Level',
}

/**
 * Card individual de configuração de um agente.
 * Exibe 4 campos (modelo, temperatura, max_tokens, thinking_level)
 * com SourceBadge indicando a fonte de resolução.
 */
export function AgentConfigCard({
  slug,
  config,
  edits,
  onFieldChange,
  onReset,
  isResetting = false,
}: AgentConfigCardProps) {
  const isDirty = Object.keys(edits).length > 0

  const getResolvedValue = (campo: string): string => {
    const val = config[campo as keyof AgentConfig]
    if (val === null || val === undefined) return ''
    return String(val)
  }

  const getSource = (campo: string): SourceType => {
    return config[`${campo}_fonte` as keyof AgentConfig] as SourceType || 'default'
  }

  const getDisplayValue = (campo: string): string => {
    if (campo in edits) return edits[campo]
    return ''
  }

  const getPlaceholder = (campo: string): string => {
    const resolved = getResolvedValue(campo)
    if (!resolved) return 'Não definido'
    return resolved
  }

  // Determinar modelo atual para validação de thinking levels
  const currentModel = edits.modelo !== undefined && edits.modelo !== ''
    ? edits.modelo
    : config.modelo || ''
  const supportedLevels = getSupportedLevels(currentModel)

  return (
    <div
      className={`rounded-lg p-4 transition-all ${isDirty ? 'ring-2 ring-orange-400' : ''}`}
      style={{ border: `1px solid ${C.gray200}` }}
      data-testid={`agent-card-${slug}`}
    >
      {/* Header: nome + descrição + reset */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <span className="text-sm font-bold" style={{ color: C.text900 }}>
            {slug}
          </span>
          <p className="text-xs mt-0.5" style={{ color: C.text500 }}>
            {config.descricao}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={isResetting}
          className="flex-shrink-0 text-xs"
          title="Limpar overrides deste agente"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          {isResetting ? 'Resetando...' : 'Resetar'}
        </Button>
      </div>

      {/* Grid 2x2: modelo, temperatura, max_tokens, thinking_level */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Modelo — Select */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium" style={{ color: C.text500 }}>
              {FIELD_LABELS.modelo}
            </Label>
            <SourceBadge source={edits.modelo !== undefined ? 'agent' : getSource('modelo')} />
          </div>
          <Select
            value={edits.modelo !== undefined ? (edits.modelo || INHERIT_VALUE) : undefined}
            onValueChange={(v) => onFieldChange('modelo', v === INHERIT_VALUE ? '' : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={getPlaceholder('modelo')} />
            </SelectTrigger>
            <SelectContent>
              {MODELOS_IA.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Temperatura — Input numérico */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium" style={{ color: C.text500 }}>
              {FIELD_LABELS.temperatura}
            </Label>
            <SourceBadge source={edits.temperatura !== undefined ? 'agent' : getSource('temperatura')} />
          </div>
          <Input
            type="text"
            value={getDisplayValue('temperatura')}
            onChange={(e) => onFieldChange('temperatura', e.target.value)}
            placeholder={getPlaceholder('temperatura')}
            className="h-8 text-xs"
          />
        </div>

        {/* Max Tokens — Input numérico */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium" style={{ color: C.text500 }}>
              {FIELD_LABELS.max_tokens}
            </Label>
            <SourceBadge source={edits.max_tokens !== undefined ? 'agent' : getSource('max_tokens')} />
          </div>
          <Input
            type="text"
            value={getDisplayValue('max_tokens')}
            onChange={(e) => onFieldChange('max_tokens', e.target.value)}
            placeholder={getPlaceholder('max_tokens')}
            className="h-8 text-xs"
          />
        </div>

        {/* Thinking Level — Select */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium" style={{ color: C.text500 }}>
              {FIELD_LABELS.thinking_level}
            </Label>
            <SourceBadge source={edits.thinking_level !== undefined ? 'agent' : getSource('thinking_level')} />
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center" title="Ver compatibilidade de modelos">
                  <HelpCircle className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 text-xs">
                <div className="space-y-2">
                  <p className="font-semibold text-gray-700">Compatibilidade de Thinking Levels</p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 px-2 font-medium">Modelo</th>
                        <th className="text-left py-1 px-2 font-medium">Níveis Suportados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(MODEL_THINKING_SUPPORT).map(([model, levels]) => (
                        <tr key={model} className="border-b">
                          <td className="py-1 px-2">{model}</td>
                          <td className="py-1 px-2 text-gray-600">{levels.join(', ')}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-1 px-2 text-gray-500" colSpan={2}>
                          Gemini 2.5 Flash Lite: usa thinkingBudget (não thinkingLevel)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {supportedLevels.length === 0 && currentModel ? (
            <>
              <div className="flex h-8 w-full items-center rounded-md border px-3 text-xs opacity-50 cursor-not-allowed bg-muted">
                <span className="text-muted-foreground">N/A</span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Modelo atual não suporta thinking levels
              </p>
            </>
          ) : (
            <Select
              value={edits.thinking_level !== undefined ? (edits.thinking_level || INHERIT_VALUE) : undefined}
              onValueChange={(v) => onFieldChange('thinking_level', v === INHERIT_VALUE ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={getPlaceholder('thinking_level')} />
              </SelectTrigger>
              <SelectContent>
                {THINKING_LEVELS.map(t => {
                  const isInheritOrNone = t.value === INHERIT_VALUE || t.value === 'none'
                  const isSupported = isInheritOrNone || supportedLevels.includes(t.value)
                  return (
                    <SelectItem key={t.value} value={t.value} disabled={!isSupported}>
                      {t.label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  )
}
