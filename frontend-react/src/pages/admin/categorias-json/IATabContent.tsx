/**
 * Conteudo da aba "Gerar com IA" no editor de categorias.
 * Replica o conteudo-modo-ia do legado (admin_categorias_json.html):
 * - Lista de perguntas com reordenacao
 * - Botoes de acao IA (reordenar, agrupar, dependencias)
 * - Criacao individual e em lote
 * - Geracao de JSON com IA
 * - Sincronizacao JSON ↔ Perguntas
 * - Preview do JSON gerado com Accept/Edit/Discard
 * - Aviso de inconsistencia
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowUpDown,
  GitBranch,
  Network,
  List,
  Plus,
  Loader2,
  Bot,
  RefreshCw,
  Check,
  Pencil,
  X,
  AlertTriangle,
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Tag,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { C } from '@/lib/designTokens'
import type { PerguntaLocal, ExtractionQuestion, ConsistenciaResponse } from './types'
import * as categoriasApi from './api'
import { PerguntaEditorDialog } from './PerguntaEditorDialog'
import { PerguntasLoteDialog } from './PerguntasLoteDialog'

interface IATabContentProps {
  /** ID real da categoria (null se ainda nao foi salva) */
  categoriaId: number | null
  /** Nome tecnico da categoria (para namespace/prefixo) */
  categoriaNome: string
  /** JSON atual no formulario */
  formatoJson: string
  /** Callback para atualizar o JSON no formulario pai */
  onJsonChange: (json: string) => void
}

/** Badge de tipo de dado */
const TIPO_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  text: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Texto' },
  number: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Numero' },
  currency: { bg: 'bg-green-100', text: 'text-green-600', label: 'Moeda' },
  boolean: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Sim/Nao' },
  date: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Data' },
  choice: { bg: 'bg-indigo-100', text: 'text-indigo-600', label: 'Lista' },
  list: { bg: 'bg-teal-100', text: 'text-teal-600', label: 'Lista' },
}

