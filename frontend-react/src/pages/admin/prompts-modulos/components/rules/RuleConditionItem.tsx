// Editor de uma condicao individual (variavel + operador + valor)

import { C } from '@/lib/designTokens'
import { Trash2 } from 'lucide-react'
import type { RuleCondition, RuleVariable, ComparisonOperator } from './types'
import { OPERATOR_LABELS, OPERATORS_BY_TYPE, VALUELESS_OPERATORS } from './constants'

interface RuleConditionItemProps {
  condition: RuleCondition
  variaveis: RuleVariable[]
  onChange: (updated: RuleCondition) => void
  onRemove: () => void
}

export function RuleConditionItem({
  condition,
  variaveis,
  onChange,
  onRemove,
}: RuleConditionItemProps) {
  const selectedVar = variaveis.find((v) => v.slug === condition.variable)
  const varType = selectedVar?.tipo || 'text'
  const operators = OPERATORS_BY_TYPE[varType] || OPERATORS_BY_TYPE.text
  const needsValue = !VALUELESS_OPERATORS.includes(condition.operator)

  function handleVariableChange(slug: string) {
    const newVar = variaveis.find((v) => v.slug === slug)
    const newType = newVar?.tipo || 'text'
    const newOperators = OPERATORS_BY_TYPE[newType] || OPERATORS_BY_TYPE.text
    // Reset operador se nao e valido para o novo tipo
    const newOp = newOperators.includes(condition.operator)
      ? condition.operator
      : newOperators[0]
    const newValue = newType === 'boolean' ? true : ''
    onChange({ ...condition, variable: slug, operator: newOp, value: newValue })
  }

  function handleOperatorChange(op: ComparisonOperator) {
    const newValue = VALUELESS_OPERATORS.includes(op) ? null : condition.value
    onChange({ ...condition, operator: op, value: newValue })
  }

  function handleValueChange(value: unknown) {
    onChange({ ...condition, value })
  }

  // Agrupamento de variaveis por fonte
  const varsExtracao = variaveis.filter((v) => v.fonte === 'extracao')
  const varsProcesso = variaveis.filter((v) => v.fonte === 'processo')

  const selectClass =
    'flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div
      className="flex items-start gap-2 p-3 rounded-lg"
      style={{ background: C.gray50, border: `1px solid ${C.gray200}` }}
    >
      {/* Variavel */}
      <div className="flex-1 min-w-0">
        <label className="text-xs font-medium mb-1 block" style={{ color: C.text500 }}>
          Variável
        </label>
        <select
          className={`${selectClass} w-full`}
          value={condition.variable}
          onChange={(e) => handleVariableChange(e.target.value)}
        >
          <option value="">Selecione...</option>
          {varsProcesso.length > 0 && (
            <optgroup label="Variáveis do Processo">
              {varsProcesso.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.label} ({v.tipo})
                </option>
              ))}
            </optgroup>
          )}
          {varsExtracao.length > 0 && (
            <optgroup label="Variáveis de Extração">
              {varsExtracao.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.label} ({v.tipo})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Operador */}
      <div className="w-44 shrink-0">
        <label className="text-xs font-medium mb-1 block" style={{ color: C.text500 }}>
          Operador
        </label>
        <select
          className={`${selectClass} w-full`}
          value={condition.operator}
          onChange={(e) => handleOperatorChange(e.target.value as ComparisonOperator)}
        >
          {operators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </div>

      {/* Valor */}
      <div className="w-40 shrink-0">
        <label className="text-xs font-medium mb-1 block" style={{ color: C.text500 }}>
          Valor
        </label>
        {!needsValue ? (
          <div
            className="flex h-9 items-center px-2 rounded-md text-xs italic"
            style={{ color: C.text400, background: C.gray100 }}
          >
            Sem valor
          </div>
        ) : varType === 'boolean' ? (
          <div className="flex h-9 items-center gap-3">
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                name={`val-${condition.variable}-bool`}
                checked={condition.value === true}
                onChange={() => handleValueChange(true)}
              />
              Sim
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                name={`val-${condition.variable}-bool`}
                checked={condition.value === false}
                onChange={() => handleValueChange(false)}
              />
              Não
            </label>
          </div>
        ) : varType === 'number' || varType === 'currency' ? (
          <input
            type="number"
            className={`${selectClass} w-full`}
            value={condition.value as number ?? ''}
            onChange={(e) => handleValueChange(e.target.value ? Number(e.target.value) : '')}
            placeholder="0"
          />
        ) : varType === 'choice' && selectedVar?.opcoes ? (
          <select
            className={`${selectClass} w-full`}
            value={String(condition.value ?? '')}
            onChange={(e) => handleValueChange(e.target.value)}
          >
            <option value="">Selecione...</option>
            {selectedVar.opcoes.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className={`${selectClass} w-full`}
            value={String(condition.value ?? '')}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="valor"
          />
        )}
      </div>

      {/* Botao remover */}
      <div className="pt-5">
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: C.text400 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = C.statusError
            e.currentTarget.style.background = C.errorBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.text400
            e.currentTarget.style.background = 'transparent'
          }}
          title="Remover condição"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
