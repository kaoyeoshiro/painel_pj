import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'

// Interfaces
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

export function TesteAtivacaoPage() {
  const { toast } = useToast()

  // Estado para tipos de peça
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [tipoPecaSelecionado, setTipoPecaSelecionado] = useState<string>('')

  // Estado para categorias de extração
  const [categorias, setCategorias] = useState<CategoriaExtracao[]>([])
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<number>>(new Set())

  // Estado para variáveis do processo
  const [variaveisDisponiveis, setVariaveisDisponiveis] = useState<Variavel[]>([])
  const [valoresVariaveis, setValoresVariaveis] = useState<Record<string, string | boolean>>({})

  // Estado para resultado da simulação
  const [resultado, setResultado] = useState<SimulacaoResultado | null>(null)
  const [simulando, setSimulando] = useState(false)

  // Estado de loading
  const [loadingTipos, setLoadingTipos] = useState(true)
  const [loadingCategorias, setLoadingCategorias] = useState(true)
  const [loadingVariaveis, setLoadingVariaveis] = useState(true)

  // Carregar tipos de peça
  useEffect(() => {
    carregarTiposPeca()
  }, [])

  // Carregar categorias de extração
  useEffect(() => {
    carregarCategorias()
  }, [])

  // Carregar variáveis do processo
  useEffect(() => {
    carregarVariaveis()
  }, [])

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
        title: 'Erro ao carregar tipos de peça',
        description: 'Não foi possível carregar os tipos de peça',
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
        description: 'Não foi possível carregar as categorias de extração',
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
        title: 'Erro ao carregar variáveis',
        description: 'Não foi possível carregar as variáveis do processo',
        variant: 'destructive'
      })
    } finally {
      setLoadingVariaveis(false)
    }
  }

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

  const getVariaveisSelecionadas = (): Variavel[] => {
    const variaveis: Variavel[] = []
    categoriasSelecionadas.forEach(catId => {
      const categoria = categorias.find(c => c.id === catId)
      if (categoria) {
        variaveis.push(...categoria.variaveis)
      }
    })
    return variaveis
  }

  const handleVariavelChange = (slug: string, valor: string | boolean) => {
    setValoresVariaveis(prev => ({
      ...prev,
      [slug]: valor
    }))
  }

  const simular = async () => {
    if (!tipoPecaSelecionado) {
      toast({
        title: 'Tipo de peça não selecionado',
        description: 'Por favor, selecione um tipo de peça',
        variant: 'destructive'
      })
      return
    }

    try {
      setSimulando(true)
      const payload = {
        tipo_peca: tipoPecaSelecionado,
        categorias_extracao: Array.from(categoriasSelecionadas),
        variaveis: valoresVariaveis
      }

      const data = await adminApi.post<SimulacaoResultado>('/teste-ativacao/simular', payload)
      setResultado(data)
      toast({
        title: 'Simulação concluída',
        description: `${data.totais.ativados} módulos ativados, ${data.totais.nao_ativados} não ativados`
      })
    } catch (error) {
      toast({
        title: 'Erro na simulação',
        description: 'Não foi possível executar a simulação',
        variant: 'destructive'
      })
    } finally {
      setSimulando(false)
    }
  }

  const isLoading = loadingTipos || loadingCategorias || loadingVariaveis

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teste de Ativação de Módulos</h1>
        <p className="text-muted-foreground">
          Simule a ativação de módulos baseado em variáveis do processo
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar esquerda (1/3) */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração</CardTitle>
              <CardDescription>Selecione o tipo de peça e categorias</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Select para tipo de peça */}
              <div className="space-y-2">
                <Label htmlFor="tipo-peca">Tipo de Peça</Label>
                {loadingTipos ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : (
                  <Select value={tipoPecaSelecionado} onValueChange={setTipoPecaSelecionado}>
                    <SelectTrigger id="tipo-peca">
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
                <Label>Categorias de Extração</Label>
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

              {/* Botão Simular */}
              <Button
                onClick={simular}
                disabled={simulando || isLoading || !tipoPecaSelecionado}
                className="w-full"
              >
                {simulando ? 'Simulando...' : 'Simular'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Painel direito (2/3) */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="variaveis" className="w-full">
            <TabsList>
              <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
              <TabsTrigger value="resultados">Resultados</TabsTrigger>
            </TabsList>

            {/* Aba Variáveis */}
            <TabsContent value="variaveis" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Variáveis do Processo</CardTitle>
                  <CardDescription>
                    Configure os valores das variáveis baseado nas categorias selecionadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingVariaveis ? (
                    <div className="text-center py-8">Carregando variáveis...</div>
                  ) : categoriasSelecionadas.size === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Selecione ao menos uma categoria para visualizar as variáveis
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getVariaveisSelecionadas().map(variavel => (
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
                                Não
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
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba Resultados */}
            <TabsContent value="resultados" className="space-y-4">
              {!resultado ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                      Execute uma simulação para ver os resultados
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Módulos Ativados */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">
                        Módulos Ativados ({resultado.totais.ativados})
                      </CardTitle>
                      <CardDescription>
                        Módulos que foram ativados pela simulação
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {resultado.modulos_ativados.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Nenhum módulo foi ativado
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

                  {/* Módulos Não Ativados */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">
                        Módulos Não Ativados ({resultado.totais.nao_ativados})
                      </CardTitle>
                      <CardDescription>
                        Módulos que não foram ativados pela simulação
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {resultado.modulos_nao_ativados.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Todos os módulos foram ativados
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
    </div>
  )
}
