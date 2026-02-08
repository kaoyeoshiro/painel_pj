import { useState, useEffect, useMemo } from 'react'
import { adminApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@/components/shared/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PageContainer } from '@/components/layout'

// ---------------------------------------------------------------------------
// Interfaces locais
// ---------------------------------------------------------------------------

interface Variavel {
  id: number
  slug: string
  label: string
  tipo: string
  descricao?: string
  opcoes?: string[]
  categoria_id?: number
  categoria_nome?: string
  ativo: boolean
  em_uso_json: boolean
  uso_count_prompts: number
}

interface VariavelResumo {
  total: number
  variaveis_com_uso: number
  variaveis_sem_uso: number
  distribuicao_tipos: Record<string, number>
}

interface Categoria {
  id: number
  nome: string
}

interface VariavelFormData {
  slug: string
  label: string
  tipo: string
  descricao: string
  opcoes: string
  categoria_id: string
  ativo: boolean
}

/** Modo de visualizacao: lista plana ou agrupado por categoria */
type ViewMode = 'list' | 'grouped'

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

/** Mapeamento de cores para badges de tipo */
const getTipoBadgeColor = (tipo: string): string => {
  const colors: Record<string, string> = {
    text: 'bg-blue-100 text-blue-800',
    number: 'bg-green-100 text-green-800',
    boolean: 'bg-purple-100 text-purple-800',
    date: 'bg-amber-100 text-amber-800',
    choice: 'bg-indigo-100 text-indigo-800',
    list: 'bg-pink-100 text-pink-800',
  }
  return colors[tipo] || 'bg-gray-100 text-gray-800'
}

