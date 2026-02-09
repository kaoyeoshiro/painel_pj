# -*- coding: utf-8 -*-
"""
Gerenciador de cotas de uso de IA por usuario.

SECURITY (LLM10:2025 - Unbounded Consumption): Limita o numero de requisicoes
de IA por usuario/dia para prevenir custos descontrolados.

Configuracao via variaveis de ambiente:
- DAILY_AI_LIMIT: Limite diario para usuarios normais (default: 100)
- DAILY_AI_LIMIT_ADMIN: Limite diario para admins (default: 500)

Uso:
    from utils.quota_manager import quota_manager

    permitido, uso, limite = quota_manager.check_and_increment(user_id, is_admin)
    if not permitido:
        raise HTTPException(status_code=429, detail=f"Limite diario de {limite} atingido.")
"""

import logging
import os
from datetime import date
from threading import Lock
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

# Limites diarios (configuraveis via env vars)
DAILY_AI_LIMIT: int = int(os.getenv("DAILY_AI_LIMIT", "100"))
DAILY_AI_LIMIT_ADMIN: int = int(os.getenv("DAILY_AI_LIMIT_ADMIN", "500"))


class QuotaManager:
    """
    Gerenciador de cotas de IA em memoria.

    Thread-safe via Lock. Reset automatico a cada novo dia.
    """

    def __init__(self):
        self._usage: Dict[int, int] = {}  # user_id -> contagem
        self._current_date: date = date.today()
        self._lock = Lock()

    def _maybe_reset(self) -> None:
        """Reseta contadores se mudou o dia."""
        today = date.today()
        if today != self._current_date:
            logger.info(
                "Reset de cotas de IA: %s -> %s (%d usuarios)",
                self._current_date,
                today,
                len(self._usage),
            )
            self._usage.clear()
            self._current_date = today

    def check_and_increment(
        self, user_id: int, is_admin: bool = False
    ) -> Tuple[bool, int, int]:
        """
        Verifica cota e incrementa uso se permitido.

        Args:
            user_id: ID do usuario
            is_admin: Se o usuario e admin (limite maior)

        Returns:
            Tupla (permitido, uso_atual, limite)
        """
        limit = DAILY_AI_LIMIT_ADMIN if is_admin else DAILY_AI_LIMIT

        with self._lock:
            self._maybe_reset()

            current = self._usage.get(user_id, 0)

            if current >= limit:
                logger.warning(
                    "SECURITY: Cota de IA atingida para user_id=%d (%d/%d)",
                    user_id,
                    current,
                    limit,
                )
                return False, current, limit

            self._usage[user_id] = current + 1
            return True, current + 1, limit

    def get_usage(self, user_id: int, is_admin: bool = False) -> dict:
        """
        Retorna uso atual do usuario.

        Args:
            user_id: ID do usuario
            is_admin: Se o usuario e admin

        Returns:
            {"used": int, "limit": int, "remaining": int}
        """
        limit = DAILY_AI_LIMIT_ADMIN if is_admin else DAILY_AI_LIMIT

        with self._lock:
            self._maybe_reset()
            used = self._usage.get(user_id, 0)

        return {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
        }


# Singleton
quota_manager = QuotaManager()


async def check_ai_quota(current_user) -> None:
    """
    Dependencia para verificar cota de IA antes de processar.

    Uso nos endpoints:
        from utils.quota_manager import check_ai_quota
        ...
        await check_ai_quota(current_user)

    Raises:
        HTTPException(429) se o limite diario foi atingido.
    """
    from fastapi import HTTPException

    permitido, uso, limite = quota_manager.check_and_increment(
        user_id=current_user.id,
        is_admin=getattr(current_user, "role", "") == "admin",
    )

    if not permitido:
        raise HTTPException(
            status_code=429,
            detail=f"Limite diário de {limite} requisições de IA atingido. Uso atual: {uso}/{limite}.",
        )
