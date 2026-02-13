# -*- coding: utf-8 -*-
"""
Compat layer legado -> novo namespace de repositories.

Este módulo permanece para preservar imports existentes enquanto
o código migra para `app.repositories.sqlalchemy.pedido_calculo`.
"""

from app.repositories.sqlalchemy.pedido_calculo import (
    FeedbackPedidoCalculoRepository,
    GeracaoPedidoCalculoRepository,
    get_feedback_pedido_repo,
    get_geracao_pedido_repo,
)

__all__ = [
    "GeracaoPedidoCalculoRepository",
    "FeedbackPedidoCalculoRepository",
    "get_geracao_pedido_repo",
    "get_feedback_pedido_repo",
]
