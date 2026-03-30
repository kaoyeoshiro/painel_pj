/**
 * Cliente API do Sistema de Revisão de Peças.
 * Consome os endpoints de /revisao/api/*.
 */

import { createApiClient } from '@/lib/api'
import type {
  ItemRevisao,
  ItemRevisaoListResponse,
  Estatisticas,
  Assessor,
  ChatMensagem,
  DocumentosResponse,
  FiltrosRevisao,
} from './types'

const api = createApiClient('/revisao/api')

// ---------------------------------------------------------------------------
// Listagem e consulta de itens
// ---------------------------------------------------------------------------

/** Busca lista paginada de itens com filtros opcionais */
export function fetchItens(filtros: FiltrosRevisao = {}): Promise<ItemRevisaoListResponse> {
  const params = new URLSearchParams()
  if (filtros.tab) params.set('tab', filtros.tab)
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.urgencia) params.set('urgencia', filtros.urgencia)
  if (filtros.tipo_peca) params.set('tipo_peca', filtros.tipo_peca)
  if (filtros.acao_sugerida) params.set('acao_sugerida', filtros.acao_sugerida)
  if (filtros.busca) params.set('busca', filtros.busca)
  if (filtros.periodo) params.set('periodo', filtros.periodo)
  if (filtros.ordenar_por) params.set('ordenar_por', filtros.ordenar_por)
  if (filtros.ordem) params.set('ordem', filtros.ordem)
  if (filtros.pagina !== undefined) params.set('pagina', String(filtros.pagina))
  if (filtros.por_pagina !== undefined) params.set('por_pagina', String(filtros.por_pagina))

  const query = params.toString()
  return api.get<ItemRevisaoListResponse>(`/itens${query ? `?${query}` : ''}`)
}

/** Busca um item pelo ID */
export function fetchItem(id: number): Promise<ItemRevisao> {
  return api.get<ItemRevisao>(`/itens/${id}`)
}

/** Busca estatísticas do painel */
export function fetchEstatisticas(): Promise<Estatisticas> {
  return api.get<Estatisticas>('/estatisticas')
}

// ---------------------------------------------------------------------------
// Ações sobre itens
// ---------------------------------------------------------------------------

/** Inicia revisão de um item (muda status para em_revisao) */
export function iniciarRevisao(id: number): Promise<ItemRevisao> {
  return api.post<ItemRevisao>(`/itens/${id}/iniciar-revisao`)
}

/** Aprova o item com o conteúdo final editado */
export function aprovarItem(id: number, conteudoFinal: string): Promise<ItemRevisao> {
  return api.post<ItemRevisao>(`/itens/${id}/aprovar`, { conteudo_final: conteudoFinal })
}

/** Rejeita o item com motivo e ação corrigida opcional */
export function rejeitarItem(
  id: number,
  motivo: string,
  acaoCorrigida?: string,
): Promise<ItemRevisao> {
  return api.post<ItemRevisao>(`/itens/${id}/rejeitar`, {
    motivo,
    acao_corrigida: acaoCorrigida,
  })
}

/** Encaminha o item para um assessor */
export function encaminharItem(id: number, assessorId: number): Promise<ItemRevisao> {
  return api.post<ItemRevisao>(`/itens/${id}/encaminhar`, { assessor_id: assessorId })
}

/** Encaminha um lote de itens para assessores */
export function encaminharLote(
  itemIds: number[],
  assessorIds: number[],
  modo: 'balanceado' | 'todos',
): Promise<{ encaminhados: number; erros: number }> {
  return api.post('/itens/encaminhar-lote', {
    item_ids: itemIds,
    assessor_ids: assessorIds,
    modo,
  })
}

/** Marca item como inserido no sistema (concluido) */
export function marcarInserido(id: number): Promise<ItemRevisao> {
  return api.post<ItemRevisao>(`/itens/${id}/marcar-inserido`)
}

/** Desfaz aprovação/rejeição, voltando o item para em_revisao */
export function desfazerItem(id: number): Promise<ItemRevisao> {
  return api.post<ItemRevisao>(`/itens/${id}/desfazer`)
}

/** Salva conteúdo editado da peça */
export function salvarConteudo(id: number, conteudo: string): Promise<ItemRevisao> {
  return api.put<ItemRevisao>(`/itens/${id}/conteudo`, { conteudo })
}

// ---------------------------------------------------------------------------
// Chat e documentos
// ---------------------------------------------------------------------------

/** Busca histórico de mensagens do chat de um item */
export function fetchChatHistorico(itemId: number): Promise<ChatMensagem[]> {
  return api.get<ChatMensagem[]>(`/itens/${itemId}/chat/historico`)
}

/** Busca documentos do TJ-MS vinculados ao processo do item */
export function fetchDocumentos(itemId: number): Promise<DocumentosResponse> {
  return api.get<DocumentosResponse>(`/itens/${itemId}/documentos`)
}

// ---------------------------------------------------------------------------
// Assessores
// ---------------------------------------------------------------------------

/** Busca lista de assessores cadastrados */
export function fetchAssessores(): Promise<Assessor[]> {
  return api.get<Assessor[]>('/assessores')
}

/** Adiciona um usuário como assessor */
export function adicionarAssessor(usuarioId: number): Promise<Assessor> {
  return api.post<Assessor>('/assessores', { usuario_id: usuarioId })
}

/** Remove um assessor pelo ID */
export function removerAssessor(id: number): Promise<void> {
  return api.delete<void>(`/assessores/${id}`)
}

/** Ativa ou desativa um assessor */
export function toggleAssessor(id: number, ativo: boolean): Promise<Assessor> {
  return api.patch<Assessor>(`/assessores/${id}`, { ativo })
}
