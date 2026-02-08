import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { PageContainer } from '@/components/layout'

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface TipoPeca {
  slug: string
  nome: string
}

interface Variavel {
  slug: string
  label: string
  tipo: string
  descricao?: string
  opcoes?: string[]
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
  regra_usada?: string
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

/** Cenario salvo com configuracao completa para reutilizar */
interface Cenario {
  id: number
  nome: string
  tipo_peca: string
  categorias: number[]
  variaveis: Record<string, string | boolean>
  descricao_situacao?: string
}

// ─── Componente principal ────────────────────────────────────────────────────

export function TesteAtivacaoPage() {
  const { toast } = useToast()

  // Estado para tipos de peca
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [tipoPecaSelecionado, setTipoPecaSelecionado] = useState<string>('')

  // Estado para categorias de extracao
  const [categorias, setCategorias] = useState<CategoriaExtracao[]>([])
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<number>>(new Set())

  // Estado para variaveis do processo
  const [variaveisDisponiveis, setVariaveisDisponiveis] = useState<Variavel[]>([])
  const [valoresVariaveis, setValoresVariaveis] = useState<Record<string, string | boolean>>({})

  // Estado para resultado da simulacao
  const [resultado, setResultado] = useState<SimulacaoResultado | null>(null)
  const [simulando, setSimulando] = useState(false)

  // Estado de loading
  const [loadingTipos, setLoadingTipos] = useState(true)
  const [loadingCategorias, setLoadingCategorias] = useState(true)
  const [loadingVariaveis, setLoadingVariaveis] = useState(true)

  // Estado para geracao de variaveis via IA (24.2)
  const [gerandoVariaveisIA, setGerandoVariaveisIA] = useState(false)

  // Estado para cenarios (24.4, 24.5, 24.6, 24.8)
  const [cenarios, setCenarios] = useState<Cenario[]>([])
  const [cenarioSelecionadoId, setCenarioSelecionadoId] = useState<string>('')
  const [loadingCenarios, setLoadingCenarios] = useState(false)
  const [dialogSalvarAberto, setDialogSalvarAberto] = useState(false)
  const [nomeCenario, setNomeCenario] = useState('')
  const [salvandoCenario, setSalvandoCenario] = useState(false)
  const [excluindoCenario, setExcluindoCenario] = useState(false)

  // Estado para descricao da situacao (24.10)
  const [descricaoSituacao, setDescricaoSituacao] = useState('')

  // ─── Carregamento inicial de dados ──────────────────────────────────────────

  useEffect(() => {
    carregarTiposPeca()
  }, [])

  useEffect(() => {
    carregarCategorias()
  }, [])

  useEffect(() => {
    carregarVariaveis()
  }, [])

  useEffect(() => {
    carregarCenarios()
  }, [])

  // ─── Funcoes de carregamento ────────────────────────────────────────────────

  const carregarTiposPeca = async () => {
    try {
      setLoadingTipos(true)
      const data = await adminApi.get<TipoPeca[]>('/teste-ativacao/tipos-peca')
      setTiposPeca(data)
      if (data.length > 0) {
        setTipoPecaSelecionado(data[0].slug)
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar tipos de peca',
        description: 'Nao foi possivel carregar os tipos de peca',
        variant: 'destructive'
      })
    } finally {
      setLoadingTipos(false)
    }
  }

