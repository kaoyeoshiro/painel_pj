import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { C } from '@/lib/designTokens'
import { Info, Lightbulb, AlertTriangle, Plus } from 'lucide-react'
import { MODELOS_IA_DIRETO } from '../constants'

interface GlobalConfigValues {
  sla_fallback_habilitado: string
  sla_timeout_segundos: string
  modelo_fallback: string
}

const DEFAULTS: GlobalConfigValues = {
  sla_fallback_habilitado: 'false',
  sla_timeout_segundos: '30',
  modelo_fallback: 'gemini-2.0-flash-lite',
}

interface Props {
  values: Record<string, string>
  onChange: (chave: string, valor: string) => void
  onSave: () => void
  isSaving: boolean
}

export function GlobalConfigSection({ values, onChange, onSave, isSaving }: Props) {
  const get = (key: keyof GlobalConfigValues) =>
    values[key] ?? DEFAULTS[key]

  const isEnabled = get('sla_fallback_habilitado') === 'true'

  return (
    <div className="space-y-6">
      {/* Banner informativo */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>Configuracoes Globais</strong> afetam todos os sistemas. Use com cautela.
        </p>
      </div>

      {/* Card: SLA Fallback Automatico */}
      <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: C.gray200 }}>
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: C.text900 }}>
            <span className="text-amber-600">⏱</span> SLA Fallback Automatico
          </h3>
          <p className="text-sm mt-1" style={{ color: C.text500 }}>
            Quando habilitado, se o modelo principal demorar mais que o timeout configurado para responder (TTFT),
            automaticamente troca para um modelo mais rapido.{' '}
            <span className="text-red-600 font-semibold">DESABILITADO por padrao</span>
            {' '}- habilite apenas se souber o que esta fazendo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* SLA Habilitado */}
          <div className={`space-y-1.5 rounded-lg border p-3 ${isEnabled ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-amber-600">👁</span> SLA Fallback Habilitado
            </Label>
            <Select
              value={get('sla_fallback_habilitado')}
              onValueChange={(v) => onChange('sla_fallback_habilitado', v)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Desabilitado (Recomendado)</SelectItem>
                <SelectItem value="true">Habilitado</SelectItem>
              </SelectContent>
            </Select>
            {isEnabled && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Habilitar pode resultar em respostas de menor qualidade
              </p>
            )}
          </div>

          {/* Timeout */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-blue-600">⏱</span> Timeout (segundos)
            </Label>
            <Input
              type="number"
              min="5"
              max="120"
              step="5"
              value={get('sla_timeout_segundos')}
              onChange={(e) => onChange('sla_timeout_segundos', e.target.value)}
              className="bg-white"
            />
            <p className="text-xs" style={{ color: C.text400 }}>
              Tempo maximo para TTFT antes de fallback
            </p>
          </div>

          {/* Modelo de Fallback */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-purple-600">🤖</span> Modelo de Fallback
            </Label>
            <Select
              value={get('modelo_fallback')}
              onValueChange={(v) => onChange('modelo_fallback', v)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELOS_IA_DIRETO.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs" style={{ color: C.text400 }}>
              Modelo usado quando timeout excede
            </p>
          </div>
        </div>

        {/* Comportamento */}
        <div className="flex items-start gap-2 text-sm" style={{ color: C.text500 }}>
          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <span>
            <strong>Comportamento:</strong> Se o modelo principal nao responder em X segundos,
            o sistema automaticamente tenta com o modelo de fallback. Util para alta disponibilidade,
            mas pode comprometer qualidade em tarefas complexas.
          </span>
        </div>
      </div>

      {/* Placeholder para futuras configs globais */}
      <div className="rounded-xl border-2 border-dashed p-6 text-center" style={{ borderColor: C.gray300 }}>
        <Plus className="h-6 w-6 mx-auto mb-2" style={{ color: C.text400 }} />
        <p className="text-sm" style={{ color: C.text400 }}>
          Outras configuracoes globais podem ser adicionadas aqui futuramente
        </p>
      </div>

      {/* Botao salvar */}
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="px-6"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white' }}
        >
          {isSaving ? 'Salvando...' : '💾 Salvar Configuracoes Globais'}
        </Button>
      </div>

      {/* Rodape com modelos recomendados */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          <strong>Modelos recomendados:</strong>{' '}
          {MODELOS_IA_DIRETO.slice(0, 3).map(m => m.label).join(', ')}
        </p>
      </div>
    </div>
  )
}
