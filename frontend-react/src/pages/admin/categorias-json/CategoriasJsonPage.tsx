import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

import { useToast } from '@/hooks/use-toast'
import { PageContainer } from '@/components/layout'

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

// Formulário de criação/edição
interface CategoriaFormData {
  nome: string
  descricao: string
  codigos_documento: string
  formato_json: string
  ativo: boolean
}

const INITIAL_FORM_DATA: CategoriaFormData = {
  nome: '',
  descricao: '',
  codigos_documento: '',
  formato_json: '{}',
  ativo: true
}

export function CategoriasJsonPage() {
  const { toast } = useToast()
  const [categorias, setCategorias] = useState<CategoriaJSON[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<CategoriaFormData>(INITIAL_FORM_DATA)
  const [jsonErrors, setJsonErrors] = useState<{ formato?: string }>({})

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
    setDialogOpen(true)
  }

  // Abrir dialog para editar
  const handleEdit = async (id: number) => {
    try {
      const categoria = await adminApi.get<CategoriaJSON>(`/admin/api/categorias-resumo-json/${id}`)
      setEditingId(id)
      setFormData({
        nome: categoria.nome || '',
        descricao: categoria.descricao || '',
        codigos_documento: categoria.codigos_documento ? categoria.codigos_documento.join(', ') : '',
        formato_json: JSON.stringify(categoria.formato_json || {}, null, 2),
        ativo: categoria.ativo !== undefined ? categoria.ativo : true
      })
      setJsonErrors({})
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
      ativo: formData.ativo
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
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Categorias JSON</h1>
        <Button onClick={handleCreate}>Nova Categoria</Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Carregando categorias...
        </div>
      )}

      {/* Grid de categorias */}
      {!loading && categorias.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma categoria cadastrada
        </div>
      )}

      {!loading && categorias.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map(categoria => (
            <Card key={categoria.id} className="p-4">
              {/* Título e descrição */}
              <div className="mb-3">
                <h3 className="font-semibold text-lg mb-1">{categoria.nome}</h3>
                <p className="text-sm text-muted-foreground">{categoria.descricao}</p>
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
                  <div className="text-xs text-muted-foreground mb-1">Códigos:</div>
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

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome da categoria"
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
              />
              <p className="text-xs text-muted-foreground mt-1">
                Códigos separados por vírgula
              </p>
            </div>

            {/* Formato JSON */}
            <div>
              <Label htmlFor="formato">Formato JSON</Label>
              <Textarea
                id="formato"
                value={formData.formato_json}
                onChange={e => {
                  setFormData(prev => ({ ...prev, formato_json: e.target.value }))
                  validateJson(e.target.value, 'formato')
                }}
                placeholder='{"campo": "tipo"}'
                rows={8}
                className="font-mono text-sm"
              />
              {jsonErrors.formato && (
                <p className="text-xs text-destructive mt-1">{jsonErrors.formato}</p>
              )}
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={e => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="ativo" className="cursor-pointer">
                Ativo
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingId ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
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
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