  const carregarCategorias = async () => {
    try {
      setLoadingCategorias(true)
      const data = await adminApi.get<CategoriaExtracao[]>('/teste-ativacao/categorias-extracao')
      setCategorias(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar categorias',
        description: 'Nao foi possivel carregar as categorias de extracao',
        variant: 'destructive'
      })
    } finally {
      setLoadingCategorias(false)
    }
  }

  const carregarVariaveis = async () => {
    try {
      setLoadingVariaveis(true)
      const data = await adminApi.get<Variavel[]>('/teste-ativacao/variaveis-processo')
      setVariaveisDisponiveis(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar variaveis',
        description: 'Nao foi possivel carregar as variaveis do processo',
        variant: 'destructive'
      })
    } finally {
      setLoadingVariaveis(false)
    }
  }

  /** Carrega cenarios salvos do backend (24.5, 24.8) */
  const carregarCenarios = async () => {
    try {
      setLoadingCenarios(true)
      const data = await adminApi.get<Cenario[]>('/teste-ativacao/cenarios')
      setCenarios(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar cenarios',
        description: 'Nao foi possivel carregar os cenarios salvos',
        variant: 'destructive'
      })
    } finally {
      setLoadingCenarios(false)
    }
  }

  // ─── Manipulacao de categorias e variaveis ──────────────────────────────────

  const toggleCategoria = (categoriaId: number) => {
    setCategoriasSelecionadas(prev => {
      const novas = new Set(prev)
      if (novas.has(categoriaId)) {
        novas.delete(categoriaId)
      } else {
        novas.add(categoriaId)
      }
      return novas
    })
  }

  /** Retorna variaveis de extracao (vinculadas as categorias selecionadas) */
  const getVariaveisExtracao = useCallback((): Variavel[] => {
    const variaveis: Variavel[] = []
    categoriasSelecionadas.forEach(catId => {
      const categoria = categorias.find(c => c.id === catId)
      if (categoria) {
        variaveis.push(...categoria.variaveis)
      }
    })
    return variaveis
  }, [categoriasSelecionadas, categorias])

  const handleVariavelChange = (slug: string, valor: string | boolean) => {
    setValoresVariaveis(prev => ({
      ...prev,
      [slug]: valor
    }))
  }

  // ─── Simulacao ──────────────────────────────────────────────────────────────

  const simular = async () => {
    if (!tipoPecaSelecionado) {
      toast({
        title: 'Tipo de peca nao selecionado',
        description: 'Por favor, selecione um tipo de peca',
        variant: 'destructive'
      })
      return
    }

    try {
      setSimulando(true)
      const payload = {
        tipo_peca: tipoPecaSelecionado,
        categorias_extracao: Array.from(categoriasSelecionadas),
        variaveis: valoresVariaveis,
        descricao_situacao: descricaoSituacao || undefined
      }

      const data = await adminApi.post<SimulacaoResultado>('/teste-ativacao/simular', payload)
      setResultado(data)
      toast({
        title: 'Simulacao concluida',
        description: `${data.totais.ativados} modulos ativados, ${data.totais.nao_ativados} nao ativados`
      })
    } catch (error) {
      toast({
        title: 'Erro na simulacao',
        description: 'Nao foi possivel executar a simulacao',
        variant: 'destructive'
      })
    } finally {
      setSimulando(false)
    }
  }

  // ─── (24.2) Gerar variaveis via IA ─────────────────────────────────────────

  /** Envia tipo de peca e categorias para a IA e preenche as variaveis */
  const gerarVariaveisIA = async () => {
    if (!tipoPecaSelecionado) {
      toast({
        title: 'Tipo de peca nao selecionado',
        description: 'Selecione um tipo de peca antes de gerar variaveis via IA',
        variant: 'destructive'
      })
      return
    }

    if (categoriasSelecionadas.size === 0) {
      toast({
        title: 'Nenhuma categoria selecionada',
        description: 'Selecione ao menos uma categoria para gerar variaveis via IA',
        variant: 'destructive'
      })
      return
    }

    try {
      setGerandoVariaveisIA(true)
      const payload = {
        tipo_peca: tipoPecaSelecionado,
        categorias: Array.from(categoriasSelecionadas)
      }

      const data = await adminApi.post<Record<string, string | boolean>>(
        '/teste-ativacao/gerar-variaveis-ia',
        payload
      )

      setValoresVariaveis(prev => ({ ...prev, ...data }))
      toast({
        title: 'Variaveis geradas com sucesso',
        description: 'Os valores foram preenchidos pela IA. Revise antes de simular.'
      })
    } catch (error) {
      toast({
        title: 'Erro ao gerar variaveis',
        description: 'Nao foi possivel gerar variaveis via IA',
        variant: 'destructive'
      })
    } finally {
      setGerandoVariaveisIA(false)
    }
  }

  // ─── (24.3) Exportar JSON ──────────────────────────────────────────────────

  /** Exporta o resultado da simulacao como arquivo JSON para download */
  const exportarJSON = () => {
    if (!resultado) {
      toast({
        title: 'Sem resultado para exportar',
        description: 'Execute uma simulacao antes de exportar',
        variant: 'destructive'
      })
      return
    }

    const exportData = {
      tipo_peca: tipoPecaSelecionado,
      categorias_extracao: Array.from(categoriasSelecionadas),
      variaveis: valoresVariaveis,
      descricao_situacao: descricaoSituacao || undefined,
      resultado
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `simulacao-${tipoPecaSelecionado}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'JSON exportado',
      description: 'O arquivo foi baixado com sucesso'
    })
  }

  // ─── (24.4) Salvar cenario ─────────────────────────────────────────────────

  /** Salva a configuracao atual como cenario nomeado no backend */
  const salvarCenario = async () => {
    if (!nomeCenario.trim()) {
      toast({
        title: 'Nome obrigatorio',
        description: 'Informe um nome para o cenario',
        variant: 'destructive'
      })
      return
    }

    try {
      setSalvandoCenario(true)
      const payload = {
        nome: nomeCenario.trim(),
        tipo_peca: tipoPecaSelecionado,
        categorias: Array.from(categoriasSelecionadas),
        variaveis: valoresVariaveis,
        descricao_situacao: descricaoSituacao || undefined
      }

      await adminApi.post<Cenario>('/teste-ativacao/cenarios', payload)

      toast({
        title: 'Cenario salvo',
        description: `O cenario "${nomeCenario}" foi salvo com sucesso`
      })

      setDialogSalvarAberto(false)
      setNomeCenario('')
      // Recarrega a lista de cenarios
      await carregarCenarios()
    } catch (error) {
      toast({
        title: 'Erro ao salvar cenario',
        description: 'Nao foi possivel salvar o cenario',
        variant: 'destructive'
      })
    } finally {
      setSalvandoCenario(false)
    }
  }

  // ─── (24.5) Carregar cenario pre-definido / (24.8) Select cenario ──────────

  /** Aplica um cenario selecionado preenchendo todos os campos */
  const aplicarCenario = (cenario: Cenario) => {
    setTipoPecaSelecionado(cenario.tipo_peca)
    setCategoriasSelecionadas(new Set(cenario.categorias))
    setValoresVariaveis(cenario.variaveis)
    setDescricaoSituacao(cenario.descricao_situacao || '')
    setCenarioSelecionadoId(String(cenario.id))

    toast({
      title: 'Cenario aplicado',
      description: `Cenario "${cenario.nome}" carregado com sucesso`
    })
  }

  /** Handler do select de cenarios (24.8) */
  const handleCenarioSelect = (cenarioIdStr: string) => {
    setCenarioSelecionadoId(cenarioIdStr)
    const cenario = cenarios.find(c => String(c.id) === cenarioIdStr)
    if (cenario) {
      aplicarCenario(cenario)
    }
  }

  // ─── (24.6) Excluir cenario ────────────────────────────────────────────────

  /** Remove um cenario do backend e atualiza a lista */
  const excluirCenario = async (cenarioId: number) => {
    try {
      setExcluindoCenario(true)
      await adminApi.delete(`/teste-ativacao/cenarios/${cenarioId}`)

      toast({
        title: 'Cenario excluido',
        description: 'O cenario foi removido com sucesso'
      })

      // Limpa selecao se o cenario excluido estava selecionado
      if (cenarioSelecionadoId === String(cenarioId)) {
        setCenarioSelecionadoId('')
      }

      await carregarCenarios()
    } catch (error) {
      toast({
        title: 'Erro ao excluir cenario',
        description: 'Nao foi possivel excluir o cenario',
        variant: 'destructive'
      })
    } finally {
      setExcluindoCenario(false)
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const isLoading = loadingTipos || loadingCategorias || loadingVariaveis

  /** Retorna o cenario atualmente selecionado, se houver */
  const cenarioAtual = cenarios.find(c => String(c.id) === cenarioSelecionadoId)

  // ─── Renderizacao de campos de variavel ─────────────────────────────────────

  /** Renderiza o campo de input adequado para cada tipo de variavel */
  const renderCampoVariavel = (variavel: Variavel) => (
    <div key={variavel.slug} className="space-y-2">
      <Label htmlFor={`var-${variavel.slug}`}>
        {variavel.label}
        {variavel.descricao && (
          <span className="text-xs text-muted-foreground ml-2">
            ({variavel.descricao})
          </span>
        )}
      </Label>

      {variavel.tipo === 'boolean' ? (
        <div className="flex space-x-4">
          <Button
            variant={valoresVariaveis[variavel.slug] === true ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleVariavelChange(variavel.slug, true)}
          >
            Sim
          </Button>
          <Button
            variant={valoresVariaveis[variavel.slug] === false ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleVariavelChange(variavel.slug, false)}
          >
            Nao
          </Button>
        </div>
      ) : variavel.tipo === 'number' ? (
        <Input
          id={`var-${variavel.slug}`}
          type="number"
          value={(valoresVariaveis[variavel.slug] as string) || ''}
          onChange={(e) => handleVariavelChange(variavel.slug, e.target.value)}
          placeholder={`Digite ${variavel.label.toLowerCase()}`}
        />
      ) : (
        <Input
          id={`var-${variavel.slug}`}
          type="text"
          value={(valoresVariaveis[variavel.slug] as string) || ''}
          onChange={(e) => handleVariavelChange(variavel.slug, e.target.value)}
          placeholder={`Digite ${variavel.label.toLowerCase()}`}
        />
      )}
    </div>
  )

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teste de Ativacao de Modulos</h1>
        <p className="text-muted-foreground">
          Simule a ativacao de modulos baseado em variaveis do processo
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Sidebar esquerda (1/3) ─────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Card de configuracao principal */}
          <Card>
            <CardHeader>
              <CardTitle>Configuracao</CardTitle>
              <CardDescription>Selecione o tipo de peca e categorias</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Select para tipo de peca */}
              <div className="space-y-2">
                <Label htmlFor="tipo-peca">Tipo de Peca</Label>
                {loadingTipos ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : (
                  <Select value={tipoPecaSelecionado} onValueChange={setTipoPecaSelecionado}>
                    <SelectTrigger id="tipo-peca" data-testid="select-tipo-peca">
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposPeca.map(tipo => (
                        <SelectItem key={tipo.slug} value={tipo.slug}>
                          {tipo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Checkboxes para categorias */}
              <div className="space-y-2">
                <Label>Categorias de Extracao</Label>
                {loadingCategorias ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="space-y-2">
                    {categorias.map(categoria => (
                      <div key={categoria.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${categoria.id}`}
                          checked={categoriasSelecionadas.has(categoria.id)}
                          onCheckedChange={() => toggleCategoria(categoria.id)}
                        />
                        <Label
                          htmlFor={`cat-${categoria.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {categoria.titulo}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* (24.10) Textarea para descricao da situacao */}
              <div className="space-y-2">
                <Label htmlFor="descricao-situacao">Descricao da Situacao</Label>
                <Textarea
                  id="descricao-situacao"
                  data-testid="textarea-descricao-situacao"
                  placeholder="Descreva a situacao do processo em texto livre..."
                  value={descricaoSituacao}
                  onChange={(e) => setDescricaoSituacao(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Botao Simular */}
              <Button
                onClick={simular}
                disabled={simulando || isLoading || !tipoPecaSelecionado}
                className="w-full"
                data-testid="btn-simular"
              >
                {simulando ? 'Simulando...' : 'Simular'}
              </Button>

              {/* (24.2) Botao Gerar Variaveis via IA */}
              <Button
                onClick={gerarVariaveisIA}
                disabled={gerandoVariaveisIA || isLoading || !tipoPecaSelecionado || categoriasSelecionadas.size === 0}
                variant="outline"
                className="w-full"
                data-testid="btn-gerar-variaveis-ia"
              >
                {gerandoVariaveisIA ? 'Gerando...' : 'Gerar Variaveis via IA'}
              </Button>

              {/* (24.3) Botao Exportar JSON */}
              <Button
                onClick={exportarJSON}
                disabled={!resultado}
                variant="outline"
                className="w-full"
                data-testid="btn-exportar-json"
              >
                Exportar JSON
              </Button>
            </CardContent>
          </Card>

          {/* Card de cenarios (24.4, 24.5, 24.6, 24.8) */}
          <Card>
            <CardHeader>
              <CardTitle>Cenarios</CardTitle>
              <CardDescription>Salve e reutilize configuracoes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* (24.8) Select de cenarios salvos */}
              <div className="space-y-2">
                <Label htmlFor="select-cenario">Cenario Salvo</Label>
                {loadingCenarios ? (
                  <div className="text-sm text-muted-foreground">Carregando cenarios...</div>
                ) : (
                  <Select
                    value={cenarioSelecionadoId}
                    onValueChange={handleCenarioSelect}
                  >
                    <SelectTrigger id="select-cenario" data-testid="select-cenario">
                      <SelectValue placeholder="Selecione um cenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {cenarios.length === 0 ? (
                        <SelectItem value="_empty" disabled>
                          Nenhum cenario salvo
                        </SelectItem>
                      ) : (
                        cenarios.map(cenario => (
                          <SelectItem key={cenario.id} value={String(cenario.id)}>
                            {cenario.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* (24.5) Dropdown de cenarios pre-definidos */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={cenarios.length === 0}
                    data-testid="btn-pre-definidos"
                  >
                    Pre-definidos
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Cenarios salvos</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {cenarios.map(cenario => (
                    <DropdownMenuItem
                      key={cenario.id}
                      onClick={() => aplicarCenario(cenario)}
                      data-testid={`dropdown-cenario-${cenario.id}`}
                    >
                      {cenario.nome}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* (24.4) Botao + Dialog para salvar cenario */}
              <Dialog open={dialogSalvarAberto} onOpenChange={setDialogSalvarAberto}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!tipoPecaSelecionado}
                    data-testid="btn-salvar-cenario"
                  >
                    Salvar Cenario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Salvar Cenario</DialogTitle>
                    <DialogDescription>
                      Salve a configuracao atual como um cenario reutilizavel.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome-cenario">Nome do Cenario</Label>
                      <Input
                        id="nome-cenario"
                        data-testid="input-nome-cenario"
                        placeholder="Ex: Contestacao padrao com dano moral"
                        value={nomeCenario}
                        onChange={(e) => setNomeCenario(e.target.value)}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Tipo de peca: <strong>{tipoPecaSelecionado || 'Nenhum'}</strong></p>
                      <p>Categorias: <strong>{categoriasSelecionadas.size}</strong></p>
                      <p>Variaveis preenchidas: <strong>{Object.keys(valoresVariaveis).length}</strong></p>
                      {descricaoSituacao && (
                        <p>Descricao: <strong>{descricaoSituacao.slice(0, 80)}...</strong></p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogSalvarAberto(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={salvarCenario}
                      disabled={salvandoCenario || !nomeCenario.trim()}
                      data-testid="btn-confirmar-salvar-cenario"
                    >
                      {salvandoCenario ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* (24.6) Botao para excluir cenario selecionado */}
              {cenarioAtual && (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={excluindoCenario}
                  onClick={() => excluirCenario(cenarioAtual.id)}
                  data-testid="btn-excluir-cenario"
                >
                  {excluindoCenario ? 'Excluindo...' : `Excluir "${cenarioAtual.nome}"`}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Painel direito (2/3) ───────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="variaveis-extracao" className="w-full">
            {/* (24.9) 3 tabs: Variaveis de Extracao, Variaveis do Processo, Resultados */}
            <TabsList data-testid="tabs-lista">
              <TabsTrigger value="variaveis-extracao" data-testid="tab-variaveis-extracao">
                Variaveis de Extracao
              </TabsTrigger>
              <TabsTrigger value="variaveis-processo" data-testid="tab-variaveis-processo">
                Variaveis do Processo
              </TabsTrigger>
              <TabsTrigger value="resultados" data-testid="tab-resultados">
                Resultados
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Variaveis de Extracao (das categorias selecionadas) ──── */}
            <TabsContent value="variaveis-extracao" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Variaveis de Extracao</CardTitle>
                  <CardDescription>
                    Variaveis vinculadas as categorias de extracao selecionadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCategorias ? (
                    <div className="text-center py-8">Carregando variaveis...</div>
                  ) : categoriasSelecionadas.size === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Selecione ao menos uma categoria para visualizar as variaveis de extracao
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="lista-variaveis-extracao">
                      {getVariaveisExtracao().map(variavel => renderCampoVariavel(variavel))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Variaveis do Processo (gerais) ──────────────────────── */}
            <TabsContent value="variaveis-processo" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Variaveis do Processo</CardTitle>
                  <CardDescription>
                    Variaveis gerais do processo que influenciam a ativacao de modulos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingVariaveis ? (
                    <div className="text-center py-8">Carregando variaveis...</div>
                  ) : variaveisDisponiveis.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma variavel do processo disponivel
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="lista-variaveis-processo">
                      {variaveisDisponiveis.map(variavel => renderCampoVariavel(variavel))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Resultados ──────────────────────────────────────────── */}
            <TabsContent value="resultados" className="space-y-4">
              {!resultado ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                      Execute uma simulacao para ver os resultados
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Modulos Ativados */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">
                        Modulos Ativados ({resultado.totais.ativados})
                      </CardTitle>
                      <CardDescription>
                        Modulos que foram ativados pela simulacao
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {resultado.modulos_ativados.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Nenhum modulo foi ativado
                          </div>
                        ) : (
                          resultado.modulos_ativados.map(modulo => (
                            <Card key={modulo.id} className="border-green-200 bg-green-50">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{modulo.titulo}</h4>
                                    <div className="flex gap-2 mt-2">
                                      <Badge variant="outline">{modulo.grupo}</Badge>
                                      <Badge variant="default">{modulo.modo}</Badge>
                                    </div>
                                    {modulo.regra_usada && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        Regra: {modulo.regra_usada}
                                      </div>
                                    )}
                                    {modulo.detalhes && (
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {modulo.detalhes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Modulos Nao Ativados */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">
                        Modulos Nao Ativados ({resultado.totais.nao_ativados})
                      </CardTitle>
                      <CardDescription>
                        Modulos que nao foram ativados pela simulacao
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {resultado.modulos_nao_ativados.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Todos os modulos foram ativados
                          </div>
                        ) : (
                          resultado.modulos_nao_ativados.map(modulo => (
                            <Card key={modulo.id} className="border-red-200 bg-red-50">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{modulo.titulo}</h4>
                                    <div className="flex gap-2 mt-2">
                                      <Badge variant="outline">{modulo.grupo}</Badge>
                                      <Badge variant="secondary">{modulo.modo}</Badge>
                                    </div>
                                    {modulo.detalhes && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        {modulo.detalhes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  )
}
