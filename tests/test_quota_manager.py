# -*- coding: utf-8 -*-
"""
Testes do gerenciador de cotas de IA.

Verifica:
- Permite dentro do limite
- Bloqueia ao atingir limite
- Reset automatico em novo dia
- Admin tem limite maior
- Retorna remaining correto
"""

import sys
from datetime import date
from pathlib import Path
from unittest.mock import patch

import pytest

# Adiciona raiz do projeto ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.quota_manager import QuotaManager, DAILY_AI_LIMIT, DAILY_AI_LIMIT_ADMIN


class TestQuotaManager:
    """Testes do QuotaManager."""

    def _create_manager(self) -> QuotaManager:
        """Cria uma instancia limpa para cada teste."""
        return QuotaManager()

    def test_allows_within_limit(self):
        """Deve permitir requisicoes dentro do limite."""
        manager = self._create_manager()

        permitido, uso, limite = manager.check_and_increment(user_id=1, is_admin=False)

        assert permitido is True
        assert uso == 1
        assert limite == DAILY_AI_LIMIT

    def test_blocks_at_limit(self):
        """Deve bloquear ao atingir o limite."""
        manager = self._create_manager()

        # Consome todo o limite
        for i in range(DAILY_AI_LIMIT):
            permitido, _, _ = manager.check_and_increment(user_id=1, is_admin=False)
            assert permitido is True

        # Proximo deve ser bloqueado
        permitido, uso, limite = manager.check_and_increment(user_id=1, is_admin=False)
        assert permitido is False
        assert uso == DAILY_AI_LIMIT
        assert limite == DAILY_AI_LIMIT

    def test_admin_higher_limit(self):
        """Admin deve ter limite maior."""
        manager = self._create_manager()

        # Consome limite de usuario normal
        for i in range(DAILY_AI_LIMIT):
            manager.check_and_increment(user_id=1, is_admin=True)

        # Admin deve continuar permitido apos limite de usuario normal
        permitido, uso, limite = manager.check_and_increment(user_id=1, is_admin=True)
        assert permitido is True
        assert uso == DAILY_AI_LIMIT + 1
        assert limite == DAILY_AI_LIMIT_ADMIN

    def test_resets_on_new_day(self):
        """Deve resetar contadores em novo dia."""
        manager = self._create_manager()

        # Consome algum limite
        for _ in range(5):
            manager.check_and_increment(user_id=1, is_admin=False)

        # Simula mudanca de dia
        from datetime import timedelta
        tomorrow = date.today() + timedelta(days=1)
        with patch("utils.quota_manager.date") as mock_date:
            mock_date.today.return_value = tomorrow
            mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

            permitido, uso, limite = manager.check_and_increment(user_id=1, is_admin=False)
            assert permitido is True
            assert uso == 1  # Resetado

    def test_returns_correct_remaining(self):
        """get_usage deve retornar remaining correto."""
        manager = self._create_manager()

        # Consome 3 requisicoes
        for _ in range(3):
            manager.check_and_increment(user_id=42, is_admin=False)

        usage = manager.get_usage(user_id=42, is_admin=False)
        assert usage["used"] == 3
        assert usage["limit"] == DAILY_AI_LIMIT
        assert usage["remaining"] == DAILY_AI_LIMIT - 3

    def test_independent_users(self):
        """Cada usuario deve ter contagem independente."""
        manager = self._create_manager()

        manager.check_and_increment(user_id=1, is_admin=False)
        manager.check_and_increment(user_id=1, is_admin=False)
        manager.check_and_increment(user_id=2, is_admin=False)

        usage_1 = manager.get_usage(user_id=1)
        usage_2 = manager.get_usage(user_id=2)

        assert usage_1["used"] == 2
        assert usage_2["used"] == 1

    def test_new_user_zero_usage(self):
        """Usuario novo deve ter uso zero."""
        manager = self._create_manager()

        usage = manager.get_usage(user_id=999)
        assert usage["used"] == 0
        assert usage["remaining"] == DAILY_AI_LIMIT
