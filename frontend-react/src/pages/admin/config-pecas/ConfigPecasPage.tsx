import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
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

/**
 * Nó da árvore de tipos de documento.
 * Cada nó possui um código numérico, rótulo de exibição e filhos opcionais.
 */
interface DocumentTreeNode {
  code: number
  label: string
  children?: DocumentTreeNode[]
}

/**
 * Árvore hierárquica estática dos tipos de documento disponíveis.
 * Reproduz a estrutura do sistema legado Jinja2 (item 29.8).
 */
const DOCUMENT_TYPE_TREE: DocumentTreeNode[] = [
  {
    code: 1,
    label: 'Decisões Judiciais',
    children: [
      { code: 10, label: 'Sentença' },
      { code: 11, label: 'Acórdão' },
      { code: 12, label: 'Decisão Interlocutória' },
      { code: 13, label: 'Despacho' },
      { code: 14, label: 'Decisão Monocrática' },
    ],
  },
  {
    code: 2,
    label: 'Petições',
    children: [
      { code: 20, label: 'Petição Inicial' },
      { code: 21, label: 'Contestação' },
      { code: 22, label: 'Réplica' },
      { code: 23, label: 'Recurso' },
      { code: 24, label: 'Contrarrazões' },
      { code: 25, label: 'Embargos' },
      { code: 26, label: 'Agravo' },
    ],
  },
  {
    code: 3,
    label: 'Documentos Administrativos',
    children: [
      { code: 30, label: 'Parecer' },
      { code: 31, label: 'Informação' },
      { code: 32, label: 'Certidão' },
      { code: 33, label: 'Notificação' },
      { code: 34, label: 'Ofício' },
    ],
  },
  {
    code: 4,
    label: 'Outros Documentos',
    children: [
      { code: 40, label: 'Procuração' },
      { code: 41, label: 'Substabelecimento' },
      { code: 42, label: 'Ata' },
      { code: 43, label: 'Laudo Pericial' },
      { code: 44, label: 'Cálculo' },
    ],
  },
]

// Clientes API
const configApi = createApiClient('/api/gerador-pecas/config')
const adminConfigApi = createApiClient('/admin/api/config-pecas')

/**
 * Coleta recursivamente todos os códigos-folha de um nó da árvore.
 * Usado para selecionar/desselecionar um grupo inteiro ao clicar no pai.
 */
function collectLeafCodes(node: DocumentTreeNode): number[] {
  if (!node.children || node.children.length === 0) {
    return [node.code]
  }
  return node.children.flatMap(collectLeafCodes)
}

/**
 * Componente de nó individual da árvore de seleção de documentos.
 * Renderiza checkbox + rótulo e, se houver filhos, permite expandir/colapsar.
 */
