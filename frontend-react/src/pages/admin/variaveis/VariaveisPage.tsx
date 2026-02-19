import { useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Search, Hash, Link2, Unlink2, Layers3, BookOpen, HelpCircle, Plus, Users, ChevronLeft, ChevronRight, Variable } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { GroupSelector } from '@/components/ui/GroupSelector'
import { C } from '@/lib/designTokens'
import { AdminSubNav } from '@/components/layout/AdminSubNav'

interface Variavel {
  id: number
  slug: string
  label: string
  tipo: string
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

export function VariaveisPage() {
  const { toast } = useToast()

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  const [resumo, setResumo] = useState<VariavelResumo | null>(null)
  const [variaveis, setVariaveis] = useState<Variavel[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [loading, setLoading] = useState(false)
  const [glossarioOpen, setGlossarioOpen] = useState(false)
  const [ajudaOpen, setAjudaOpen] = useState(false)

  useEffect(() => {
    if (selectedGroupId) {
      void carregarDados()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Recarrega quando filtros mudam; carregarDados é estável
  }, [busca, tipoFiltro, categoriaFiltro, showInactive, selectedGroupId])

  async function carregarDados() {
    if (!selectedGroupId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200', offset: '0', group_id: String(selectedGroupId) })
      if (busca) params.append('busca', busca)
      if (tipoFiltro) params.append('tipo', tipoFiltro)
      if (categoriaFiltro) params.append('categoria_id', categoriaFiltro)
      if (showInactive) params.append('incluir_inativas', 'true')

      const [resumoData, variaveisData, categoriasData] = await Promise.all([
        adminApi.get<VariavelResumo>(`/admin/api/extraction/variaveis/resumo?group_id=${selectedGroupId}`),
        adminApi.get<Variavel[]>(`/admin/api/extraction/variaveis?${params.toString()}`),
        adminApi.get<Categoria[]>(`/admin/api/categorias-resumo-json?apenas_com_variaveis=true&group_id=${selectedGroupId}`),
      ])

      setResumo(resumoData)
      setVariaveis(variaveisData)
      setCategorias(categoriasData)
    } catch (error) {
      toast({
        title: 'Erro ao carregar variáveis',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
      setResumo(null)
      setVariaveis([])
    } finally {
      setLoading(false)
    }
  }

  const totalTipos = useMemo(() => {
    if (!resumo) return 0
    return Object.keys(resumo.distribuicao_tipos || {}).length
  }, [resumo])

  const tipoLabel = (tipo: string) => {
    const map: Record<string, string> = {
      text: 'Texto',
      number: 'Numero',
      date: 'Data',
      boolean: 'Sim/Nao',
      choice: 'Escolha',
      list: 'Lista',
      currency: 'Monetario',
    }
    return map[tipo] || tipo
  }

  return (
    <>
      <BreadcrumbBar
        title="Painel de Variaveis"
        icon={<Variable className="w-3.5 h-3.5" />}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setGlossarioOpen(true)} className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-indigo-50 rounded-lg transition-colors" style={{ color: C.navy600 }}>
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Glossário</span>
            </button>
            <button onClick={() => setAjudaOpen(true)} className="hover:text-blue-600 transition-colors" style={{ color: C.text500 }}>
              <HelpCircle className="h-4 w-4" />
            </button>
            <Button onClick={() => toast({ title: 'Ação', description: 'Cadastro de nova variável em breve nesta tela.' })} style={{ background: C.navy950, color: 'white' }}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Variavel
            </Button>
          </div>
        }
      />

      <ContentArea>
        <AdminSubNav />

        <GroupSelector
          selectedGroupId={selectedGroupId}
          onGroupChange={setSelectedGroupId}
        />

        <div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4" style={{ border: `1px solid ${C.gray200}` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Hash className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <p className="text-sm" style={{ color: C.text500 }}>Total de Variaveis</p>
                  <p className="text-2xl font-bold" style={{ color: C.text900 }}>{resumo?.total ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4" style={{ border: `1px solid ${C.gray200}` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><Link2 className="h-4 w-4 text-green-600" /></div>
                <div>
                  <p className="text-sm" style={{ color: C.text500 }}>Em Uso</p>
                  <p className="text-2xl font-bold" style={{ color: C.text900 }}>{resumo?.variaveis_com_uso ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4" style={{ border: `1px solid ${C.gray200}` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg"><Unlink2 className="h-4 w-4 text-yellow-600" /></div>
                <div>
                  <p className="text-sm" style={{ color: C.text500 }}>Sem Uso</p>
                  <p className="text-2xl font-bold" style={{ color: C.text900 }}>{resumo?.variaveis_sem_uso ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4" style={{ border: `1px solid ${C.gray200}` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg"><Layers3 className="h-4 w-4 text-purple-600" /></div>
                <div>
                  <p className="text-sm" style={{ color: C.text500 }}>Tipos</p>
                  <p className="text-2xl font-bold" style={{ color: C.text900 }}>{totalTipos}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mb-6" style={{ border: `1px solid ${C.gray200}` }}>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.text400 }} />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10"
                    placeholder="Buscar por slug (com ou sem prefixo) ou label..."
                  />
                </div>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <Select value={tipoFiltro || '__all_types__'} onValueChange={(v) => setTipoFiltro(v === '__all_types__' ? '' : v)}>
                  <SelectTrigger className="w-[140px] h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_types__">Todos os tipos</SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Numero</SelectItem>
                    <SelectItem value="date">Data</SelectItem>
                    <SelectItem value="boolean">Sim/Nao</SelectItem>
                    <SelectItem value="choice">Escolha Unica</SelectItem>
                    <SelectItem value="list">Lista</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoriaFiltro || '__all_categories__'} onValueChange={(v) => setCategoriaFiltro(v === '__all_categories__' ? '' : v)}>
                  <SelectTrigger className="w-[170px] h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_categories__">Todas as categorias</SelectItem>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors" style={{ background: C.gray100 }}>
                  <Checkbox checked={showInactive} onCheckedChange={(checked) => setShowInactive(checked === true)} />
                  <span className="text-sm" style={{ color: C.text500 }}>Mostrar inativas</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: `1px solid ${C.gray200}` }}>
            {loading ? (
              <div className="px-4 py-8 text-center" style={{ color: C.text400 }}>
                <p>Carregando variaveis...</p>
              </div>
            ) : variaveis.length === 0 ? (
              <div className="min-h-[260px] flex items-center justify-center text-center px-6">
                <div>
                  <Users className="h-10 w-10 mx-auto mb-3" style={{ color: C.text400 }} />
                  <p style={{ color: C.text400 }}>Nenhuma variavel encontrada</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: C.text500 }}>Slug</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: C.text500 }}>Label</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: C.text500 }}>Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: C.text500 }}>Categoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: C.text500 }}>Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: C.text500 }}>Uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variaveis.map((v) => (
                      <tr key={v.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: C.text700 }}>{v.slug}</td>
                        <td className="px-4 py-3" style={{ color: C.text700 }}>{v.label}</td>
                        <td className="px-4 py-3"><Badge variant="outline">{tipoLabel(v.tipo)}</Badge></td>
                        <td className="px-4 py-3" style={{ color: C.text500 }}>{v.categoria_nome || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={v.ativo ? 'default' : 'secondary'}>{v.ativo ? 'Ativa' : 'Inativa'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: C.text500 }}>
                          {v.em_uso_json ? 'JSON' : '-'} {v.uso_count_prompts > 0 ? `| ${v.uso_count_prompts} prompt(s)` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm" style={{ color: C.text500 }}>Mostrando 0 - {variaveis.length} de {variaveis.length} variaveis</div>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-lg cursor-not-allowed" style={{ border: `1px solid ${C.gray300}`, color: C.text400 }} disabled>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="px-3 py-2 rounded-lg cursor-not-allowed" style={{ border: `1px solid ${C.gray300}`, color: C.text400 }} disabled>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <Dialog open={glossarioOpen} onOpenChange={setGlossarioOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Glossário</DialogTitle>
              <DialogDescription>Referência rápida dos conceitos de variáveis e extração.</DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-2" style={{ color: C.text500 }}>
              <p><strong>Slug:</strong> identificador técnico único da variável.</p>
              <p><strong>Label:</strong> nome amigável exibido para usuários.</p>
              <p><strong>Em Uso:</strong> variável referenciada por prompts e/ou JSON de extração.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGlossarioOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={ajudaOpen} onOpenChange={setAjudaOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ajuda Rápida</DialogTitle>
              <DialogDescription>Como usar esta tela de gerenciamento.</DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-2" style={{ color: C.text500 }}>
              <p>1. Use busca e filtros para localizar variáveis.</p>
              <p>2. Habilite "Mostrar inativas" para incluir variáveis desativadas.</p>
              <p>3. Consulte o glossário para entender os tipos de campo.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAjudaOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentArea>
    </>
  )
}