export function IATabContent({ categoriaId, categoriaNome, formatoJson, onJsonChange }: IATabContentProps) {
  const { toast } = useToast()

  // Estado das perguntas
  const [perguntas, setPerguntas] = useState<PerguntaLocal[]>([])
  const [loadingPerguntas, setLoadingPerguntas] = useState(false)

  // Dialogs
  const [perguntaEditorOpen, setPerguntaEditorOpen] = useState(false)
  const [editandoPergunta, setEditandoPergunta] = useState<PerguntaLocal | null>(null)
  const [loteDialogOpen, setLoteDialogOpen] = useState(false)

  // Acoes IA
  const [statusIA, setStatusIA] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'warning' }>({ text: '', type: 'info' })
  const [gerandoJson, setGerandoJson] = useState(false)
  const [sincronizandoJson, setSincronizandoJson] = useState(false)
  const [reordenando, setReordenando] = useState(false)
  const [agrupando, setAgrupando] = useState(false)
  const [criandoDeps, setCriandoDeps] = useState(false)

  // Preview do JSON gerado
  const [jsonGerado, setJsonGerado] = useState<Record<string, unknown> | null>(null)
  const [variaveisCriadas, setVariaveisCriadas] = useState<{ slug: string; tipo: string }[]>([])

  // Consistencia
  const [inconsistencia, setInconsistencia] = useState<ConsistenciaResponse | null>(null)
  const [sincronizandoPerguntas, setSincronizandoPerguntas] = useState(false)

  // Carrega perguntas ao montar ou quando categoriaId muda
  const carregarPerguntas = useCallback(async () => {
    if (!categoriaId) return
    setLoadingPerguntas(true)
    try {
      const data = await categoriasApi.listarPerguntas(categoriaId, false)
      setPerguntas(data.map(mapExtractionToPerguntaLocal))
      // Verifica consistencia
      await verificarConsistencia()
    } catch {
      console.error('Erro ao carregar perguntas')
    } finally {
      setLoadingPerguntas(false)
    }
  }, [categoriaId])

  useEffect(() => {
    carregarPerguntas()
  }, [carregarPerguntas])

  const verificarConsistencia = async () => {
    if (!categoriaId) return
    try {
      const resultado = await categoriasApi.verificarConsistencia(categoriaId)
      setInconsistencia(resultado.consistente ? null : resultado)
    } catch {
      setInconsistencia(null)
    }
  }

  // Variaveis disponiveis para dependencia (slugs das perguntas atuais)
  const variaveisDisponiveis = perguntas
    .filter(p => p.nome_variavel_sugerido)
    .map(p => ({
      slug: p.nome_variavel_sugerido!,
      pergunta: p.pergunta,
    }))

  // ==========================================
  // Handlers de perguntas
  // ==========================================

  const handleNovaPergunta = () => {
    setEditandoPergunta(null)
    setPerguntaEditorOpen(true)
  }

  const handleEditarPergunta = (index: number) => {
    setEditandoPergunta(perguntas[index])
    setPerguntaEditorOpen(true)
  }

  const handleSalvarPergunta = async (data: PerguntaLocal) => {
    if (!categoriaId) {
      toast({ title: 'Erro', description: 'Salve a categoria primeiro', variant: 'destructive' })
      return
    }

    try {
      if (data.id) {
        // Atualizar
        await categoriasApi.atualizarPergunta(data.id, {
          pergunta: data.pergunta,
          nome_variavel_sugerido: data.nome_variavel_sugerido,
          tipo_sugerido: data.tipo_sugerido,
          opcoes_sugeridas: data.opcoes_sugeridas,
          depends_on_variable: data.depends_on_variable,
          dependency_operator: data.dependency_operator,
          dependency_value: data.dependency_value,
          ativo: data.ativo,
          ordem: data.ordem,
        })
      } else {
        // Criar
        await categoriasApi.criarPergunta({
          categoria_id: categoriaId,
          pergunta: data.pergunta,
          nome_variavel_sugerido: data.nome_variavel_sugerido,
          tipo_sugerido: data.tipo_sugerido,
          opcoes_sugeridas: data.opcoes_sugeridas,
          depends_on_variable: data.depends_on_variable,
          dependency_operator: data.dependency_operator,
          dependency_value: data.dependency_value,
          ativo: data.ativo,
          ordem: data.ordem || perguntas.length,
        })
      }

      toast({ title: 'Sucesso', description: data.id ? 'Pergunta atualizada' : 'Pergunta criada' })
      await carregarPerguntas()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar pergunta'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }

  const handleExcluirPergunta = async (index: number) => {
    const pergunta = perguntas[index]

    if (!pergunta.id) {
      // Nao salva, apenas remove local
      setPerguntas(prev => prev.filter((_, i) => i !== index))
      return
    }

    if (!confirm(`Tem certeza que deseja excluir a pergunta:\n\n"${pergunta.pergunta}"?\n\nEsta acao nao pode ser desfeita.`)) {
      return
    }

    try {
      await categoriasApi.excluirPergunta(pergunta.id)
      setStatusIA({ text: 'Pergunta excluida com sucesso!', type: 'success' })
      setTimeout(() => setStatusIA({ text: '', type: 'info' }), 3000)
      await carregarPerguntas()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao excluir pergunta'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }

  // Move pergunta para cima/baixo e salva ordem
  const handleMover = async (index: number, direcao: 'up' | 'down') => {
    const novoIndex = direcao === 'up' ? index - 1 : index + 1
    if (novoIndex < 0 || novoIndex >= perguntas.length) return

    const novas = [...perguntas]
    const [item] = novas.splice(index, 1)
    novas.splice(novoIndex, 0, item)
    novas.forEach((p, i) => { p.ordem = i })
    setPerguntas(novas)

    // Salva ordem no servidor
    if (categoriaId) {
      const perguntasComId = novas
        .map((p, i) => ({ id: p.id!, ordem: i }))
        .filter(p => p.id)
      if (perguntasComId.length > 0) {
        try {
          await categoriasApi.atualizarOrdemLote({ categoria_id: categoriaId, perguntas: perguntasComId })
        } catch {
          console.error('Erro ao salvar ordem')
        }
      }
    }
  }

  // ==========================================
  // Handlers de criacao em lote
  // ==========================================

  const handleCriarLote = async (linhas: string[], analisarDeps: boolean) => {
    if (!categoriaId) throw new Error('Salve a categoria primeiro')

    const resultado = await categoriasApi.criarPerguntasLote({
      categoria_id: categoriaId,
      perguntas: linhas.map(l => ({ pergunta: l })),
      analisar_dependencias: analisarDeps,
    })

    if (!resultado.success) {
      throw new Error(resultado.erro || 'Erro ao criar perguntas')
    }

    toast({
      title: 'Sucesso',
      description: `${resultado.total_criadas} perguntas criadas (${resultado.total_com_dependencias} com dependencias)`,
    })

    await carregarPerguntas()
  }

  // ==========================================
  // Acoes IA
  // ==========================================

  const handleGerarJson = async () => {
    if (!categoriaId) {
      toast({ title: 'Erro', description: 'Salve a categoria primeiro', variant: 'destructive' })
      return
    }
    if (perguntas.length === 0) {
      toast({ title: 'Erro', description: 'Adicione pelo menos uma pergunta', variant: 'destructive' })
      return
    }

    setGerandoJson(true)
    setStatusIA({ text: 'Aguarde, a IA esta analisando as perguntas...', type: 'info' })

    try {
      const resultado = await categoriasApi.gerarSchema(categoriaId)

      if (!resultado.success) {
        throw new Error(resultado.erro || 'Erro ao gerar JSON')
      }

      setJsonGerado(resultado.schema_json)
      setVariaveisCriadas(resultado.variaveis_criadas || [])
      setStatusIA({ text: 'JSON gerado com sucesso! Revise e clique em Aceitar.', type: 'success' })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao gerar JSON'
      setStatusIA({ text: msg, type: 'error' })
    } finally {
      setGerandoJson(false)
    }
  }

  const handleAceitarJson = () => {
    if (!jsonGerado) return
    onJsonChange(JSON.stringify(jsonGerado, null, 2))
    setJsonGerado(null)
    setVariaveisCriadas([])
    setStatusIA({ text: 'JSON aceito e aplicado!', type: 'success' })
    setTimeout(() => setStatusIA({ text: '', type: 'info' }), 3000)
  }

  const handleEditarJson = () => {
    if (!jsonGerado) return
    onJsonChange(JSON.stringify(jsonGerado, null, 2))
    setJsonGerado(null)
    setVariaveisCriadas([])
    setStatusIA({ text: 'JSON copiado para edicao manual. Mude para a aba "JSON Manual".', type: 'info' })
  }

  const handleDescartarJson = () => {
    setJsonGerado(null)
    setVariaveisCriadas([])
    setStatusIA({ text: 'JSON descartado.', type: 'warning' })
    setTimeout(() => setStatusIA({ text: '', type: 'info' }), 3000)
  }

  const handleSincronizarJson = async () => {
    if (!categoriaId) {
      toast({ title: 'Erro', description: 'Salve a categoria primeiro', variant: 'destructive' })
      return
    }

    setSincronizandoJson(true)
    setStatusIA({ text: 'Sincronizando JSON com as perguntas...', type: 'info' })

    try {
      const resultado = await categoriasApi.sincronizarJson(categoriaId)

      if (!resultado.success) {
        if (resultado.perguntas_incompletas && resultado.perguntas_incompletas.length > 0) {
          const msgs = resultado.perguntas_incompletas.map((p, i) => `${i + 1}. ${p.pergunta}: ${p.problema}`).join('\n')
          toast({ title: 'Perguntas incompletas', description: msgs, variant: 'destructive' })
        }
        throw new Error(resultado.erro || 'Erro ao sincronizar')
      }

      if (resultado.schema_json) {
        onJsonChange(JSON.stringify(resultado.schema_json, null, 2))
      }

      setStatusIA({
        text: resultado.mensagem || 'JSON atualizado com sucesso!',
        type: resultado.houve_alteracao ? 'success' : 'info',
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao sincronizar'
      setStatusIA({ text: msg, type: 'error' })
    } finally {
      setSincronizandoJson(false)
    }
  }

  const handleReordenar = async () => {
    if (!categoriaId || perguntas.length < 2) return

    setReordenando(true)
    setStatusIA({ text: 'Aguarde, a IA esta analisando a melhor ordem...', type: 'info' })

    try {
      const resultado = await categoriasApi.ordenarPerguntasIA(
        categoriaNome,
        perguntas.map(p => ({
          id: p.id ?? null,
          pergunta: p.pergunta,
          tipo_sugerido: p.tipo_sugerido,
          depends_on_variable: p.depends_on_variable,
        }))
      )

      if (!resultado.success) {
        throw new Error(resultado.erro || 'Erro ao reordenar')
      }

      // Aplica nova ordem
      const ordemMap = new Map(resultado.ordem.map((item, i) => [item.pergunta.toLowerCase().trim(), i]))
      const novas = [...perguntas].sort((a, b) => {
        const posA = ordemMap.get(a.pergunta.toLowerCase().trim()) ?? 999
        const posB = ordemMap.get(b.pergunta.toLowerCase().trim()) ?? 999
        return posA - posB
      })
      novas.forEach((p, i) => { p.ordem = i })
      setPerguntas(novas)

      // Salva ordem no servidor
      const perguntasComId = novas.map((p, i) => ({ id: p.id!, ordem: i })).filter(p => p.id)
      if (perguntasComId.length > 0) {
        await categoriasApi.atualizarOrdemLote({ categoria_id: categoriaId, perguntas: perguntasComId })
      }

      setStatusIA({ text: 'Perguntas reordenadas com sucesso pela IA!', type: 'success' })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao reordenar'
      setStatusIA({ text: msg, type: 'error' })
    } finally {
      setReordenando(false)
    }
  }

  const handleAgrupar = async () => {
    if (!categoriaId) return

    const temDeps = perguntas.some(p => p.depends_on_variable)
    if (!temDeps) {
      toast({
        title: 'Sem dependencias',
        description: 'Use "Dependencias" para criar dependencias primeiro.',
        variant: 'destructive',
      })
      return
    }

    setAgrupando(true)
    setStatusIA({ text: 'Organizando hierarquia de dependencias...', type: 'info' })

    try {
      const resultado = await categoriasApi.agruparPorDependencias(categoriaId)

      if (!resultado.success) {
        throw new Error(resultado.message || 'Erro ao agrupar')
      }

      // Aplica nova ordem
      if (resultado.nova_ordem && resultado.nova_ordem.length > 0) {
        const ordemMap = new Map(resultado.nova_ordem.map(item => [item.id, item.ordem]))
        const novas = [...perguntas]
        novas.forEach(p => {
          if (p.id && ordemMap.has(p.id)) {
            p.ordem = ordemMap.get(p.id)!
          }
        })
        novas.sort((a, b) => a.ordem - b.ordem)
        setPerguntas(novas)
      }

      const text = resultado.ciclos_detectados?.length
        ? `Agrupado com avisos: ${resultado.ciclos_detectados.join('; ')}`
        : resultado.message || 'Hierarquia organizada com sucesso!'
      setStatusIA({ text, type: resultado.ciclos_detectados?.length ? 'warning' : 'success' })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao agrupar'
      setStatusIA({ text: msg, type: 'error' })
    } finally {
      setAgrupando(false)
    }
  }

  const handleDependencias = async () => {
    if (!categoriaId || perguntas.length < 2) return

    if (!confirm('A IA vai analisar as perguntas e criar/substituir dependencias entre elas.\n\nDependencias existentes serao substituidas.\n\nDeseja continuar?')) {
      return
    }

    setCriandoDeps(true)
    setStatusIA({ text: 'Analisando perguntas para identificar dependencias...', type: 'info' })

    try {
      // 1. Inferir
      const inferResult = await categoriasApi.inferirDependencias(categoriaId)

      if (!inferResult.success) {
        throw new Error(inferResult.erro || 'Erro ao inferir dependencias')
      }

      if (inferResult.dependencias_inferidas.length === 0) {
        setStatusIA({ text: 'Nenhuma dependencia identificada pela IA.', type: 'warning' })
        return
      }

      setStatusIA({
        text: `Aplicando ${inferResult.dependencias_inferidas.length} dependencia(s)...`,
        type: 'info',
      })

      // 2. Aplicar
      const applyResult = await categoriasApi.aplicarDependencias(categoriaId, inferResult.dependencias_inferidas)

      if (!applyResult.success) {
        throw new Error(applyResult.erro || 'Erro ao aplicar dependencias')
      }

      // 3. Recarregar
      await carregarPerguntas()

      setStatusIA({
        text: `${inferResult.dependencias_inferidas.length} dependencia(s) criada(s) com sucesso!`,
        type: 'success',
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar dependencias'
      setStatusIA({ text: msg, type: 'error' })
    } finally {
      setCriandoDeps(false)
    }
  }

  const handleSincronizarPerguntasJson = async () => {
    if (!categoriaId) return

    setSincronizandoPerguntas(true)
    try {
      const resultado = await categoriasApi.sincronizarPerguntasJson(categoriaId)
      if (resultado.success) {
        setInconsistencia(null)
        await carregarPerguntas()
        toast({ title: 'Sucesso', description: resultado.mensagem || 'Sincronizacao concluida' })
      } else {
        toast({ title: 'Erro', description: resultado.erro || 'Erro ao sincronizar', variant: 'destructive' })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao sincronizar'
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setSincronizandoPerguntas(false)
    }
  }

  // ==========================================
  // Render
  // ==========================================

  const algumProcessando = gerandoJson || sincronizandoJson || reordenando || agrupando || criandoDeps

  return (
    <div className="space-y-4" data-testid="tab-ia-content">
      {/* Aviso: categoria nao salva */}
      {!categoriaId && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm" style={{ color: '#92400e' }}>
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Salve a categoria primeiro para usar o modo IA.
        </div>
      )}

      {/* Lista de perguntas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium" style={{ color: C.text700 }}>
            Perguntas de Extracao
            <span className="text-xs ml-1" style={{ color: C.text400 }}>
              ({perguntas.length} pergunta{perguntas.length !== 1 ? 's' : ''})
            </span>
          </label>
          <div className="flex gap-1">
            {/* Botoes IA — outline/neutro */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReordenar}
              disabled={algumProcessando || !categoriaId || perguntas.length < 2}
              className="text-xs h-7 px-2"
              title="Usar IA para reordenar as perguntas logicamente"
              data-testid="btn-reordenar-ia"
            >
              {reordenando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowUpDown className="h-3 w-3 mr-1" />}
              Reordenar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAgrupar}
              disabled={algumProcessando || !categoriaId || perguntas.length < 2}
              className="text-xs h-7 px-2"
              title="Agrupar filhos abaixo das perguntas maes (sem IA)"
              data-testid="btn-agrupar"
            >
              {agrupando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Network className="h-3 w-3 mr-1" />}
              Agrupar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDependencias}
              disabled={algumProcessando || !categoriaId || perguntas.length < 2}
              className="text-xs h-7 px-2"
              title="Usar IA para criar/recriar dependencias entre perguntas"
              data-testid="btn-dependencias-ia"
            >
              {criandoDeps ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <GitBranch className="h-3 w-3 mr-1" />}
              Dependencias
            </Button>

            <span className="w-px h-5 bg-gray-200 mx-1 self-center" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoteDialogOpen(true)}
              disabled={!categoriaId}
              className="text-xs h-7 px-2"
              data-testid="btn-varias-perguntas"
            >
              <List className="h-3 w-3 mr-1" />
              Varias
            </Button>
            <Button
              size="sm"
              onClick={handleNovaPergunta}
              disabled={!categoriaId}
              className="text-xs h-7 px-3"
              style={{ background: C.navy950, color: 'white' }}
              data-testid="btn-nova-pergunta"
            >
              <Plus className="h-3 w-3 mr-1" />
              Nova
            </Button>
          </div>
        </div>

        <p className="text-xs mb-2" style={{ color: C.text400 }}>
          <GripVertical className="h-3 w-3 inline mr-1" />
          Use as setas para reordenar
        </p>

        {/* Aviso de inconsistencia */}
        {inconsistencia && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg" data-testid="aviso-inconsistencia">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">{inconsistencia.mensagem}</p>
                {inconsistencia.variaveis_sem_pergunta.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Variaveis: {inconsistencia.variaveis_sem_pergunta.map(v => v.slug).join(', ')}
                  </p>
                )}
                <Button
                  size="sm"
                  onClick={handleSincronizarPerguntasJson}
                  disabled={sincronizandoPerguntas}
                  className="mt-2 text-xs bg-amber-500 text-white hover:bg-amber-600"
                  data-testid="btn-sincronizar-perguntas"
                >
                  {sincronizandoPerguntas ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Sincronizar Perguntas com JSON
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div
          className="space-y-2 max-h-96 overflow-auto border rounded-lg p-3 bg-gray-50"
          style={{ borderColor: C.gray200 }}
          data-testid="lista-perguntas-ia"
        >
          {loadingPerguntas && (
            <div className="text-center py-8 text-sm" style={{ color: C.text400 }}>
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Carregando perguntas...
            </div>
          )}

          {!loadingPerguntas && perguntas.length === 0 && (
            <div className="text-center py-8" style={{ color: C.text400 }}>
              <p className="text-sm mb-1">Nenhuma pergunta adicionada ainda.</p>
              <p className="text-xs">Clique em "Nova" ou "Varias" para comecar.</p>
            </div>
          )}

          {!loadingPerguntas && perguntas.map((p, index) => (
            <div
              key={p.id ?? `new-${index}`}
              className={`bg-white rounded-lg border p-3 transition-all hover:shadow-sm ${
                p.ativo === false ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:border-blue-300'
              }`}
              data-testid={`pergunta-item-${p.id ?? index}`}
            >
              <div className="flex items-start gap-2">
                {/* Setas de reordenacao */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMover(index, 'up')}
                    disabled={index === 0}
                    className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                    title="Mover para cima"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMover(index, 'down')}
                    disabled={index === perguntas.length - 1}
                    className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                    title="Mover para baixo"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Numero */}
                <span className="text-xs font-mono mt-1 w-6 shrink-0" style={{ color: C.text400 }}>
                  {index + 1}.
                </span>

                {/* Conteudo */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm mb-1 ${p.ativo === false ? 'text-gray-500' : ''}`} style={{ color: p.ativo !== false ? C.text800 : undefined }}>
                    {p.pergunta}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.nome_variavel_sugerido && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 font-mono inline-flex items-center gap-0.5">
                        <Tag className="h-2.5 w-2.5" />
                        {p.nome_variavel_sugerido}
                      </span>
                    )}
                    {p.tipo_sugerido && TIPO_BADGES[p.tipo_sugerido] && (
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${TIPO_BADGES[p.tipo_sugerido].bg} ${TIPO_BADGES[p.tipo_sugerido].text}`}>
                        {TIPO_BADGES[p.tipo_sugerido].label}
                      </span>
                    )}
                    {p.opcoes_sugeridas && p.opcoes_sugeridas.length > 0 && (
                      <span className="text-[10px]" style={{ color: C.text400 }}>
                        ({p.opcoes_sugeridas.length} opcoes)
                      </span>
                    )}
                    {p.depends_on_variable && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 text-purple-600 inline-flex items-center gap-0.5">
                        <GitBranch className="h-2.5 w-2.5" />
                        {p.depends_on_variable}
                      </span>
                    )}
                    {p.ativo === false && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-600">INATIVA</span>
                    )}
                  </div>
                </div>

                {/* Acoes */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditarPergunta(index)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluirPergunta(index)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botoes de geracao */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleGerarJson}
          disabled={algumProcessando || !categoriaId || perguntas.length === 0}
          style={{ background: C.navy950, color: 'white' }}
          className="text-sm"
          data-testid="btn-gerar-json-ia"
        >
          {gerandoJson ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Bot className="h-4 w-4 mr-2" />
          )}
          Gerar JSON com IA
        </Button>
        <Button
          variant="outline"
          onClick={handleSincronizarJson}
          disabled={algumProcessando || !categoriaId}
          className="text-sm"
          title="Sincroniza o JSON com as perguntas cadastradas, sem usar IA."
          data-testid="btn-atualizar-json"
        >
          {sincronizandoJson ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar JSON
        </Button>

        {/* Status */}
        {statusIA.text && (
          <span
            className="text-sm"
            style={{
              color: statusIA.type === 'success' ? C.statusSuccess
                : statusIA.type === 'error' ? '#dc2626'
                : statusIA.type === 'warning' ? '#d97706'
                : '#3b82f6',
            }}
            data-testid="status-ia"
          >
            {statusIA.text}
          </span>
        )}
      </div>

      {/* Preview do JSON gerado */}
      {jsonGerado && (
        <div data-testid="preview-json-gerado">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium" style={{ color: C.text700 }}>
              <Check className="h-4 w-4 inline text-green-500 mr-1" />
              JSON Gerado pela IA
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAceitarJson}
                className="text-xs bg-green-100 text-green-700 hover:bg-green-200 border-0"
                data-testid="btn-aceitar-json"
              >
                <Check className="h-3 w-3 mr-1" />
                Aceitar e Usar
              </Button>
              <Button
                size="sm"
                onClick={handleEditarJson}
                className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-0"
                data-testid="btn-editar-json-gerado"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                onClick={handleDescartarJson}
                className="text-xs bg-red-100 text-red-700 hover:bg-red-200 border-0"
                data-testid="btn-descartar-json"
              >
                <X className="h-3 w-3 mr-1" />
                Descartar
              </Button>
            </div>
          </div>
          <pre className="p-4 bg-gray-800 text-green-400 rounded-lg text-sm overflow-auto max-h-64 font-mono">
            {JSON.stringify(jsonGerado, null, 2)}
          </pre>
        </div>
      )}

      {/* Variaveis criadas */}
      {variaveisCriadas.length > 0 && (
        <div data-testid="variaveis-criadas">
          <label className="block text-sm font-medium mb-2" style={{ color: C.text700 }}>
            <Tag className="h-4 w-4 inline text-blue-500 mr-1" />
            Variaveis Criadas
          </label>
          <div className="flex flex-wrap gap-2">
            {variaveisCriadas.map(v => (
              <span key={v.slug} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {v.slug} <span className="text-blue-400">({v.tipo})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <PerguntaEditorDialog
        open={perguntaEditorOpen}
        onOpenChange={setPerguntaEditorOpen}
        pergunta={editandoPergunta}
        categoriaNome={categoriaNome}
        variaveisDisponiveis={variaveisDisponiveis}
        onSave={handleSalvarPergunta}
      />

      <PerguntasLoteDialog
        open={loteDialogOpen}
        onOpenChange={setLoteDialogOpen}
        categoriaId={categoriaId}
        onCriar={handleCriarLote}
      />
    </div>
  )
}

/** Converte ExtractionQuestion do backend para PerguntaLocal */
function mapExtractionToPerguntaLocal(q: ExtractionQuestion): PerguntaLocal {
  return {
    id: q.id,
    pergunta: q.pergunta,
    nome_variavel_sugerido: q.nome_variavel_sugerido,
    tipo_sugerido: q.tipo_sugerido,
    opcoes_sugeridas: q.opcoes_sugeridas,
    depends_on_variable: q.depends_on_variable,
    dependency_operator: q.dependency_operator,
    dependency_value: q.dependency_value,
    dependency_inferred: q.dependency_inferred,
    ativo: q.ativo,
    ordem: q.ordem,
  }
}
