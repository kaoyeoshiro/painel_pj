/**
 * Hook principal do Extrator de Autos.
 *
 * Concentra todo o estado, efeitos e callbacks da pagina:
 * consulta de processos, selecao de categorias, preview de documentos,
 * download via SSE e historico.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { extratorApi } from '@/lib/api'
import { useStreamingFetch } from '@/services/api/streaming'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useToast } from '@/components/ui/toast'
import { timestamp } from '../types'
import type {
  ProcessoInfo,
  CategoriaDocumento,
  PreviewDocumento,
  BertStatus,
  DownloadOptions,
  DownloadSSEEvent,
  HistoricoDownload,
  LoteResultados,
  ModoSelecao,
  PageState,
} from '@/types/extrator-autos'

// ============================================================================
// Hook
// ============================================================================

export function useExtratorAutos() {
  const { toast } = useToast()

  // -- Estado da maquina de estados --
  const [pageState, setPageState] = useState<PageState>('idle')
  const [erroMensagem, setErroMensagem] = useState('')

  // -- Modo lote --
  const [modoLote, setModoLote] = useState(false)

  // -- Inputs --
  const [cnjInput, setCnjInput] = useState('')
  const [loteCnjInput, setLoteCnjInput] = useState('')

  // -- Dados do processo / lote --
  const [processoInfo, setProcessoInfo] = useState<ProcessoInfo | null>(null)
  const [loteResultados, setLoteResultados] = useState<LoteResultados | null>(null)

  // -- Categorias e selecao --
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [categoriasSelec, setCategoriasSelec] = useState<Set<number>>(new Set())
  const [codigosManuais, setCodigosManuais] = useState<number[]>([])
  const [codigoInput, setCodigoInput] = useState('')
  const [modoSelecao, setModoSelecao] = useState<ModoSelecao>('categoria')

  // -- Preview --
  const [previewDocs, setPreviewDocs] = useState<PreviewDocumento[]>([])

  // -- Download --
  const [downloadOpcoes, setDownloadOpcoes] = useState<DownloadOptions>({
    formato: 'pdf_txt',
    mesclar_pdfs: false,
    salvar_xml: false,
    pasta_unica: false,
    processos_paralelos: 2,
  })
  const [downloadPercentual, setDownloadPercentual] = useState(0)
  const [downloadMensagem, setDownloadMensagem] = useState('')
  const [downloadLogs, setDownloadLogs] = useState<string[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // -- Download Modal --
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [formatoSaidaFinal, setFormatoSaidaFinal] = useState<'zip' | 'pdf_direto'>('zip')

  // -- Historico --
  const [historicoAberto, setHistoricoAberto] = useState(false)

  // -- BERT --
  const { data: bertStatus } = useQuery<BertStatus>({
    queryKey: queryKeys.extrator.bertHealth(),
    queryFn: () => extratorApi.get<BertStatus>('/bert/health'),
  })

  // -- Historico query --
  const {
    data: historico,
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery<HistoricoDownload[]>({
    queryKey: queryKeys.extrator.historico(),
    queryFn: () => extratorApi.get<{ itens: Array<Record<string, unknown>> }>('/historico').then(r =>
      r.itens.map((item): HistoricoDownload => ({
        id: item.id as number,
        numero_cnj: item.numero_cnj as string,
        modo: (item.modo_selecao as string) || '',
        formato: (item.modo_saida as string) || '',
        total_docs: (item.total_docs_baixados as number) || 0,
        status: (item.status as string) || '',
        criado_em: (item.criado_em as string) || '',
      })),
    ),
    enabled: historicoAberto,
  })

  // Scroll automatico nos logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [downloadLogs])

  // ---------------------------------------------------------------------------
  // Acoes
  // ---------------------------------------------------------------------------

  /** Conta processos digitados no modo lote */
  const contarProcessosLote = useCallback((): number => {
    return loteCnjInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean).length
  }, [loteCnjInput])

  /** Consultar processo individual */
  const consultarProcesso = useCallback(async () => {
    const cnj = cnjInput.trim()
    if (!cnj) {
      toast({ title: 'Campo obrigatorio', description: 'Digite o numero CNJ', variant: 'destructive' })
      return
    }
    setPageState('consultando')
    setErroMensagem('')
    try {
      const raw = await extratorApi.post<{
        processo: { numero: string; numero_formatado: string; classe_processual: string; comarca: string; vara: string }
        documentos: unknown[]
        total_documentos: number
        erro: string | null
      }>('/consultar', { numero_cnj: cnj })
      if (raw.erro) throw new Error(raw.erro)
      const info: ProcessoInfo = {
        numero_cnj: raw.processo.numero,
        numero_formatado: raw.processo.numero_formatado,
        classe_processual: raw.processo.classe_processual ?? '',
        comarca: raw.processo.comarca ?? '',
        vara: raw.processo.vara ?? '',
        assunto: '',
        total_documentos: raw.total_documentos,
      }
      setProcessoInfo(info)
      const cats = await extratorApi.get<{ categorias: CategoriaDocumento[] }>('/categorias').then(r => r.categorias)
      setCategorias(cats)
      setCategoriasSelec(new Set())
      setCodigosManuais([])
      setPageState('selecionando')
      toast({ title: 'Processo encontrado', description: `${info.total_documentos} documentos` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar processo'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [cnjInput, toast])

  /** Consultar lote */
  const consultarLote = useCallback(async () => {
    const linhas = loteCnjInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (linhas.length === 0) {
      toast({ title: 'Campo obrigatorio', description: 'Digite ao menos um numero CNJ', variant: 'destructive' })
      return
    }
    setPageState('consultando')
    setErroMensagem('')
    try {
      const raw = await extratorApi.post<{
        total_consultados: number
        total_sucesso: number
        total_erros: number
        resultados: Array<{
          processo: { numero: string; numero_formatado: string; classe_processual: string; comarca: string; vara: string }
          documentos: unknown[]
          total_documentos: number
          numero_cnj: string
        }>
        erros: Array<{ numero_cnj: string; erro: string }>
      }>('/consultar-lote', { numeros_cnj: linhas })
      const resultado: LoteResultados = {
        total_processos: raw.total_consultados,
        consultados: raw.total_sucesso,
        com_erro: raw.total_erros,
        resultados: raw.resultados.map((r) => ({
          numero_cnj: r.numero_cnj || r.processo?.numero || '',
          numero_formatado: r.processo?.numero_formatado || '',
          classe_processual: r.processo?.classe_processual || '',
          comarca: r.processo?.comarca || '',
          vara: r.processo?.vara || '',
          assunto: '',
          total_documentos: r.total_documentos,
        })),
      }
      setLoteResultados(resultado)
      const cats = await extratorApi.get<{ categorias: CategoriaDocumento[] }>('/categorias').then(r => r.categorias)
      setCategorias(cats)
      setCategoriasSelec(new Set())
      setCodigosManuais([])
      setPageState('selecionando')
      toast({
        title: 'Lote consultado',
        description: `${resultado.consultados} de ${resultado.total_processos} processos`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar lote'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [loteCnjInput, toast])

  /** Toggle categoria */
  const toggleCategoria = useCallback((id: number) => {
    setCategoriasSelec((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /** Adicionar codigo manual */
  const adicionarCodigoManual = useCallback(() => {
    const cod = parseInt(codigoInput, 10)
    if (isNaN(cod)) {
      toast({ title: 'Codigo invalido', description: 'Digite um numero valido', variant: 'destructive' })
      return
    }
    setCodigosManuais((prev) => (prev.includes(cod) ? prev : [...prev, cod]))
    setCodigoInput('')
  }, [codigoInput, toast])

  /** Remover codigo manual */
  const removerCodigoManual = useCallback((cod: number) => {
    setCodigosManuais((prev) => prev.filter((c) => c !== cod))
  }, [])

  /** Coletar todos os codigos selecionados */
  const codigosSelecionados = useCallback((): number[] => {
    const codsCategoria: number[] = []
    for (const catId of categoriasSelec) {
      const cat = categorias.find((c) => c.id === catId)
      if (cat) codsCategoria.push(...cat.codigos)
    }
    return [...new Set([...codsCategoria, ...codigosManuais])]
  }, [categoriasSelec, categorias, codigosManuais])

  /** Visualizar documentos (preview - modo individual) */
  const visualizarDocumentos = useCallback(async () => {
    const codigos = codigosSelecionados()
    if (codigos.length === 0) {
      toast({
        title: 'Nenhuma selecao',
        description: 'Selecione ao menos uma categoria ou codigo',
        variant: 'destructive',
      })
      return
    }
    setPageState('consultando')
    try {
      const result = await extratorApi.post<{ documentos: PreviewDocumento[] }>('/preview', {
        numero_cnj: processoInfo?.numero_cnj,
        codigos_resolvidos: codigos,
        categorias_ids: [...categoriasSelec],
        modo_selecao: modoSelecao,
      })
      setPreviewDocs(result.documentos)
      setPageState('preview')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar preview'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    }
  }, [codigosSelecionados, processoInfo, modoSelecao, categoriasSelec, toast])

  /** Toggle selecao de documento no preview */
  const toggleDocPreview = useCallback((docId: string) => {
    setPreviewDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, selecionado: !d.selecionado } : d)),
    )
  }, [])

  /** Selecionar/deselecionar todos */
  const toggleTodosPreview = useCallback(() => {
    const todosSelec = previewDocs.every((d) => d.selecionado)
    setPreviewDocs((prev) => prev.map((d) => ({ ...d, selecionado: !todosSelec })))
  }, [previewDocs])

  /** Contadores de preview */
  const previewContadores = useCallback(() => {
    const total = previewDocs.length
    const selecionados = previewDocs.filter((d) => d.selecionado).length
    return { total, selecionados }
  }, [previewDocs])

  /** Processa evento SSE de download */
  const processarEventoDownload = useCallback((evento: DownloadSSEEvent) => {
    if (evento.tipo === 'progresso') {
      setDownloadPercentual(evento.percentual ?? 0)
      if (evento.mensagem) {
        setDownloadMensagem(evento.mensagem)
        setDownloadLogs((prev) => [...prev, `[${timestamp()}] ${evento.mensagem}`])
      }
    } else if (evento.tipo === 'concluido') {
      setDownloadPercentual(100)
      setDownloadMensagem('Download concluido!')
      setJobId(evento.job_id ?? null)
      setDownloadLogs((prev) => [
        ...prev,
        `[${timestamp()}] Download concluido! ${evento.total_docs ?? 0} documentos.`,
      ])
      setPageState('concluido')
    } else if (evento.tipo === 'erro') {
      setDownloadMensagem(evento.mensagem ?? 'Erro durante download')
      setDownloadLogs((prev) => [
        ...prev,
        `[${timestamp()}] ERRO: ${evento.mensagem}`,
      ])
      setPageState('erro')
      setErroMensagem(evento.mensagem ?? 'Erro durante download')
    }
  }, [])

  // Hook de streaming SSE compartilhado para download
  const { start: startDownloadSSE } = useStreamingFetch<DownloadSSEEvent>({
    onEvent: (evento) => processarEventoDownload(evento),
    onError: (err) => {
      const msg = err.message || 'Erro de conexao'
      setErroMensagem(msg)
      setPageState('erro')
      toast({ title: 'Erro no download', description: msg, variant: 'destructive' })
    },
  })

  /** Iniciar download via SSE */
  const iniciarDownload = useCallback(async () => {
    const docsSelecionados = previewDocs.filter((d) => d.selecionado)

    if (!modoLote && docsSelecionados.length === 0) {
      toast({
        title: 'Nenhum documento selecionado',
        description: 'Selecione ao menos um documento para baixar',
        variant: 'destructive',
      })
      return
    }

    setPageState('baixando')
    setDownloadPercentual(0)
    setDownloadMensagem('Iniciando download...')
    setDownloadLogs([`[${timestamp()}] Iniciando download...`])
    setJobId(null)

    let url: string
    let body: Record<string, unknown>

    if (modoLote && loteResultados) {
      url = '/extrator-autos/api/baixar-lote'
      body = {
        numeros_cnj: loteResultados.resultados.map((p) => p.numero_cnj),
        modo_saida: downloadOpcoes.formato,
        mesclar_pdfs: downloadOpcoes.mesclar_pdfs,
        salvar_xml_completo: downloadOpcoes.salvar_xml,
        categorias_ids: [...categoriasSelec],
        codigos_manuais_add: codigosManuais,
        modo_selecao: modoSelecao,
      }
    } else {
      url = '/extrator-autos/api/baixar-stream'
      body = {
        numero_cnj: processoInfo?.numero_cnj,
        documento_ids: docsSelecionados.map((d) => d.id),
        modo_saida: downloadOpcoes.formato,
        mesclar_pdfs: downloadOpcoes.mesclar_pdfs,
        salvar_xml_completo: downloadOpcoes.salvar_xml,
        categorias_selecionadas: [...categoriasSelec],
        codigos_manuais_add: codigosManuais,
        modo_selecao: modoSelecao,
        formato_saida_final: formatoSaidaFinal,
      }
    }

    // Streaming SSE via hook compartilhado — erro tratado em onError do hook
    await startDownloadSSE(url, body).catch(() => {
      // Erro ja tratado pelo onError do useStreamingFetch
    })
  }, [previewDocs, modoLote, loteResultados, processoInfo, downloadOpcoes, categoriasSelec, codigosManuais, modoSelecao, formatoSaidaFinal, toast, startDownloadSSE])

  /** Baixar ZIP concluido */
  const baixarZip = useCallback(async () => {
    if (!jobId) return
    try {
      const blob = await extratorApi.blob(`/download/${jobId}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const ext = formatoSaidaFinal === 'pdf_direto' ? 'pdf' : 'zip'
      link.download = `extrator_${jobId}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: 'Erro ao baixar arquivo',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }, [jobId, formatoSaidaFinal, toast])

  /** Nova consulta (reset) */
  const novaConsulta = useCallback(() => {
    setPageState('idle')
    setCnjInput('')
    setLoteCnjInput('')
    setProcessoInfo(null)
    setLoteResultados(null)
    setCategorias([])
    setCategoriasSelec(new Set())
    setCodigosManuais([])
    setPreviewDocs([])
    setDownloadPercentual(0)
    setDownloadMensagem('')
    setDownloadLogs([])
    setJobId(null)
    setErroMensagem('')
    setDownloadModalOpen(false)
    setFormatoSaidaFinal('zip')
  }, [])

  /** Handler Enter no input CNJ */
  const handleCnjKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') consultarProcesso()
    },
    [consultarProcesso],
  )

  /** Toggle do historico (abre/fecha) */
  const toggleHistorico = useCallback(() => {
    const next = !historicoAberto
    setHistoricoAberto(next)
    if (next) refetchHistorico()
  }, [historicoAberto, refetchHistorico])

  /** Avanca lote direto para preview (pula preview de documentos individuais) */
  const avancarLoteParaPreview = useCallback(() => {
    setPageState('preview')
  }, [])

  return {
    // Estado
    pageState,
    erroMensagem,
    modoLote,
    setModoLote,
    cnjInput,
    setCnjInput,
    loteCnjInput,
    setLoteCnjInput,
    processoInfo,
    loteResultados,
    categorias,
    categoriasSelec,
    codigosManuais,
    codigoInput,
    setCodigoInput,
    modoSelecao,
    setModoSelecao,
    previewDocs,
    downloadOpcoes,
    setDownloadOpcoes,
    downloadPercentual,
    downloadMensagem,
    downloadLogs,
    jobId,
    logsEndRef,
    historicoAberto,
    bertStatus,
    historico,
    isLoadingHistorico,
    downloadModalOpen,
    setDownloadModalOpen,
    formatoSaidaFinal,
    setFormatoSaidaFinal,

    // Acoes
    contarProcessosLote,
    consultarProcesso,
    consultarLote,
    toggleCategoria,
    adicionarCodigoManual,
    removerCodigoManual,
    codigosSelecionados,
    visualizarDocumentos,
    toggleDocPreview,
    toggleTodosPreview,
    previewContadores,
    iniciarDownload,
    baixarZip,
    novaConsulta,
    handleCnjKeyDown,
    toggleHistorico,
    avancarLoteParaPreview,
  }
}

/** Tipo de retorno do hook para tipagem de props */
export type UseExtratorAutosReturn = ReturnType<typeof useExtratorAutos>