/** Descripcoes dos tipos de variaveis para o dialog de ajuda */
const TIPOS_DESCRICAO: Record<string, string> = {
  text: 'Texto livre - para valores como nomes, descricoes, observacoes.',
  number: 'Numerico - para valores monetarios, quantidades, percentuais.',
  boolean: 'Verdadeiro/Falso - para flags como "tem liminar", "e urgente".',
  date: 'Data - para datas como "data da distribuicao", "prazo final".',
  choice: 'Escolha unica - o usuario seleciona uma opcao de uma lista pre-definida.',
  list: 'Lista multipla - permite selecionar varias opcoes de uma lista.',
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function VariaveisPage() {
  const { toast } = useToast()

  // Estados principais
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<VariavelResumo | null>(null)
  const [variaveis, setVariaveis] = useState<Variavel[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  // Estados de filtros
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Estado de modo de visualizacao (lista vs agrupado)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Estado para controlar quais grupos estao expandidos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Estados de dialogs
  const [dialogAberto, setDialogAberto] = useState(false)
  const [deleteDialogAberto, setDeleteDialogAberto] = useState(false)
  const [glossaryDialogOpen, setGlossaryDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [variavelEditando, setVariavelEditando] = useState<Variavel | null>(null)
  const [variavelDeletando, setVariavelDeletando] = useState<Variavel | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Estado do formulario
  const [formData, setFormData] = useState<VariavelFormData>({
    slug: '',
    label: '',
    tipo: 'text',
    descricao: '',
    opcoes: '',
    categoria_id: '',
    ativo: true,
  })

  // ---------------------------------------------------------------------------
  // Carregar dados
  // ---------------------------------------------------------------------------

  useEffect(() => {
    carregarDados()
  }, [busca, tipoFiltro, categoriaFiltro, showInactive])

  const carregarDados = async () => {
    try {
      setLoading(true)

      // Carregar resumo
      const resumoData = await adminApi.get<VariavelResumo>('/admin/api/extraction/variaveis/resumo')
      setResumo(resumoData)

      // Carregar variaveis com filtros
      const params = new URLSearchParams({ limit: '200', offset: '0' })
      if (busca) params.append('busca', busca)
      if (tipoFiltro) params.append('tipo', tipoFiltro)
      if (categoriaFiltro) params.append('categoria_id', categoriaFiltro)
      if (showInactive) params.append('incluir_inativas', 'true')
      const variaveisData = await adminApi.get<Variavel[]>(`/admin/api/extraction/variaveis?${params}`)
      setVariaveis(variaveisData)

      // Carregar categorias (apenas uma vez)
      if (categorias.length === 0) {
        const categoriasData = await adminApi.get<Categoria[]>('/admin/api/categorias-resumo-json?apenas_com_variaveis=true')
        setCategorias(categoriasData)
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Agrupamento por categoria (para modo agrupado)
  // ---------------------------------------------------------------------------

  /** Agrupa variaveis por nome da categoria */
  const groupedVariables = useMemo(() => {
    const groups = new Map<string, Variavel[]>()

    for (const v of variaveis) {
      const groupName = v.categoria_nome || 'Sem Categoria'
      const existing = groups.get(groupName)
      if (existing) {
        existing.push(v)
      } else {
        groups.set(groupName, [v])
      }
    }

    // Ordenar grupos alfabeticamente, "Sem Categoria" por ultimo
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Sem Categoria') return 1
      if (b === 'Sem Categoria') return -1
      return a.localeCompare(b, 'pt-BR')
    })

    return sorted
  }, [variaveis])

  /** Nomes de todos os grupos disponiveis */
  const allGroupNames = useMemo(
    () => groupedVariables.map(([name]) => name),
    [groupedVariables]
  )

  // ---------------------------------------------------------------------------
  // Acoes de grupo (expandir/recolher)
  // ---------------------------------------------------------------------------

  /** Alterna a expansao de um grupo individual */
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  /** Expande todos os grupos */
  const expandAllGroups = () => {
    setExpandedGroups(new Set(allGroupNames))
  }

  /** Recolhe todos os grupos */
  const collapseAllGroups = () => {
    setExpandedGroups(new Set())
  }

  // ---------------------------------------------------------------------------
  // Handlers de CRUD
  // ---------------------------------------------------------------------------

  /** Abre dialog para criar nova variavel */
  const abrirDialogCriar = () => {
    setVariavelEditando(null)
    setFormData({
      slug: '',
      label: '',
      tipo: 'text',
      descricao: '',
      opcoes: '',
      categoria_id: '',
      ativo: true,
    })
    setDialogAberto(true)
  }

  /** Abre dialog para editar variavel existente */
  const abrirDialogEditar = (variavel: Variavel) => {
    setVariavelEditando(variavel)
    setFormData({
      slug: variavel.slug,
      label: variavel.label,
      tipo: variavel.tipo,
      descricao: variavel.descricao || '',
      opcoes: variavel.opcoes ? variavel.opcoes.join('\n') : '',
      categoria_id: variavel.categoria_id?.toString() || '',
      ativo: variavel.ativo,
    })
    setDialogAberto(true)
  }

  /** Salva variavel (criar ou atualizar) */
  const salvarVariavel = async () => {
    try {
      setSalvando(true)

      // Validacoes
      if (!formData.slug || !formData.label) {
        toast({
          title: 'Validacao',
          description: 'Slug e Label sao obrigatorios',
          variant: 'destructive',
        })
        return
      }

      // Preparar dados para envio
      const payload: Record<string, unknown> = {
        slug: formData.slug,
        label: formData.label,
        tipo: formData.tipo,
        descricao: formData.descricao || null,
        categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : null,
        ativo: formData.ativo,
      }

      // Adicionar opcoes se tipo for choice ou list
      if ((formData.tipo === 'choice' || formData.tipo === 'list') && formData.opcoes) {
        payload.opcoes = formData.opcoes.split('\n').filter(o => o.trim()).map(o => o.trim())
      }

      // Criar ou atualizar
      if (variavelEditando) {
        await adminApi.put(`/admin/api/extraction/variaveis/${variavelEditando.id}`, payload)
        toast({
          title: 'Sucesso',
          description: 'Variavel atualizada com sucesso',
        })
      } else {
        await adminApi.post('/admin/api/extraction/variaveis', payload)
        toast({
          title: 'Sucesso',
          description: 'Variavel criada com sucesso',
        })
      }

      setDialogAberto(false)
      carregarDados()
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  /** Abre dialog de confirmacao de exclusao */
  const confirmarExclusao = (variavel: Variavel) => {
    setVariavelDeletando(variavel)
    setDeleteDialogAberto(true)
  }

  /** Deleta a variavel selecionada */
  const deletarVariavel = async () => {
    if (!variavelDeletando) return

    try {
      await adminApi.delete(`/admin/api/extraction/variaveis/${variavelDeletando.id}`)
      toast({
        title: 'Sucesso',
        description: 'Variavel excluida com sucesso',
      })
      setDeleteDialogAberto(false)
      carregarDados()
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Definicao de colunas da DataTable
  // ---------------------------------------------------------------------------

  const columns: ColumnDef<Variavel>[] = [
    {
      accessor: 'slug',
      header: 'Slug',
      render: (_val, row) => (
        <span className="font-mono text-sm">{row.slug}</span>
      ),
    },
    {
      accessor: 'label',
      header: 'Label',
    },
    {
      accessor: 'tipo',
      header: 'Tipo',
      render: (_val, row) => (
        <Badge className={getTipoBadgeColor(row.tipo)}>
          {row.tipo}
        </Badge>
      ),
    },
    {
      accessor: 'categoria_nome',
      header: 'Categoria',
      render: (_val, row) => row.categoria_nome || '-',
    },
    {
      accessor: 'ativo',
      header: 'Status',
      render: (_val, row) => (
        <Badge
          variant={row.ativo ? 'default' : 'secondary'}
          className={row.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}
        >
          {row.ativo ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
    },
    {
      accessor: 'em_uso_json',
      header: 'Uso',
      render: (_val, row) => (
        <div className="flex gap-1">
          {row.em_uso_json && (
            <Badge variant="outline" className="text-xs">JSON</Badge>
          )}
          {row.uso_count_prompts > 0 && (
            <Badge variant="outline" className="text-xs">
              {row.uso_count_prompts} prompt{row.uso_count_prompts > 1 ? 's' : ''}
            </Badge>
          )}
          {!row.em_uso_json && row.uso_count_prompts === 0 && (
            <span className="text-xs text-gray-400">Sem uso</span>
          )}
        </div>
      ),
    },
    {
      accessor: 'id',
      header: 'Acoes',
      render: (_val, row) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => abrirDialogEditar(row)}
          >
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => confirmarExclusao(row)}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ]

  // ---------------------------------------------------------------------------
  // Renderizacao: Cards de resumo
  // ---------------------------------------------------------------------------

  const renderResumo = () => {
    if (!resumo) return null

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumo.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Em Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resumo.variaveis_com_uso}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Sem Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-400">{resumo.variaveis_sem_uso}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tipos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(resumo.distribuicao_tipos).map(([tipo, count]) => (
                <Badge key={tipo} className={getTipoBadgeColor(tipo)}>
                  {tipo}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Renderizacao: Modo agrupado por categoria (secoes colapsaveis)
  // ---------------------------------------------------------------------------

  const renderGroupedView = () => {
    if (groupedVariables.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              Nenhuma variavel encontrada.
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-3" data-testid="grouped-view">
        {groupedVariables.map(([groupName, groupVars]) => {
          const isExpanded = expandedGroups.has(groupName)

          return (
            <Card key={groupName} data-testid={`group-${groupName}`}>
              {/* Cabecalho do grupo - clicavel para expandir/recolher */}
              <CardHeader
                className="cursor-pointer select-none hover:bg-muted/30 transition-colors py-3"
                onClick={() => toggleGroup(groupName)}
                data-testid={`group-header-${groupName}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono select-none">
                      {isExpanded ? '\u25BC' : '\u25B6'}
                    </span>
                    <CardTitle className="text-base">{groupName}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {groupVars.length} {groupVars.length === 1 ? 'variavel' : 'variaveis'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {/* Conteudo do grupo - tabela de variaveis */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Slug</TableHead>
                          <TableHead>Label</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Uso</TableHead>
                          <TableHead>Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupVars.map(v => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <span className="font-mono text-sm">{v.slug}</span>
                            </TableCell>
                            <TableCell>{v.label}</TableCell>
                            <TableCell>
                              <Badge className={getTipoBadgeColor(v.tipo)}>
                                {v.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={v.ativo ? 'default' : 'secondary'}
                                className={v.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}
                              >
                                {v.ativo ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {v.em_uso_json && (
                                  <Badge variant="outline" className="text-xs">JSON</Badge>
                                )}
                                {v.uso_count_prompts > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {v.uso_count_prompts} prompt{v.uso_count_prompts > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {!v.em_uso_json && v.uso_count_prompts === 0 && (
                                  <span className="text-xs text-gray-400">Sem uso</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => abrirDialogEditar(v)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => confirmarExclusao(v)}
                                >
                                  Excluir
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Renderizacao principal
  // ---------------------------------------------------------------------------

  return (
    <PageContainer>
      {/* Cabecalho da pagina com titulo e botoes de acao */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Variaveis</h1>
        <div className="flex items-center gap-2">
          {/* Botao Glossario (25.6) */}
          <Button
            variant="outline"
            onClick={() => setGlossaryDialogOpen(true)}
            data-testid="btn-glossary"
          >
            Glossario
          </Button>

          {/* Botao Ajuda (25.7) */}
          <Button
            variant="outline"
            onClick={() => setHelpDialogOpen(true)}
            data-testid="btn-help"
          >
            ?
          </Button>
        </div>
      </div>

      {renderResumo()}

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="busca">Buscar</Label>
              <Input
                id="busca"
                placeholder="Slug ou label..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipoFiltro || 'all'} onValueChange={(val) => setTipoFiltro(val === 'all' ? '' : val)}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                  <SelectItem value="date">date</SelectItem>
                  <SelectItem value="choice">choice</SelectItem>
                  <SelectItem value="list">list</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={categoriaFiltro || 'all'} onValueChange={(val) => setCategoriaFiltro(val === 'all' ? '' : val)}>
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={abrirDialogCriar} className="w-full">
                Nova Variavel
              </Button>
            </div>
          </div>

          {/* Segunda linha de filtros: checkbox inativas + toggle de visualizacao + expandir/recolher */}
          <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t gap-4">
            {/* Checkbox Mostrar Inativas (25.5) */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked === true)}
                data-testid="checkbox-show-inactive"
              />
              <Label htmlFor="show-inactive" className="cursor-pointer text-sm">
                Mostrar inativas
              </Label>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle de visualizacao: Lista / Agrupado (25.11) */}
              <div className="flex items-center gap-2" data-testid="view-mode-toggle">
                <Label className="text-sm text-muted-foreground">Visualizar:</Label>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    data-testid="btn-view-list"
                    className="rounded-r-none"
                  >
                    Lista
                  </Button>
                  <Button
                    variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setViewMode('grouped')
                      // Ao entrar no modo agrupado, expandir todos por padrao
                      expandAllGroups()
                    }}
                    data-testid="btn-view-grouped"
                    className="rounded-l-none"
                  >
                    Agrupado
                  </Button>
                </div>
              </div>

              {/* Botoes Expandir/Recolher Tudo (25.8) - visiveis apenas no modo agrupado */}
              {viewMode === 'grouped' && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAllGroups}
                    data-testid="btn-expand-all"
                  >
                    Expandir Tudo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAllGroups}
                    data-testid="btn-collapse-all"
                  >
                    Recolher Tudo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteudo principal: lista ou agrupado */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={variaveis}
              isLoading={loading}
            />
          </CardContent>
        </Card>
      ) : (
        loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            </CardContent>
          </Card>
        ) : (
          renderGroupedView()
        )
      )}

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {variavelEditando ? 'Editar Variavel' : 'Nova Variavel'}
            </DialogTitle>
            <DialogDescription>
              {variavelEditando
                ? 'Atualize os dados da variavel de extracao'
                : 'Crie uma nova variavel de extracao'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="form-slug">Slug *</Label>
              <Input
                id="form-slug"
                placeholder="ex: valor_causa"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                disabled={!!variavelEditando}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="form-label">Label *</Label>
              <Input
                id="form-label"
                placeholder="ex: Valor da Causa"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="form-tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(valor) => setFormData({ ...formData, tipo: valor })}
              >
                <SelectTrigger id="form-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                  <SelectItem value="date">date</SelectItem>
                  <SelectItem value="choice">choice</SelectItem>
                  <SelectItem value="list">list</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="form-descricao">Descricao</Label>
              <Textarea
                id="form-descricao"
                placeholder="Descreva o proposito desta variavel..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
              />
            </div>

            {(formData.tipo === 'choice' || formData.tipo === 'list') && (
              <div className="grid gap-2">
                <Label htmlFor="form-opcoes">Opcoes (uma por linha)</Label>
                <Textarea
                  id="form-opcoes"
                  placeholder="Opcao 1&#10;Opcao 2&#10;Opcao 3"
                  value={formData.opcoes}
                  onChange={(e) => setFormData({ ...formData, opcoes: e.target.value })}
                  rows={4}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="form-categoria">Categoria</Label>
              <Select
                value={formData.categoria_id || 'none'}
                onValueChange={(valor) => setFormData({ ...formData, categoria_id: valor === 'none' ? '' : valor })}
              >
                <SelectTrigger id="form-categoria">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="form-ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked === true })}
              />
              <Label htmlFor="form-ativo" className="cursor-pointer">
                Variavel ativa
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarVariavel} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusao */}
      <Dialog open={deleteDialogAberto} onOpenChange={setDeleteDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a variavel <strong>{variavelDeletando?.slug}</strong>?
              Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogAberto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deletarVariavel}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Glossario (25.6) - tabela com todas as variaveis carregadas */}
      <Dialog open={glossaryDialogOpen} onOpenChange={setGlossaryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-glossary">
          <DialogHeader>
            <DialogTitle>Glossario de Variaveis</DialogTitle>
            <DialogDescription>
              Lista completa de todas as variaveis cadastradas com seus slugs, labels e tipos.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh]">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variaveis.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Nenhuma variavel carregada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    variaveis.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <span className="font-mono text-sm">{v.slug}</span>
                        </TableCell>
                        <TableCell>{v.label}</TableCell>
                        <TableCell>
                          <Badge className={getTipoBadgeColor(v.tipo)}>
                            {v.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>{v.categoria_nome || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={v.ativo ? 'default' : 'secondary'}
                            className={v.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}
                          >
                            {v.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGlossaryDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ajuda (25.7) - instrucoes de uso das variaveis */}
      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-help">
          <DialogHeader>
            <DialogTitle>Ajuda - Variaveis de Extracao</DialogTitle>
            <DialogDescription>
              Guia de uso e referencia rapida para gerenciamento de variaveis.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-6 pr-4">
              {/* O que sao variaveis */}
              <section>
                <h3 className="text-base font-semibold mb-2">O que sao variaveis?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Variaveis sao campos estruturados usados para extrair informacoes
                  especificas de documentos juridicos. Cada variavel tem um <strong>slug</strong> (identificador
                  unico usado no sistema), um <strong>label</strong> (nome amigavel exibido ao usuario)
                  e um <strong>tipo</strong> que define o formato do dado esperado.
                </p>
              </section>

              {/* Como criar */}
              <section>
                <h3 className="text-base font-semibold mb-2">Como criar uma variavel?</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Clique no botao <strong>"Nova Variavel"</strong> na area de filtros.</li>
                  <li>Preencha o <strong>slug</strong> (ex: <code className="bg-muted px-1 rounded">valor_causa</code>) - deve ser unico e sem espacos.</li>
                  <li>Preencha o <strong>label</strong> (ex: "Valor da Causa") - nome legivel.</li>
                  <li>Selecione o <strong>tipo</strong> adequado ao dado que sera extraido.</li>
                  <li>Opcionalmente, adicione uma descricao e associe a uma categoria.</li>
                  <li>Clique em <strong>Salvar</strong>.</li>
                </ol>
              </section>

              {/* Tipos disponiveis */}
              <section>
                <h3 className="text-base font-semibold mb-2">Tipos disponiveis</h3>
                <div className="space-y-2">
                  {Object.entries(TIPOS_DESCRICAO).map(([tipo, desc]) => (
                    <div key={tipo} className="flex gap-3 items-start">
                      <Badge className={`${getTipoBadgeColor(tipo)} shrink-0 mt-0.5`}>
                        {tipo}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Categorias */}
              <section>
                <h3 className="text-base font-semibold mb-2">Categorias</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Variaveis podem ser organizadas em categorias para facilitar a
                  visualizacao e o gerenciamento. Use o modo de visualizacao <strong>"Agrupado"</strong> para
                  ver as variaveis organizadas por categoria em secoes colapsaveis.
                </p>
              </section>

              {/* Ativas vs Inativas */}
              <section>
                <h3 className="text-base font-semibold mb-2">Ativas vs Inativas</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Variaveis podem ser desativadas sem serem excluidas. Variaveis inativas
                  nao aparecem na listagem padrao - marque <strong>"Mostrar inativas"</strong> nos
                  filtros para visualiza-las. Desativar uma variavel nao remove seus
                  dados ja extraidos.
                </p>
              </section>

              {/* Uso */}
              <section>
                <h3 className="text-base font-semibold mb-2">Indicadores de uso</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A coluna "Uso" indica onde a variavel esta sendo utilizada:
                  <strong> JSON</strong> significa que esta referenciada na configuracao de extracao,
                  e <strong>prompts</strong> indica quantos prompts de IA referenciam esta variavel.
                  Variaveis "Sem uso" podem ser candidatas a remocao ou revisao.
                </p>
              </section>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHelpDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
