import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { C } from '@/lib/designTokens'
import { Info, Lightbulb, Plus, HelpCircle } from 'lucide-react'
import { MODELOS_IA_DIRETO, THINKING_LEVELS_DIRETO, MODEL_THINKING_SUPPORT, getSupportedLevels } from '../constants'

/** Chaves de configuracao do sistema "sistemas_acessorios" */
interface SistemasAcessoriosValues {
  gerador_regras_modelo: string
  gerador_regras_thinking_level: string
  gerador_regras_temperatura: string
  classificador_documentos_modelo: string
  classificador_documentos_temperatura: string
  classificador_documentos_threshold: string
}

const DEFAULTS: SistemasAcessoriosValues = {
  gerador_regras_modelo: 'gemini-3-flash-preview',
  gerador_regras_thinking_level: 'low',
  gerador_regras_temperatura: '0.1',
  classificador_documentos_modelo: 'gemini-3-flash-preview',
  classificador_documentos_temperatura: '0.1',
  classificador_documentos_threshold: '0.5',
}

const THINKING_BEHAVIORS: Record<string, string> = {
  low: 'Pensamento curto e direto, sem inferencia juridica, apenas identificar variaveis e montar condicoes logicas.',
  minimal: 'Pensamento minimo, focado em extracoes simples e mapeamentos diretos.',
  medium: 'Analise moderada com alguma inferencia para regras mais complexas.',
  high: 'Analise profunda com raciocinio juridico para regras sofisticadas.',
}

interface Props {
  values: Record<string, string>
  onChange: (chave: string, valor: string) => void
  onSave: () => void
  isSaving: boolean
}

