import { useState, useEffect, useRef, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { HelpCircle, X, Tags } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { AdminSubNav } from '@/components/layout'
import { C, FONT_UI } from '@/lib/designTokens'

// Estrutura de dados da categoria JSON
interface CategoriaJSON {
  id: number
  nome: string
  titulo?: string
  descricao: string
  codigos_documento?: string[] | null
  formato_json: Record<string, unknown>
  instrucoes_extracao?: string
  is_residual?: boolean
  ativo: boolean
  json_gerado_por_ia?: boolean
  criado_em?: string
  atualizado_em?: string
}

// Tipo de fonte para saída formatada
type FontType = 'normal' | 'monospace' | 'custom'

// Formulário de criação/edição
interface CategoriaFormData {
  nome: string
  descricao: string
  codigos_documento: string
  formato_json: string
  ativo: boolean
  blacklist: string[]
  fontType: FontType
  customFontName: string
}

const INITIAL_FORM_DATA: CategoriaFormData = {
  nome: '',
  descricao: '',
  codigos_documento: '',
  formato_json: '{}',
  ativo: true,
  blacklist: [],
  fontType: 'normal',
  customFontName: ''
}

// Variáveis disponíveis para inserção no formato JSON
const AVAILABLE_VARIABLES = [
  { value: '{numero_cnj}', label: 'Número CNJ' },
  { value: '{data}', label: 'Data' },
  { value: '{valor}', label: 'Valor' },
  { value: '{parte_autora}', label: 'Parte Autora' },
  { value: '{parte_re}', label: 'Parte Ré' },
  { value: '{tipo_acao}', label: 'Tipo de Ação' },
  { value: '{comarca}', label: 'Comarca' },
  { value: '{vara}', label: 'Vara' },
  { value: '{status}', label: 'Status' },
  { value: '{descricao}', label: 'Descrição' }
]

export function CategoriasJsonPage() {
  const { toast } = useToast()
  const [categorias, setCategorias] = useState<CategoriaJSON[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<CategoriaFormData>(INITIAL_FORM_DATA)
  const [jsonErrors, setJsonErrors] = useState<{ formato?: string }>({})
  const [blacklistInput, setBlacklistInput] = useState('')

  // Referência ao textarea do formato JSON para inserção de variáveis na posição do cursor
  const formatoTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Carregar categorias
  useEffect(() => {
    loadCategorias()
  }, [])

  const loadCategorias = async () => {
    try {
      setLoading(true)
      const data = await adminApi.get<CategoriaJSON[]>('/admin/api/categorias-resumo-json')
      setCategorias(data)
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar categorias',
        variant: 'destructive'
      })
      console.error('Erro ao carregar categorias:', error)
    } finally {
      setLoading(false)
    }
  }

  // Abrir dialog para criar
  const handleCreate = () => {
    setEditingId(null)
    setFormData(INITIAL_FORM_DATA)
    setJsonErrors({})
    setBlacklistInput('')
    setDialogOpen(true)
  }

  // Abrir dialog para editar
  const handleEdit = async (id: number) => {
    try {
      const categoria = await adminApi.get<CategoriaJSON & {
        blacklist?: string[]
        font_type?: FontType
        custom_font_name?: string
      }>(`/admin/api/categorias-resumo-json/${id}`)
      setEditingId(id)
      setFormData({
        nome: categoria.nome || '',
        descricao: categoria.descricao || '',
        codigos_documento: categoria.codigos_documento ? categoria.codigos_documento.join(', ') : '',
        formato_json: JSON.stringify(categoria.formato_json || {}, null, 2),
        ativo: categoria.ativo !== undefined ? categoria.ativo : true,
        blacklist: categoria.blacklist || [],
        fontType: categoria.font_type || 'normal',
        customFontName: categoria.custom_font_name || ''
      })
      setJsonErrors({})
      setBlacklistInput('')
      setDialogOpen(true)
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar categoria',
        variant: 'destructive'
      })
      console.error('Erro ao carregar categoria:', error)
    }
  }

  // Validar e parsear JSON
  const validateJson = (jsonString: string, field: 'formato'): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(jsonString)
      setJsonErrors(prev => ({ ...prev, [field]: undefined }))
      return parsed
    } catch (error) {
      setJsonErrors(prev => ({ ...prev, [field]: 'JSON inválido' }))
      return null
    }
  }

  // Adicionar termo à blacklist
  const handleAddBlacklistTerm = useCallback(() => {
    const term = blacklistInput.trim()
    if (!term) return

    // Evitar duplicatas
    if (formData.blacklist.includes(term)) {
      toast({
        title: 'Aviso',
        description: 'Termo já existe na blacklist',
        variant: 'destructive'
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      blacklist: [...prev.blacklist, term]
    }))
    setBlacklistInput('')
  }, [blacklistInput, formData.blacklist, toast])

  // Remover termo da blacklist
  const handleRemoveBlacklistTerm = (term: string) => {
    setFormData(prev => ({
      ...prev,
      blacklist: prev.blacklist.filter(t => t !== term)
    }))
  }

  // Adicionar blacklist ao pressionar Enter
  const handleBlacklistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddBlacklistTerm()
    }
  }

  // Inserir variável na posição do cursor no textarea de formato JSON
  const handleInsertVariable = (variable: string) => {
    const textarea = formatoTextareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = formData.formato_json
    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end)

    setFormData(prev => ({ ...prev, formato_json: newValue }))
    validateJson(newValue, 'formato')

    // Reposicionar o cursor após a variável inserida
    requestAnimationFrame(() => {
      textarea.focus()
      const newCursorPos = start + variable.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
  }

  // Salvar categoria
  const handleSave = async () => {
    // Validar JSONs
    const formatoJson = validateJson(formData.formato_json, 'formato')

    if (!formatoJson) {
      toast({
        title: 'Erro',
        description: 'Corrija os erros de JSON antes de salvar',
        variant: 'destructive'
      })
      return
    }

    // Preparar dados
    const payload = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim(),
      codigos_documento: formData.codigos_documento
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0),
      formato_json: formatoJson,
      ativo: formData.ativo,
      blacklist: formData.blacklist,
      font_type: formData.fontType,
      custom_font_name: formData.fontType === 'custom' ? formData.customFontName.trim() : undefined
    }

    try {
      if (editingId) {
        await adminApi.put(`/admin/api/categorias-resumo-json/${editingId}`, payload)
        toast({
          title: 'Sucesso',
          description: 'Categoria atualizada com sucesso'
        })
      } else {
        await adminApi.post('/admin/api/categorias-resumo-json', payload)
        toast({
          title: 'Sucesso',
          description: 'Categoria criada com sucesso'
        })
      }
      setDialogOpen(false)
      loadCategorias()
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar categoria',
        variant: 'destructive'
      })
      console.error('Erro ao salvar categoria:', error)
    }
  }

  // Abrir dialog de confirmação de exclusão
  const handleDeleteClick = (id: number) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  // Confirmar exclusão
  const handleDeleteConfirm = async () => {
    if (!deletingId) return

    try {
      await adminApi.delete(`/admin/api/categorias-resumo-json/${deletingId}`)
      toast({
        title: 'Sucesso',
        description: 'Categoria excluída com sucesso'
      })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      loadCategorias()
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir categoria',
        variant: 'destructive'
      })
      console.error('Erro ao excluir categoria:', error)
    }
  }

  return (
    <div style={{ fontFamily: FONT_UI }}>
      <BreadcrumbBar
        title="Categorias JSON"
        icon={<Tags style={{ width: 14, height: 14 }} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setHelpDialogOpen(true)}
              data-testid="help-button"
              aria-label="Ajuda"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleCreate}
              style={{ background: C.navy950, color: 'white' }}
            >
              Nova Categoria
            </Button>
          </div>
        }
      />

      <div style={{ maxWidth: 1350, margin: '0 auto', padding: '32px 40px' }} className="space-y-6">
      <AdminSubNav />

      {/* Loading */}
      {loading && (
        <div className="text-center py-8" style={{ color: C.text500 }}>
          Carregando categorias...
        </div>
      )}

      {/* Grid de categorias */}
      {!loading && categorias.length === 0 && (
        <div className="text-center py-8" style={{ color: C.text500 }}>
          Nenhuma categoria cadastrada
        </div>
      )}

      {!loading && categorias.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map(categoria => (
            <Card key={categoria.id} className="p-4 rounded-2xl" style={{ borderColor: C.gray200 }}>
              {/* Título e descrição */}
              <div className="mb-3">
                <h3 className="font-semibold text-lg mb-1" style={{ color: C.text900 }}>{categoria.nome}</h3>
                <p className="text-sm" style={{ color: C.text500 }}>{categoria.descricao}</p>
              </div>

              {/* Badges de status */}
              <div className="flex gap-2 mb-3 flex-wrap">
                <Badge variant={categoria.ativo ? 'default' : 'secondary'}>
                  {categoria.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
                {categoria.json_gerado_por_ia && (
                  <Badge variant="default">IA</Badge>
                )}
              </div>

              {/* Códigos de documentos */}
              {categoria.codigos_documento && categoria.codigos_documento.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs mb-1" style={{ color: C.text400 }}>Códigos:</div>
                  <div className="flex gap-1 flex-wrap">
                    {categoria.codigos_documento.map((codigo, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {codigo}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(categoria.id)}
                  className="flex-1"
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick(categoria.id)}
                  className="flex-1"
                >
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 22.2 / 22.5 - Dialog de criação/edição aprimorado com seções organizadas */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="editor-dialog">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Altere os campos abaixo para atualizar a categoria.'
                : 'Preencha os campos abaixo para criar uma nova categoria.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* === Seção: Informações básicas === */}
            <fieldset className="space-y-4 border rounded-lg p-4" style={{ borderColor: C.gray200 }} data-testid="section-basic-info">
              <legend className="text-sm font-semibold px-2" style={{ color: C.text700 }}>Informações Básicas</legend>

              {/* Nome */}
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome da categoria"
                  data-testid="input-nome"
                />
              </div>

              {/* Descrição */}
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição da categoria"
                  rows={3}
                  data-testid="input-descricao"
                />
              </div>

              {/* Códigos de documentos */}
              <div>
                <Label htmlFor="codigos">Códigos de Documentos</Label>
                <Input
                  id="codigos"
                  value={formData.codigos_documento}
                  onChange={e => setFormData(prev => ({ ...prev, codigos_documento: e.target.value }))}
                  placeholder="Ex: 10, 20, 30 (separados por vírgula)"
                  data-testid="input-codigos"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Códigos separados por vírgula
                </p>
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={e => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="h-4 w-4"
                  data-testid="checkbox-ativo"
                />
                <Label htmlFor="ativo" className="cursor-pointer">
                  Ativo
                </Label>
              </div>
            </fieldset>

            {/* === Seção: Formato JSON e variáveis === */}
            <fieldset className="space-y-4 border rounded-lg p-4" style={{ borderColor: C.gray200 }} data-testid="section-formato">
              <legend className="text-sm font-semibold px-2" style={{ color: C.text700 }}>Formato JSON</legend>

              {/* 22.6 - Combobox de variáveis para inserção */}
              <div>
                <Label htmlFor="variables-select">Inserir Variável</Label>
                <Select
                  onValueChange={(value) => handleInsertVariable(value)}
                  value=""
                >
                  <SelectTrigger
                    id="variables-select"
                    data-testid="select-variables"
                    aria-label="Inserir variável"
                  >
                    <SelectValue placeholder="Selecione uma variável para inserir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_VARIABLES.map(variable => (
                      <SelectItem
                        key={variable.value}
                        value={variable.value}
                        data-testid={`variable-option-${variable.value}`}
                      >
                        {variable.label} — {variable.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione uma variável para inseri-la na posição do cursor no campo de formato.
                </p>
              </div>

              {/* Campo de formato JSON */}
              <div>
                <Label htmlFor="formato">Formato JSON</Label>
                <Textarea
                  id="formato"
                  ref={formatoTextareaRef}
                  value={formData.formato_json}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, formato_json: e.target.value }))
                    validateJson(e.target.value, 'formato')
                  }}
                  placeholder='{"campo": "tipo"}'
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="textarea-formato"
                />
                {jsonErrors.formato && (
                  <p className="text-xs text-destructive mt-1" data-testid="formato-error">
                    {jsonErrors.formato}
                  </p>
                )}
              </div>

              {/* Pré-visualização do JSON formatado */}
              {!jsonErrors.formato && formData.formato_json.trim() !== '' && (
                <div data-testid="json-preview">
                  <Label>Pré-visualização</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(formData.formato_json), null, 2)
                      } catch {
                        return formData.formato_json
                      }
                    })()}
                  </pre>
                </div>
              )}
            </fieldset>

            {/* === Seção: Blacklist === */}
            {/* 22.3 - Editor de blacklist com pills/tags */}
            <fieldset className="space-y-4 border rounded-lg p-4" style={{ borderColor: C.gray200 }} data-testid="section-blacklist">
              <legend className="text-sm font-semibold px-2" style={{ color: C.text700 }}>Blacklist</legend>

              <div>
                <Label htmlFor="blacklist-input">Adicionar termo à blacklist</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="blacklist-input"
                    value={blacklistInput}
                    onChange={e => setBlacklistInput(e.target.value)}
                    onKeyDown={handleBlacklistKeyDown}
                    placeholder="Digite um termo e pressione Enter"
                    data-testid="input-blacklist"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddBlacklistTerm}
                    data-testid="btn-add-blacklist"
                  >
                    Adicionar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Termos na blacklist serão ignorados durante a extração.
                </p>
              </div>

              {/* Pills/tags da blacklist */}
              {formData.blacklist.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="blacklist-pills">
                  {formData.blacklist.map((term, idx) => (
                    <Badge
                      key={`${term}-${idx}`}
                      variant="secondary"
                      className="flex items-center gap-1 pl-2.5 pr-1 py-1"
                      data-testid={`blacklist-pill-${idx}`}
                    >
                      <span>{term}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlacklistTerm(term)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                        aria-label={`Remover ${term} da blacklist`}
                        data-testid={`btn-remove-blacklist-${idx}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {formData.blacklist.length === 0 && (
                <p className="text-sm text-muted-foreground italic" data-testid="blacklist-empty">
                  Nenhum termo na blacklist.
                </p>
              )}
            </fieldset>

            {/* === Seção: Fonte especial === */}
            {/* 22.7 - Radio group para seleção de fonte */}
            <fieldset className="space-y-4 border rounded-lg p-4" style={{ borderColor: C.gray200 }} data-testid="section-font-type">
              <legend className="text-sm font-semibold px-2" style={{ color: C.text700 }}>Fonte da Saída</legend>

              <div className="space-y-3" role="radiogroup" aria-label="Tipo de fonte">
                {/* Opção: Normal */}
                <label
                  className="flex items-center gap-3 cursor-pointer"
                  data-testid="radio-font-normal"
                >
                  <input
                    type="radio"
                    name="fontType"
                    value="normal"
                    checked={formData.fontType === 'normal'}
                    onChange={() => setFormData(prev => ({ ...prev, fontType: 'normal' }))}
                    className="h-4 w-4 text-primary"
                    data-testid="radio-input-font-normal"
                  />
                  <span className="text-sm">Normal</span>
                </label>

                {/* Opção: Monoespaçada */}
                <label
                  className="flex items-center gap-3 cursor-pointer"
                  data-testid="radio-font-monospace"
                >
                  <input
                    type="radio"
                    name="fontType"
                    value="monospace"
                    checked={formData.fontType === 'monospace'}
                    onChange={() => setFormData(prev => ({ ...prev, fontType: 'monospace' }))}
                    className="h-4 w-4 text-primary"
                    data-testid="radio-input-font-monospace"
                  />
                  <span className="text-sm font-mono">Monoespaçada</span>
                </label>

                {/* Opção: Custom */}
                <label
                  className="flex items-center gap-3 cursor-pointer"
                  data-testid="radio-font-custom"
                >
                  <input
                    type="radio"
                    name="fontType"
                    value="custom"
                    checked={formData.fontType === 'custom'}
                    onChange={() => setFormData(prev => ({ ...prev, fontType: 'custom' }))}
                    className="h-4 w-4 text-primary"
                    data-testid="radio-input-font-custom"
                  />
                  <span className="text-sm">Personalizada</span>
                </label>

                {/* Campo para nome da fonte personalizada */}
                {formData.fontType === 'custom' && (
                  <div className="ml-7" data-testid="custom-font-input-wrapper">
                    <Label htmlFor="custom-font-name">Nome da fonte</Label>
                    <Input
                      id="custom-font-name"
                      value={formData.customFontName}
                      onChange={e => setFormData(prev => ({ ...prev, customFontName: e.target.value }))}
                      placeholder="Ex: Arial, Courier New, Times New Roman"
                      className="mt-1"
                      data-testid="input-custom-font-name"
                    />
                  </div>
                )}
              </div>
            </fieldset>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="btn-cancel">
              Cancelar
            </Button>
            <Button onClick={handleSave} data-testid="btn-save" style={{ background: C.navy950, color: 'white' }}>
              {editingId ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="delete-dialog">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} data-testid="btn-confirm-delete">
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 22.5 - Dialog de ajuda explicando o sistema de categorias JSON */}
      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="help-dialog">
          <DialogHeader>
            <DialogTitle>Como funciona o sistema de Categorias JSON</DialogTitle>
            <DialogDescription>
              Guia de referência para configuração de categorias de extração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <section>
              <h3 className="font-semibold mb-1" style={{ color: C.text900 }}>O que são Categorias JSON?</h3>
              <p style={{ color: C.text500 }}>
                As categorias JSON definem como os dados são extraídos e estruturados a partir
                de documentos jurídicos. Cada categoria especifica um formato de saída em JSON
                que a IA utiliza para organizar as informações extraídas.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1" style={{ color: C.text900 }}>Formato JSON</h3>
              <p style={{ color: C.text500 }}>
                O campo de formato define a estrutura esperada do JSON de saída. Você pode
                utilizar variáveis como <code className="px-1 rounded" style={{ background: C.gray100 }}>{'{numero_cnj}'}</code>,{' '}
                <code className="px-1 rounded" style={{ background: C.gray100 }}>{'{data}'}</code>,{' '}
                <code className="px-1 rounded" style={{ background: C.gray100 }}>{'{valor}'}</code> e outras para indicar
                campos dinâmicos. Utilize o seletor de variáveis para inseri-las facilmente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1" style={{ color: C.text900 }}>Blacklist</h3>
              <p style={{ color: C.text500 }}>
                A blacklist permite definir termos que devem ser ignorados durante o processo
                de extração. Termos adicionados à blacklist não serão considerados na análise
                do documento, melhorando a precisão dos resultados.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1" style={{ color: C.text900 }}>Códigos de Documentos</h3>
              <p style={{ color: C.text500 }}>
                Os códigos de documentos associam a categoria a tipos específicos de documentos
                no sistema. Uma categoria pode estar vinculada a múltiplos códigos, separados
                por vírgula.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1" style={{ color: C.text900 }}>Fonte da Saída</h3>
              <p style={{ color: C.text500 }}>
                Selecione o tipo de fonte para a formatação da saída: Normal (fonte padrão do
                sistema), Monoespaçada (ideal para dados tabulares) ou Personalizada (informe
                o nome da fonte desejada).
              </p>
            </section>
          </div>

          <DialogFooter>
            <Button onClick={() => setHelpDialogOpen(false)} data-testid="btn-close-help" style={{ background: C.navy950, color: 'white' }}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
