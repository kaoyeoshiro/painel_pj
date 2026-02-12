/**
 * Camada de API para Categorias JSON.
 * Encapsula todas as chamadas HTTP usando adminApi.
 */

import { adminApi } from '@/lib/api'
import type {
  CategoriaJSON,
  CategoriaCreatePayload,
  CategoriaUpdatePayload,
  CodigoDisponivel,
  FonteEspecial,
  CodigosIgnoradosResponse,
  ExtractionQuestion,
  ExtractionQuestionCreate,
  ExtractionQuestionUpdate,
  BulkQuestionsCreate,
  BulkQuestionsResponse,
  GenerateSchemaResponse,
  SyncJsonResponse,
  ConsistenciaResponse,
  AplicarJsonResponse,
  OrdenarIAResponse,
  AgruparDependenciasResponse,
  InferirDependenciasResponse,
  AplicarDependenciasResponse,
  SincronizarPerguntasJsonResponse,
  OrdemLotePayload,
} from './types'

const BASE = '/admin/api/categorias-resumo-json'

/** Lista categorias. Por padrao inclui inativos (apenas_ativos=false). */
export async function listar(apenasAtivos = false): Promise<CategoriaJSON[]> {
  return adminApi.get<CategoriaJSON[]>(`${BASE}?apenas_ativos=${apenasAtivos}`)
}

/** Obtem uma categoria por ID. */
export async function obter(id: number): Promise<CategoriaJSON> {
  return adminApi.get<CategoriaJSON>(`${BASE}/${id}`)
}

/** Cria uma nova categoria. */
export async function criar(data: CategoriaCreatePayload): Promise<CategoriaJSON> {
  return adminApi.post<CategoriaJSON>(BASE, data)
}

/** Atualiza uma categoria existente. */
export async function atualizar(id: number, data: CategoriaUpdatePayload): Promise<CategoriaJSON> {
  return adminApi.put<CategoriaJSON>(`${BASE}/${id}`, data)
}

/** Desativa (soft delete) uma categoria. */
export async function desativar(id: number): Promise<{ message: string }> {
  return adminApi.delete<{ message: string }>(`${BASE}/${id}`)
}

/** Lista todos os codigos de documento TJ-MS disponiveis. */
export async function codigosDisponiveis(): Promise<CodigoDisponivel[]> {
  return adminApi.get<CodigoDisponivel[]>(`${BASE}/codigos-disponiveis`)
}

/** Lista fontes especiais disponiveis. */
export async function fontesEspeciais(): Promise<FonteEspecial[]> {
  return adminApi.get<FonteEspecial[]>(`${BASE}/fontes-especiais`)
}

/** Obtem codigos ignorados na extracao JSON. */
export async function getCodigosIgnorados(): Promise<CodigosIgnoradosResponse> {
  return adminApi.get<CodigosIgnoradosResponse>(`${BASE}/config/codigos-ignorados`)
}

/** Atualiza codigos ignorados na extracao JSON. */
export async function setCodigosIgnorados(codigos: number[]): Promise<{ success: boolean; codigos: number[] }> {
  return adminApi.put<{ success: boolean; codigos: number[] }>(`${BASE}/config/codigos-ignorados`, { codigos })
}

// ============================================================================
// API DE EXTRACAO (router_extraction.py)
// ============================================================================

const EXTRACTION = '/admin/api/extraction'

/** Lista perguntas de extracao de uma categoria. */
export async function listarPerguntas(categoriaId: number, apenasAtivos = true): Promise<ExtractionQuestion[]> {
  return adminApi.get<ExtractionQuestion[]>(`${EXTRACTION}/categorias/${categoriaId}/perguntas?apenas_ativos=${apenasAtivos}`)
}

/** Cria uma pergunta de extracao. */
export async function criarPergunta(data: ExtractionQuestionCreate): Promise<ExtractionQuestion> {
  return adminApi.post<ExtractionQuestion>(`${EXTRACTION}/perguntas`, data)
}

/** Atualiza uma pergunta de extracao. */
export async function atualizarPergunta(id: number, data: ExtractionQuestionUpdate): Promise<ExtractionQuestion> {
  return adminApi.put<ExtractionQuestion>(`${EXTRACTION}/perguntas/${id}`, data)
}

