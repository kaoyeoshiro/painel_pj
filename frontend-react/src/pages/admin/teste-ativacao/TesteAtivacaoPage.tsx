import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Wand2,
  FileText,
  Edit3,
  Tags,
  Bookmark,
  Save,
  PlayCircle,
  Download,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout'

interface TipoPeca {
  slug: string
  nome: string
}

interface Variavel {
  slug: string
  label: string
  tipo: string
  descricao?: string
}

interface CategoriaExtracao {
  id: number
  titulo: string
  variaveis: Variavel[]
}

interface ModuloSimulado {
  id: number
  titulo: string
  grupo: string
  modo: string
  ativado: boolean
  detalhes?: string
}

interface SimulacaoResultado {
  modulos_ativados: ModuloSimulado[]
  modulos_nao_ativados: ModuloSimulado[]
  totais: {
    ativados: number
    nao_ativados: number
  }
}

interface Cenario {
  id: number
  nome: string
  tipo_peca: string
  categorias: number[]
  variaveis: Record<string, string | boolean>
  descricao_situacao?: string
}

type ActiveTab = 'variaveis-extracao' | 'variaveis-processo' | 'resultados'

export function TesteAtivacaoPage() {
  const { toast } = useToast()

  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [tipoPecaSelecionado, setTipoPecaSelecionado] = useState('')

  const [categorias, setCategorias] = useState<CategoriaExtracao[]>([])
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<number>>(new Set())

  const [variaveisDisponiveis, setVariaveisDisponiveis] = useState<Variavel[]>([])
  const [valoresVariaveis, setValoresVariaveis] = useState<Record<string, string | boolean>>({})

  const [descricaoSituacao, setDescricaoSituacao] = useState('')

  const [cenarios, setCenarios] = useState<Cenario[]>([])
  const [cenarioSelecionadoId, setCenarioSelecionadoId] = useState('')
  const [nomeCenario, setNomeCenario] = useState('')

  const [resultado, setResultado] = useState<SimulacaoResultado | null>(null)

  const [loading, setLoading] = useState(true)
  const [simulando, setSimulando] = useState(false)
  const [gerandoVariaveisIA, setGerandoVariaveisIA] = useState(false)
  const [salvandoCenario, setSalvandoCenario] = useState(false)
  const [exportandoJson, setExportandoJson] = useState(false)

  const [activeTab, setActiveTab] = useState<ActiveTab>('variaveis-extracao')

  useEffect(() => {
    void carregarDadosIniciais()
  }, [])

  async function carregarDadosIniciais() {
    setLoading(true)
    try {
      const [tipos, cats, vars, cs] = await Promise.all([
        adminApi.get<TipoPeca[]>('/teste-ativacao/tipos-peca'),
        adminApi.get<CategoriaExtracao[]>('/teste-ativacao/categorias-extracao'),
        adminApi.get<Variavel[]>('/teste-ativacao/variaveis-processo'),
        adminApi.get<Cenario[]>('/teste-ativacao/cenarios'),
      ])

      setTiposPeca(tipos)
      setCategorias(cats)
      setVariaveisDisponiveis(vars)
      setCenarios(cs)

      if (tipos.length > 0) {
        setTipoPecaSelecionado(tipos[0].slug)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleCategoria = (categoriaId: number) => {
    setCategoriasSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(categoriaId)) next.delete(categoriaId)
      else next.add(categoriaId)
      return next
    })
  }

  const getVariaveisExtracao = () => {
    const vars: Variavel[] = []
    categoriasSelecionadas.forEach((catId) => {
      const cat = categorias.find((c) => c.id === catId)
      if (cat) vars.push(...cat.variaveis)
    })
    return vars
  }

  const handleVariavelChange = (slug: string, value: string | boolean) => {
    setValoresVariaveis((prev) => ({ ...prev, [slug]: value }))
  }

  async function simularAtivacao() {
    if (!tipoPecaSelecionado) {
      toast({ variant: 'destructive', title: 'Tipo de peça é obrigatório' })
      return
    }

    setSimulando(true)
    try {
      const data = await adminApi.post<SimulacaoResultado>('/teste-ativacao/simular', {
        tipo_peca: tipoPecaSelecionado,
        categorias_extracao: Array.from(categoriasSelecionadas),
        variaveis: valoresVariaveis,
        descricao_situacao: descricaoSituacao || undefined,
      })
      setResultado(data)
      setActiveTab('resultados')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na simulação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setSimulando(false)
    }
  }

  async function gerarVariaveisIA() {
    if (!tipoPecaSelecionado || categoriasSelecionadas.size === 0) {
      toast({ variant: 'destructive', title: 'Selecione tipo de peça e ao menos uma categoria' })
      return
    }

    setGerandoVariaveisIA(true)
    try {
      const data = await adminApi.post<Record<string, string | boolean>>('/teste-ativacao/gerar-variaveis-ia', {
        tipo_peca: tipoPecaSelecionado,
        categorias: Array.from(categoriasSelecionadas),
      })
      setValoresVariaveis((prev) => ({ ...prev, ...data }))
      toast({ title: 'Variáveis geradas via IA' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar variáveis',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setGerandoVariaveisIA(false)
    }
  }

  function exportarJSON() {
    if (!resultado) return
    setExportandoJson(true)
    try {
      const payload = {
        tipo_peca: tipoPecaSelecionado,
        categorias_extracao: Array.from(categoriasSelecionadas),
        variaveis: valoresVariaveis,
        descricao_situacao: descricaoSituacao,
        resultado,
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `simulacao-${tipoPecaSelecionado}-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setExportandoJson(false)
    }
  }

  async function salvarCenario() {
    if (!nomeCenario.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cenário' })
      return
    }

    setSalvandoCenario(true)
    try {
      await adminApi.post('/teste-ativacao/cenarios', {
        nome: nomeCenario.trim(),
        tipo_peca: tipoPecaSelecionado,
        categorias: Array.from(categoriasSelecionadas),
        variaveis: valoresVariaveis,
        descricao_situacao: descricaoSituacao || undefined,
      })

      const novosCenarios = await adminApi.get<Cenario[]>('/teste-ativacao/cenarios')
      setCenarios(novosCenarios)
      setNomeCenario('')
      toast({ title: 'Cenário salvo' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar cenário',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setSalvandoCenario(false)
    }
  }

  const aplicarCenario = (cenario: Cenario) => {
    setTipoPecaSelecionado(cenario.tipo_peca)
    setCategoriasSelecionadas(new Set(cenario.categorias))
    setValoresVariaveis(cenario.variaveis)
    setDescricaoSituacao(cenario.descricao_situacao || '')
    setCenarioSelecionadoId(String(cenario.id))
  }

  const renderCampoVariavel = (variavel: Variavel) => {
    if (variavel.tipo === 'boolean') {
      return (
        <div key={variavel.slug} className="space-y-2">
          <Label className="text-sm">{variavel.label}</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={valoresVariaveis[variavel.slug] === true ? 'default' : 'outline'}
              onClick={() => handleVariavelChange(variavel.slug, true)}
            >
              Sim
            </Button>
            <Button
              size="sm"
              variant={valoresVariaveis[variavel.slug] === false ? 'default' : 'outline'}
              onClick={() => handleVariavelChange(variavel.slug, false)}
            >
              Não
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div key={variavel.slug} className="space-y-2">
        <Label className="text-sm">{variavel.label}</Label>
        <Input
          value={String(valoresVariaveis[variavel.slug] ?? '')}
          onChange={(e) => handleVariavelChange(variavel.slug, e.target.value)}
          placeholder={variavel.descricao || `Digite ${variavel.label.toLowerCase()}`}
        />
      </div>
    )
  }

  return (
    <PageContainer fluid noPadding>
      <div className="px-4 pt-4">
        <PageHeader
          title="Teste de Ativacao de Modulos"
          description="Simule ativacao de prompts com variaveis de teste"
          actions={
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border-2 border-amber-300 shrink-0">
              <FileText className="h-4 w-4 text-amber-600" />
              <label className="text-sm font-medium text-amber-700">Tipo de Peca:</label>
              <Select value={tipoPecaSelecionado || '__none__'} onValueChange={(v) => setTipoPecaSelecionado(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-10 min-w-[200px] border-2 border-amber-400 bg-white font-semibold">
                  <SelectValue placeholder="-- Selecione --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Selecione --</SelectItem>
                  {tiposPeca.map((tipo) => (
                    <SelectItem key={tipo.slug} value={tipo.slug}>
                      {tipo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!tipoPecaSelecionado && <span className="text-xs text-red-600 font-medium animate-pulse">(obrigatorio)</span>}
            </div>
          }
        />
      </div>

      <div className="p-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-purple-500" />
                  Descricao da Situacao
                </h3>
              </div>
              <div className="p-4">
                <Textarea
                  rows={5}
                  value={descricaoSituacao}
                  onChange={(e) => setDescricaoSituacao(e.target.value)}
                  className="w-full text-sm resize-none"
                  placeholder="Descreva a situacao processual...&#10;Ex: Acao para medicamento nao incorporado ao SUS, valor R$ 450.000, Estado no polo passivo."
                />
                <Button
                  onClick={gerarVariaveisIA}
                  disabled={gerandoVariaveisIA || loading}
                  className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {gerandoVariaveisIA ? 'Gerando...' : 'Gerar Variaveis via IA'}
                </Button>
              </div>
            </Card>

            <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Tags className="h-4 w-4 text-blue-500" />
                  Categorias de Extracao
                </h3>
              </div>
              <div className="p-4 max-h-[200px] overflow-y-auto space-y-2">
                {categorias.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-4">{loading ? 'Carregando...' : 'Nenhuma categoria'}</p>
                ) : (
                  categorias.map((categoria) => (
                    <div key={categoria.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${categoria.id}`}
                        checked={categoriasSelecionadas.has(categoria.id)}
                        onCheckedChange={() => toggleCategoria(categoria.id)}
                      />
                      <Label htmlFor={`cat-${categoria.id}`} className="text-sm cursor-pointer font-normal">
                        {categoria.titulo}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-green-500" />
                  Cenarios Salvos
                </h3>
                <button onClick={salvarCenario} className="text-green-600 hover:text-green-800 text-sm" title="Salvar cenário atual">
                  <Save className="h-4 w-4" />
                </button>
              </div>
              <div className="p-2 space-y-2">
                <Select
                  value={cenarioSelecionadoId || '__none__'}
                  onValueChange={(v) => {
                    if (v === '__none__') {
                      setCenarioSelecionadoId('')
                      return
                    }
                    const cenario = cenarios.find((c) => String(c.id) === v)
                    if (cenario) aplicarCenario(cenario)
                  }}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="-- Selecionar cenario --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Selecionar cenario --</SelectItem>
                    {cenarios.map((cenario) => (
                      <SelectItem key={cenario.id} value={String(cenario.id)}>
                        {cenario.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Input
                    value={nomeCenario}
                    onChange={(e) => setNomeCenario(e.target.value)}
                    placeholder="Nome do cenário"
                    className="h-8 text-xs"
                  />
                  <Button onClick={salvarCenario} size="sm" variant="outline" disabled={salvandoCenario}>
                    {salvandoCenario ? '...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('variaveis-extracao')}
                  className={`flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'variaveis-extracao' ? 'border-b-[3px] border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Variaveis Extracao
                </button>
                <button
                  onClick={() => setActiveTab('variaveis-processo')}
                  className={`flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'variaveis-processo' ? 'border-b-[3px] border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Variaveis Processo
                </button>
                <button
                  onClick={() => setActiveTab('resultados')}
                  className={`flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'resultados' ? 'border-b-[3px] border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Resultados
                </button>
              </div>

              {activeTab === 'variaveis-extracao' && (
                <div className="p-4 overflow-y-auto h-[calc(100vh-280px)] max-h-[calc(100vh-280px)]">
                  {categoriasSelecionadas.size === 0 ? (
                    <p className="text-center text-gray-400 py-8">Selecione categorias para ver as variaveis</p>
                  ) : (
                    <div className="space-y-4">{getVariaveisExtracao().map((v) => renderCampoVariavel(v))}</div>
                  )}
                </div>
              )}

              {activeTab === 'variaveis-processo' && (
                <div className="p-4 overflow-y-auto h-[calc(100vh-280px)] max-h-[calc(100vh-280px)]">
                  {variaveisDisponiveis.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">Carregando...</p>
                  ) : (
                    <div className="space-y-4">{variaveisDisponiveis.map((v) => renderCampoVariavel(v))}</div>
                  )}
                </div>
              )}

              {activeTab === 'resultados' && (
                <div className="h-[calc(100vh-280px)] max-h-[calc(100vh-280px)]">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      <span className="font-bold text-green-600">{resultado?.totais.ativados ?? 0}</span> ativados |
                      <span className="font-bold text-red-600 ml-1">{resultado?.totais.nao_ativados ?? 0}</span> nao ativados
                    </span>
                    <div className="flex-1" />
                    <Button onClick={exportarJSON} variant="outline" size="sm" disabled={!resultado || exportandoJson}>
                      <Download className="h-4 w-4 mr-1" />
                      {exportandoJson ? 'Exportando...' : 'Exportar JSON'}
                    </Button>
                  </div>

                  <div className="overflow-y-auto p-4 h-[calc(100%-52px)] space-y-3">
                    {!resultado ? (
                      <div className="text-center py-12 text-gray-400">
                        <p className="text-lg">Clique em "SIMULAR ATIVACAO" para ver os resultados</p>
                      </div>
                    ) : (
                      <>
                        {resultado.modulos_ativados.map((modulo) => (
                          <Card key={`on-${modulo.id}`} className="p-4 border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-800">{modulo.titulo}</p>
                                <p className="text-xs text-gray-500 mt-1">{modulo.grupo}</p>
                              </div>
                              <Badge variant="success">Ativado</Badge>
                            </div>
                          </Card>
                        ))}
                        {resultado.modulos_nao_ativados.map((modulo) => (
                          <Card key={`off-${modulo.id}`} className="p-4 border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-800">{modulo.titulo}</p>
                                <p className="text-xs text-gray-500 mt-1">{modulo.grupo}</p>
                              </div>
                              <Badge variant="destructive">Não ativado</Badge>
                            </div>
                          </Card>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3">
              <Button
                onClick={simularAtivacao}
                disabled={simulando || loading || !tipoPecaSelecionado}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-3"
              >
                <PlayCircle className="h-5 w-5" />
                {simulando ? 'SIMULANDO...' : 'SIMULAR ATIVACAO'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