export function SistemasAcessoriosSection({ values, onChange, onSave, isSaving }: Props) {
  const get = (key: keyof SistemasAcessoriosValues) =>
    values[key] ?? DEFAULTS[key]

  const thinkingLevel = get('gerador_regras_thinking_level')
  const currentModel = get('gerador_regras_modelo')
  const supportedLevels = getSupportedLevels(currentModel)

  return (
    <div className="space-y-6">
      {/* Banner informativo */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          <strong>Sistemas Acessorios</strong> sao agentes de IA auxiliares com escopo tecnico bem delimitado.
          Eles nao compartilham configuracao com os agentes juridicos principais.
        </p>
      </div>

      {/* Card: Gerador de Regras Deterministicas */}
      <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: C.gray200 }}>
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: C.text900 }}>
            <span className="text-purple-600">🔮</span> Gerador de Regras Deterministicas via IA
          </h3>
          <p className="text-sm mt-1" style={{ color: C.text500 }}>
            Converte linguagem natural em regras booleanas deterministicas. Acessado em:{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/admin/prompts-modulos</code>
            {' → Editar Modulo → Gerar Regra via IA'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Modelo */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-blue-600">🤖</span> Modelo
            </Label>
            <Input
              value={get('gerador_regras_modelo')}
              onChange={(e) => onChange('gerador_regras_modelo', e.target.value)}
              placeholder="gemini-3-flash-preview"
              className="bg-white"
            />
            <p className="text-xs" style={{ color: C.text400 }}>
              Modelo para converter texto → regra JSON
            </p>
          </div>

          {/* Nivel de Raciocinio */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-indigo-600">◑</span> Nivel de Raciocinio
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
            </Label>
            {supportedLevels.length === 0 && currentModel ? (
              <>
                <div className="flex h-9 w-full items-center rounded-md border px-3 text-sm opacity-50 cursor-not-allowed bg-muted">
                  <span className="text-muted-foreground">N/A</span>
                </div>
                <p className="text-xs text-amber-600">
                  Modelo atual não suporta thinking levels
                </p>
              </>
            ) : (
              <>
                <Select
                  value={get('gerador_regras_thinking_level')}
                  onValueChange={(v) => onChange('gerador_regras_thinking_level', v)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THINKING_LEVELS_DIRETO.map(opt => {
                      const isSupported = supportedLevels.includes(opt.value)
                      return (
                        <SelectItem key={opt.value} value={opt.value} disabled={!isSupported}>
                          {opt.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs" style={{ color: C.text400 }}>
                  LOW recomendado: tarefa mecanica e logica
                </p>
              </>
            )}
          </div>

          {/* Temperatura */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-red-500">🌡</span> Temperatura
            </Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={get('gerador_regras_temperatura')}
              onChange={(e) => onChange('gerador_regras_temperatura', e.target.value)}
              className="bg-white"
            />
            <p className="text-xs" style={{ color: C.text400 }}>
              0.1 recomendado: maximo determinismo
            </p>
          </div>
        </div>

        {/* Comportamento esperado */}
        <div className="flex items-start gap-2 text-sm" style={{ color: C.text500 }}>
          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <span>
            <strong>Comportamento esperado:</strong>{' '}
            {THINKING_BEHAVIORS[thinkingLevel] || THINKING_BEHAVIORS.low}
          </span>
        </div>
      </div>

      {/* Card: Classificador de Documentos PDF */}
      <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: C.gray200 }}>
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: C.text900 }}>
            <span className="text-orange-600">📑</span> Classificador de Documentos PDF
          </h3>
          <p className="text-sm mt-1" style={{ color: C.text500 }}>
            Classifica PDFs anexados em categorias do{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/admin/categorias-resumo-json</code>.
            {' '}Usado quando o usuario anexa PDFs diretamente no gerador de pecas (sem metadado de codigo).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Modelo */}
          <div className="space-y-1.5 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <Label className="text-sm font-medium flex items-center gap-1.5 text-orange-700">
              <span>🤖</span> Modelo
            </Label>
            <Input
              value={get('classificador_documentos_modelo')}
              onChange={(e) => onChange('classificador_documentos_modelo', e.target.value)}
              placeholder="gemini-3-flash-preview"
              className="bg-white"
            />
            <p className="text-xs text-orange-600">
              <strong>Recomendado:</strong> gemini-3-flash-preview (rapido e barato)
            </p>
          </div>

          {/* Temperatura */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-red-500">🌡</span> Temperatura
            </Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={get('classificador_documentos_temperatura')}
              onChange={(e) => onChange('classificador_documentos_temperatura', e.target.value)}
              className="bg-white"
            />
            <p className="text-xs" style={{ color: C.text400 }}>
              0.1 recomendado para classificacao
            </p>
          </div>

          {/* Threshold */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-violet-600">✂</span> Threshold de Confianca
            </Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={get('classificador_documentos_threshold')}
              onChange={(e) => onChange('classificador_documentos_threshold', e.target.value)}
              className="bg-white"
            />
            <p className="text-xs" style={{ color: C.text400 }}>
              Abaixo deste valor, aplica fallback
            </p>
          </div>
        </div>

        {/* Heuristica */}
        <div className="flex items-start gap-2 text-sm" style={{ color: C.text500 }}>
          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <span>
            <strong>Heuristica:</strong> Para PDFs com texto, envia primeiros + ultimos 1000 tokens.
            Para PDFs imagem ou OCR falho, envia PDF completo como imagem.
          </span>
        </div>
      </div>

      {/* Placeholder para futuros sistemas */}
      <div className="rounded-xl border-2 border-dashed p-6 text-center" style={{ borderColor: C.gray300 }}>
        <Plus className="h-6 w-6 mx-auto mb-2" style={{ color: C.text400 }} />
        <p className="text-sm" style={{ color: C.text400 }}>
          Outros sistemas acessorios podem ser adicionados aqui futuramente
        </p>
      </div>

      {/* Botao salvar */}
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="px-6"
          style={{ background: C.navy950, color: 'white' }}
        >
          {isSaving ? 'Salvando...' : '💾 Salvar Configuracoes Sistemas Acessorios'}
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
