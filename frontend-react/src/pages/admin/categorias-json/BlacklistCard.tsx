/**
 * Secao de codigos ignorados (blacklist) — exibida no topo da pagina.
 * Gerencia codigos numericos de documentos que nao terao resumo JSON extraido.
 */

import { useState } from 'react'
import { Ban, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { C } from '@/lib/designTokens'

interface BlacklistCardProps {
  codigos: number[]
  onSave: (codigos: number[]) => Promise<void>
  loading: boolean
}

export function BlacklistCard({ codigos, onSave, loading }: BlacklistCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

  const startEditing = () => {
    setDraft([...codigos])
    setInputValue('')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setDraft([])
    setInputValue('')
  }

  const addCodigo = () => {
    const num = parseInt(inputValue.trim(), 10)
    if (isNaN(num) || num <= 0) return
    if (draft.includes(num)) return
    setDraft(prev => [...prev, num].sort((a, b) => a - b))
    setInputValue('')
  }

  const removeCodigo = (codigo: number) => {
    setDraft(prev => prev.filter(c => c !== codigo))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCodigo()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setSaveStatus('saved')
      setTimeout(() => {
        setSaveStatus('idle')
        setEditing(false)
      }, 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl" style={{ borderColor: C.gray200 }} data-testid="blacklist-card">
      {/* Cabecalho */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: C.gray100 }}>
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-red-500" />
          <h3 className="font-medium text-sm" style={{ color: C.text900 }}>
            Codigos Ignorados na Extracao JSON
          </h3>
          <span className="text-xs" style={{ color: C.text400 }}>
            (documentos com estes codigos nao terao resumo extraido)
          </span>
        </div>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startEditing}
            className="text-xs"
            style={{ color: C.navy700 }}
            data-testid="btn-editar-blacklist"
          >
            Editar
          </Button>
        )}
      </div>

      {/* Conteudo */}
      <div className="px-4 py-3">
        {/* Modo exibicao */}
        {!editing && (
          <div className="flex flex-wrap gap-2" data-testid="blacklist-display">
            {loading && <span className="text-sm" style={{ color: C.text400 }}>Carregando...</span>}
            {!loading && codigos.length === 0 && (
              <span className="text-sm italic" style={{ color: C.text400 }}>
                Nenhum codigo ignorado
              </span>
            )}
            {!loading && codigos.map(codigo => (
              <span
                key={codigo}
                className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 font-mono"
              >
                {codigo}
              </span>
            ))}
          </div>
        )}

        {/* Modo edicao */}
        {editing && (
          <div className="space-y-3" data-testid="blacklist-editor">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite o codigo (ex: 9508)"
                className="flex-1"
                data-testid="input-blacklist-codigo"
              />
              <Button
                variant="secondary"
                onClick={addCodigo}
                className="bg-red-100 text-red-700 hover:bg-red-200"
                data-testid="btn-add-blacklist"
              >
                Adicionar
              </Button>
            </div>

            <div
              className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-lg bg-red-50"
              style={{ borderColor: '#fecaca' }}
            >
              {draft.length === 0 && (
                <span className="text-sm" style={{ color: C.text400 }}>Nenhum codigo ignorado</span>
              )}
              {draft.map(codigo => (
                <span
                  key={codigo}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 font-mono"
                >
                  {codigo}
                  <button
                    type="button"
                    onClick={() => removeCodigo(codigo)}
                    className="rounded-full p-0.5 hover:bg-red-200 transition-colors"
                    aria-label={`Remover codigo ${codigo}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className={saveStatus === 'saved'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
                }
                data-testid="btn-salvar-blacklist"
              >
                {saving ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo!' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
