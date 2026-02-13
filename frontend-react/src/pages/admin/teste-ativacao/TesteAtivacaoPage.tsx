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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useMarkdown } from '@/hooks/useMarkdown'
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
  FolderOpen,
  Bot,
  Copy,
  Loader2,
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { AdminSubNav } from '@/components/layout'
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

interface CenarioPredefinido {
  id: number
  nome: string
  descricao?: string
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

  // Estados para features orfas
  const [modalPredefinidos, setModalPredefinidos] = useState(false)
  const [cenariosPredefinidos, setCenariosPredefinidos] = useState<CenarioPredefinido[]>([])
  const [loadingPredefinidos, setLoadingPredefinidos] = useState(false)
  const [modalRelatorio, setModalRelatorio] = useState(false)
  const [relatorioConteudo, setRelatorioConteudo] = useState('')
  const [loadingRelatorio, setLoadingRelatorio] = useState(false)
  const [relatorioModuloTitulo, setRelatorioModuloTitulo] = useState('')

  const { html: relatorioHtml } = useMarkdown(relatorioConteudo)

  useEffect(() => {
    void carregarDadosIniciais()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Carrega apenas na montagem
  }, [])

  async function carregarDadosIniciais() {
    setLoading(true)
    try {
      const [tipos, cats, vars, cs] = await Promise.all([
        adminApi.get<TipoPeca[]>('/admin/api/teste-ativacao/tipos-peca'),
        adminApi.get<CategoriaExtracao[]>('/admin/api/teste-ativacao/categorias-extracao'),
        adminApi.get<Variavel[]>('/admin/api/teste-ativacao/variaveis-processo'),
        adminApi.get<Cenario[]>('/admin/api/teste-ativacao/cenarios'),
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
      toast({ variant: 'destructive', title: 'Tipo de peca e obrigatorio' })
      return
    }

    setSimulando(true)
    try {
      const data = await adminApi.post<SimulacaoResultado>('/admin/api/teste-ativacao/simular', {
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
        title: 'Erro na simulacao',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setSimulando(false)
    }
  }

  async function gerarVariaveisIA() {
    if (!tipoPecaSelecionado || categoriasSelecionadas.size === 0) {
      toast({ variant: 'destructive', title: 'Selecione tipo de peca e ao menos uma categoria' })
      return
    }

    setGerandoVariaveisIA(true)
    try {
      const data = await adminApi.post<Record<string, string | boolean>>('/admin/api/teste-ativacao/gerar-variaveis-ia', {
        tipo_peca: tipoPecaSelecionado,
        categorias: Array.from(categoriasSelecionadas),
      })
      setValoresVariaveis((prev) => ({ ...prev, ...data }))
      toast({ title: 'Variaveis geradas via IA' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar variaveis',
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
      toast({ variant: 'destructive', title: 'Informe o nome do cenario' })
      return
    }

    setSalvandoCenario(true)
    try {
      await adminApi.post('/admin/api/teste-ativacao/cenarios', {
        nome: nomeCenario.trim(),
        tipo_peca: tipoPecaSelecionado,
        categorias: Array.from(categoriasSelecionadas),
        variaveis: valoresVariaveis,
        descricao_situacao: descricaoSituacao || undefined,
      })

      const novosCenarios = await adminApi.get<Cenario[]>('/admin/api/teste-ativacao/cenarios')
      setCenarios(novosCenarios)
      setNomeCenario('')
      toast({ title: 'Cenario salvo' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar cenario',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setSalvandoCenario(false)
    }
  }

  const aplicarCenario = (cenario: Cenario | CenarioPredefinido) => {
    setTipoPecaSelecionado(cenario.tipo_peca)
    setCategoriasSelecionadas(new Set(cenario.categorias))
    setValoresVariaveis(cenario.variaveis)
    setDescricaoSituacao(cenario.descricao_situacao || '')
    setCenarioSelecionadoId(String(cenario.id))
  }

  /** Carregar cenarios predefinidos do backend */
  async function carregarPredefinidos() {
    setLoadingPredefinidos(true)
    setModalPredefinidos(true)
    try {
      const data = await adminApi.get<CenarioPredefinido[]>('/admin/api/teste-ativacao/cenarios-predefinidos')
      setCenariosPredefinidos(data)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar cenarios predefinidos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingPredefinidos(false)
    }
  }

  /** Gerar relatorio de ativacao via IA para um modulo nao ativado */
  async function gerarRelatorioAtivacao(modulo: ModuloSimulado) {
    setRelatorioModuloTitulo(modulo.titulo)
    setRelatorioConteudo('')
    setModalRelatorio(true)
    setLoadingRelatorio(true)
    try {
      const data = await adminApi.post<{ sucesso: boolean; relatorio: string }>(
        '/admin/api/teste-ativacao/relatorio-ativacao',
        {
          modulo_id: modulo.id,
          tipo_peca: tipoPecaSelecionado,
          variaveis_fornecidas: valoresVariaveis,
          resultado_avaliacao: {
            ativado: false,
            modo: modulo.modo,
            detalhes: modulo.detalhes || '',
          },
        },
      )
      setRelatorioConteudo(data.relatorio || 'Sem relatorio disponivel.')
    } catch (error) {
      setRelatorioConteudo('Erro ao gerar relatorio.')
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar relatorio',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setLoadingRelatorio(false)
    }
  }

  /** Copiar markdown original para clipboard */
  async function copiarRelatorio() {
    try {
      await navigator.clipboard.writeText(relatorioConteudo)
      toast({ title: 'Copiado', description: 'Relatorio copiado para a area de transferencia' })
    } catch {
      toast({ title: 'Erro', description: 'Nao foi possivel copiar', variant: 'destructive' })
    }
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
              Nao
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
        icon={<Zap className="w-3.5 h-3.5" />}
        actions={
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium whitespace-nowrap" style={{ color: C.text500 }}>Tipo de Peca:</label>
            <Select value={tipoPecaSelecionado || '__none__'} onValueChange={(v) => setTipoPecaSelecionado(v === '__none__' ? '' : v)} disabled={loading}>
              <SelectTrigger className="h-9 min-w-[200px] bg-white text-sm" style={{ borderColor: C.gray300 }} data-testid="select-tipo-peca">
                <SelectValue placeholder={loading ? 'Carregando...' : '-- Selecione --'} />
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
            {!tipoPecaSelecionado && !loading && <span className="text-xs font-medium" style={{ color: C.statusWarning }}>(obrigatorio)</span>}
          </div>
        }
      />

      <ContentArea className="space-y-6">
        <AdminSubNav />
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={carregarPredefinidos}
                    className="p-1 rounded hover:bg-blue-100 transition-colors"
                    title="Cenarios pre-definidos"
                    data-testid="btn-pre-definidos"
                  >
                    <FolderOpen className="h-4 w-4" style={{ color: C.navy600 }} />
                  </button>
                  <button onClick={salvarCenario} className="text-green-600 hover:text-green-800 text-sm p-1" title="Salvar cenario atual">
                    <Save className="h-4 w-4" />
                  </button>
                </div>
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
                    placeholder="Nome do cenario"
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
                  data-testid="tab-variaveis-extracao"
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
                  data-testid="tab-variaveis-processo"
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
                  data-testid="tab-resultados"
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
                                {modulo.detalhes && (
                                  <p className="text-xs mt-1" style={{ color: C.text400 }}>{modulo.detalhes}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => gerarRelatorioAtivacao(modulo)}
                                  disabled={loadingRelatorio}
                                  className="text-xs text-white"
                                  style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}
                                  data-testid={`btn-relatorio-${modulo.id}`}
                                >
                                  <Bot className="h-3.5 w-3.5 mr-1" />
                                  Relatorio IA
                                </Button>
                                <Badge variant="destructive">Nao ativado</Badge>
                              </div>
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

      {/* Dialog de cenarios predefinidos */}
      <Dialog open={modalPredefinidos} onOpenChange={setModalPredefinidos}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" style={{ color: C.navy600 }} />
              Cenarios Pre-definidos
            </DialogTitle>
            <DialogDescription className="sr-only">
              Selecione um cenario pre-definido para teste de ativacao
            </DialogDescription>
          </DialogHeader>
          {loadingPredefinidos ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: C.navy600 }} />
            </div>
          ) : cenariosPredefinidos.length === 0 ? (
            <p className="text-center py-8" style={{ color: C.text400 }}>Nenhum cenario pre-definido disponivel</p>
          ) : (
            <div className="space-y-3">
              {cenariosPredefinidos.map((cenario) => (
                <div
                  key={cenario.id}
                  className="p-4 rounded-2xl cursor-pointer transition-colors"
                  style={{
                    background: 'white',
                    border: `1px solid ${C.gray200}`,
                  }}
                  onClick={() => {
                    aplicarCenario(cenario)
                    setModalPredefinidos(false)
                    toast({ title: 'Cenario aplicado', description: cenario.nome })
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.navy50 }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm" style={{ color: C.text900 }}>{cenario.nome}</p>
                    <Badge variant="default" className="text-xs">{cenario.tipo_peca}</Badge>
                  </div>
                  {cenario.descricao && (
                    <p className="text-xs mt-1" style={{ color: C.text500 }}>{cenario.descricao}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="default" className="text-xs" style={{ background: C.navy100, color: C.navy700 }}>
                      {Object.keys(cenario.variaveis).length} variaveis
                    </Badge>
                    {cenario.categorias.length > 0 && (
                      <Badge variant="default" className="text-xs" style={{ background: C.navy100, color: C.navy700 }}>
                        {cenario.categorias.length} categorias
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de relatorio de ativacao */}
      <Dialog open={modalRelatorio} onOpenChange={setModalRelatorio}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="px-2 py-1 rounded-lg" style={{ background: 'linear-gradient(135deg, #fffbeb, #fff7ed)' }}>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" style={{ color: C.orange600 }} />
                Relatorio IA — {relatorioModuloTitulo}
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Relatorio gerado por IA sobre o modulo selecionado
            </DialogDescription>
          </DialogHeader>
          {loadingRelatorio ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: C.orange600 }} />
              <p className="text-sm" style={{ color: C.text500 }}>Gerando relatorio via IA...</p>
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: relatorioHtml }}
            />
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copiarRelatorio}
              disabled={loadingRelatorio || !relatorioConteudo}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setModalRelatorio(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
