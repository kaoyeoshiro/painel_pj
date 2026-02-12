# -*- coding: utf-8 -*-
"""
Repositorios do sistema Pedido de Calculo.

Encapsula acesso a dados, substituindo db.query direto nos routers.
"""

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.repository_base import BaseRepository
from sistemas.pedido_calculo.models import GeracaoPedidoCalculo, FeedbackPedidoCalculo

logger = logging.getLogger(__name__)


class GeracaoPedidoCalculoRepository(BaseRepository[GeracaoPedidoCalculo]):
    """Repositorio para geracoes de pedidos de calculo."""

    model = GeracaoPedidoCalculo

    def find_by_user(self, usuario_id: int, limit: int = 50) -> list[GeracaoPedidoCalculo]:
        """Lista geracoes do usuario, mais recentes primeiro."""
        return (
            self.query()
            .filter(GeracaoPedidoCalculo.usuario_id == usuario_id)
            .order_by(GeracaoPedidoCalculo.criado_em.desc())
            .limit(limit)
            .all()
        )

    def find_by_id_and_user(
        self, geracao_id: int, usuario_id: int
    ) -> GeracaoPedidoCalculo | None:
        """Busca geracao por ID verificando propriedade do usuario."""
        return (
            self.query()
            .filter(
                GeracaoPedidoCalculo.id == geracao_id,
                GeracaoPedidoCalculo.usuario_id == usuario_id,
            )
            .first()
        )

    def find_latest_by_cnj_and_user(
        self, numero_cnj: str, usuario_id: int
    ) -> GeracaoPedidoCalculo | None:
        """Busca geracao mais recente por CNJ e usuario."""
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
    """Repositorio para feedbacks de pedidos de calculo."""

    model = FeedbackPedidoCalculo

    def find_by_geracao(self, geracao_id: int) -> FeedbackPedidoCalculo | None:
        """Busca feedback de uma geracao especifica."""
        return (
            self.query()
            .filter(FeedbackPedidoCalculo.geracao_id == geracao_id)
            .first()
        )


# ============================================
# Depends factories
# ============================================


def get_geracao_pedido_repo(
    db: Session = Depends(get_db),
) -> GeracaoPedidoCalculoRepository:
    """Factory para injecao do repositorio de geracoes de pedido."""
    return GeracaoPedidoCalculoRepository(db)


def get_feedback_pedido_repo(
    db: Session = Depends(get_db),
) -> FeedbackPedidoCalculoRepository:
    """Factory para injecao do repositorio de feedbacks de pedido."""
    return FeedbackPedidoCalculoRepository(db)
