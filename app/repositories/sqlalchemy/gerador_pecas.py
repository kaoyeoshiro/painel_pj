# -*- coding: utf-8 -*-
"""
Repositórios SQLAlchemy do domínio Gerador de Peças.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.repositories.sqlalchemy.base import BaseRepository
from database.connection import get_db
from sistemas.gerador_pecas.models import FeedbackPeca, GeracaoPeca, VersaoPeca


class GeracaoPecaRepository(BaseRepository[GeracaoPeca]):
    """Repositório para gerações de peças jurídicas."""

    model = GeracaoPeca

    def find_by_user(self, usuario_id: int, limit: int = 50) -> list[GeracaoPeca]:
        return (
            self.query()
            .filter(GeracaoPeca.usuario_id == usuario_id)
            .order_by(GeracaoPeca.criado_em.desc())
            .limit(limit)
            .all()
        )

    def find_by_id_and_user(self, geracao_id: int, usuario_id: int) -> GeracaoPeca | None:
        return (
            self.query()
            .filter(
                GeracaoPeca.id == geracao_id,
                GeracaoPeca.usuario_id == usuario_id,
            )
            .first()
        )

    def find_latest_with_docs(self, numero_cnj: str) -> GeracaoPeca | None:
        return (
            self.query()
            .filter(
                GeracaoPeca.numero_cnj == numero_cnj,
                GeracaoPeca.documentos_processados.isnot(None),
            )
            .order_by(GeracaoPeca.criado_em.desc())
            .first()
        )


class FeedbackPecaRepository(BaseRepository[FeedbackPeca]):
    """Repositório para feedbacks de peças."""

    model = FeedbackPeca

    def find_by_geracao(self, geracao_id: int) -> FeedbackPeca | None:
        return (
            self.query()
            .filter(FeedbackPeca.geracao_id == geracao_id)
            .first()
        )


class VersaoPecaRepository(BaseRepository[VersaoPeca]):
    """Repositório para versões de peças."""

    model = VersaoPeca

    def has_versions(self, geracao_id: int) -> bool:
        return (
            self.query()
            .filter(VersaoPeca.geracao_id == geracao_id)
            .first()
            is not None
        )


def get_geracao_repo(db: Session = Depends(get_db)) -> GeracaoPecaRepository:
    return GeracaoPecaRepository(db)


def get_feedback_repo(db: Session = Depends(get_db)) -> FeedbackPecaRepository:
    return FeedbackPecaRepository(db)


def get_versao_repo(db: Session = Depends(get_db)) -> VersaoPecaRepository:
    return VersaoPecaRepository(db)


__all__ = [
    "GeracaoPecaRepository",
    "FeedbackPecaRepository",
    "VersaoPecaRepository",
    "get_geracao_repo",
    "get_feedback_repo",
    "get_versao_repo",
]

