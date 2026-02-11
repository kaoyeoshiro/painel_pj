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
  Zap,
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'

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
    <>
      <BreadcrumbBar
        title="Teste de Ativacao de Modulos"
        icon={<Zap style={{ width: 14, height: 14 }} />}
        actions={
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg shrink-0" style={{ background: C.orange50, border: `2px solid ${C.orange400}` }}>
            <FileText className="h-4 w-4" style={{ color: C.orange600 }} />
            <label className="text-sm font-medium" style={{ color: C.text700 }}>Tipo de Peca:</label>
            <Select value={tipoPecaSelecionado || '__none__'} onValueChange={(v) => setTipoPecaSelecionado(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-10 min-w-[200px] bg-white font-semibold" style={{ border: `2px solid ${C.orange400}` }}>
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
            {!tipoPecaSelecionado && <span className="text-xs font-medium animate-pulse" style={{ color: C.statusError }}>(obrigatorio)</span>}
          </div>
        }
      />

      <ContentArea>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <Card className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: C.gray200 }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: C.gray200, background: C.navy50 }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: C.text700 }}>
                  <Edit3 className="h-4 w-4" style={{ color: C.navy600 }} />
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

            <Card className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: C.gray200 }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: C.gray200, background: C.navy50 }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: C.text700 }}>
                  <Tags className="h-4 w-4" style={{ color: C.navy600 }} />
                  Categorias de Extracao
                </h3>
              </div>
              <div className="p-4 max-h-[200px] overflow-y-auto space-y-2">
                {categorias.length === 0 ? (
                  <p className="text-center text-sm py-4" style={{ color: C.text400 }}>{loading ? 'Carregando...' : 'Nenhuma categoria'}</p>
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

            <Card className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: C.gray200 }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: C.gray200, background: C.navy50 }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: C.text700 }}>
                  <Bookmark className="h-4 w-4" style={{ color: C.navy600 }} />
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
            <div className="bg-white rounded-2xl shadow-sm relative overflow-hidden" style={{ border: `1px solid ${C.gray200}` }}>
              <div className="flex border-b" style={{ borderColor: C.gray200 }}>
                <button
                  onClick={() => setActiveTab('variaveis-extracao')}
                  className="flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2"
                  style={{
                    borderBottom: activeTab === 'variaveis-extracao' ? `3px solid ${C.navy700}` : '3px solid transparent',
                    color: activeTab === 'variaveis-extracao' ? C.navy700 : C.text500,
                    background: activeTab === 'variaveis-extracao' ? C.navy50 : 'transparent',
                  }}
                >
                  <FileText className="h-4 w-4" />
                  Variaveis Extracao
                </button>
                <button
                  onClick={() => setActiveTab('variaveis-processo')}
                  className="flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2"
                  style={{
                    borderBottom: activeTab === 'variaveis-processo' ? `3px solid ${C.navy700}` : '3px solid transparent',
                    color: activeTab === 'variaveis-processo' ? C.navy700 : C.text500,
                    background: activeTab === 'variaveis-processo' ? C.navy50 : 'transparent',
                  }}
                >
                  <FileText className="h-4 w-4" />
                  Variaveis Processo
                </button>
                <button
                  onClick={() => setActiveTab('resultados')}
                  className="flex-1 px-6 py-3 text-sm font-medium flex items-center justify-center gap-2"
                  style={{
                    borderBottom: activeTab === 'resultados' ? `3px solid ${C.navy700}` : '3px solid transparent',
                    color: activeTab === 'resultados' ? C.navy700 : C.text500,
                    background: activeTab === 'resultados' ? C.navy50 : 'transparent',
                  }}
                >
                  <FileText className="h-4 w-4" />
                  Resultados
                </button>
              </div>

              {activeTab === 'variaveis-extracao' && (
                <div className="p-4 overflow-y-auto h-[calc(100vh-280px)] max-h-[calc(100vh-280px)]">
                  {categoriasSelecionadas.size === 0 ? (
                    <p className="text-center py-8" style={{ color: C.text400 }}>Selecione categorias para ver as variaveis</p>
                  ) : (
                    <div className="space-y-4">{getVariaveisExtracao().map((v) => renderCampoVariavel(v))}</div>
                  )}
                </div>
              )}

              {activeTab === 'variaveis-processo' && (
                <div className="p-4 overflow-y-auto h-[calc(100vh-280px)] max-h-[calc(100vh-280px)]">
                  {variaveisDisponiveis.length === 0 ? (
                    <p className="text-center py-8" style={{ color: C.text400 }}>Carregando...</p>
                  ) : (
                    <div className="space-y-4">{variaveisDisponiveis.map((v) => renderCampoVariavel(v))}</div>
                  )}
                </div>
              )}

              {activeTab === 'resultados' && (
                <div className="h-[calc(100vh-280px)] max-h-[calc(100vh-280px)]">
                  <div className="px-4 py-3 border-b flex items-center gap-4" style={{ borderColor: C.gray200, background: C.gray50 }}>
                    <span className="text-sm" style={{ color: C.text500 }}>
                      <span className="font-bold" style={{ color: C.statusSuccess }}>{resultado?.totais.ativados ?? 0}</span> ativados |
                      <span className="font-bold ml-1" style={{ color: C.statusError }}>{resultado?.totais.nao_ativados ?? 0}</span> nao ativados
                    </span>
                    <div className="flex-1" />
                    <Button onClick={exportarJSON} variant="outline" size="sm" disabled={!resultado || exportandoJson}>
                      <Download className="h-4 w-4 mr-1" />
                      {exportandoJson ? 'Exportando...' : 'Exportar JSON'}
                    </Button>
                  </div>

                  <div className="overflow-y-auto p-4 h-[calc(100%-52px)] space-y-3">
                    {!resultado ? (
                      <div className="text-center py-12" style={{ color: C.text400 }}>
                        <p className="text-lg">Clique em "SIMULAR ATIVACAO" para ver os resultados</p>
                      </div>
                    ) : (
                      <>
                        {resultado.modulos_ativados.map((modulo) => (
                          <Card key={`on-${modulo.id}`} className="p-4" style={{ borderLeft: `4px solid ${C.statusSuccess}`, borderColor: C.gray200 }}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold" style={{ color: C.text900 }}>{modulo.titulo}</p>
                                <p className="text-xs mt-1" style={{ color: C.text500 }}>{modulo.grupo}</p>
                              </div>
                              <Badge variant="success">Ativado</Badge>
                            </div>
                          </Card>
                        ))}
                        {resultado.modulos_nao_ativados.map((modulo) => (
                          <Card key={`off-${modulo.id}`} className="p-4" style={{ borderLeft: `4px solid ${C.statusError}`, borderColor: C.gray200 }}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold" style={{ color: C.text900 }}>{modulo.titulo}</p>
                                <p className="text-xs mt-1" style={{ color: C.text500 }}>{modulo.grupo}</p>
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
                className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-3"
                style={{ background: C.navy950, color: 'white' }}
              >
                <PlayCircle className="h-5 w-5" />
                {simulando ? 'SIMULANDO...' : 'SIMULAR ATIVACAO'}
              </Button>
            </div>
          </div>
        </div>
      </ContentArea>
    </>
  )
}
