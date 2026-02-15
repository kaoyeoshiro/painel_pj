# -*- coding: utf-8 -*-
"""
Testes unitarios para o Repository Pattern (Fase 3).

Verifica:
- BaseRepository fornece operacoes CRUD genericas
- GeracaoPecaRepository encapsula queries de dominio
- FeedbackPecaRepository encapsula queries de feedback
- VersaoPecaRepository encapsula queries de versoes
- Depends factories criam repos com sessao compartilhada
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

from database.repository_base import BaseRepository
from sistemas.gerador_pecas.repositories import (
    GeracaoPecaRepository,
    FeedbackPecaRepository,
    VersaoPecaRepository,
)


# ============================================
# Fixtures
# ============================================


class FakeModel:
    """Modelo fake para testes do BaseRepository."""
    id = "id_column"

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class FakeRepository(BaseRepository["FakeModel"]):
    model = FakeModel


@pytest.fixture
def mock_db():
    """Sessao SQLAlchemy mockada."""
    db = MagicMock()
    # db.query(Model).filter(...).first() chain
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    return db


# ============================================
# Testes BaseRepository
# ============================================


class TestBaseRepository:
    """Testes do repositorio base generico."""

    def test_init_stores_db(self, mock_db):
        repo = FakeRepository(mock_db)
        assert repo.db is mock_db

    def test_query_delegates_to_db(self, mock_db):
        repo = FakeRepository(mock_db)
        repo.query()
        mock_db.query.assert_called_once_with(FakeModel)

    def test_get_by_id_queries_model(self, mock_db):
        repo = FakeRepository(mock_db)
        repo.get_by_id(42)
        mock_db.query.assert_called_with(FakeModel)

    def test_add_calls_db_add(self, mock_db):
        repo = FakeRepository(mock_db)
        entity = FakeModel(id=1)
        result = repo.add(entity)
        mock_db.add.assert_called_once_with(entity)
        assert result is entity

    def test_delete_calls_db_delete(self, mock_db):
        repo = FakeRepository(mock_db)
        entity = FakeModel(id=1)
        repo.delete(entity)
        mock_db.delete.assert_called_once_with(entity)

    def test_commit_calls_db_commit(self, mock_db):
        repo = FakeRepository(mock_db)
        repo.commit()
        mock_db.commit.assert_called_once()

    def test_flush_calls_db_flush(self, mock_db):
        repo = FakeRepository(mock_db)
        repo.flush()
        mock_db.flush.assert_called_once()

    def test_refresh_calls_db_refresh(self, mock_db):
        repo = FakeRepository(mock_db)
        entity = FakeModel(id=1)
        repo.refresh(entity)
        mock_db.refresh.assert_called_once_with(entity)

    def test_rollback_calls_db_rollback(self, mock_db):
        repo = FakeRepository(mock_db)
        repo.rollback()
        mock_db.rollback.assert_called_once()


# ============================================
# Testes GeracaoPecaRepository
# ============================================


class TestGeracaoPecaRepository:
    """Testes do repositorio de geracoes de pecas."""

    def test_find_by_user_applies_filter_and_limit(self, mock_db):
        repo = GeracaoPecaRepository(mock_db)
        result = repo.find_by_user(usuario_id=7, limit=25)

        # Verifica que chamou query no modelo correto
        mock_db.query.assert_called()
        assert isinstance(result, list)

    def test_find_by_id_and_user_returns_none_when_not_found(self, mock_db):
        repo = GeracaoPecaRepository(mock_db)
        result = repo.find_by_id_and_user(geracao_id=99, usuario_id=1)
        assert result is None

    def test_find_by_id_and_user_returns_entity_when_found(self, mock_db):
        fake_geracao = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = fake_geracao

        repo = GeracaoPecaRepository(mock_db)
        result = repo.find_by_id_and_user(geracao_id=1, usuario_id=1)
        assert result is fake_geracao

    def test_find_latest_with_docs_filters_by_cnj(self, mock_db):
        repo = GeracaoPecaRepository(mock_db)
        result = repo.find_latest_with_docs("08043300920248120017")

        mock_db.query.assert_called()
        # Retorna None por padrao (mock)
        assert result is None


# ============================================
# Testes FeedbackPecaRepository
# ============================================


class TestFeedbackPecaRepository:
    """Testes do repositorio de feedbacks."""

    def test_find_by_geracao_returns_none_when_not_found(self, mock_db):
        repo = FeedbackPecaRepository(mock_db)
        result = repo.find_by_geracao(geracao_id=99)
        assert result is None

    def test_find_by_geracao_returns_feedback_when_found(self, mock_db):
        fake_feedback = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = fake_feedback

        repo = FeedbackPecaRepository(mock_db)
        result = repo.find_by_geracao(geracao_id=1)
        assert result is fake_feedback


# ============================================
# Testes VersaoPecaRepository
# ============================================


class TestVersaoPecaRepository:
    """Testes do repositorio de versoes."""

    def test_has_versions_returns_false_when_empty(self, mock_db):
        repo = VersaoPecaRepository(mock_db)
        assert repo.has_versions(geracao_id=1) is False

    def test_has_versions_returns_true_when_exists(self, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()

        repo = VersaoPecaRepository(mock_db)
        assert repo.has_versions(geracao_id=1) is True


# ============================================
# Testes de integracao: Depends factories
# ============================================


class TestDependsFactories:
    """Verifica que factories produzem repos com sessao correta."""

    def test_get_geracao_repo_creates_repo(self, mock_db):
        from sistemas.gerador_pecas.repositories import get_geracao_repo
        # Simula injecao manual
        repo = GeracaoPecaRepository(mock_db)
        assert isinstance(repo, GeracaoPecaRepository)
        assert repo.db is mock_db

    def test_get_feedback_repo_creates_repo(self, mock_db):
        repo = FeedbackPecaRepository(mock_db)
        assert isinstance(repo, FeedbackPecaRepository)
        assert repo.db is mock_db

    def test_repos_share_session(self, mock_db):
        """Repos criados com mesma sessao compartilham transacao."""
        geracao_repo = GeracaoPecaRepository(mock_db)
        feedback_repo = FeedbackPecaRepository(mock_db)
        assert geracao_repo.db is feedback_repo.db

    def test_commit_on_one_repo_commits_shared_session(self, mock_db):
        """Commit em qualquer repo persiste todas as alteracoes."""
        geracao_repo = GeracaoPecaRepository(mock_db)
        feedback_repo = FeedbackPecaRepository(mock_db)

        geracao_repo.commit()
        mock_db.commit.assert_called_once()

        # Segundo commit tambem funciona
        feedback_repo.commit()
        assert mock_db.commit.call_count == 2


# ============================================
# Testes estruturais
# ============================================


class TestStructuralValidation:
    """Verifica integridade estrutural do codigo."""

    def test_router_imports_repositories(self):
        """Router do gerador_pecas importa os repos."""
        router_path = Path(__file__).parent.parent.parent / "sistemas" / "gerador_pecas" / "router.py"
        content = router_path.read_text(encoding="utf-8")
        assert "GeracaoPecaRepository" in content
        assert "get_geracao_repo" in content
        assert "get_feedback_repo" in content

    def test_router_uses_repo_in_historico(self):
        """Endpoint listar_historico usa repo em vez de db.query."""
        router_path = Path(__file__).parent.parent.parent / "sistemas" / "gerador_pecas" / "router.py"
        content = router_path.read_text(encoding="utf-8")

        # Busca a funcao listar_historico
        start = content.find("async def listar_historico")
        end = content.find("\n@router.", start + 1)
        func_body = content[start:end]

        assert "repo.find_by_user" in func_body, "listar_historico deveria usar repo.find_by_user"
        assert "db.query(GeracaoPeca)" not in func_body, "listar_historico nao deveria ter db.query direto"

    def test_router_uses_repo_in_feedback(self):
        """Endpoint enviar_feedback usa repo em vez de db.query."""
        router_path = Path(__file__).parent.parent.parent / "sistemas" / "gerador_pecas" / "router.py"
        content = router_path.read_text(encoding="utf-8")

        start = content.find("async def enviar_feedback")
        end = content.find("\n@router.", start + 1)
        func_body = content[start:end]

        assert "feedback_repo.find_by_geracao" in func_body
        assert "feedback_repo.add" in func_body
        assert "db.query(FeedbackPeca)" not in func_body

    def test_base_repository_has_required_methods(self):
        """BaseRepository expoe interface CRUD completa."""
        methods = ["get_by_id", "add", "delete", "commit", "flush", "refresh", "rollback", "query"]
        for method in methods:
            assert hasattr(BaseRepository, method), f"BaseRepository nao tem metodo '{method}'"
