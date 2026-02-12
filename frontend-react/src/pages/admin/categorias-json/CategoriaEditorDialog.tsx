/**
 * Dialog de criacao/edicao de categoria JSON.
 * Replica o comportamento do legado:
 * - Nao fecha apos salvar (mantem aberto com feedback)
 * - Backdrop click nao fecha
 * - Campos corretos (titulo, source_type, instrucoes_extracao, is_residual, motivo)
 * - formato_json como string, codigos_documento como number[]
 */

import { useState, useEffect, useRef } from 'react'
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
import { X, Check, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { C } from '@/lib/designTokens'
import type { CategoriaFormData, FonteEspecial } from './types'
import * as categoriasApi from './api'
import { CodigosSelectorDialog } from './CodigosSelectorDialog'
import { IATabContent } from './IATabContent'

interface CategoriaEditorDialogProps {
  open: boolean
  editingId: number | null
  onClose: () => void
  onSaved: () => void
}

const INITIAL_FORM: CategoriaFormData = {
  nome: '',
  titulo: '',
  descricao: '',
  codigos_documento: [],
  formato_json: '{}',
  instrucoes_extracao: '',
  is_residual: false,
  ativo: true,
  source_type: 'code',
  source_special_type: '',
  motivo: '',
}

export function CategoriaEditorDialog({ open, editingId, onClose, onSaved }: CategoriaEditorDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<CategoriaFormData>({ ...INITIAL_FORM })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [jsonValid, setJsonValid] = useState<boolean | null>(null)
  const [fontesEspeciais, setFontesEspeciais] = useState<FonteEspecial[]>([])
  const [codigosSelectorOpen, setCodigosSelectorOpen] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')
  const [activeTab, setActiveTab] = useState<'manual' | 'ia'>('manual')

  // ID real da categoria (pode mudar apos primeiro save de criacao)
  const [realId, setRealId] = useState<number | null>(editingId)

  const formatoRef = useRef<HTMLTextAreaElement>(null)

  // Sincroniza realId com editingId quando dialog abre
  useEffect(() => {
    setRealId(editingId)
  }, [editingId])

  // Carrega dados ao abrir
  useEffect(() => {
    if (!open) return
    resetState()

    if (editingId) {
      loadCategoria(editingId)
    } else {
      setForm({ ...INITIAL_FORM })
      setLoading(false)
    }

    loadFontesEspeciais()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Executa apenas ao abrir/fechar dialog ou trocar ID
  }, [open, editingId])

  const resetState = () => {
    setSaveStatus('idle')
    setSaveError('')
    setJsonValid(null)
    setCodigoInput('')
    setActiveTab('manual')
  }

  const loadCategoria = async (id: number) => {
    setLoading(true)
    try {
      const cat = await categoriasApi.obter(id)
      setForm({
        nome: cat.nome,
        titulo: cat.titulo,
        descricao: cat.descricao || '',
        codigos_documento: cat.codigos_documento || [],
        formato_json: cat.formato_json,
        instrucoes_extracao: cat.instrucoes_extracao || '',
        is_residual: cat.is_residual,
        ativo: cat.ativo,
        source_type: cat.source_type,
        source_special_type: cat.source_special_type || '',
        motivo: '',
      })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar categoria', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const loadFontesEspeciais = async () => {
    try {
      const fontes = await categoriasApi.fontesEspeciais()
      setFontesEspeciais(fontes)
    } catch {
      // Silencioso — fontes especiais sao opcionais
    }
  }

  const updateField = <K extends keyof CategoriaFormData>(key: K, value: CategoriaFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'formato_json') setJsonValid(null)
  }

  // Validacao JSON
  const validateJson = (): boolean => {
    try {
      JSON.parse(form.formato_json)
      setJsonValid(true)
      return true
    } catch {
      setJsonValid(false)
      return false
    }
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(form.formato_json)
      const formatted = JSON.stringify(parsed, null, 2)
      updateField('formato_json', formatted)
      setJsonValid(true)
    } catch {
      setJsonValid(false)
    }
  }

  // Codigos
  const addCodigo = () => {
    const num = parseInt(codigoInput.trim(), 10)
    if (isNaN(num) || num <= 0) return
    if (form.codigos_documento.includes(num)) return
    updateField('codigos_documento', [...form.codigos_documento, num].sort((a, b) => a - b))
    setCodigoInput('')
  }

  const removeCodigo = (codigo: number) => {
    updateField('codigos_documento', form.codigos_documento.filter(c => c !== codigo))
  }

  const toggleCode = (codigo: number) => {
    if (form.codigos_documento.includes(codigo)) {
      removeCodigo(codigo)
    } else {
      updateField('codigos_documento', [...form.codigos_documento, codigo].sort((a, b) => a - b))
    }
  }

  // Salvar
  const handleSave = async () => {
    // Validacoes
    if (!form.nome.trim() && !realId) {
      setSaveError('O campo "Nome" e obrigatorio para criar uma categoria.')
      return
    }
    if (!form.titulo.trim()) {
      setSaveError('O campo "Titulo" e obrigatorio.')
      return
    }
    if (!validateJson()) {
      setSaveError('O formato JSON e invalido. Corrija antes de salvar.')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveStatus('idle')

    try {
      if (realId) {
        // Atualizar
        await categoriasApi.atualizar(realId, {
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim() || null,
          codigos_documento: form.codigos_documento,
          formato_json: form.formato_json,
          instrucoes_extracao: form.instrucoes_extracao.trim() || null,
          is_residual: form.is_residual,
          ativo: form.ativo,
          source_type: form.source_type,
          source_special_type: form.source_type === 'special' ? form.source_special_type || null : null,
          motivo: form.motivo.trim() || 'Atualizacao via interface',
        })
      } else {
        // Criar
        const created = await categoriasApi.criar({
          nome: form.nome.trim(),
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim() || null,
          codigos_documento: form.codigos_documento,
          formato_json: form.formato_json,
          instrucoes_extracao: form.instrucoes_extracao.trim() || null,
          is_residual: form.is_residual,
          ativo: form.ativo,
          source_type: form.source_type,
          source_special_type: form.source_type === 'special' ? form.source_special_type || null : null,
        })
        // Apos criar, muda para modo edicao com o ID retornado
        setRealId(created.id)
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)

      toast({
        title: 'Sucesso',
        description: realId ? 'Categoria atualizada com sucesso' : 'Categoria criada com sucesso',
      })

      onSaved()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar categoria'
      setSaveError(msg)
      setSaveStatus('error')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const isEditMode = realId !== null

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
        <DialogContent
          className="max-w-5xl max-h-[95vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          data-testid="editor-dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? `Editando: ${form.titulo || form.nome}`
                : 'Preencha os campos para criar uma nova categoria.'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-12 text-sm" style={{ color: C.text400 }}>
              Carregando categoria...
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {/* === Dados basicos === */}
              <fieldset className="space-y-4 border rounded-lg p-4" style={{ borderColor: C.gray200 }}>
                <legend className="text-sm font-semibold px-2" style={{ color: C.text700 }}>
                  Informacoes Basicas
                </legend>

                <div className="grid grid-cols-2 gap-4">
                  {/* Nome (somente criacao) */}
                  <div>
                    <Label htmlFor="editor-nome">Nome (identificador)</Label>
                    <Input
                      id="editor-nome"
                      value={form.nome}
                      onChange={e => updateField('nome', e.target.value)}
                      placeholder="ex: peticoes, decisoes"
                      disabled={isEditMode}
                      data-testid="input-nome"
                    />
                    <p className="text-xs mt-1" style={{ color: C.text400 }}>
                      Identificador unico (sem espacos ou acentos)
                    </p>
                  </div>

                  {/* Titulo */}
                  <div>
                    <Label htmlFor="editor-titulo">Titulo (exibicao)</Label>
                    <Input
                      id="editor-titulo"
                      value={form.titulo}
                      onChange={e => updateField('titulo', e.target.value)}
                      placeholder="ex: Peticoes, Decisoes Judiciais"
                      data-testid="input-titulo"
                    />
                  </div>
                </div>

                {/* Descricao */}
                <div>
                  <Label htmlFor="editor-descricao">Descricao</Label>
                  <Textarea
                    id="editor-descricao"
                    value={form.descricao}
                    onChange={e => updateField('descricao', e.target.value)}
                    placeholder="Descreva o proposito desta categoria..."
                    rows={2}
                    data-testid="input-descricao"
                  />
                </div>
              </fieldset>

              {/* === Fonte dos documentos === */}
              <fieldset className="space-y-4 border rounded-lg p-4" style={{ borderColor: C.gray200 }}>
                <legend className="text-sm font-semibold px-2" style={{ color: C.text700 }}>
                  Fonte dos Documentos
                </legend>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="source_type"
                      value="code"
                      checked={form.source_type === 'code'}
                      onChange={() => updateField('source_type', 'code')}
                      className="h-4 w-4"
                      data-testid="radio-source-code"
                    />
                    <span className="text-sm" style={{ color: C.text700 }}>Por codigo de documento</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="source_type"
                      value="special"
                      checked={form.source_type === 'special'}
                      onChange={() => updateField('source_type', 'special')}
                      className="h-4 w-4"
                      data-testid="radio-source-special"
                    />
                    <span className="text-sm" style={{ color: C.text700 }}>Fonte especial (regra logica)</span>
                  </label>
                </div>

                {/* Fonte especial — dropdown */}
                {form.source_type === 'special' && (
                  <div data-testid="secao-fonte-especial">
                    <Label>Selecione a fonte especial</Label>
                    <Select
                      value={form.source_special_type}
                      onValueChange={val => updateField('source_special_type', val)}
                    >
                      <SelectTrigger data-testid="select-fonte-especial">
                        <SelectValue placeholder="-- Selecione --" />
                      </SelectTrigger>
                      <SelectContent>
                        {fontesEspeciais.map(f => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.source_special_type && (
                      <p className="text-xs mt-1" style={{ color: C.text400 }}>
                        {fontesEspeciais.find(f => f.key === form.source_special_type)?.descricao}
                      </p>
                    )}
                  </div>
                )}

                {/* Codigos de documento — somente se source=code */}
                {form.source_type === 'code' && (
                  <div data-testid="secao-codigos-documento">
                    <div className="flex items-center gap-2 mb-1">
                      <Label>Codigos de Documento TJ-MS</Label>
                      <button
                        type="button"
                        onClick={() => setCodigosSelectorOpen(true)}
                        className="text-xs transition-colors"
                        style={{ color: C.navy700 }}
                        data-testid="btn-ver-codigos"
                      >
                        Ver lista de codigos
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Input
                        type="number"
                        min={1}
                        value={codigoInput}
                        onChange={e => setCodigoInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCodigo() } }}
                        placeholder="Digite o codigo (ex: 500)"
                        className="flex-1"
                        data-testid="input-codigo"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={addCodigo}
                        className="bg-green-100 text-green-700 hover:bg-green-200"
                      >
                        Adicionar
                      </Button>
                    </div>
                    <div
                      className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-lg bg-gray-50"
                      style={{ borderColor: C.gray200 }}
                      data-testid="lista-codigos"
                    >
                      {form.codigos_documento.length === 0 && (
                        <span className="text-sm" style={{ color: C.text400 }}>Nenhum codigo adicionado</span>
                      )}
                      {form.codigos_documento.map(codigo => (
                        <span
                          key={codigo}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-mono"
                        >
                          {codigo}
                          <button
                            type="button"
                            onClick={() => removeCodigo(codigo)}
                            className="rounded-full p-0.5 hover:bg-green-200 transition-colors"
                            aria-label={`Remover codigo ${codigo}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              {/* === Formato JSON com tabs === */}
              <fieldset className="space-y-4 border rounded-lg p-4" style={{ borderColor: C.gray200 }}>
                <legend className="text-sm font-semibold px-2" style={{ color: C.text700 }}>
                  Formato JSON
                </legend>

                {/* Tabs */}
                <div className="flex border-b" style={{ borderColor: C.gray200 }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
                    style={{
                      color: activeTab === 'manual' ? C.navy700 : C.text400,
                      borderColor: activeTab === 'manual' ? C.navy700 : 'transparent',
                    }}
                    data-testid="tab-json-manual"
                  >
                    JSON Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ia')}
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
                    style={{
                      color: activeTab === 'ia' ? C.navy700 : C.text400,
                      borderColor: activeTab === 'ia' ? C.navy700 : 'transparent',
                    }}
                    data-testid="tab-json-ia"
                  >
                    Gerar com IA
                  </button>
                </div>

                {/* Tab Manual */}
                {activeTab === 'manual' && (
                  <div className="space-y-3">
                    <Textarea
                      ref={formatoRef}
                      value={form.formato_json}
                      onChange={e => updateField('formato_json', e.target.value)}
                      placeholder='{"campo": {"type": "string", "description": "Descricao"}}'
                      rows={12}
                      className="font-mono text-sm"
                      data-testid="textarea-formato"
                    />

                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={validateJson}>
                        Validar JSON
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={formatJson}>
                        Formatar
                      </Button>
                      {jsonValid === true && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" /> JSON valido
                        </span>
                      )}
                      {jsonValid === false && (
                        <span className="flex items-center gap-1 text-xs text-red-600" data-testid="formato-error">
                          <AlertCircle className="h-3 w-3" /> JSON invalido
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab IA — geracao de JSON com perguntas */}
                {activeTab === 'ia' && (
                  <IATabContent
                    categoriaId={realId}
                    categoriaNome={form.nome}
                    formatoJson={form.formato_json}
                    onJsonChange={(json) => updateField('formato_json', json)}
                  />
                )}
              </fieldset>

              {/* === Instrucoes de extracao === */}
              <div>
                <Label htmlFor="editor-instrucoes">Instrucoes de Extracao (opcional)</Label>
                <Textarea
                  id="editor-instrucoes"
                  value={form.instrucoes_extracao}
                  onChange={e => updateField('instrucoes_extracao', e.target.value)}
                  placeholder="Instrucoes adicionais para a LLM durante a extracao..."
                  rows={3}
                  data-testid="textarea-instrucoes"
                />
              </div>

              {/* === Opcoes === */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_residual}
                    onChange={e => updateField('is_residual', e.target.checked)}
                    className="h-4 w-4"
                    data-testid="checkbox-residual"
                  />
                  <span className="text-sm" style={{ color: C.text700 }}>Categoria Residual (fallback)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={e => updateField('ativo', e.target.checked)}
                    className="h-4 w-4"
                    data-testid="checkbox-ativo"
                  />
                  <span className="text-sm" style={{ color: C.text700 }}>Ativo</span>
                </label>
              </div>

              {/* === Motivo (somente edicao) === */}
              {isEditMode && (
                <div>
                  <Label htmlFor="editor-motivo">Motivo da alteracao</Label>
                  <Input
                    id="editor-motivo"
                    value={form.motivo}
                    onChange={e => updateField('motivo', e.target.value)}
                    placeholder="Descreva o motivo da alteracao..."
                    data-testid="input-motivo"
                  />
                </div>
              )}
            </div>
          )}

          {/* Erro inline */}
          {saveError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="save-error">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {saveError}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose} data-testid="btn-cancel">
              Fechar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                background: saveStatus === 'saved' ? C.statusSuccess : C.navy950,
                color: 'white',
              }}
              data-testid="btn-save"
            >
              {saving
                ? 'Salvando...'
                : saveStatus === 'saved'
                  ? 'Salvo!'
                  : isEditMode
                    ? 'Atualizar'
                    : 'Criar'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de selecao de codigos */}
      <CodigosSelectorDialog
        open={codigosSelectorOpen}
        onOpenChange={setCodigosSelectorOpen}
        selectedCodes={form.codigos_documento}
        onToggleCode={toggleCode}
        currentCategoriaId={realId}
      />
    </>
  )
}
