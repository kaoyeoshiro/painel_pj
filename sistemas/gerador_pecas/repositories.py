# -*- coding: utf-8 -*-
"""
Repositorios do sistema Gerador de Pecas.

Encapsula acesso a dados, substituindo db.query direto nos routers.
Cada repositorio gerencia um modelo (ou agregado) e expoe metodos
de dominio especificos.
"""

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.repository_base import BaseRepository
from sistemas.gerador_pecas.models import GeracaoPeca, FeedbackPeca, VersaoPeca

logger = logging.getLogger(__name__)


# ============================================
# Repositorios
# ============================================


class GeracaoPecaRepository(BaseRepository[GeracaoPeca]):
    """Repositorio para geracoes de pecas juridicas."""

    model = GeracaoPeca

    def find_by_user(self, usuario_id: int, limit: int = 50) -> list[GeracaoPeca]:
        """Lista geracoes do usuario, mais recentes primeiro."""
        return (
            self.query()
            .filter(GeracaoPeca.usuario_id == usuario_id)
            .order_by(GeracaoPeca.criado_em.desc())
            .limit(limit)
            .all()
        )

    def find_by_id_and_user(
        self, geracao_id: int, usuario_id: int
    ) -> GeracaoPeca | None:
        """Busca geracao por ID verificando propriedade do usuario."""
        return (
            self.query()
            .filter(
                GeracaoPeca.id == geracao_id,
                GeracaoPeca.usuario_id == usuario_id,
            )
            .first()
        )

    def find_latest_with_docs(self, numero_cnj: str) -> GeracaoPeca | None:
        """Busca geracao mais recente com documentos processados para um CNJ."""
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
    """Repositorio para feedbacks de pecas."""

    model = FeedbackPeca

    def find_by_geracao(self, geracao_id: int) -> FeedbackPeca | None:
        """Busca feedback de uma geracao especifica."""
        return (
            self.query()
            .filter(FeedbackPeca.geracao_id == geracao_id)
            .first()
        )


class VersaoPecaRepository(BaseRepository[VersaoPeca]):
    """Repositorio para versoes de pecas."""

    model = VersaoPeca

    def has_versions(self, geracao_id: int) -> bool:
        """Verifica se a geracao ja possui versoes."""
        return (
            self.query()
            .filter(VersaoPeca.geracao_id == geracao_id)
            .first()
            is not None
        )


# ============================================
# Depends factories para injecao via FastAPI
# ============================================


def get_geracao_repo(
    db: Session = Depends(get_db),
) -> GeracaoPecaRepository:
    """Factory para injecao do repositorio de geracoes."""
    return GeracaoPecaRepository(db)


def get_feedback_repo(
    db: Session = Depends(get_db),
) -> FeedbackPecaRepository:
    """Factory para injecao do repositorio de feedbacks."""
    return FeedbackPecaRepository(db)


def get_versao_repo(
    db: Session = Depends(get_db),
) -> VersaoPecaRepository:
    """Factory para injecao do repositorio de versoes."""
    return VersaoPecaRepository(db)
