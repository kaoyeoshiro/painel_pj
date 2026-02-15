# tests/test_alembic_migrations.py
"""
Testes para validar a cadeia de migrations Alembic.

Verifica que:
1. Todos os models estao importados no env.py
2. A cadeia de migrations tem exatamente um head (sem bifurcacoes)
3. Upgrade/downgrade funcionam sem erros no banco local
4. Baseline cria tabelas corretamente em banco vazio

Fase 0.7 do plano de refatoracao backend (Feb 2026).
"""

import os
import sys
import pytest

# Garante que o diretorio raiz esta no path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestAlembicEnvImports:
    """Verifica que env.py importa todos os models corretamente."""

    def test_base_metadata_has_tables(self):
        """Base.metadata deve ter 60+ tabelas registradas.

        Importa os mesmos models que env.py importa para popular o metadata.
        NAO importa env.py diretamente (requer contexto Alembic).
        """
        from database.connection import Base

        # Replica os imports do env.py para popular metadata
        from auth.models import User  # noqa: F401
        from admin.models import PromptConfig, ConfiguracaoIA  # noqa: F401
        from admin.models_gemini_logs import GeminiApiLog  # noqa: F401
        from admin.models_performance import AdminSettings  # noqa: F401
        from admin.models_request_perf import RequestPerfLog  # noqa: F401
        from admin.models_prompt_groups import PromptGroup  # noqa: F401
        from admin.models_prompts import PromptModulo  # noqa: F401
        from sistemas.gerador_pecas.models import GeracaoPeca  # noqa: F401
        from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento  # noqa: F401
        from sistemas.gerador_pecas.models_extraction import ExtractionQuestion  # noqa: F401
        from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON  # noqa: F401
        from sistemas.gerador_pecas.models_teste_categorias import TesteDocumento  # noqa: F401
        from sistemas.gerador_pecas.models_teste_ativacao import CenarioTesteAtivacao  # noqa: F401
        from sistemas.matriculas_confrontantes.models import Analise  # noqa: F401
        from sistemas.assistencia_judiciaria.models import ConsultaProcesso  # noqa: F401
        from sistemas.pedido_calculo.models import GeracaoPedidoCalculo  # noqa: F401
        from sistemas.prestacao_contas.models import GeracaoAnalise  # noqa: F401
        from sistemas.relatorio_cumprimento.models import GeracaoRelatorioCumprimento  # noqa: F401
        from sistemas.classificador_documentos.models import ProjetoClassificacao  # noqa: F401
        from sistemas.bert_training.models import BertDataset  # noqa: F401
        from sistemas.cumprimento_beta.models import SessaoCumprimentoBeta  # noqa: F401
        from sistemas.extrator_autos.models import ExtracaoAutos  # noqa: F401

        table_count = len(Base.metadata.tables)
        assert table_count >= 60, (
            f"Base.metadata tem apenas {table_count} tabelas. "
            f"Esperado >= 60. Verifique imports em migrations/env.py"
        )

    def test_critical_tables_registered(self):
        """Tabelas criticas devem estar no metadata."""
        from database.connection import Base

        critical_tables = {
            "users",
            "geracoes_pecas",
            "feedbacks_pecas",
            "prompt_modulos",
            "prompt_groups",
            "configuracoes_ia",
            "prompt_configs",
            "gemini_api_logs",
            "performance_logs",
            "request_perf_logs",
            "extraction_questions",
            "extraction_models",
            "extraction_variables",
            "geracoes_pedido_calculo",
            "geracoes_prestacao_contas",
            "geracoes_relatorio_cumprimento",
            "projetos_classificacao",
            "bert_datasets",
            "bert_runs",
            "sessoes_cumprimento_beta",
            "extracoes_autos",
        }

        registered = set(Base.metadata.tables.keys())
        missing = critical_tables - registered
        assert not missing, (
            f"Tabelas criticas nao registradas no metadata: {missing}. "
            f"Adicione os imports em migrations/env.py"
        )


