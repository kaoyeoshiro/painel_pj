import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@/components/shared/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/components/ui/toast'

// Interfaces locais
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

// Mapeamento de cores para tipos
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

  // Estados de dialogs
  const [dialogAberto, setDialogAberto] = useState(false)
  const [deleteDialogAberto, setDeleteDialogAberto] = useState(false)
  const [variavelEditando, setVariavelEditando] = useState<Variavel | null>(null)
  const [variavelDeletando, setVariavelDeletando] = useState<Variavel | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Estado do formulário
  const [formData, setFormData] = useState<VariavelFormData>({
    slug: '',
    label: '',
    tipo: 'text',
    descricao: '',
    opcoes: '',
    categoria_id: '',
    ativo: true,
  })

  // Carregar dados iniciais
  useEffect(() => {
    carregarDados()
  }, [busca, tipoFiltro, categoriaFiltro])

  const carregarDados = async () => {
    try {
      setLoading(true)

      // Carregar resumo
      const resumoData = await adminApi.get<VariavelResumo>('/admin/api/extraction/variaveis/resumo')
      setResumo(resumoData)

      // Carregar variáveis com filtros
      const params = new URLSearchParams({ limit: '200', offset: '0' })
      if (busca) params.append('busca', busca)
      if (tipoFiltro) params.append('tipo', tipoFiltro)
      if (categoriaFiltro) params.append('categoria_id', categoriaFiltro)
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

  // Abrir dialog para criar
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

  // Abrir dialog para editar
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

  // Salvar variável
  const salvarVariavel = async () => {
    try {
      setSalvando(true)

      // Validações
      if (!formData.slug || !formData.label) {
        toast({
          title: 'Validação',
          description: 'Slug e Label são obrigatórios',
          variant: 'destructive',
        })
        return
      }

      // Preparar dados para envio
      const payload: any = {
        slug: formData.slug,
        label: formData.label,
        tipo: formData.tipo,
        descricao: formData.descricao || null,
        categoria_id: formData.categoria_id ? parseInt(formData.categoria_id) : null,
        ativo: formData.ativo,
      }

      // Adicionar opções se tipo for choice ou list
      if ((formData.tipo === 'choice' || formData.tipo === 'list') && formData.opcoes) {
        payload.opcoes = formData.opcoes.split('\n').filter(o => o.trim()).map(o => o.trim())
      }

      // Criar ou atualizar
      if (variavelEditando) {
        await adminApi.put(`/admin/api/extraction/variaveis/${variavelEditando.id}`, payload)
        toast({
          title: 'Sucesso',
          description: 'Variável atualizada com sucesso',
        })
      } else {
        await adminApi.post('/admin/api/extraction/variaveis', payload)
        toast({
          title: 'Sucesso',
          description: 'Variável criada com sucesso',
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

  // Confirmar exclusão
  const confirmarExclusao = (variavel: Variavel) => {
    setVariavelDeletando(variavel)
    setDeleteDialogAberto(true)
  }

  // Deletar variável
  const deletarVariavel = async () => {
    if (!variavelDeletando) return

    try {
      await adminApi.delete(`/admin/api/extraction/variaveis/${variavelDeletando.id}`)
      toast({
        title: 'Sucesso',
        description: 'Variável excluída com sucesso',
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

  // Definir colunas da tabela
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
      accessor: 'ativo',
      header: 'Ações',
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

  // Renderizar cards de resumo
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

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Gerenciar Variáveis</h1>

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
                Nova Variável
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={variaveis}
            isLoading={loading}
          />
        </CardContent>
      </Card>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {variavelEditando ? 'Editar Variável' : 'Nova Variável'}
            </DialogTitle>
            <DialogDescription>
              {variavelEditando
                ? 'Atualize os dados da variável de extração'
                : 'Crie uma nova variável de extração'}
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
              <Label htmlFor="form-descricao">Descrição</Label>
              <Textarea
                id="form-descricao"
                placeholder="Descreva o propósito desta variável..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
              />
            </div>

            {(formData.tipo === 'choice' || formData.tipo === 'list') && (
              <div className="grid gap-2">
                <Label htmlFor="form-opcoes">Opções (uma por linha)</Label>
                <Textarea
                  id="form-opcoes"
                  placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
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
              <input
                type="checkbox"
                id="form-ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="form-ativo" className="cursor-pointer">
                Variável ativa
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

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={deleteDialogAberto} onOpenChange={setDeleteDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a variável <strong>{variavelDeletando?.slug}</strong>?
              Esta ação não pode ser desfeita.
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
    </div>
  )
}
