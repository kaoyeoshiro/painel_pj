import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { PageContainer } from '@/components/layout'

interface PromptGroup {
  id: number
  name: string
}

interface TipoPeca {
  id: number
  titulo: string
  categoria?: string
}

interface ResumoConfiguracao {
  total_modulos_conteudo: number
  tipos_peca: Array<{
    tipo_peca?: string
    titulo?: string
    modulos_ativos: number
    modulos_inativos: number
    total_modulos: number
  }>
}

interface Modulo {
  modulo_id: number
  titulo: string
  categoria?: string
  subcategoria?: string
  condicao_ativacao?: string
  ativo_tipo_peca: boolean
}

interface ModulosPorTipoPeca {
  modulos: Modulo[]
}

// Agrupa módulos por categoria
function agruparModulosPorCategoria(modulos: Modulo[]): Map<string, Modulo[]> {
  const grupos = new Map<string, Modulo[]>()

  modulos.forEach(modulo => {
    const categoria = modulo.categoria || 'Sem Categoria'
    if (!grupos.has(categoria)) {
      grupos.set(categoria, [])
    }
    grupos.get(categoria)!.push(modulo)
  })

  return grupos
}

export function ModulosTipoPecaPage() {
  const { toast } = useToast()

  // Estado dos dados carregados
  const [grupos, setGrupos] = useState<PromptGroup[]>([])
  const [grupoSelecionado, setGrupoSelecionado] = useState<number | null>(null)
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [resumo, setResumo] = useState<ResumoConfiguracao | null>(null)

  // Estado de carregamento
  const [carregandoGrupos, setCarregandoGrupos] = useState(true)
  const [carregandoTipos, setCarregandoTipos] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Estado de expansão e módulos
  const [tiposExpandidos, setTiposExpandidos] = useState<Set<string>>(new Set())
  const [modulosPorTipo, setModulosPorTipo] = useState<Map<string, Modulo[]>>(new Map())
  const [carregandoModulos, setCarregandoModulos] = useState<Set<string>>(new Set())

  // Estado de alterações pendentes: Map<tipo_peca_slug, Map<modulo_id, boolean>>
  const [alteracoesPendentes, setAlteracoesPendentes] = useState<Map<string, Map<number, boolean>>>(new Map())

  // Carregar grupos ao montar
  useEffect(() => {
    carregarGrupos()
  }, [])

  // Carregar tipos de peça quando grupo mudar
  useEffect(() => {
    if (grupoSelecionado !== null) {
      carregarTiposPeca()
    }
  }, [grupoSelecionado])

  async function carregarGrupos() {
    try {
      setCarregandoGrupos(true)
      const data = await adminApi.get<PromptGroup[]>('/admin/api/prompts-modulos/grupos')
      setGrupos(data)

      // Selecionar primeiro grupo por padrão
      if (data.length > 0) {
        setGrupoSelecionado(data[0].id)
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar grupos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setCarregandoGrupos(false)
    }
  }

  async function carregarTiposPeca() {
    try {
      setCarregandoTipos(true)
      const [tipos, resumoData] = await Promise.all([
        adminApi.get<TipoPeca[]>(`/admin/api/prompts-modulos/tipos-peca?group_id=${grupoSelecionado}`),
        adminApi.get<ResumoConfiguracao>(`/admin/api/prompts-modulos/resumo-configuracao-tipos-peca?group_id=${grupoSelecionado}`)
      ])

      setTiposPeca(tipos)
      setResumo(resumoData)

      // Limpar estado ao trocar de grupo
      setTiposExpandidos(new Set())
      setModulosPorTipo(new Map())
      setAlteracoesPendentes(new Map())
    } catch (error) {
      toast({
        title: 'Erro ao carregar tipos de peça',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setCarregandoTipos(false)
    }
  }

  async function carregarModulosTipoPeca(tipoPeca: TipoPeca) {
    const categoria = tipoPeca.categoria || ''

    if (modulosPorTipo.has(categoria)) {
      return // Já carregado
    }

    try {
      setCarregandoModulos(prev => new Set(prev).add(categoria))

      const data = await adminApi.get<ModulosPorTipoPeca>(
        `/admin/api/prompts-modulos/modulos-por-tipo-peca/${categoria}?group_id=${grupoSelecionado}`
      )

      setModulosPorTipo(prev => new Map(prev).set(categoria, data.modulos))
    } catch (error) {
      toast({
        title: 'Erro ao carregar módulos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setCarregandoModulos(prev => {
        const novo = new Set(prev)
        novo.delete(categoria)
        return novo
      })
    }
  }

  function toggleTipoPeca(tipoPeca: TipoPeca) {
    const categoria = tipoPeca.categoria || ''
    const novoSet = new Set(tiposExpandidos)

    if (novoSet.has(categoria)) {
      novoSet.delete(categoria)
    } else {
      novoSet.add(categoria)
      // Carregar módulos se ainda não foram carregados
      if (!modulosPorTipo.has(categoria)) {
        carregarModulosTipoPeca(tipoPeca)
      }
    }

    setTiposExpandidos(novoSet)
  }

  function toggleModulo(tipoPecaCategoria: string, moduloId: number, estadoAtual: boolean) {
    setAlteracoesPendentes(prev => {
      const novoMap = new Map(prev)

      if (!novoMap.has(tipoPecaCategoria)) {
        novoMap.set(tipoPecaCategoria, new Map())
      }

      const modulosMap = novoMap.get(tipoPecaCategoria)!
      modulosMap.set(moduloId, !estadoAtual)

      return novoMap
    })
  }

  function ativarTodos(tipoPecaCategoria: string) {
    const modulos = modulosPorTipo.get(tipoPecaCategoria) || []

    setAlteracoesPendentes(prev => {
      const novoMap = new Map(prev)
      const modulosMap = new Map<number, boolean>()

      modulos.forEach(modulo => {
        modulosMap.set(modulo.modulo_id, true)
      })

      novoMap.set(tipoPecaCategoria, modulosMap)
      return novoMap
    })
  }

  function desativarTodos(tipoPecaCategoria: string) {
    const modulos = modulosPorTipo.get(tipoPecaCategoria) || []

    setAlteracoesPendentes(prev => {
      const novoMap = new Map(prev)
      const modulosMap = new Map<number, boolean>()

      modulos.forEach(modulo => {
        modulosMap.set(modulo.modulo_id, false)
      })

      novoMap.set(tipoPecaCategoria, modulosMap)
      return novoMap
    })
  }

  async function salvarAlteracoesTipo(tipoPecaCategoria: string) {
    const alteracoes = alteracoesPendentes.get(tipoPecaCategoria)
    if (!alteracoes || alteracoes.size === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Não há alterações pendentes para este tipo de peça',
      })
      return
    }

    try {
      setSalvando(true)

      // Converter Map para array de objetos
      const configuracoes = Array.from(alteracoes.entries()).map(([moduloId, ativo]) => ({
        modulo_id: moduloId,
        tipo_peca: tipoPecaCategoria,
        ativo_tipo_peca: ativo
      }))

      await adminApi.post('/admin/api/prompts-modulos/configurar-modulos-tipo-peca', {
        group_id: grupoSelecionado,
        configuracoes
      })

      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso',
      })

      // Limpar alterações pendentes deste tipo
      setAlteracoesPendentes(prev => {
        const novoMap = new Map(prev)
        novoMap.delete(tipoPecaCategoria)
        return novoMap
      })

      // Recarregar módulos para refletir mudanças
      const modulos = modulosPorTipo.get(tipoPecaCategoria)
      if (modulos) {
        setModulosPorTipo(prev => {
          const novoMap = new Map(prev)
          novoMap.delete(tipoPecaCategoria)
          return novoMap
        })

        const tipoPeca = tiposPeca.find(t => (t.categoria || '') === tipoPecaCategoria)
        if (tipoPeca) {
          await carregarModulosTipoPeca(tipoPeca)
        }
      }

      // Recarregar resumo
      const resumoData = await adminApi.get<ResumoConfiguracao>(
        `/admin/api/prompts-modulos/resumo-configuracao-tipos-peca?group_id=${grupoSelecionado}`
      )
      setResumo(resumoData)

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

  async function salvarTodasAlteracoes() {
    if (alteracoesPendentes.size === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Não há alterações pendentes',
      })
      return
    }

    try {
      setSalvando(true)

      // Converter todas as alterações para array
      const configuracoes: Array<{
        modulo_id: number
        tipo_peca: string
        ativo_tipo_peca: boolean
      }> = []

      alteracoesPendentes.forEach((modulosMap, tipoPeca) => {
        modulosMap.forEach((ativo, moduloId) => {
          configuracoes.push({
            modulo_id: moduloId,
            tipo_peca: tipoPeca,
            ativo_tipo_peca: ativo
          })
        })
      })

      await adminApi.post('/admin/api/prompts-modulos/configurar-modulos-tipo-peca', {
        group_id: grupoSelecionado,
        configuracoes
      })

      toast({
        title: 'Sucesso',
        description: `${configuracoes.length} configurações salvas com sucesso`,
      })

      // Limpar todas as alterações
      setAlteracoesPendentes(new Map())

      // Recarregar dados
      await carregarTiposPeca()

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

  // Calcular estatísticas
  const totalTipos = tiposPeca.length
  const totalModulos = resumo?.total_modulos_conteudo || 0
  const totalConfiguracoes = resumo?.tipos_peca.reduce((acc, t) => acc + t.modulos_ativos, 0) || 0

  let totalAlteracoesPendentes = 0
  alteracoesPendentes.forEach(modulosMap => {
    totalAlteracoesPendentes += modulosMap.size
  })

  // Obter estado efetivo do módulo (considerando alterações pendentes)
  function getEstadoModulo(tipoPecaCategoria: string, modulo: Modulo): boolean {
    const alteracoes = alteracoesPendentes.get(tipoPecaCategoria)
    if (alteracoes?.has(modulo.modulo_id)) {
      return alteracoes.get(modulo.modulo_id)!
    }
    return modulo.ativo_tipo_peca
  }

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Módulos por Tipo de Peça</h1>

        <div className="flex items-center gap-4">
          {/* Seletor de grupo */}
          {carregandoGrupos ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <Select
              value={grupoSelecionado?.toString() || ''}
              onValueChange={(value) => setGrupoSelecionado(Number(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {grupos.map(grupo => (
                  <SelectItem key={grupo.id} value={grupo.id.toString()}>
                    {grupo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Botão de salvar tudo */}
          <Button
            onClick={salvarTodasAlteracoes}
            disabled={salvando || totalAlteracoesPendentes === 0}
          >
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      {carregandoTipos ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Tipos de Peça</div>
            <div className="text-2xl font-bold">{totalTipos}</div>
          </Card>

          <Card className="p-4">
            <div className="text-sm text-gray-600">Módulos Disponíveis</div>
            <div className="text-2xl font-bold">{totalModulos}</div>
          </Card>

          <Card className="p-4">
            <div className="text-sm text-gray-600">Configurações Ativas</div>
            <div className="text-2xl font-bold">{totalConfiguracoes}</div>
          </Card>

          <Card className="p-4">
            <div className="text-sm text-gray-600">Alterações Pendentes</div>
            <div className="text-2xl font-bold text-amber-600">{totalAlteracoesPendentes}</div>
          </Card>
        </div>
      )}

      {/* Alert explicativo */}
      <Alert>
        <div className="text-sm">
          <strong>Como usar:</strong> Expanda cada tipo de peça para configurar quais módulos de conteúdo
          devem estar ativos. Módulos ativos serão sugeridos automaticamente durante a geração de peças deste tipo.
          As alterações são salvas por tipo de peça ou todas de uma vez.
        </div>
      </Alert>

      {/* Lista de tipos de peça */}
      {carregandoTipos ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {tiposPeca.map(tipoPeca => {
            const categoria = tipoPeca.categoria || ''
            const expandido = tiposExpandidos.has(categoria)
            const modulos = modulosPorTipo.get(categoria) || []
            const carregando = carregandoModulos.has(categoria)

            // Encontrar resumo deste tipo
            const resumoTipo = resumo?.tipos_peca.find(
              t => (t.tipo_peca || '') === categoria
            )

            const temAlteracoes = alteracoesPendentes.has(categoria) &&
                                 alteracoesPendentes.get(categoria)!.size > 0

            return (
              <Card key={tipoPeca.id} className="overflow-hidden">
                {/* Header do card */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => toggleTipoPeca(tipoPeca)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {expandido ? '▼' : '▶'}
                    </span>
                    <div>
                      <h3 className="font-semibold">{tipoPeca.titulo}</h3>
                      {resumoTipo && (
                        <div className="text-sm text-gray-600 mt-1">
                          <Badge variant="success" className="mr-2">
                            {resumoTipo.modulos_ativos} ativos
                          </Badge>
                          <Badge variant="secondary">
                            {resumoTipo.modulos_inativos} inativos
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {temAlteracoes && (
                    <Badge variant="warning">
                      {alteracoesPendentes.get(categoria)!.size} pendentes
                    </Badge>
                  )}
                </div>

                {/* Conteúdo expandido */}
                {expandido && (
                  <div className="border-t p-4 space-y-4">
                    {/* Ações em lote */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => ativarTodos(categoria)}
                        disabled={carregando}
                      >
                        Ativar Todos
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => desativarTodos(categoria)}
                        disabled={carregando}
                      >
                        Desativar Todos
                      </Button>

                      <div className="flex-1" />

                      <Button
                        size="sm"
                        onClick={() => salvarAlteracoesTipo(categoria)}
                        disabled={salvando || !temAlteracoes}
                      >
                        {salvando ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>

                    {/* Lista de módulos */}
                    {carregando ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-12" />
                        ))}
                      </div>
                    ) : modulos.length === 0 ? (
                      <div className="text-center text-gray-500 py-4">
                        Nenhum módulo disponível
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Array.from(agruparModulosPorCategoria(modulos).entries()).map(([cat, mods]) => (
                          <div key={cat}>
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">
                              {cat}
                            </h4>
                            <div className="space-y-2">
                              {mods.map(modulo => {
                                const estadoAtual = getEstadoModulo(categoria, modulo)
                                const foiAlterado = alteracoesPendentes.get(categoria)?.has(modulo.modulo_id)

                                return (
                                  <div
                                    key={modulo.modulo_id}
                                    className={`flex items-start gap-3 p-3 rounded border ${
                                      foiAlterado ? 'bg-amber-50 border-amber-200' : 'bg-white'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={estadoAtual}
                                      onChange={() => toggleModulo(categoria, modulo.modulo_id, modulo.ativo_tipo_peca)}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">{modulo.titulo}</div>
                                      {modulo.condicao_ativacao && (
                                        <div className="text-sm text-gray-600 mt-1">
                                          Condição: {modulo.condicao_ativacao}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
