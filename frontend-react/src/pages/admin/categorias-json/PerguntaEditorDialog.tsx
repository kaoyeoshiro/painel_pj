/**
 * Dialog de criacao/edicao de uma pergunta de extracao.
 * Replica o modal-pergunta do legado (admin_categorias_json.html).
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { C } from '@/lib/designTokens'
import type { PerguntaLocal, DependencyOperator } from './types'

interface PerguntaEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pergunta: PerguntaLocal | null
  categoriaNome: string
  /** Variaveis disponiveis para dependencia (slugs das outras perguntas) */
  variaveisDisponiveis: { slug: string; pergunta: string }[]
  onSave: (data: PerguntaLocal) => void
}

const TIPOS_DADO: { value: string; label: string }[] = [
  { value: '', label: 'Deixar IA decidir' },
  { value: 'text', label: 'Texto livre' },
  { value: 'number', label: 'Numero inteiro' },
  { value: 'currency', label: 'Valor monetario' },
  { value: 'boolean', label: 'Sim/Nao' },
  { value: 'date', label: 'Data' },
  { value: 'choice', label: 'Lista de opcoes' },
  { value: 'list', label: 'Lista de textos' },
]

const OPERADORES: { value: DependencyOperator; label: string }[] = [
  { value: 'equals', label: 'e igual a' },
  { value: 'not_equals', label: 'e diferente de' },
  { value: 'exists', label: 'existe (tem valor)' },
  { value: 'not_exists', label: 'nao existe (vazio)' },
  { value: 'contains', label: 'contem' },
  { value: 'greater_than', label: 'e maior que' },
  { value: 'less_than', label: 'e menor que' },
]

const OPERADORES_SEM_VALOR: DependencyOperator[] = ['exists', 'not_exists']