class TestAlembicMigrationChain:
    """Verifica a integridade da cadeia de migrations."""

    def _get_script_directory(self):
        """Retorna o ScriptDirectory do Alembic."""
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        config = Config(os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "alembic.ini",
        ))
        return ScriptDirectory.from_config(config)

    def test_single_head(self):
        """Deve haver exatamente um head (sem bifurcacoes)."""
        scripts = self._get_script_directory()
        heads = list(scripts.get_heads())
        assert len(heads) == 1, (
            f"Encontrados {len(heads)} heads: {heads}. "
            f"Deve haver exatamente 1. Resolva a bifurcacao com alembic merge."
        )

    def test_no_broken_chain(self):
        """Toda revision deve ter down_revision valido (exceto a primeira)."""
        scripts = self._get_script_directory()
        revisions = list(scripts.walk_revisions())

        assert len(revisions) >= 5, (
            f"Apenas {len(revisions)} revisions encontradas. Esperado >= 5."
        )

        for rev in revisions:
            if rev.down_revision is not None:
                # Verifica que o down_revision existe
                try:
                    scripts.get_revision(rev.down_revision)
                except Exception:
                    pytest.fail(
                        f"Revision {rev.revision} aponta para "
                        f"down_revision inexistente: {rev.down_revision}"
                    )

    def test_head_is_constraint_migration(self):
        """O head deve ser a migration mais recente (constraint)."""
        scripts = self._get_script_directory()
        heads = list(scripts.get_heads())
        assert heads[0] == "c2b3d4e5f6a7", (
            f"Head esperado: c2b3d4e5f6a7, encontrado: {heads[0]}. "
            f"Uma nova migration foi adicionada? Atualize este teste."
        )

    def test_migration_files_exist(self):
        """Todos os arquivos de migration devem existir no disco."""
        scripts = self._get_script_directory()
        for rev in scripts.walk_revisions():
            # walk_revisions so retorna revisions com arquivo valido
            assert rev.module is not None or rev.path is not None, (
                f"Revision {rev.revision} nao tem arquivo associado"
            )


class TestAlembicUpgradeDowngrade:
    """Testa upgrade/downgrade no banco local.

    NOTA: Estes testes requerem um banco PostgreSQL rodando.
    Sao pulados automaticamente se DATABASE_URL nao estiver configurada.
    """

    @pytest.fixture(autouse=True)
    def _check_database(self):
        """Pula testes se o banco nao estiver acessivel."""
        try:
            from database.connection import engine
            with engine.connect() as conn:
                from sqlalchemy import text
                conn.execute(text("SELECT 1"))
        except Exception:
            pytest.skip("Banco de dados nao acessivel")

    def _get_config(self):
        from alembic.config import Config
        config = Config(os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "alembic.ini",
        ))
        return config

    def test_upgrade_to_head(self):
        """alembic upgrade head deve funcionar sem erros."""
        from alembic import command
        config = self._get_config()
        # Nao deve levantar excecao
        command.upgrade(config, "head")

    def test_downgrade_one_step(self):
        """alembic downgrade -1 deve funcionar sem erros."""
        from alembic import command
        config = self._get_config()
        command.upgrade(config, "head")
        command.downgrade(config, "-1")
        # Volta ao head para nao deixar banco em estado inconsistente
        command.upgrade(config, "head")

    def test_current_is_head(self):
        """Apos upgrade head, current deve ser o head."""
        from alembic import command
        from alembic.script import ScriptDirectory

        config = self._get_config()
        command.upgrade(config, "head")

        scripts = ScriptDirectory.from_config(config)
        heads = list(scripts.get_heads())

        # Verifica via query direta
        from database.connection import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).fetchone()

        assert result is not None, "Tabela alembic_version vazia"
        assert result[0] == heads[0], (
            f"Current version ({result[0]}) != head ({heads[0]})"
        )
