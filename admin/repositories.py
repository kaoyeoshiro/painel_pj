# -*- coding: utf-8 -*-
"""
Repositorios compartilhados do modulo admin.

ConfiguracaoIA e PromptConfig sao usados por multiplos sistemas.
Centralizar as queries evita repeticao de db.query(ConfiguracaoIA)
espalhadas por 7+ routers.
"""

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.repository_base import BaseRepository
from admin.models import ConfiguracaoIA, PromptConfig

logger = logging.getLogger(__name__)


class ConfiguracaoIARepository(BaseRepository[ConfiguracaoIA]):
    """Repositorio para configuracoes de IA."""

    model = ConfiguracaoIA

    def get_config(self, sistema: str, chave: str) -> ConfiguracaoIA | None:
        """Busca configuracao por sistema e chave."""
        return (
            self.query()
            .filter(
                ConfiguracaoIA.sistema == sistema,
                ConfiguracaoIA.chave == chave,
            )
            .first()
        )

    def get_valor(self, sistema: str, chave: str, default: str | None = None) -> str | None:
        """Retorna apenas o valor de uma configuracao, com fallback."""
        config = self.get_config(sistema, chave)
        return config.valor if config else default

    def list_by_sistema(self, sistema: str) -> list[ConfiguracaoIA]:
        """Lista todas as configuracoes de um sistema."""
        return (
            self.query()
            .filter(ConfiguracaoIA.sistema == sistema)
            .all()
        )


class PromptConfigRepository(BaseRepository[PromptConfig]):
    """Repositorio para configuracoes de prompts."""

    model = PromptConfig

    def get_active(self, sistema: str, tipo: str) -> PromptConfig | None:
        """Busca prompt ativo por sistema e tipo."""
        return (
            self.query()
            .filter(
                PromptConfig.sistema == sistema,
                PromptConfig.tipo == tipo,
                PromptConfig.is_active == True,
            )
            .first()
        )

    def list_by_sistema(self, sistema: str) -> list[PromptConfig]:
        """Lista todos os prompts de um sistema."""
        return (
            self.query()
            .filter(PromptConfig.sistema == sistema)
            .all()
        )


# ============================================
# Depends factories
# ============================================


def get_config_repo(
    db: Session = Depends(get_db),
) -> ConfiguracaoIARepository:
    """Factory para injecao do repositorio de configuracoes."""
    return ConfiguracaoIARepository(db)


def get_prompt_config_repo(
    db: Session = Depends(get_db),
) -> PromptConfigRepository:
    """Factory para injecao do repositorio de prompts."""
    return PromptConfigRepository(db)