export function PerguntaEditorDialog({
  open,
  onOpenChange,
  pergunta,
  categoriaNome,
  variaveisDisponiveis,
  onSave,
}: PerguntaEditorDialogProps) {
  const isEdit = pergunta !== null && pergunta.id !== undefined

  const [texto, setTexto] = useState('')
  const [nomeVariavel, setNomeVariavel] = useState('')
  const [tipoSugerido, setTipoSugerido] = useState('')
  const [opcoes, setOpcoes] = useState('')
  const [ordem, setOrdem] = useState(0)
  const [ativo, setAtivo] = useState(true)

  // Dependencia
  const [temDependencia, setTemDependencia] = useState(false)
  const [dependsOn, setDependsOn] = useState('')
  const [depOperator, setDepOperator] = useState<DependencyOperator>('equals')
  const [depValue, setDepValue] = useState('')

  // Erro
  const [erro, setErro] = useState('')

  // Prefixo da categoria para exibicao
  const prefixo = categoriaNome ? `${categoriaNome}_` : ''

  useEffect(() => {
    if (!open) return

    if (pergunta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicialização de formulário a partir de props ao abrir dialog
      setTexto(pergunta.pergunta)
      // Remove prefixo para exibir apenas o nome base
      const slug = pergunta.nome_variavel_sugerido || ''
      setNomeVariavel(slug.startsWith(prefixo) ? slug.slice(prefixo.length) : slug)
      setTipoSugerido(pergunta.tipo_sugerido || '')
      setOpcoes(pergunta.opcoes_sugeridas?.join('\n') || '')
      setOrdem(pergunta.ordem)
      setAtivo(pergunta.ativo)

      if (pergunta.depends_on_variable) {
        setTemDependencia(true)
        setDependsOn(pergunta.depends_on_variable)
        setDepOperator((pergunta.dependency_operator as DependencyOperator) || 'equals')
        setDepValue(String(pergunta.dependency_value ?? ''))
      } else {
        setTemDependencia(false)
        setDependsOn('')
        setDepOperator('equals')
        setDepValue('')
      }
    } else {
      // Novo
      setTexto('')
      setNomeVariavel('')
      setTipoSugerido('')
      setOpcoes('')
      setOrdem(0)
      setAtivo(true)
      setTemDependencia(false)
      setDependsOn('')
      setDepOperator('equals')
      setDepValue('')
    }

    setErro('')
  }, [open, pergunta, prefixo])

  const handleSave = () => {
    if (!texto.trim()) {
      setErro('O campo "Pergunta" e obrigatorio.')
      return
    }

    const opcoesArr = tipoSugerido === 'choice'
      ? opcoes.split('\n').map(l => l.trim()).filter(Boolean)
      : null

    const data: PerguntaLocal = {
      ...(pergunta?.id !== undefined ? { id: pergunta.id } : {}),
      pergunta: texto.trim(),
      nome_variavel_sugerido: nomeVariavel.trim() || null,
      tipo_sugerido: tipoSugerido || null,
      opcoes_sugeridas: opcoesArr,
      depends_on_variable: temDependencia && dependsOn ? dependsOn : null,
      dependency_operator: temDependencia && dependsOn ? depOperator : null,
      dependency_value: temDependencia && dependsOn && !OPERADORES_SEM_VALOR.includes(depOperator)
        ? depValue
        : null,
      dependency_inferred: pergunta?.dependency_inferred ?? false,
      ativo,
      ordem,
    }

    onSave(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="pergunta-editor-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Pergunta' : 'Nova Pergunta de Extracao'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Edite os campos abaixo.' : 'Escreva como se estivesse perguntando a um assistente humano.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pergunta */}
          <div>
            <Label>Pergunta em linguagem natural *</Label>
            <Textarea
              value={texto}
              onChange={e => { setTexto(e.target.value); setErro('') }}
              placeholder="Ex: Qual e o medicamento solicitado na peticao?"
              rows={2}
              data-testid="input-pergunta-texto"
            />
          </div>

          {/* Sugestoes opcionais */}
          <div className="border-t pt-4 space-y-4" style={{ borderColor: C.gray200 }}>
            <p className="text-sm" style={{ color: C.text500 }}>
              Sugestoes opcionais (a IA decide se nao preencher)
            </p>

            {/* Nome da variavel */}
            <div>
              <Label>Nome base da variavel</Label>
              <div className="flex items-stretch">
                {prefixo && (
                  <span
                    className="inline-flex items-center px-3 py-2 border border-r-0 bg-gray-100 text-sm rounded-l-lg font-mono"
                    style={{ borderColor: C.gray300, color: C.text500 }}
                  >
                    {prefixo}
                  </span>
                )}
                <Input
                  value={nomeVariavel}
                  onChange={e => setNomeVariavel(e.target.value)}
                  placeholder="ex: medicamento_solicitado"
                  className={`font-mono ${prefixo ? 'rounded-l-none' : ''}`}
                  data-testid="input-pergunta-variavel"
                />
              </div>
              <p className="text-xs mt-1" style={{ color: C.text400 }}>
                Apenas letras minusculas, numeros e underscores. Prefixo aplicado automaticamente.
              </p>
            </div>

            {/* Tipo + Ordem */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de dado sugerido</Label>
                <Select value={tipoSugerido} onValueChange={setTipoSugerido}>
                  <SelectTrigger data-testid="select-tipo-pergunta">
                    <SelectValue placeholder="Deixar IA decidir" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DADO.map(t => (
                      <SelectItem key={t.value || '_empty'} value={t.value || '_empty'}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  min={0}
                  value={ordem}
                  onChange={e => setOrdem(parseInt(e.target.value, 10) || 0)}
                  className="w-24"
                  data-testid="input-pergunta-ordem"
                />
              </div>
            </div>

            {/* Opcoes (para choice) */}
            {tipoSugerido === 'choice' && (
              <div>
                <Label>Opcoes (uma por linha)</Label>
                <Textarea
                  value={opcoes}
                  onChange={e => setOpcoes(e.target.value)}
                  placeholder={'Deferido\nIndeferido\nParcialmente deferido'}
                  rows={3}
                  data-testid="textarea-opcoes-pergunta"
                />
              </div>
            )}
          </div>

          {/* Dependencia */}
          <div className="border-t pt-4" style={{ borderColor: C.gray200 }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={temDependencia}
                onChange={e => setTemDependencia(e.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-tem-dependencia"
              />
              <span className="text-sm font-medium" style={{ color: C.text700 }}>
                Esta pergunta depende de outra
              </span>
            </label>

            {temDependencia && (
              <div className="mt-3 space-y-3 bg-gray-50 p-3 rounded-lg border" style={{ borderColor: C.gray200 }}>
                <p className="text-xs" style={{ color: C.text500 }}>
                  A pergunta so sera feita se a condicao for satisfeita.
                </p>

                {/* Variavel de dependencia */}
                <div>
                  <Label>Variavel de dependencia</Label>
                  <Select value={dependsOn} onValueChange={setDependsOn}>
                    <SelectTrigger data-testid="select-depends-on">
                      <SelectValue placeholder="Selecione a variavel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {variaveisDisponiveis.map(v => (
                        <SelectItem key={v.slug} value={v.slug}>
                          <span className="font-mono text-xs">{v.slug}</span>
                          <span className="ml-2 text-xs" style={{ color: C.text400 }}>{v.pergunta}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operador + Valor */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Condicao</Label>
                    <Select value={depOperator} onValueChange={v => setDepOperator(v as DependencyOperator)}>
                      <SelectTrigger data-testid="select-dep-operator">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERADORES.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!OPERADORES_SEM_VALOR.includes(depOperator) && (
                    <div>
                      <Label>Valor</Label>
                      <Input
                        value={depValue}
                        onChange={e => setDepValue(e.target.value)}
                        placeholder="ex: true, sim, medicamento"
                        data-testid="input-dep-value"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ativo}
              onChange={e => setAtivo(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-pergunta-ativa"
            />
            <span className="text-sm" style={{ color: C.text700 }}>Pergunta ativa</span>
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-sm text-red-600">{erro}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            style={{ background: C.navy950, color: 'white' }}
            data-testid="btn-salvar-pergunta"
          >
            Salvar Pergunta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
