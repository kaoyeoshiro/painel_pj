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
