# admin/repositories_performance.py
"""
Repositories para dados de performance e logs Gemini.

Encapsula todo acesso a dados (db.query) que antes estava
nos routers router_performance.py e router_gemini_logs.py.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from fastapi import Depends
from datetime import datetime, timedelta
from typing import Optional, List

from database.connection import get_db
from admin.models_performance import PerformanceLog, RouteSystemMap


class PerformanceRepository:
    """Repository para logs de performance e mapeamentos de rota."""

    def __init__(self, db: Session):
        self.db = db

    # --------------------------------------------------
    # RouteSystemMap
    # --------------------------------------------------

    def listar_mapeamentos(self) -> List[RouteSystemMap]:
        """Retorna todos os mapeamentos de rota, ordenados por prioridade."""
        return self.db.query(RouteSystemMap).order_by(
            desc(RouteSystemMap.priority),
            RouteSystemMap.route_pattern
        ).all()

    def listar_mapeamentos_simples(self) -> List[RouteSystemMap]:
        """Retorna todos os mapeamentos sem ordenacao especifica."""
        return self.db.query(RouteSystemMap).all()

    def listar_nomes_sistemas(self) -> list[str]:
        """Retorna nomes de sistema distintos dos mapeamentos."""
        result = self.db.query(RouteSystemMap.system_name).distinct().all()
        return [m[0] for m in result if m[0]]

    def buscar_mapeamento_por_id(self, map_id: int) -> RouteSystemMap | None:
        """Busca mapeamento por ID."""
        return self.db.query(RouteSystemMap).filter(
            RouteSystemMap.id == map_id
        ).first()

    def buscar_mapeamento_por_pattern(
        self, route_pattern: str, excluir_id: int | None = None
    ) -> RouteSystemMap | None:
        """Busca mapeamento por pattern, opcionalmente excluindo um ID."""
        query = self.db.query(RouteSystemMap).filter(
            RouteSystemMap.route_pattern == route_pattern
        )
        if excluir_id is not None:
            query = query.filter(RouteSystemMap.id != excluir_id)
        return query.first()

    def criar_mapeamento(self, mapping: RouteSystemMap) -> RouteSystemMap:
        """Persiste novo mapeamento."""
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def atualizar_mapeamento(self, mapping: RouteSystemMap) -> RouteSystemMap:
        """Persiste alteracoes em mapeamento existente."""
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def remover_mapeamento(self, mapping: RouteSystemMap) -> None:
        """Remove mapeamento do banco."""
        self.db.delete(mapping)
        self.db.commit()

    # --------------------------------------------------
    # PerformanceLog — Leitura
    # --------------------------------------------------

    def listar_logs(
        self,
        start_date: datetime,
        route: str | None = None,
        action: str | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
        fetch_multiplier: int = 1,
    ) -> list[PerformanceLog]:
        """Retorna logs de performance com filtros basicos."""
        query = self.db.query(PerformanceLog).filter(
            PerformanceLog.created_at >= start_date
        )
        if route:
            query = query.filter(PerformanceLog.route.contains(route))
        if action:
            query = query.filter(PerformanceLog.action == action)
        if status:
            query = query.filter(PerformanceLog.status == status)

        query = query.order_by(desc(PerformanceLog.created_at))
        return query.offset(offset).limit(limit * fetch_multiplier).all()

    def contar_logs(self, start_date: datetime) -> int:
        """Conta logs a partir de uma data."""
        return self.db.query(func.count(PerformanceLog.id)).filter(
            PerformanceLog.created_at >= start_date
        ).scalar() or 0

    def obter_medias_tempo(self, start_date: datetime) -> dict:
        """Retorna medias de tempo por componente."""
        result = self.db.query(
            func.avg(PerformanceLog.total_ms).label('total'),
            func.avg(PerformanceLog.llm_request_ms).label('llm'),
            func.avg(PerformanceLog.db_total_ms).label('db'),
            func.avg(PerformanceLog.json_parse_ms).label('parse'),
        ).filter(
            PerformanceLog.created_at >= start_date
        ).first()
        return {
            'total': round(result.total or 0, 1),
            'llm': round(result.llm or 0, 1),
            'db': round(result.db or 0, 1),
            'parse': round(result.parse or 0, 1),
        }

    def listar_logs_por_total_ms(
        self, start_date: datetime, limit: int = 500
    ) -> list[PerformanceLog]:
        """Retorna logs ordenados por total_ms decrescente (para calculo de bottleneck)."""
        return self.db.query(PerformanceLog).filter(
            PerformanceLog.created_at >= start_date
        ).order_by(desc(PerformanceLog.total_ms)).limit(limit).all()

    def listar_erros_recentes(
        self, start_date: datetime, limit: int = 10
    ) -> list[PerformanceLog]:
        """Retorna erros recentes."""
        return self.db.query(PerformanceLog).filter(
            PerformanceLog.created_at >= start_date,
            PerformanceLog.status == 'error'
        ).order_by(desc(PerformanceLog.created_at)).limit(limit).all()

    def listar_actions_distintas(self) -> list[str]:
        """Retorna lista de actions distintas."""
        result = self.db.query(PerformanceLog.action).distinct().filter(
            PerformanceLog.action.isnot(None)
        ).all()
        return [r[0] for r in result if r[0]]

    def agrupar_rotas(
        self, start_date: datetime, limit: int = 20
    ) -> list[tuple]:
        """Retorna rotas agrupadas por contagem."""
        return self.db.query(
            PerformanceLog.route,
            func.count(PerformanceLog.id).label('count')
        ).filter(
            PerformanceLog.created_at >= start_date
        ).group_by(
            PerformanceLog.route
        ).order_by(
            desc('count')
        ).limit(limit).all()

    # --------------------------------------------------
    # PerformanceLog — Escrita
    # --------------------------------------------------

    def salvar_log(self, log: PerformanceLog) -> PerformanceLog:
        """Persiste um log de performance."""
        self.db.add(log)
        self.db.commit()
        return log

    # --------------------------------------------------
    # PerformanceLog — Cleanup
    # --------------------------------------------------

    def remover_logs_antigos(self, cutoff_date: datetime) -> int:
        """Remove logs anteriores a cutoff_date. Retorna qtd removida."""
        deleted = self.db.query(PerformanceLog).filter(
            PerformanceLog.created_at < cutoff_date
        ).delete(synchronize_session=False)
        self.db.commit()
        return deleted

    def contar_total_logs(self) -> int:
        """Conta total de logs na tabela."""
        return self.db.query(func.count(PerformanceLog.id)).scalar() or 0

    def buscar_id_corte(self, max_logs: int) -> int | None:
        """Busca o ID de corte para manter apenas max_logs registros."""
        result = self.db.query(PerformanceLog.id).order_by(
            desc(PerformanceLog.created_at)
        ).offset(max_logs).first()
        return result[0] if result else None

    def remover_logs_por_id(self, cutoff_id: int) -> int:
        """Remove logs com ID menor que cutoff_id. Retorna qtd removida."""
        deleted = self.db.query(PerformanceLog).filter(
            PerformanceLog.id < cutoff_id
        ).delete(synchronize_session=False)
        self.db.commit()
        return deleted


class GeminiLogsRepository:
    """Repository para queries de logs Gemini no router_gemini_logs.py."""

    def __init__(self, db: Session):
        self.db = db

    def buscar_thinking_level_por_sistema(
        self, sistema: str, start_date: datetime
    ) -> list[tuple]:
        """
        Retorna contagem agrupada por modulo e thinking_level
        para um sistema no periodo.
        """
        from admin.models_gemini_logs import GeminiApiLog

        return self.db.query(
            GeminiApiLog.modulo,
            GeminiApiLog.thinking_level,
            func.count(GeminiApiLog.id).label('count')
        ).filter(
            and_(
                GeminiApiLog.sistema == sistema,
                GeminiApiLog.created_at >= start_date,
                GeminiApiLog.success == True  # noqa: E712
            )
        ).group_by(
            GeminiApiLog.modulo,
            GeminiApiLog.thinking_level
        ).all()

    def buscar_request_perf_por_id(self, request_id: str):
        """Busca log de performance de request por request_id."""
        from admin.models_request_perf import RequestPerfLog

        return self.db.query(RequestPerfLog).filter(
            RequestPerfLog.request_id == request_id
        ).first()


# --------------------------------------------------
# Factory functions para injecao de dependencia
# --------------------------------------------------

def get_performance_repository(
    db: Session = Depends(get_db)
) -> PerformanceRepository:
    """Factory para injecao via Depends."""
    return PerformanceRepository(db)


def get_gemini_logs_repository(
    db: Session = Depends(get_db)
) -> GeminiLogsRepository:
    """Factory para injecao via Depends."""
    return GeminiLogsRepository(db)