/** Exclui uma pergunta de extracao. */
export async function excluirPergunta(id: number): Promise<{ message: string }> {
  return adminApi.delete<{ message: string }>(`${EXTRACTION}/perguntas/${id}`)
}

/** Cria perguntas em lote (com analise de dependencias opcional por IA). */
export async function criarPerguntasLote(data: BulkQuestionsCreate): Promise<BulkQuestionsResponse> {
  return adminApi.post<BulkQuestionsResponse>(`${EXTRACTION}/perguntas/lote`, data)
}

/** Atualiza ordem das perguntas em lote. */
export async function atualizarOrdemLote(data: OrdemLotePayload): Promise<{ success: boolean; atualizadas: number }> {
  return adminApi.put<{ success: boolean; atualizadas: number }>(`${EXTRACTION}/perguntas/ordem-lote`, data)
}

/** Gera schema JSON com IA a partir das perguntas da categoria. */
export async function gerarSchema(categoriaId: number): Promise<GenerateSchemaResponse> {
  return adminApi.post<GenerateSchemaResponse>(`${EXTRACTION}/categorias/${categoriaId}/gerar-schema`, {})
}

/** Sincroniza JSON com as perguntas (sem IA). */
export async function sincronizarJson(categoriaId: number): Promise<SyncJsonResponse> {
  return adminApi.post<SyncJsonResponse>(`${EXTRACTION}/categorias/${categoriaId}/sincronizar-json`, {})
}

/** Aplica JSON nas perguntas/variaveis (JSON vira fonte de verdade). */
export async function aplicarJson(categoriaId: number, jsonContent: string, confirmarRemocao = false): Promise<AplicarJsonResponse> {
  return adminApi.post<AplicarJsonResponse>(`${EXTRACTION}/categorias/${categoriaId}/aplicar-json`, {
    json_content: jsonContent,
    confirmar_remocao_variaveis_em_uso: confirmarRemocao,
  })
}

/** Verifica consistencia entre JSON e perguntas. */
export async function verificarConsistencia(categoriaId: number): Promise<ConsistenciaResponse> {
  return adminApi.get<ConsistenciaResponse>(`${EXTRACTION}/categorias/${categoriaId}/verificar-consistencia`)
}

/** Sincroniza perguntas com o JSON da categoria (cria perguntas faltantes). */
export async function sincronizarPerguntasJson(categoriaId: number): Promise<SincronizarPerguntasJsonResponse> {
  return adminApi.post<SincronizarPerguntasJsonResponse>(`${EXTRACTION}/categorias/${categoriaId}/sincronizar-perguntas-json`, {})
}

/** Reordena perguntas usando IA. */
export async function ordenarPerguntasIA(categoriaNome: string, perguntas: { id?: number | null; pergunta: string; tipo_sugerido?: string | null; depends_on_variable?: string | null }[]): Promise<OrdenarIAResponse> {
  return adminApi.post<OrdenarIAResponse>(`${EXTRACTION}/perguntas/ordenar-ia`, {
    categoria_nome: categoriaNome,
    perguntas,
  })
}

/** Agrupa perguntas por dependencias (deterministico, sem IA). */
export async function agruparPorDependencias(categoriaId: number): Promise<AgruparDependenciasResponse> {
  return adminApi.post<AgruparDependenciasResponse>(`${EXTRACTION}/perguntas/agrupar-por-dependencias`, {
    categoria_id: categoriaId,
  })
}

/** Infere dependencias entre perguntas usando IA. */
export async function inferirDependencias(categoriaId: number): Promise<InferirDependenciasResponse> {
  return adminApi.post<InferirDependenciasResponse>(`${EXTRACTION}/dependencias/inferir`, {
    categoria_id: categoriaId,
  })
}

/** Aplica dependencias inferidas nas perguntas. */
export async function aplicarDependencias(categoriaId: number, dependencias: { pergunta_id: number; depends_on_variable: string; operator: string; value: unknown }[]): Promise<AplicarDependenciasResponse> {
  return adminApi.post<AplicarDependenciasResponse>(`${EXTRACTION}/dependencias/aplicar`, {
    categoria_id: categoriaId,
    dependencias,
  })
}
