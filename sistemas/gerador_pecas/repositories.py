# -*- coding: utf-8 -*-
"""
Compat layer legado -> novo namespace de repositories.

Este módulo permanece para preservar imports existentes enquanto
o código migra para `app.repositories.sqlalchemy.gerador_pecas`.
"""

from app.repositories.sqlalchemy.gerador_pecas import (
    CategoriaResumoJSONRepository,
    FeedbackPecaRepository,
    GeracaoPecaRepository,
    PromptGroupReadRepository,
    PromptModuloReadRepository,
    PromptSubcategoriaReadRepository,
    PromptSubgroupReadRepository,
    VersaoPecaRepository,
    get_feedback_repo,
    get_geracao_repo,
    get_versao_repo,
)

__all__ = [
    "GeracaoPecaRepository",
    "FeedbackPecaRepository",
    "VersaoPecaRepository",
    "PromptGroupReadRepository",
    "PromptSubgroupReadRepository",
    "PromptSubcategoriaReadRepository",
    "PromptModuloReadRepository",
    "CategoriaResumoJSONRepository",
    "get_geracao_repo",
    "get_feedback_repo",
    "get_versao_repo",
]
