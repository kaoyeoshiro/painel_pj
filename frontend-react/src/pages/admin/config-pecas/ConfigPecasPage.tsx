import { useState, useEffect } from 'react'
import { createApiClient } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { PageContainer } from '@/components/layout'

// Interfaces
interface CategoriaDocumento {
  id: number
  nome: string
  titulo: string
  descricao: string | null
  codigos_documento: number[]
  cor: string
  ordem: number
  ativo: boolean
  is_primeiro_documento: boolean
}

interface TipoPeca {
  id: number
  nome: string
  titulo: string
  descricao: string | null
  icone: string
  ordem: number
  ativo: boolean
  is_padrao: boolean
  categorias_documento: CategoriaDocumento[]
}

// Cliente API
const configApi = createApiClient('/api/gerador-pecas/config')

export function ConfigPecasPage() {
  const { toast } = useToast()

  // Estado para categorias
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(true)
  const [dialogCategoriaOpen, setDialogCategoriaOpen] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaDocumento | null>(null)

  // Estado para tipos de peça
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [loadingTipos, setLoadingTipos] = useState(true)
  const [dialogTipoOpen, setDialogTipoOpen] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoPeca | null>(null)

  // Formulário de categoria
  const [formCategoria, setFormCategoria] = useState({
    nome: '',
    titulo: '',
    descricao: '',
    codigos_documento: '',
    cor: '#3b82f6',
    ordem: 0,
    ativo: true,
    is_primeiro_documento: false
  })

  // Formulário de tipo de peça
  const [formTipo, setFormTipo] = useState({
    nome: '',
    titulo: '',
    descricao: '',
    icone: '',
    ordem: 0,
    ativo: true,
    is_padrao: false
  })

  // Carregar categorias
  useEffect(() => {
    carregarCategorias()
  }, [])

  // Carregar tipos de peça
  useEffect(() => {
    carregarTipos()
  }, [])

  const carregarCategorias = async () => {
    try {
      setLoadingCategorias(true)
      const response = await configApi.get<CategoriaDocumento[]>('/categorias')
      setCategorias(response)
    } catch (error) {
      toast({
        title: 'Erro ao carregar categorias',
        description: 'Não foi possível carregar as categorias de documentos',
        variant: 'destructive'
      })
    } finally {
      setLoadingCategorias(false)
    }
  }

  const carregarTipos = async () => {
    try {
      setLoadingTipos(true)
      const response = await configApi.get<TipoPeca[]>('/tipos-peca')
      setTiposPeca(response)
    } catch (error) {
      toast({
        title: 'Erro ao carregar tipos',
        description: 'Não foi possível carregar os tipos de peça',
        variant: 'destructive'
      })
    } finally {
      setLoadingTipos(false)
    }
  }

  // Handlers de categoria
  const abrirDialogCategoria = (categoria?: CategoriaDocumento) => {
    if (categoria) {
      setCategoriaEditando(categoria)
      setFormCategoria({
        nome: categoria.nome,
        titulo: categoria.titulo,
        descricao: categoria.descricao || '',
        codigos_documento: categoria.codigos_documento.join(', '),
        cor: categoria.cor,
        ordem: categoria.ordem,
        ativo: categoria.ativo,
        is_primeiro_documento: categoria.is_primeiro_documento
      })
    } else {
      setCategoriaEditando(null)
      setFormCategoria({
        nome: '',
        titulo: '',
        descricao: '',
        codigos_documento: '',
        cor: '#3b82f6',
        ordem: categorias.length,
        ativo: true,
        is_primeiro_documento: false
      })
    }
    setDialogCategoriaOpen(true)
  }

  const salvarCategoria = async () => {
    try {
      // Parsear códigos de documento
      const codigos = formCategoria.codigos_documento
        .split(',')
        .map(c => parseInt(c.trim()))
        .filter(c => !isNaN(c))

      const payload = {
        nome: formCategoria.nome,
        titulo: formCategoria.titulo,
        descricao: formCategoria.descricao || null,
        codigos_documento: codigos,
        cor: formCategoria.cor,
        ordem: formCategoria.ordem,
        ativo: formCategoria.ativo,
        is_primeiro_documento: formCategoria.is_primeiro_documento
      }

      if (categoriaEditando) {
        await configApi.put(`/categorias/${categoriaEditando.id}`, payload)
        toast({
          title: 'Categoria atualizada',
          description: 'Categoria atualizada com sucesso'
        })
      } else {
        await configApi.post('/categorias', payload)
        toast({
          title: 'Categoria criada',
          description: 'Nova categoria criada com sucesso'
        })
      }

      setDialogCategoriaOpen(false)
      carregarCategorias()
    } catch (error) {
      toast({
        title: 'Erro ao salvar categoria',
        description: 'Não foi possível salvar a categoria',
        variant: 'destructive'
      })
    }
  }

  const excluirCategoria = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta categoria?')) return

    try {
      await configApi.delete(`/categorias/${id}`)
      toast({
        title: 'Categoria excluída',
        description: 'Categoria excluída com sucesso'
      })
      carregarCategorias()
    } catch (error) {
      toast({
        title: 'Erro ao excluir categoria',
        description: 'Não foi possível excluir a categoria',
        variant: 'destructive'
      })
    }
  }

  // Handlers de tipo de peça
  const abrirDialogTipo = (tipo?: TipoPeca) => {
    if (tipo) {
      setTipoEditando(tipo)
      setFormTipo({
        nome: tipo.nome,
        titulo: tipo.titulo,
        descricao: tipo.descricao || '',
        icone: tipo.icone,
        ordem: tipo.ordem,
        ativo: tipo.ativo,
        is_padrao: tipo.is_padrao
      })
    } else {
      setTipoEditando(null)
      setFormTipo({
        nome: '',
        titulo: '',
        descricao: '',
        icone: '',
        ordem: tiposPeca.length,
        ativo: true,
        is_padrao: false
      })
    }
    setDialogTipoOpen(true)
  }

  const salvarTipo = async () => {
    try {
      const payload = {
        nome: formTipo.nome,
        titulo: formTipo.titulo,
        descricao: formTipo.descricao || null,
        icone: formTipo.icone,
        ordem: formTipo.ordem,
        ativo: formTipo.ativo,
        is_padrao: formTipo.is_padrao
      }

      if (tipoEditando) {
        await configApi.put(`/tipos-peca/${tipoEditando.id}`, payload)
        toast({
          title: 'Tipo atualizado',
          description: 'Tipo de peça atualizado com sucesso'
        })
      } else {
        await configApi.post('/tipos-peca', payload)
        toast({
          title: 'Tipo criado',
          description: 'Novo tipo de peça criado com sucesso'
        })
      }

      setDialogTipoOpen(false)
      carregarTipos()
    } catch (error) {
      toast({
        title: 'Erro ao salvar tipo',
        description: 'Não foi possível salvar o tipo de peça',
        variant: 'destructive'
      })
    }
  }

  const excluirTipo = async (id: number) => {
    if (!confirm('Deseja realmente excluir este tipo de peça?')) return

    try {
      await configApi.delete(`/tipos-peca/${id}`)
      toast({
        title: 'Tipo excluído',
        description: 'Tipo de peça excluído com sucesso'
      })
      carregarTipos()
    } catch (error) {
      toast({
        title: 'Erro ao excluir tipo',
        description: 'Não foi possível excluir o tipo de peça',
        variant: 'destructive'
      })
    }
  }

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuração de Peças</h1>
        <p className="text-muted-foreground">
          Gerencie categorias de documentos e tipos de peças jurídicas
        </p>
      </div>

      <Tabs defaultValue="categorias" className="w-full">
        <TabsList>
          <TabsTrigger value="categorias">Categorias de Documentos</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de Peça</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Categorias de Documentos</h2>
            <Button onClick={() => abrirDialogCategoria()}>Nova Categoria</Button>
          </div>

          {loadingCategorias ? (
            <div className="text-center py-8">Carregando categorias...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorias.map(categoria => (
                <Card key={categoria.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: categoria.cor }}
                      />
                      <CardTitle className="text-lg">{categoria.titulo}</CardTitle>
                    </div>
                    <CardDescription>{categoria.nome}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {categoria.descricao && (
                      <p className="text-sm text-muted-foreground">{categoria.descricao}</p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {categoria.codigos_documento.map(codigo => (
                        <Badge key={codigo} variant="outline">
                          {codigo}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Badge variant={categoria.ativo ? 'default' : 'secondary'}>
                        {categoria.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {categoria.is_primeiro_documento && (
                        <Badge variant="outline">1º doc</Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDialogCategoria(categoria)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => excluirCategoria(categoria.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tipos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Tipos de Peça</h2>
            <Button onClick={() => abrirDialogTipo()}>Novo Tipo</Button>
          </div>

          {loadingTipos ? (
            <div className="text-center py-8">Carregando tipos...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tiposPeca.map(tipo => (
                <Card key={tipo.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {tipo.icone && <span className="text-2xl">{tipo.icone}</span>}
                      <CardTitle className="text-lg">{tipo.titulo}</CardTitle>
                    </div>
                    <CardDescription>{tipo.nome}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tipo.descricao && (
                      <p className="text-sm text-muted-foreground">{tipo.descricao}</p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {tipo.categorias_documento.map(cat => (
                        <Badge key={cat.id} variant="outline" style={{ borderColor: cat.cor }}>
                          {cat.titulo}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Badge variant={tipo.ativo ? 'default' : 'secondary'}>
                        {tipo.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {tipo.is_padrao && (
                        <Badge variant="outline">Padrão</Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDialogTipo(tipo)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => excluirTipo(tipo.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de Categoria */}
      <Dialog open={dialogCategoriaOpen} onOpenChange={setDialogCategoriaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {categoriaEditando ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              Configure os dados da categoria de documentos
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cat-nome">Nome</Label>
              <Input
                id="cat-nome"
                value={formCategoria.nome}
                onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })}
                placeholder="ex: mandado_seguranca"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cat-titulo">Título</Label>
              <Input
                id="cat-titulo"
                value={formCategoria.titulo}
                onChange={(e) => setFormCategoria({ ...formCategoria, titulo: e.target.value })}
                placeholder="ex: Mandado de Segurança"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cat-descricao">Descrição</Label>
              <Textarea
                id="cat-descricao"
                value={formCategoria.descricao}
                onChange={(e) => setFormCategoria({ ...formCategoria, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cat-codigos">Códigos de Documento</Label>
              <Input
                id="cat-codigos"
                value={formCategoria.codigos_documento}
                onChange={(e) => setFormCategoria({ ...formCategoria, codigos_documento: e.target.value })}
                placeholder="ex: 10, 20, 30"
              />
              <p className="text-sm text-muted-foreground">
                Digite os códigos separados por vírgula
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cat-cor">Cor</Label>
                <Input
                  id="cat-cor"
                  type="color"
                  value={formCategoria.cor}
                  onChange={(e) => setFormCategoria({ ...formCategoria, cor: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cat-ordem">Ordem</Label>
                <Input
                  id="cat-ordem"
                  type="number"
                  value={formCategoria.ordem}
                  onChange={(e) => setFormCategoria({ ...formCategoria, ordem: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="cat-ativo"
                checked={formCategoria.ativo}
                onCheckedChange={(checked) => setFormCategoria({ ...formCategoria, ativo: checked as boolean })}
              />
              <Label htmlFor="cat-ativo">Ativo</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="cat-primeiro"
                checked={formCategoria.is_primeiro_documento}
                onCheckedChange={(checked) => setFormCategoria({ ...formCategoria, is_primeiro_documento: checked as boolean })}
              />
              <Label htmlFor="cat-primeiro">É primeiro documento</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCategoriaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarCategoria}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Tipo de Peça */}
      <Dialog open={dialogTipoOpen} onOpenChange={setDialogTipoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {tipoEditando ? 'Editar Tipo de Peça' : 'Novo Tipo de Peça'}
            </DialogTitle>
            <DialogDescription>
              Configure os dados do tipo de peça jurídica
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tipo-nome">Nome</Label>
              <Input
                id="tipo-nome"
                value={formTipo.nome}
                onChange={(e) => setFormTipo({ ...formTipo, nome: e.target.value })}
                placeholder="ex: peticao_inicial"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tipo-titulo">Título</Label>
              <Input
                id="tipo-titulo"
                value={formTipo.titulo}
                onChange={(e) => setFormTipo({ ...formTipo, titulo: e.target.value })}
                placeholder="ex: Petição Inicial"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tipo-descricao">Descrição</Label>
              <Textarea
                id="tipo-descricao"
                value={formTipo.descricao}
                onChange={(e) => setFormTipo({ ...formTipo, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo-icone">Ícone</Label>
                <Input
                  id="tipo-icone"
                  value={formTipo.icone}
                  onChange={(e) => setFormTipo({ ...formTipo, icone: e.target.value })}
                  placeholder="ex: 📄"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tipo-ordem">Ordem</Label>
                <Input
                  id="tipo-ordem"
                  type="number"
                  value={formTipo.ordem}
                  onChange={(e) => setFormTipo({ ...formTipo, ordem: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="tipo-ativo"
                checked={formTipo.ativo}
                onCheckedChange={(checked) => setFormTipo({ ...formTipo, ativo: checked as boolean })}
              />
              <Label htmlFor="tipo-ativo">Ativo</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="tipo-padrao"
                checked={formTipo.is_padrao}
                onCheckedChange={(checked) => setFormTipo({ ...formTipo, is_padrao: checked as boolean })}
              />
              <Label htmlFor="tipo-padrao">Tipo padrão</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTipoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarTipo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
