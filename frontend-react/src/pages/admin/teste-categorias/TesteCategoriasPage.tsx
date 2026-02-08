import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { adminApi } from '@/lib/api'
import { PageContainer } from '@/components/layout'

// Estruturas de dados locais
interface Categoria {
  id: number
  nome: string
}

interface ProcessoValidado {
  original: string
  normalizado: string | null
  valido: boolean
  erro: string | null
}

interface ClassificacaoResultado {
  processo: string
  categoria_id: number
  json_extraido: Record<string, unknown>
  modelo_usado: string
  tempo_segundos: number
  tokens_usados: number
  status: 'ok' | 'erro'
  erro?: string
}

export function TesteCategoriasPage() {
  const { toast } = useToast()

  // Estado
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [textProcessos, setTextProcessos] = useState<string>('')
  const [processosValidados, setProcessosValidados] = useState<ProcessoValidado[]>([])
  const [resultados, setResultados] = useState<ClassificacaoResultado[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(false)
  const [loadingValidar, setLoadingValidar] = useState(false)
  const [loadingClassificar, setLoadingClassificar] = useState(false)

  // Carregar categorias ao montar
  useEffect(() => {
    carregarCategorias()
  }, [])

  async function carregarCategorias() {
    setLoadingCategorias(true)
    try {
      const data = await adminApi.get<Categoria[]>(
        '/admin/api/categorias-resumo-json/teste-categorias/categorias-ativas'
      )
      setCategorias(data)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar categorias',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingCategorias(false)
    }
  }

  async function validarProcessos() {
    if (!textProcessos.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo vazio',
        description: 'Digite pelo menos um número de processo'
      })
      return
    }

    const linhas = textProcessos
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    if (linhas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum processo válido',
        description: 'Digite pelo menos um número de processo'
      })
      return
    }

    setLoadingValidar(true)
    try {
      const data = await adminApi.post<ProcessoValidado[]>(
        '/admin/api/categorias-resumo-json/teste-categorias/validar-processos',
        { processos: linhas }
      )
      setProcessosValidados(data)
      setResultados([]) // Limpar resultados anteriores

      const validos = data.filter(p => p.valido).length
      const invalidos = data.filter(p => !p.valido).length

      toast({
        title: 'Validação concluída',
        description: `${validos} válido(s), ${invalidos} inválido(s)`
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao validar processos',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingValidar(false)
    }
  }

  async function classificarProcessos() {
    const processosValidos = processosValidados
      .filter(p => p.valido && p.normalizado)
      .map(p => p.normalizado!)

    if (processosValidos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum processo válido',
        description: 'Valide os processos antes de classificar'
      })
      return
    }

    if (!categoriaId) {
      toast({
        variant: 'destructive',
        title: 'Categoria não selecionada',
        description: 'Selecione uma categoria antes de classificar'
      })
      return
    }

    setLoadingClassificar(true)
    try {
      const data = await adminApi.post<ClassificacaoResultado[]>(
        '/admin/api/categorias-resumo-json/teste-categorias/classificar',
        {
          processos: processosValidos,
          categoria_id: parseInt(categoriaId, 10)
        }
      )
      setResultados(data)

      const sucessos = data.filter(r => r.status === 'ok').length
      const erros = data.filter(r => r.status === 'erro').length

      toast({
        title: 'Classificação concluída',
        description: `${sucessos} sucesso(s), ${erros} erro(s)`
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao classificar processos',
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    } finally {
      setLoadingClassificar(false)
    }
  }

  const processosValidos = processosValidados.filter(p => p.valido)
  const podeClassificar = processosValidos.length > 0 && categoriaId !== ''

  return (
    <PageContainer className="space-y-6">
      <h1 className="text-2xl font-bold">Teste de Categorias</h1>

      {/* Seleção de categoria */}
      <Card className="p-4">
        <label className="block text-sm font-medium mb-2">
          Categoria <span className="text-red-500">*</span>
        </label>
        <Select
          value={categoriaId}
          onValueChange={setCategoriaId}
          disabled={loadingCategorias}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map(cat => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Painéis lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel esquerdo - Validação */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 space-y-4">
            <h2 className="text-xl font-semibold">Processos</h2>

            <div>
              <label className="block text-sm font-medium mb-2">
                Digite os números de processo (um por linha)
              </label>
              <Textarea
                value={textProcessos}
                onChange={(e) => setTextProcessos(e.target.value)}
                placeholder={'0000000-00.0000.0.00.0000\n0000001-00.0000.0.00.0000'}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={validarProcessos}
              disabled={loadingValidar || !textProcessos.trim()}
              className="w-full"
            >
              {loadingValidar ? 'Validando...' : 'Validar'}
            </Button>

            {/* Lista de processos validados */}
            {processosValidados.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Processos validados:</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {processosValidados.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm p-2 border rounded"
                    >
                      <span className="font-mono text-xs truncate">
                        {p.normalizado || p.original}
                      </span>
                      <Badge variant={p.valido ? 'success' : 'destructive'}>
                        {p.valido ? 'válido' : 'inválido'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Painel direito - Resultados */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Resultados</h2>
              <Button
                onClick={classificarProcessos}
                disabled={!podeClassificar || loadingClassificar}
              >
                {loadingClassificar ? 'Classificando...' : 'Classificar'}
              </Button>
            </div>

            {/* Cards de resultados */}
            <div className="space-y-4">
              {resultados.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum resultado ainda. Selecione uma categoria e classifique os processos.
                </div>
              ) : (
                resultados.map((res, idx) => (
                  <Card key={idx} className="p-4 space-y-3">
                    {/* Cabeçalho do resultado */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono font-semibold">{res.processo}</h3>
                      <Badge variant={res.status === 'ok' ? 'success' : 'destructive'}>
                        {res.status}
                      </Badge>
                    </div>

                    {/* JSON extraído */}
                    {res.status === 'ok' && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">JSON Extraído:</h4>
                        <div className="bg-muted p-3 rounded text-sm space-y-1">
                          {Object.entries(res.json_extraido).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="font-medium">{key}:</span>
                              <span className="text-muted-foreground">
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadados */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Modelo: {res.modelo_usado}</span>
                      <span>Tempo: {res.tempo_segundos.toFixed(2)}s</span>
                      <span>Tokens: {res.tokens_usados}</span>
                    </div>

                    {/* Erro se houver */}
                    {res.erro && (
                      <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                        <strong>Erro:</strong> {res.erro}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
