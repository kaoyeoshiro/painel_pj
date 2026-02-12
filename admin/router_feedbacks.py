# admin/router_feedbacks.py
"""
Sub-router de administração - Dashboard, listagem, detalhes e exportação de feedbacks.

Endpoints:
- GET /api/feedbacks/dashboard — Dashboard com estatísticas consolidadas
- GET /api/feedbacks/lista — Listagem paginada com filtros
- GET /api/feedbacks/consulta/{consulta_id} — Detalhes de uma consulta/geração
- GET /api/feedbacks/exportar — Exportação de feedbacks
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timedelta

from utils.timezone import to_iso_utc
from auth.dependencies import require_admin
from auth.models import User

from admin.repositories import (
    get_feedback_repo,
    FeedbackRepository,
)

# Modelos usados apenas para referencia em evolucao_semanal
from sistemas.assistencia_judiciaria.models import FeedbackAnalise
from sistemas.matriculas_confrontantes.models import FeedbackMatricula
from sistemas.gerador_pecas.models import FeedbackPeca
from sistemas.pedido_calculo.models import FeedbackPedidoCalculo
from sistemas.prestacao_contas.models import FeedbackPrestacao
from sistemas.relatorio_cumprimento.models import FeedbackRelatorioCumprimento


router = APIRouter()


# ============================================
# Dashboard de Feedback (Admin)
# ============================================

@router.get("/api/feedbacks/dashboard")
async def dashboard_feedbacks(
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    sistema: Optional[str] = None,
    semanas_evolucao: int = 12,
    current_user: User = Depends(require_admin),
    feedback_repo: FeedbackRepository = Depends(get_feedback_repo)
):
    """
    Retorna estatísticas do dashboard de feedbacks.

    Parâmetros:
        - mes: Mês para filtrar (1-12)
        - ano: Ano para filtrar (ex: 2026)
        - sistema: Sistema específico ('assistencia_judiciaria' ou 'matriculas')
        - semanas_evolucao: Número de semanas para o gráfico de evolução (default: 12)

    Exclui feedbacks de usuários admin e teste.
    Apenas para administradores.
    """
    try:
        # Calcula período de filtro
        data_inicio = None
        data_fim = None
        if ano:
            if mes:
                # Mês específico
                data_inicio = datetime(ano, mes, 1)
                if mes == 12:
                    data_fim = datetime(ano + 1, 1, 1)
                else:
                    data_fim = datetime(ano, mes + 1, 1)
            else:
                # Ano inteiro
                data_inicio = datetime(ano, 1, 1)
                data_fim = datetime(ano + 1, 1, 1)

        # Usuarios a excluir (admin e teste)
        ids_excluir = feedback_repo.get_excluded_user_ids()

        # Flags para incluir cada sistema
        incluir_aj = sistema is None or sistema == 'assistencia_judiciaria'
        incluir_mat = sistema is None or sistema == 'matriculas'
        incluir_gp = sistema is None or sistema == 'gerador_pecas'
        incluir_pc = sistema is None or sistema == 'pedido_calculo'
        incluir_prest = sistema is None or sistema == 'prestacao_contas'
        incluir_rc = sistema is None or sistema == 'relatorio_cumprimento'

        total_consultas_aj = 0
        total_feedbacks_aj = 0
        feedbacks_por_avaliacao_aj = []

        total_analises_mat = 0
        total_feedbacks_mat = 0
        feedbacks_por_avaliacao_mat = []

        total_geracoes_gp = 0
        total_feedbacks_gp = 0
        feedbacks_por_avaliacao_gp = []

        total_geracoes_pc = 0
        total_feedbacks_pc = 0
        feedbacks_por_avaliacao_pc = []

        total_geracoes_prest = 0
        total_feedbacks_prest = 0
        feedbacks_por_avaliacao_prest = []

        total_geracoes_rc = 0
        total_feedbacks_rc = 0
        feedbacks_por_avaliacao_rc = []

        # === Sistema Assistência Judiciária ===
        if incluir_aj:
            total_consultas_aj = feedback_repo.count_consultas_aj(ids_excluir, data_inicio, data_fim)
            total_feedbacks_aj = feedback_repo.count_feedbacks_aj(ids_excluir, data_inicio, data_fim)
            feedbacks_por_avaliacao_aj = feedback_repo.get_avaliacoes_por_sistema(
                'assistencia_judiciaria', ids_excluir, data_inicio, data_fim
            )

        # === Sistema Matrículas ===
        if incluir_mat:
            total_analises_mat = feedback_repo.count_analises_mat(ids_excluir, data_inicio, data_fim)
            total_feedbacks_mat = feedback_repo.count_feedbacks_mat(ids_excluir, data_inicio, data_fim)
            feedbacks_por_avaliacao_mat = feedback_repo.get_avaliacoes_por_sistema(
                'matriculas', ids_excluir, data_inicio, data_fim
            )

        # === Sistema Gerador de Peças ===
        if incluir_gp:
            total_geracoes_gp = feedback_repo.count_geracoes_gp(ids_excluir, data_inicio, data_fim)
            total_feedbacks_gp = feedback_repo.count_feedbacks_gp(ids_excluir, data_inicio, data_fim)
            feedbacks_por_avaliacao_gp = feedback_repo.get_avaliacoes_por_sistema(
                'gerador_pecas', ids_excluir, data_inicio, data_fim
            )

        # === Sistema Pedido de Cálculo ===
        if incluir_pc:
            total_geracoes_pc = feedback_repo.count_geracoes_pc(ids_excluir, data_inicio, data_fim)
            total_feedbacks_pc = feedback_repo.count_feedbacks_pc(ids_excluir, data_inicio, data_fim)
            feedbacks_por_avaliacao_pc = feedback_repo.get_avaliacoes_por_sistema(
                'pedido_calculo', ids_excluir, data_inicio, data_fim
            )

        # === Sistema Prestação de Contas ===
        if incluir_prest:
            total_geracoes_prest = feedback_repo.count_geracoes_prest(ids_excluir, data_inicio, data_fim)
            total_feedbacks_prest = feedback_repo.count_feedbacks_prest(ids_excluir, data_inicio, data_fim)
            feedbacks_por_avaliacao_prest = feedback_repo.get_avaliacoes_por_sistema(
                'prestacao_contas', ids_excluir, data_inicio, data_fim
            )

        # === Sistema Relatório de Cumprimento ===
        if incluir_rc:
            total_geracoes_rc = feedback_repo.count_geracoes_rc_concluido(ids_excluir, data_inicio, data_fim)
            total_feedbacks_rc = feedback_repo.count_feedbacks_rc(ids_excluir, data_inicio, data_fim)
            feedbacks_por_avaliacao_rc = feedback_repo.get_avaliacoes_por_sistema(
                'relatorio_cumprimento', ids_excluir, data_inicio, data_fim
            )

        # === Totais combinados ===
        total_consultas = total_consultas_aj + total_analises_mat + total_geracoes_gp + total_geracoes_pc + total_geracoes_prest + total_geracoes_rc
        total_feedbacks = total_feedbacks_aj + total_feedbacks_mat + total_feedbacks_gp + total_feedbacks_pc + total_feedbacks_prest + total_feedbacks_rc

        # Combinar avaliações
        avaliacoes = {
            'correto': 0,
            'parcial': 0,
            'incorreto': 0,
            'erro_ia': 0
        }
        for avaliacao, count in feedbacks_por_avaliacao_aj:
            if avaliacao in avaliacoes:
                avaliacoes[avaliacao] += count
        for avaliacao, count in feedbacks_por_avaliacao_mat:
            if avaliacao in avaliacoes:
                avaliacoes[avaliacao] += count
        for avaliacao, count in feedbacks_por_avaliacao_gp:
            if avaliacao in avaliacoes:
                avaliacoes[avaliacao] += count
        for avaliacao, count in feedbacks_por_avaliacao_pc:
            if avaliacao in avaliacoes:
                avaliacoes[avaliacao] += count
        for avaliacao, count in feedbacks_por_avaliacao_prest:
            if avaliacao in avaliacoes:
                avaliacoes[avaliacao] += count
        for avaliacao, count in feedbacks_por_avaliacao_rc:
            if avaliacao in avaliacoes:
                avaliacoes[avaliacao] += count

        # Taxa de acerto (correto / total feedbacks)
        taxa_acerto = 0
        if total_feedbacks > 0:
            taxa_acerto = round((avaliacoes['correto'] / total_feedbacks) * 100, 1)

        # Feedbacks por dia (no período selecionado ou últimos 30 dias)
        if data_inicio and data_fim:
            data_limite_recentes = data_inicio
            data_fim_recentes = data_fim
        else:
            data_limite_recentes = datetime.utcnow() - timedelta(days=30)
            data_fim_recentes = datetime.utcnow()

        feedbacks_recentes_aj = []
        feedbacks_recentes_mat = []
        feedbacks_recentes_gp = []
        feedbacks_recentes_pc = []
        feedbacks_recentes_prest = []
        feedbacks_recentes_rc = []

        if incluir_aj:
            feedbacks_recentes_aj = feedback_repo.feedbacks_recentes_aj(ids_excluir, data_limite_recentes, data_fim_recentes)
        if incluir_mat:
            feedbacks_recentes_mat = feedback_repo.feedbacks_recentes_mat(ids_excluir, data_limite_recentes, data_fim_recentes)
        if incluir_gp:
            feedbacks_recentes_gp = feedback_repo.feedbacks_recentes_gp(ids_excluir, data_limite_recentes, data_fim_recentes)
        if incluir_pc:
            feedbacks_recentes_pc = feedback_repo.feedbacks_recentes_pc(ids_excluir, data_limite_recentes, data_fim_recentes)
        if incluir_prest:
            feedbacks_recentes_prest = feedback_repo.feedbacks_recentes_prest(ids_excluir, data_limite_recentes, data_fim_recentes)
        if incluir_rc:
            feedbacks_recentes_rc = feedback_repo.feedbacks_recentes_rc(ids_excluir, data_limite_recentes, data_fim_recentes)

        # Combina feedbacks recentes por data
        feedbacks_por_data = {}
        for data, count in feedbacks_recentes_aj:
            feedbacks_por_data[str(data)] = feedbacks_por_data.get(str(data), 0) + count
        for data, count in feedbacks_recentes_mat:
            feedbacks_por_data[str(data)] = feedbacks_por_data.get(str(data), 0) + count
        for data, count in feedbacks_recentes_gp:
            feedbacks_por_data[str(data)] = feedbacks_por_data.get(str(data), 0) + count
        for data, count in feedbacks_recentes_pc:
            feedbacks_por_data[str(data)] = feedbacks_por_data.get(str(data), 0) + count
        for data, count in feedbacks_recentes_prest:
            feedbacks_por_data[str(data)] = feedbacks_por_data.get(str(data), 0) + count
        for data, count in feedbacks_recentes_rc:
            feedbacks_por_data[str(data)] = feedbacks_por_data.get(str(data), 0) + count

        feedbacks_recentes = [{"data": data, "count": count} for data, count in sorted(feedbacks_por_data.items())]

        # Feedbacks por usuário (top 10) - combinando sistemas selecionados
        feedbacks_por_usuario_aj = []
        feedbacks_por_usuario_mat = []
        feedbacks_por_usuario_gp = []
        feedbacks_por_usuario_pc = []
        feedbacks_por_usuario_prest = []
        feedbacks_por_usuario_rc = []

        if incluir_aj:
            feedbacks_por_usuario_aj = feedback_repo.feedbacks_por_usuario_aj(ids_excluir, data_inicio, data_fim)
        if incluir_mat:
            feedbacks_por_usuario_mat = feedback_repo.feedbacks_por_usuario_mat(ids_excluir, data_inicio, data_fim)
        if incluir_gp:
            feedbacks_por_usuario_gp = feedback_repo.feedbacks_por_usuario_gp(ids_excluir, data_inicio, data_fim)
        if incluir_pc:
            feedbacks_por_usuario_pc = feedback_repo.feedbacks_por_usuario_pc(ids_excluir, data_inicio, data_fim)
        if incluir_prest:
            feedbacks_por_usuario_prest = feedback_repo.feedbacks_por_usuario_prest(ids_excluir, data_inicio, data_fim)
        if incluir_rc:
            feedbacks_por_usuario_rc = feedback_repo.feedbacks_por_usuario_rc(ids_excluir, data_inicio, data_fim)

        # Combina por usuário
        usuarios_stats = {}
        for username, full_name, total, corretos in feedbacks_por_usuario_aj:
            if username not in usuarios_stats:
                usuarios_stats[username] = {"nome": full_name or username, "total": 0, "corretos": 0}
            usuarios_stats[username]["total"] += total
            usuarios_stats[username]["corretos"] += corretos or 0
        for username, full_name, total, corretos in feedbacks_por_usuario_mat:
            if username not in usuarios_stats:
                usuarios_stats[username] = {"nome": full_name or username, "total": 0, "corretos": 0}
            usuarios_stats[username]["total"] += total
            usuarios_stats[username]["corretos"] += corretos or 0
        for username, full_name, total, corretos in feedbacks_por_usuario_gp:
            if username not in usuarios_stats:
                usuarios_stats[username] = {"nome": full_name or username, "total": 0, "corretos": 0}
            usuarios_stats[username]["total"] += total
            usuarios_stats[username]["corretos"] += corretos or 0
        for username, full_name, total, corretos in feedbacks_por_usuario_pc:
            if username not in usuarios_stats:
                usuarios_stats[username] = {"nome": full_name or username, "total": 0, "corretos": 0}
            usuarios_stats[username]["total"] += total
            usuarios_stats[username]["corretos"] += corretos or 0
        for username, full_name, total, corretos in feedbacks_por_usuario_prest:
            if username not in usuarios_stats:
                usuarios_stats[username] = {"nome": full_name or username, "total": 0, "corretos": 0}
            usuarios_stats[username]["total"] += total
            usuarios_stats[username]["corretos"] += corretos or 0
        for username, full_name, total, corretos in feedbacks_por_usuario_rc:
            if username not in usuarios_stats:
                usuarios_stats[username] = {"nome": full_name or username, "total": 0, "corretos": 0}
            usuarios_stats[username]["total"] += total
            usuarios_stats[username]["corretos"] += corretos or 0

        feedbacks_por_usuario = sorted(
            [{"username": k, **v} for k, v in usuarios_stats.items()],
            key=lambda x: x["total"],
            reverse=True
        )[:10]

        # Usuários que geraram relatório mas não deram feedback
        consultas_sem_feedback_aj = []
        analises_sem_feedback_mat = []
        geracoes_sem_feedback_gp = []
        geracoes_sem_feedback_pc = []
        geracoes_sem_feedback_prest = []
        geracoes_sem_feedback_rc = []

        if incluir_aj:
            consultas_sem_feedback_aj = feedback_repo.pendentes_aj(ids_excluir, data_inicio, data_fim)
        if incluir_mat:
            analises_sem_feedback_mat = feedback_repo.pendentes_mat(ids_excluir, data_inicio, data_fim)
        if incluir_gp:
            geracoes_sem_feedback_gp = feedback_repo.pendentes_gp(ids_excluir, data_inicio, data_fim)
        if incluir_pc:
            geracoes_sem_feedback_pc = feedback_repo.pendentes_pc(ids_excluir, data_inicio, data_fim)
        if incluir_prest:
            geracoes_sem_feedback_prest = feedback_repo.pendentes_prest(ids_excluir, data_inicio, data_fim)
        if incluir_rc:
            geracoes_sem_feedback_rc = feedback_repo.pendentes_rc(ids_excluir, data_inicio, data_fim)

        # Combina e formata
        pendentes_feedback = []
        for id, cnj_fmt, cnj, consultado_em, username, full_name in consultas_sem_feedback_aj:
            pendentes_feedback.append({
                "id": id,
                "sistema": "assistencia_judiciaria",
                "identificador": cnj_fmt or cnj,
                "usuario": full_name or username,
                "data": to_iso_utc(consultado_em)
            })
        for id, file_name, matricula, analisado_em, username, full_name in analises_sem_feedback_mat:
            pendentes_feedback.append({
                "id": id,
                "sistema": "matriculas",
                "identificador": matricula or file_name,
                "usuario": full_name or username,
                "data": to_iso_utc(analisado_em)
            })
        for row in geracoes_sem_feedback_gp:
            id, tipo_peca, numero_cnj, criado_em, username, full_name = row[:6]
            modo_ativacao = row[6] if len(row) > 6 else None
            pendentes_feedback.append({
                "id": id,
                "sistema": "gerador_pecas",
                "identificador": numero_cnj or tipo_peca,
                "usuario": full_name or username,
                "data": to_iso_utc(criado_em),
                "modo_ativacao": modo_ativacao
            })
        for id, numero_cnj_fmt, numero_cnj, criado_em, username, full_name in geracoes_sem_feedback_pc:
            pendentes_feedback.append({
                "id": id,
                "sistema": "pedido_calculo",
                "identificador": numero_cnj_fmt or numero_cnj,
                "usuario": full_name or username,
                "data": to_iso_utc(criado_em)
            })
        for id, numero_cnj_fmt, numero_cnj, criado_em, username, full_name in geracoes_sem_feedback_prest:
            pendentes_feedback.append({
                "id": id,
                "sistema": "prestacao_contas",
                "identificador": numero_cnj_fmt or numero_cnj,
                "usuario": full_name or username,
                "data": to_iso_utc(criado_em)
            })
        for id, numero_cnj_fmt, numero_cnj, criado_em, username, full_name in geracoes_sem_feedback_rc:
            pendentes_feedback.append({
                "id": id,
                "sistema": "relatorio_cumprimento",
                "identificador": numero_cnj_fmt or numero_cnj,
                "usuario": full_name or username,
                "data": to_iso_utc(criado_em)
            })

        # Ordena por data (mais recentes primeiro)
        pendentes_feedback.sort(key=lambda x: x.get('data') or '', reverse=True)
        pendentes_feedback = pendentes_feedback[:20]

        # ============================================
        # EVOLUÇÃO TEMPORAL POR SISTEMA (semanas)
        # ============================================
        # Calcula taxa de acerto por semana para cada sistema
        # IMPORTANTE: Usa período independente (últimas N semanas) para garantir visualização útil
        # Define período para evolução: últimas N semanas (independente do filtro de mês/ano)
        data_fim_evolucao = datetime.utcnow()
        data_inicio_evolucao = data_fim_evolucao - timedelta(weeks=semanas_evolucao)

        # Gera lista de todas as semanas no período para garantir continuidade
        def gerar_semanas_periodo(data_inicio, data_fim):
            """Gera lista de todas as semanas (ano-semana) no período."""
            semanas = []
            current = data_inicio
            while current <= data_fim:
                ano_iso, semana_iso, _ = current.isocalendar()
                semana_str = f"{ano_iso}-S{semana_iso:02d}"
                if semana_str not in semanas:
                    semanas.append(semana_str)
                current += timedelta(days=7)
            return semanas

        todas_semanas_evolucao = gerar_semanas_periodo(data_inicio_evolucao, data_fim_evolucao)

        def calcular_evolucao_semanal(feedback_model, ids_excluir):
            """Calcula taxa de acerto por semana para um modelo de feedback (últimas N semanas)."""
            return feedback_repo.evolucao_semanal(
                feedback_model, ids_excluir, data_inicio_evolucao, data_fim_evolucao
            )

        def formatar_dados_evolucao(dados_raw, todas_semanas):
            """Formata dados de evolução preenchendo semanas sem dados com zeros."""
            # Mapeia dados por semana
            dados_por_semana = {}
            for r in dados_raw:
                semana_str = f"{int(r.ano)}-S{int(r.semana):02d}"
                dados_por_semana[semana_str] = {
                    'semana': semana_str,
                    'total': r.total,
                    'corretos': r.corretos or 0,
                    'parciais': r.parciais or 0,
                    'incorretos': r.incorretos or 0,
                    'taxa_acerto': round((r.corretos or 0) / r.total * 100, 1) if r.total > 0 else 0
                }

            # Preenche todas as semanas, usando null para semanas sem dados
            resultado = []
            for semana in todas_semanas:
                if semana in dados_por_semana:
                    resultado.append(dados_por_semana[semana])
                else:
                    # Semana sem dados - usar null para não distorcer o gráfico
                    resultado.append({
                        'semana': semana,
                        'total': 0,
                        'corretos': 0,
                        'parciais': 0,
                        'incorretos': 0,
                        'taxa_acerto': None  # null indica ausência de dados
                    })
            return resultado

        evolucao_por_sistema = {}

        if incluir_aj:
            dados_aj = calcular_evolucao_semanal(FeedbackAnalise, ids_excluir)
            evolucao_por_sistema['assistencia_judiciaria'] = formatar_dados_evolucao(dados_aj, todas_semanas_evolucao)

        if incluir_mat:
            dados_mat = calcular_evolucao_semanal(FeedbackMatricula, ids_excluir)
            evolucao_por_sistema['matriculas'] = formatar_dados_evolucao(dados_mat, todas_semanas_evolucao)

        if incluir_gp:
            dados_gp = calcular_evolucao_semanal(FeedbackPeca, ids_excluir)
            evolucao_por_sistema['gerador_pecas'] = formatar_dados_evolucao(dados_gp, todas_semanas_evolucao)

        if incluir_pc:
            dados_pc = calcular_evolucao_semanal(FeedbackPedidoCalculo, ids_excluir)
            evolucao_por_sistema['pedido_calculo'] = formatar_dados_evolucao(dados_pc, todas_semanas_evolucao)

        if incluir_prest:
            dados_prest = calcular_evolucao_semanal(FeedbackPrestacao, ids_excluir)
            evolucao_por_sistema['prestacao_contas'] = formatar_dados_evolucao(dados_prest, todas_semanas_evolucao)

        if incluir_rc:
            dados_rc = calcular_evolucao_semanal(FeedbackRelatorioCumprimento, ids_excluir)
            evolucao_por_sistema['relatorio_cumprimento'] = formatar_dados_evolucao(dados_rc, todas_semanas_evolucao)

        return {
            "total_consultas": total_consultas,
            "total_feedbacks": total_feedbacks,
            "consultas_sem_feedback": total_consultas - total_feedbacks,
            "taxa_acerto": taxa_acerto,
            "avaliacoes": avaliacoes,
            "feedbacks_recentes": feedbacks_recentes,
            "feedbacks_por_usuario": feedbacks_por_usuario,
            "pendentes_feedback": pendentes_feedback,
            "filtro_aplicado": {
                "mes": mes,
                "ano": ano,
                "sistema": sistema
            },
            "por_sistema": {
                "assistencia_judiciaria": {
                    "total": total_consultas_aj,
                    "feedbacks": total_feedbacks_aj
                },
                "matriculas": {
                    "total": total_analises_mat,
                    "feedbacks": total_feedbacks_mat
                },
                "gerador_pecas": {
                    "total": total_geracoes_gp,
                    "feedbacks": total_feedbacks_gp
                },
                "pedido_calculo": {
                    "total": total_geracoes_pc,
                    "feedbacks": total_feedbacks_pc
                },
                "prestacao_contas": {
                    "total": total_geracoes_prest,
                    "feedbacks": total_feedbacks_prest
                },
                "relatorio_cumprimento": {
                    "total": total_geracoes_rc,
                    "feedbacks": total_feedbacks_rc
                }
            },
            "evolucao_por_sistema": evolucao_por_sistema
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/feedbacks/lista")
async def listar_feedbacks(
    page: int = 1,
    per_page: int = 20,
    avaliacao: Optional[str] = None,
    usuario_id: Optional[int] = None,
    sistema: Optional[str] = None,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: User = Depends(require_admin),
    feedback_repo: FeedbackRepository = Depends(get_feedback_repo)
):
    """
    Lista todos os feedbacks com paginação e filtros.
    Exclui feedbacks de usuários admin e teste.
    Apenas para administradores.
    """
    try:
        # Calcula período de filtro
        data_inicio = None
        data_fim = None
        if ano:
            if mes:
                data_inicio = datetime(ano, mes, 1)
                if mes == 12:
                    data_fim = datetime(ano + 1, 1, 1)
                else:
                    data_fim = datetime(ano, mes + 1, 1)
            else:
                data_inicio = datetime(ano, 1, 1)
                data_fim = datetime(ano + 1, 1, 1)

        # Usuarios a excluir (admin e teste)
        ids_excluir = feedback_repo.get_excluded_user_ids()

        feedbacks_combinados = []

        # Feedbacks de Assistência Judiciária
        if sistema is None or sistema == 'assistencia_judiciaria':
            for fb, cnj_fmt, cnj, modelo, username, full_name in feedback_repo.listar_feedbacks_aj(
                ids_excluir, data_inicio, data_fim, avaliacao, usuario_id
            ):
                feedbacks_combinados.append({
                    "id": fb.id,
                    "consulta_id": fb.consulta_id,
                    "sistema": "assistencia_judiciaria",
                    "identificador": cnj_fmt or cnj,
                    "cnj": cnj_fmt or cnj,
                    "modelo": modelo,
                    "usuario": full_name or username,
                    "username": username,
                    "avaliacao": fb.avaliacao,
                    "comentario": fb.comentario,
                    "campos_incorretos": fb.campos_incorretos,
                    "criado_em": to_iso_utc(fb.criado_em),
                    "criado_em_dt": fb.criado_em
                })

        # Feedbacks de Matrículas
        if sistema is None or sistema == 'matriculas':
            modelo_matriculas_default = feedback_repo.get_modelo_matriculas_default()

            for fb, file_name, matricula, modelo_usado, username, full_name in feedback_repo.listar_feedbacks_mat(
                ids_excluir, data_inicio, data_fim, avaliacao, usuario_id
            ):
                feedbacks_combinados.append({
                    "id": fb.id,
                    "consulta_id": fb.analise_id,
                    "sistema": "matriculas",
                    "identificador": matricula or file_name,
                    "cnj": None,
                    "modelo": modelo_usado or modelo_matriculas_default,
                    "usuario": full_name or username,
                    "username": username,
                    "avaliacao": fb.avaliacao,
                    "comentario": fb.comentario,
                    "campos_incorretos": fb.campos_incorretos,
                    "criado_em": to_iso_utc(fb.criado_em),
                    "criado_em_dt": fb.criado_em
                })

        # Feedbacks de Gerador de Peças
        if sistema is None or sistema == 'gerador_pecas':
            for fb, tipo_peca, numero_cnj, modelo_usado, geracao_id_ref, username, full_name in feedback_repo.listar_feedbacks_gp(
                ids_excluir, data_inicio, data_fim, avaliacao, usuario_id
            ):
                # Busca dados de curadoria (colunas podem nao existir no banco)
                modo_ativacao, modulos_det, modulos_llm, curadoria_meta = feedback_repo.get_curadoria_metadata_gp(geracao_id_ref)
                # Dados específicos do modo semi-automático
                modo_info = None
                if modo_ativacao == 'semi_automatico':
                    curadoria_data = curadoria_meta or {}
                    # Calcula total_preview: usa o valor salvo ou estima pela soma de curados + excluídos
                    preview_ids = curadoria_data.get("modulos_preview_ids", [])
                    total_preview_saved = curadoria_data.get("total_preview", 0)
                    # Se não tiver total_preview salvo, estima pelo tamanho da lista de preview_ids
                    # ou pela soma de curados (que vieram do preview) + excluídos
                    total_preview = total_preview_saved if total_preview_saved else len(preview_ids) if preview_ids else (
                        curadoria_data.get("total_curados", 0) - curadoria_data.get("total_manuais", 0) + curadoria_data.get("total_excluidos", 0)
                    )
                    modo_info = {
                        "modo": "semi_automatico",
                        "total_preview": total_preview,
                        "total_curados": curadoria_data.get("total_curados", (modulos_det or 0) + (modulos_llm or 0)),
                        "total_manuais": curadoria_data.get("total_manuais", modulos_llm or 0),
                        "total_excluidos": curadoria_data.get("total_excluidos", 0),
                        "categorias_ordem": curadoria_data.get("categorias_ordem", [])
                    }
                elif modo_ativacao:
                    modo_info = {
                        "modo": modo_ativacao,
                        "modulos_det": modulos_det,
                        "modulos_llm": modulos_llm
                    }

                feedbacks_combinados.append({
                    "id": fb.id,
                    "consulta_id": fb.geracao_id,
                    "sistema": "gerador_pecas",
                    "identificador": numero_cnj or tipo_peca,
                    "cnj": numero_cnj,
                    "modelo": modelo_usado or "gemini-3-flash-preview",
                    "usuario": full_name or username,
                    "username": username,
                    "avaliacao": fb.avaliacao,
                    "comentario": fb.comentario,
                    "campos_incorretos": fb.campos_incorretos,
                    "criado_em": to_iso_utc(fb.criado_em),
                    "criado_em_dt": fb.criado_em,
                    "modo_ativacao": modo_info
                })

        # Feedbacks de Pedido de Cálculo
        if sistema is None or sistema == 'pedido_calculo':
            for fb, numero_cnj_fmt, numero_cnj, modelo_usado, username, full_name in feedback_repo.listar_feedbacks_pc(
                ids_excluir, data_inicio, data_fim, avaliacao, usuario_id
            ):
                feedbacks_combinados.append({
                    "id": fb.id,
                    "consulta_id": fb.geracao_id,
                    "sistema": "pedido_calculo",
                    "identificador": numero_cnj_fmt or numero_cnj,
                    "cnj": numero_cnj,
                    "modelo": modelo_usado or "gemini-3-flash-preview",
                    "usuario": full_name or username,
                    "username": username,
                    "avaliacao": fb.avaliacao,
                    "comentario": fb.comentario,
                    "campos_incorretos": fb.campos_incorretos,
                    "criado_em": to_iso_utc(fb.criado_em),
                    "criado_em_dt": fb.criado_em
                })

        # Feedbacks de Prestação de Contas
        if sistema is None or sistema == 'prestacao_contas':
            for fb, numero_cnj_fmt, numero_cnj, modelo_usado, username, full_name in feedback_repo.listar_feedbacks_prest(
                ids_excluir, data_inicio, data_fim, avaliacao, usuario_id
            ):
                # Constrói campos_incorretos a partir dos booleanos específicos
                campos_incorretos = []
                if fb.parecer_correto is False:
                    campos_incorretos.append("parecer")
                if fb.valores_corretos is False:
                    campos_incorretos.append("valores")
                if fb.medicamento_correto is False:
                    campos_incorretos.append("medicamento")

                feedbacks_combinados.append({
                    "id": fb.id,
                    "consulta_id": fb.geracao_id,
                    "sistema": "prestacao_contas",
                    "identificador": numero_cnj_fmt or numero_cnj,
                    "cnj": numero_cnj,
                    "modelo": modelo_usado or "gemini-2.0-flash",
                    "usuario": full_name or username,
                    "username": username,
                    "avaliacao": fb.avaliacao,
                    "comentario": fb.comentario,
                    "campos_incorretos": campos_incorretos if campos_incorretos else None,
                    "criado_em": to_iso_utc(fb.criado_em),
                    "criado_em_dt": fb.criado_em
                })

        # Feedbacks de Relatório de Cumprimento
        if sistema is None or sistema == 'relatorio_cumprimento':
            for fb, numero_cnj_fmt, numero_cnj, modelo_usado, username, full_name in feedback_repo.listar_feedbacks_rc(
                ids_excluir, data_inicio, data_fim, avaliacao, usuario_id
            ):
                feedbacks_combinados.append({
                    "id": fb.id,
                    "consulta_id": fb.geracao_id,
                    "sistema": "relatorio_cumprimento",
                    "identificador": numero_cnj_fmt or numero_cnj,
                    "cnj": numero_cnj,
                    "modelo": modelo_usado or "gemini-3-flash-preview",
                    "usuario": full_name or username,
                    "username": username,
                    "avaliacao": fb.avaliacao,
                    "comentario": fb.comentario,
                    "campos_incorretos": fb.campos_incorretos,
                    "criado_em": to_iso_utc(fb.criado_em),
                    "criado_em_dt": fb.criado_em
                })

        # Ordena por data (mais recentes primeiro)
        feedbacks_combinados.sort(key=lambda x: x.get('criado_em_dt') or datetime.min, reverse=True)

        # Remove campo auxiliar
        for fb in feedbacks_combinados:
            del fb['criado_em_dt']

        # Total e paginação
        total = len(feedbacks_combinados)
        total_pages = (total + per_page - 1) // per_page
        offset = (page - 1) * per_page
        feedbacks_paginados = feedbacks_combinados[offset:offset + per_page]

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "feedbacks": feedbacks_paginados
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/feedbacks/consulta/{consulta_id}")
async def obter_consulta_detalhes(
    consulta_id: int,
    sistema: str = "assistencia_judiciaria",
    current_user: User = Depends(require_admin),
    feedback_repo: FeedbackRepository = Depends(get_feedback_repo)
):
    """
    Obtém detalhes de uma consulta/análise incluindo o relatório gerado.
    Apenas para administradores.
    """
    try:
        if sistema == "assistencia_judiciaria":
            consulta = feedback_repo.detalhe_consulta_aj(consulta_id)

            if not consulta:
                raise HTTPException(status_code=404, detail="Consulta não encontrada")

            c, username, full_name = consulta

            # Busca feedback se existir
            feedback = feedback_repo.detalhe_feedback_aj(consulta_id)

            return {
                "id": c.id,
                "sistema": "assistencia_judiciaria",
                "identificador": c.cnj_formatado or c.cnj,
                "cnj": c.cnj_formatado or c.cnj,
                "dados": c.dados_json,
                "relatorio": c.relatorio,
                "modelo": c.modelo_usado,
                "usuario": full_name or username,
                "consultado_em": to_iso_utc(c.consultado_em),
                "feedback": {
                    "avaliacao": feedback.avaliacao if feedback else None,
                    "comentario": feedback.comentario if feedback else None,
                    "campos_incorretos": feedback.campos_incorretos if feedback else None,
                    "criado_em": to_iso_utc(feedback.criado_em) if feedback else None
                } if feedback else None
            }

        elif sistema == "matriculas":
            analise = feedback_repo.detalhe_analise_mat(consulta_id)

            if not analise:
                raise HTTPException(status_code=404, detail="Análise não encontrada")

            a, username, full_name = analise

            # Busca feedback se existir
            feedback = feedback_repo.detalhe_feedback_mat(consulta_id)

            return {
                "id": a.id,
                "sistema": "matriculas",
                "identificador": a.matricula_principal or a.file_name,
                "arquivo": a.file_name,
                "matricula_principal": a.matricula_principal,
                "dados": a.resultado_json,
                "relatorio": a.relatorio_texto,
                "modelo": a.modelo_usado,
                "usuario": full_name or username,
                "analisado_em": to_iso_utc(a.analisado_em),
                "feedback": {
                    "avaliacao": feedback.avaliacao if feedback else None,
                    "comentario": feedback.comentario if feedback else None,
                    "campos_incorretos": feedback.campos_incorretos if feedback else None,
                    "criado_em": to_iso_utc(feedback.criado_em) if feedback else None
                } if feedback else None
            }

        elif sistema == "gerador_pecas":
            geracao = feedback_repo.detalhe_geracao_gp(consulta_id)

            if not geracao:
                raise HTTPException(status_code=404, detail="Geração não encontrada")

            (g_id, g_cnj, g_cnj_fmt, g_tipo, g_dados, g_conteudo, g_prompt, g_resumo,
             g_historico, g_modelo, g_tempo, g_criado, username, full_name) = geracao

            # Busca feedback se existir
            feedback = feedback_repo.detalhe_feedback_gp(consulta_id)

            # Busca versões da peça
            versoes = feedback_repo.detalhe_versoes_gp(consulta_id)

            # Formata histórico de chat filtrando apenas mensagens do usuário (role: user)
            # para evitar contagem duplicada (respostas do assistente não são edições)
            historico_chat = g_historico or []
            edicoes_chat = [
                msg for msg in historico_chat
                if isinstance(msg, dict) and msg.get('role') == 'user'
            ]

            # Obtém dados de curadoria (colunas podem nao existir no banco)
            modo_ativacao, modulos_det, modulos_llm, curadoria_meta = feedback_repo.get_curadoria_metadata_gp(consulta_id)

            # Monta informações do modo
            modo_info = None
            if modo_ativacao == 'semi_automatico':
                curadoria_data = curadoria_meta or {}
                modo_info = {
                    "modo": "semi_automatico",
                    "total_preview": curadoria_data.get("total_preview", 0),
                    "total_curados": curadoria_data.get("total_curados", (modulos_det or 0) + (modulos_llm or 0)),
                    "total_manuais": curadoria_data.get("total_manuais", modulos_llm or 0),
                    "total_excluidos": curadoria_data.get("total_excluidos", 0),
                    "modulos_preview_ids": curadoria_data.get("modulos_preview_ids", []),
                    "modulos_curados_ids": curadoria_data.get("modulos_curados_ids", []),
                    "modulos_manuais_ids": curadoria_data.get("modulos_manuais_ids", []),
                    "modulos_excluidos_ids": curadoria_data.get("modulos_excluidos_ids", []),
                    "categorias_ordem": curadoria_data.get("categorias_ordem", []),
                    "preview_timestamp": curadoria_data.get("preview_timestamp")
                }
            elif modo_ativacao:
                modo_info = {
                    "modo": modo_ativacao,
                    "modulos_det": modulos_det,
                    "modulos_llm": modulos_llm
                }

            return {
                "id": g_id,
                "sistema": "gerador_pecas",
                "identificador": g_cnj_fmt or g_cnj or g_tipo,
                "cnj": g_cnj,
                "tipo_peca": g_tipo,
                "dados": g_dados,
                "relatorio": g_conteudo,
                "modelo": g_modelo,
                "usuario": full_name or username,
                "criado_em": to_iso_utc(g_criado),
                "historico_chat": historico_chat,  # Histórico completo de chat
                "edicoes_chat": edicoes_chat,  # Apenas mensagens do usuário (pedidos de revisão)
                "total_edicoes_chat": len(edicoes_chat),  # Contagem correta
                "modo_ativacao": modo_info,  # Informações do modo de ativação (automático/semi-automático)
                "versoes": [
                    {
                        "id": v.id,
                        "numero_versao": v.numero_versao,
                        "origem": v.origem,
                        "descricao_alteracao": v.descricao_alteracao,
                        "conteudo": v.conteudo,
                        "criado_em": to_iso_utc(v.criado_em)
                    }
                    for v in versoes
                ],
                "total_versoes": len(versoes),
                "feedback": {
                    "avaliacao": feedback.avaliacao if feedback else None,
                    "comentario": feedback.comentario if feedback else None,
                    "campos_incorretos": feedback.campos_incorretos if feedback else None,
                    "criado_em": to_iso_utc(feedback.criado_em) if feedback else None
                } if feedback else None
            }

        elif sistema == "pedido_calculo":
            geracao = feedback_repo.detalhe_geracao_pc(consulta_id)

            if not geracao:
                raise HTTPException(status_code=404, detail="Geração não encontrada")

            p, username, full_name = geracao

            # Busca feedback se existir
            feedback = feedback_repo.detalhe_feedback_pc(consulta_id)

            return {
                "id": p.id,
                "sistema": "pedido_calculo",
                "identificador": p.numero_cnj_formatado or p.numero_cnj,
                "numero_processo": p.numero_cnj,
                "titulo": p.numero_cnj_formatado,
                "dados": p.dados_agente1,
                "relatorio": p.conteudo_gerado,
                "modelo": p.modelo_usado,
                "usuario": full_name or username,
                "analisado_em": to_iso_utc(p.criado_em),
                "feedback": {
                    "avaliacao": feedback.avaliacao if feedback else None,
                    "comentario": feedback.comentario if feedback else None,
                    "campos_incorretos": feedback.campos_incorretos if feedback else None,
                    "criado_em": to_iso_utc(feedback.criado_em) if feedback else None
                } if feedback else None
            }

        elif sistema == "prestacao_contas":
            geracao = feedback_repo.detalhe_geracao_prest(consulta_id)

            if not geracao:
                raise HTTPException(status_code=404, detail="Análise não encontrada")

            g, username, full_name = geracao

            # Busca feedback se existir
            feedback = feedback_repo.detalhe_feedback_prest(consulta_id)

            return {
                "id": g.id,
                "sistema": "prestacao_contas",
                "identificador": g.numero_cnj_formatado or g.numero_cnj,
                "numero_processo": g.numero_cnj,
                "parecer": g.parecer,
                "dados": g.dados_processo_xml,
                "relatorio": g.fundamentacao,
                "modelo": g.modelo_usado,
                "usuario": full_name or username,
                "criado_em": to_iso_utc(g.criado_em),
                "feedback": {
                    "avaliacao": feedback.avaliacao if feedback else None,
                    "comentario": feedback.comentario if feedback else None,
                    "campos_incorretos": None,
                    "criado_em": to_iso_utc(feedback.criado_em) if feedback else None
                } if feedback else None
            }

        elif sistema == "relatorio_cumprimento":
            geracao = feedback_repo.detalhe_geracao_rc(consulta_id)

            if not geracao:
                raise HTTPException(status_code=404, detail="Relatório não encontrado")

            g, username, full_name = geracao

            # Busca feedback se existir
            feedback = feedback_repo.detalhe_feedback_rc(consulta_id)

            return {
                "id": g.id,
                "sistema": "relatorio_cumprimento",
                "identificador": g.numero_cumprimento_formatado or g.numero_cumprimento,
                "numero_processo": g.numero_cumprimento,
                "numero_principal": g.numero_principal_formatado or g.numero_principal,
                "dados": g.dados_basicos,
                "relatorio": g.conteudo_gerado,
                "modelo": g.modelo_usado,
                "usuario": full_name or username,
                "criado_em": to_iso_utc(g.criado_em),
                "documentos_baixados": g.documentos_baixados,
                "transito_julgado_localizado": g.transito_julgado_localizado,
                "data_transito_julgado": g.data_transito_julgado,
                "historico_chat": g.historico_chat,
                "feedback": {
                    "avaliacao": feedback.avaliacao if feedback else None,
                    "comentario": feedback.comentario if feedback else None,
                    "campos_incorretos": feedback.campos_incorretos if feedback else None,
                    "criado_em": to_iso_utc(feedback.criado_em) if feedback else None
                } if feedback else None
            }

        else:
            raise HTTPException(status_code=400, detail="Sistema inválido")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/feedbacks/exportar")
async def exportar_feedbacks(
    formato: str = "json",
    current_user: User = Depends(require_admin),
    feedback_repo: FeedbackRepository = Depends(get_feedback_repo)
):
    """
    Exporta todos os feedbacks.
    Apenas para administradores.
    """
    try:
        data = []

        # Feedbacks de Assistência Judiciária
        for fb, cnj_fmt, cnj, username, full_name in feedback_repo.exportar_feedbacks_aj():
            data.append({
                "id": fb.id,
                "sistema": "assistencia_judiciaria",
                "identificador": cnj_fmt or cnj,
                "usuario": full_name or username,
                "avaliacao": fb.avaliacao,
                "comentario": fb.comentario,
                "campos_incorretos": fb.campos_incorretos,
                "criado_em": to_iso_utc(fb.criado_em)
            })

        # Feedbacks de Matrículas
        for fb, file_name, matricula, username, full_name in feedback_repo.exportar_feedbacks_mat():
            data.append({
                "id": fb.id,
                "sistema": "matriculas",
                "identificador": matricula or file_name,
                "usuario": full_name or username,
                "avaliacao": fb.avaliacao,
                "comentario": fb.comentario,
                "campos_incorretos": fb.campos_incorretos,
                "criado_em": to_iso_utc(fb.criado_em)
            })

        # Feedbacks de Gerador de Peças
        for fb, numero_cnj, tipo_peca, username, full_name in feedback_repo.exportar_feedbacks_gp():
            data.append({
                "id": fb.id,
                "sistema": "gerador_pecas",
                "identificador": numero_cnj or tipo_peca,
                "usuario": full_name or username,
                "avaliacao": fb.avaliacao,
                "comentario": fb.comentario,
                "campos_incorretos": fb.campos_incorretos,
                "criado_em": to_iso_utc(fb.criado_em)
            })

        # Feedbacks de Pedido de Cálculo
        for fb, numero_cnj_fmt, numero_cnj, username, full_name in feedback_repo.exportar_feedbacks_pc():
            data.append({
                "id": fb.id,
                "sistema": "pedido_calculo",
                "identificador": numero_cnj_fmt or numero_cnj,
                "usuario": full_name or username,
                "avaliacao": fb.avaliacao,
                "comentario": fb.comentario,
                "campos_incorretos": fb.campos_incorretos,
                "criado_em": to_iso_utc(fb.criado_em)
            })

        return {"feedbacks": data, "total": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
