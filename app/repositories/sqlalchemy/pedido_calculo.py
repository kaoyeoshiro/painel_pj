# -*- coding: utf-8 -*-
"""
Repositórios SQLAlchemy do domínio Pedido de Cálculo.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.repositories.sqlalchemy.base import BaseRepository
from database.connection import get_db
from sistemas.pedido_calculo.models import FeedbackPedidoCalculo, GeracaoPedidoCalculo


class GeracaoPedidoCalculoRepository(BaseRepository[GeracaoPedidoCalculo]):
    """Repositório para gerações de pedido de cálculo."""

    model = GeracaoPedidoCalculo

    def find_by_user(self, usuario_id: int, limit: int = 50) -> list[GeracaoPedidoCalculo]:
        return (
            self.query()
            .filter(GeracaoPedidoCalculo.usuario_id == usuario_id)
            .order_by(GeracaoPedidoCalculo.criado_em.desc())
            .limit(limit)
            .all()
        )

    def find_by_id_and_user(
        self,
        geracao_id: int,
        usuario_id: int,
    ) -> GeracaoPedidoCalculo | None:
        return (
            self.query()
            .filter(
                GeracaoPedidoCalculo.id == geracao_id,
                GeracaoPedidoCalculo.usuario_id == usuario_id,
            )
            .first()
        )

    def find_latest_by_cnj_and_user(
        self,
        numero_cnj: str,
        usuario_id: int,
    ) -> GeracaoPedidoCalculo | None:
        return (
            self.query()
            .filter(
                GeracaoPedidoCalculo.numero_cnj == numero_cnj,
                GeracaoPedidoCalculo.usuario_id == usuario_id,
            )
            .order_by(GeracaoPedidoCalculo.criado_em.desc())
            .first()
        )


class FeedbackPedidoCalculoRepository(BaseRepository[FeedbackPedidoCalculo]):
    """Repositório para feedbacks de pedido de cálculo."""

    model = FeedbackPedidoCalculo

    def find_by_geracao(self, geracao_id: int) -> FeedbackPedidoCalculo | None:
        return (
            self.query()
            .filter(FeedbackPedidoCalculo.geracao_id == geracao_id)
            .first()
        )


def get_geracao_pedido_repo(
    db: Session = Depends(get_db),
) -> GeracaoPedidoCalculoRepository:
    return GeracaoPedidoCalculoRepository(db)


def get_feedback_pedido_repo(
    db: Session = Depends(get_db),
) -> FeedbackPedidoCalculoRepository:
    return FeedbackPedidoCalculoRepository(db)


__all__ = [
    "GeracaoPedidoCalculoRepository",
    "FeedbackPedidoCalculoRepository",
    "get_geracao_pedido_repo",
    "get_feedback_pedido_repo",
]

