# -*- coding: utf-8 -*-
"""
Testes para os repositorios do modulo admin.

Testa imports, instanciacao e interface publica dos repositories.
Usa mock para db session (sem banco real).
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock

pytestmark = pytest.mark.unit


class TestImportsEInstanciacao:
    """Verifica que todos os repositories importam e instanciam corretamente."""

    def test_import_configuracao_ia_repository(self):
        from admin.repositories import ConfiguracaoIARepository
        assert ConfiguracaoIARepository is not None

    def test_import_prompt_config_repository(self):
        from admin.repositories import PromptConfigRepository
        assert PromptConfigRepository is not None

    def test_import_prompt_modulo_repository(self):
        from admin.repositories import PromptModuloRepository
        assert PromptModuloRepository is not None

    def test_import_prompt_group_repository(self):
        from admin.repositories import PromptGroupRepository
        assert PromptGroupRepository is not None

    def test_import_feedback_repository(self):
        from admin.repositories import FeedbackRepository
        assert FeedbackRepository is not None

    def test_instanciacao_config_repo(self):
        from admin.repositories import ConfiguracaoIARepository
        db = MagicMock()
        repo = ConfiguracaoIARepository(db)
        assert repo is not None
        assert repo.db is db

    def test_instanciacao_prompt_config_repo(self):
        from admin.repositories import PromptConfigRepository
        db = MagicMock()
        repo = PromptConfigRepository(db)
        assert repo is not None

    def test_instanciacao_prompt_modulo_repo(self):
        from admin.repositories import PromptModuloRepository
        db = MagicMock()
        repo = PromptModuloRepository(db)
        assert repo is not None

    def test_instanciacao_prompt_group_repo(self):
        from admin.repositories import PromptGroupRepository
        db = MagicMock()
        repo = PromptGroupRepository(db)
        assert repo is not None

    def test_instanciacao_feedback_repo(self):
        from admin.repositories import FeedbackRepository
        db = MagicMock()
        repo = FeedbackRepository(db)
        assert repo is not None


class TestInterfacePublica:
    """Verifica que os metodos publicos existem nos repositories."""

    def test_config_repo_tem_get_config(self):
        from admin.repositories import ConfiguracaoIARepository
        assert hasattr(ConfiguracaoIARepository, 'get_config')
        assert callable(getattr(ConfiguracaoIARepository, 'get_config'))

    def test_config_repo_tem_get_valor(self):
        from admin.repositories import ConfiguracaoIARepository
        assert hasattr(ConfiguracaoIARepository, 'get_valor')

    def test_config_repo_tem_upsert_config(self):
        from admin.repositories import ConfiguracaoIARepository
        assert hasattr(ConfiguracaoIARepository, 'upsert_config')

    def test_config_repo_tem_list_by_sistema(self):
        from admin.repositories import ConfiguracaoIARepository
        assert hasattr(ConfiguracaoIARepository, 'list_by_sistema')

    def test_prompt_config_repo_tem_get_active(self):
        from admin.repositories import PromptConfigRepository
        assert hasattr(PromptConfigRepository, 'get_active')

    def test_prompt_modulo_repo_tem_get_distinct_categorias(self):
        from admin.repositories import PromptModuloRepository
        assert hasattr(PromptModuloRepository, 'get_distinct_categorias')

    def test_feedback_repo_tem_get_excluded_user_ids(self):
        from admin.repositories import FeedbackRepository
        assert hasattr(FeedbackRepository, 'get_excluded_user_ids')

    def test_feedback_repo_tem_get_avaliacoes_por_sistema(self):
        from admin.repositories import FeedbackRepository
        assert hasattr(FeedbackRepository, 'get_avaliacoes_por_sistema')


class TestConfiguracaoIARepositoryMetodos:
    """Testa metodos do ConfiguracaoIARepository com mock."""

    def test_get_valor_retorna_default_quando_nenhum(self):
        from admin.repositories import ConfiguracaoIARepository
        db = MagicMock()
        repo = ConfiguracaoIARepository(db)

        # Mock: query chain retorna None (config não encontrada)
        db.query.return_value.filter.return_value.first.return_value = None

        resultado = repo.get_valor("sistema_teste", "chave_teste", default="fallback")
        assert resultado == "fallback"

    def test_get_valor_retorna_valor_quando_existe(self):
        from admin.repositories import ConfiguracaoIARepository
        db = MagicMock()
        repo = ConfiguracaoIARepository(db)

        # Mock: config encontrada
        mock_config = MagicMock()
        mock_config.valor = "valor_real"
        db.query.return_value.filter.return_value.first.return_value = mock_config

        resultado = repo.get_valor("sistema_teste", "chave_teste", default="fallback")
        assert resultado == "valor_real"


class TestFeedbackRepositoryMetodos:
    """Testa metodos do FeedbackRepository com mock."""

    def test_get_avaliacoes_por_sistema_sistema_invalido(self):
        from admin.repositories import FeedbackRepository
        db = MagicMock()
        repo = FeedbackRepository(db)

        resultado = repo.get_avaliacoes_por_sistema("sistema_inexistente", ids_excluir=[])
        assert resultado == []