function TreeNode({
  node,
  selectedCodes,
  onToggle,
  searchTerm,
}: {
  node: DocumentTreeNode
  selectedCodes: Set<number>
  onToggle: (codes: number[], checked: boolean) => void
  searchTerm: string
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0

  // Códigos-folha deste nó (para seleção em grupo)
  const leafCodes = useMemo(() => collectLeafCodes(node), [node])

  // Verifica se o nó ou algum filho corresponde ao filtro de busca
  const matchesSearch = useCallback(
    (n: DocumentTreeNode): boolean => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      if (n.label.toLowerCase().includes(term)) return true
      if (n.children) return n.children.some(matchesSearch)
      return false
    },
    [searchTerm]
  )

  // Não renderiza se não corresponde à busca
  if (!matchesSearch(node)) return null

  // Determina estado do checkbox: todos selecionados, parcial, nenhum
  const allSelected = leafCodes.every((c) => selectedCodes.has(c))
  const someSelected = leafCodes.some((c) => selectedCodes.has(c))
  const isIndeterminate = someSelected && !allSelected

  const handleCheck = (checked: boolean) => {
    onToggle(leafCodes, checked)
  }

  return (
    <div className="ml-2" data-testid={`tree-node-${node.code}`}>
      <div className="flex items-center gap-2 py-1">
        {/* Botão de expandir/colapsar para nós com filhos */}
        {hasChildren ? (
          <button
            type="button"
            className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
            data-testid={`tree-toggle-${node.code}`}
            aria-label={expanded ? 'Colapsar' : 'Expandir'}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span className="w-5" />
        )}

        <Checkbox
          id={`doc-tree-${node.code}`}
          checked={isIndeterminate ? 'indeterminate' : allSelected}
          onCheckedChange={handleCheck}
          data-testid={`tree-checkbox-${node.code}`}
        />
        <Label
          htmlFor={`doc-tree-${node.code}`}
          className="text-sm cursor-pointer select-none"
        >
          {node.label}
          {hasChildren && (
            <span className="text-xs text-muted-foreground ml-1">
              ({leafCodes.filter((c) => selectedCodes.has(c)).length}/{leafCodes.length})
            </span>
          )}
        </Label>
      </div>

      {/* Filhos colapsáveis */}
      {hasChildren && expanded && (
        <div className="ml-4 border-l border-muted pl-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.code}
              node={child}
              selectedCodes={selectedCodes}
              onToggle={onToggle}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Componente de árvore de seleção de tipos de documento (item 29.8 + 29.9).
 * Inclui campo de busca para filtrar tipos de documento.
 */
function DocumentTreeSelect({
  selectedCodes,
  onChange,
}: {
  selectedCodes: number[]
  onChange: (codes: number[]) => void
}) {
  // Estado de busca dentro da árvore (item 29.9)
  const [searchTerm, setSearchTerm] = useState('')

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes])

  const handleToggle = useCallback(
    (codes: number[], checked: boolean) => {
      const current = new Set(selectedCodes)
      for (const code of codes) {
        if (checked) {
          current.add(code)
        } else {
          current.delete(code)
        }
      }
      // Ordena os códigos para consistência
      onChange(Array.from(current).sort((a, b) => a - b))
    },
    [selectedCodes, onChange]
  )

  return (
    <div className="border rounded-md" data-testid="document-tree-select">
      {/* Campo de busca de documentos (item 29.9) */}
      <div className="p-2 border-b">
        <Input
          placeholder="Buscar tipo de documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8"
          data-testid="document-tree-search"
        />
      </div>

      {/* Área com scroll para a árvore */}
      <ScrollArea className="max-h-64 p-2">
        {DOCUMENT_TYPE_TREE.map((node) => (
          <TreeNode
            key={node.code}
            node={node}
            selectedCodes={selectedSet}
            onToggle={handleToggle}
            searchTerm={searchTerm}
          />
        ))}
      </ScrollArea>

      {/* Resumo dos selecionados */}
      {selectedCodes.length > 0 && (
        <div className="p-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground" data-testid="document-tree-summary">
            {selectedCodes.length} tipo(s) selecionado(s): {selectedCodes.join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

export function ConfigPecasPage() {
  const { toast } = useToast()

  // Estado para categorias
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(true)
  const [dialogCategoriaOpen, setDialogCategoriaOpen] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaDocumento | null>(null)

  // Estado para tipos de peca
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [loadingTipos, setLoadingTipos] = useState(true)
  const [dialogTipoOpen, setDialogTipoOpen] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoPeca | null>(null)

  // Estado de loading para ações administrativas (itens 29.10 e 29.11)
  const [loadingCarregarIniciais, setLoadingCarregarIniciais] = useState(false)
  const [loadingSincronizar, setLoadingSincronizar] = useState(false)

  // Formulario de categoria
  const [formCategoria, setFormCategoria] = useState({
    nome: '',
    titulo: '',
    descricao: '',
    codigos_documento: [] as number[],
    cor: '#3b82f6',
    ordem: 0,
    ativo: true,
    is_primeiro_documento: false
  })

  // Formulario de tipo de peca
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

  // Carregar tipos de peca
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

  /**
   * Carrega dados iniciais de configuração de peças (item 29.10).
   * Chama POST /admin/api/config-pecas/carregar-iniciais.
   */
  const carregarDadosIniciais = async () => {
    if (!confirm('Deseja realmente carregar os dados iniciais? Isso pode sobrescrever configurações existentes.')) {
      return
    }

    try {
      setLoadingCarregarIniciais(true)
      await adminConfigApi.post('/carregar-iniciais')
      toast({
        title: 'Dados iniciais carregados',
        description: 'Os dados iniciais de configuração foram carregados com sucesso'
      })
      // Recarrega os dados após carregar iniciais
      carregarCategorias()
      carregarTipos()
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados iniciais',
        description: 'Não foi possível carregar os dados iniciais de configuração',
        variant: 'destructive'
      })
    } finally {
      setLoadingCarregarIniciais(false)
    }
  }

  /**
   * Sincroniza configuração de peças com o sistema de prompts (item 29.11).
   * Chama POST /admin/api/config-pecas/sincronizar-prompts.
   */
  const sincronizarComPrompts = async () => {
    try {
      setLoadingSincronizar(true)
      await adminConfigApi.post('/sincronizar-prompts')
      toast({
        title: 'Sincronização concluída',
        description: 'A configuração foi sincronizada com os prompts com sucesso'
      })
    } catch (error) {
      toast({
        title: 'Erro ao sincronizar',
        description: 'Não foi possível sincronizar a configuração com os prompts',
        variant: 'destructive'
      })
    } finally {
      setLoadingSincronizar(false)
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
        codigos_documento: [...categoria.codigos_documento],
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
        codigos_documento: [],
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
      const payload = {
        nome: formCategoria.nome,
        titulo: formCategoria.titulo,
        descricao: formCategoria.descricao || null,
        codigos_documento: formCategoria.codigos_documento,
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

  // Handlers de tipo de peca
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Configuração de Peças</h1>
          <p className="text-muted-foreground">
            Gerencie categorias de documentos e tipos de peças jurídicas
          </p>
        </div>

        {/* Botões administrativos (itens 29.10 e 29.11) */}
        <div className="flex gap-2" data-testid="admin-actions">
          <Button
            variant="outline"
            onClick={carregarDadosIniciais}
            disabled={loadingCarregarIniciais}
            data-testid="btn-carregar-dados-iniciais"
          >
            {loadingCarregarIniciais ? 'Carregando...' : 'Carregar Dados Iniciais'}
          </Button>
          <Button
            variant="outline"
            onClick={sincronizarComPrompts}
            disabled={loadingSincronizar}
            data-testid="btn-sincronizar-prompts"
          >
            {loadingSincronizar ? 'Sincronizando...' : 'Sincronizar com Prompts'}
          </Button>
        </div>
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
                        <Badge variant="outline">1o doc</Badge>
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
                        <Badge variant="outline">Padrao</Badge>
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
              <Label htmlFor="cat-titulo">Titulo</Label>
              <Input
                id="cat-titulo"
                value={formCategoria.titulo}
                onChange={(e) => setFormCategoria({ ...formCategoria, titulo: e.target.value })}
                placeholder="ex: Mandado de Seguranca"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cat-descricao">Descricao</Label>
              <Textarea
                id="cat-descricao"
                value={formCategoria.descricao}
                onChange={(e) => setFormCategoria({ ...formCategoria, descricao: e.target.value })}
                placeholder="Descricao opcional"
              />
            </div>

            {/* Arvore de selecao de tipos de documento (item 29.8 + 29.9) */}
            <div className="grid gap-2">
              <Label>Tipos de Documento</Label>
              <DocumentTreeSelect
                selectedCodes={formCategoria.codigos_documento}
                onChange={(codes) => setFormCategoria({ ...formCategoria, codigos_documento: codes })}
              />
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
              <Label htmlFor="cat-primeiro">E primeiro documento</Label>
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

      {/* Dialog de Tipo de Peca */}
      <Dialog open={dialogTipoOpen} onOpenChange={setDialogTipoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {tipoEditando ? 'Editar Tipo de Peca' : 'Novo Tipo de Peca'}
            </DialogTitle>
            <DialogDescription>
              Configure os dados do tipo de peca juridica
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
              <Label htmlFor="tipo-titulo">Titulo</Label>
              <Input
                id="tipo-titulo"
                value={formTipo.titulo}
                onChange={(e) => setFormTipo({ ...formTipo, titulo: e.target.value })}
                placeholder="ex: Peticao Inicial"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tipo-descricao">Descricao</Label>
              <Textarea
                id="tipo-descricao"
                value={formTipo.descricao}
                onChange={(e) => setFormTipo({ ...formTipo, descricao: e.target.value })}
                placeholder="Descricao opcional"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo-icone">Icone</Label>
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
              <Label htmlFor="tipo-padrao">Tipo padrao</Label>
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
