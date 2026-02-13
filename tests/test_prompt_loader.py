# tests/test_prompt_loader.py
"""
Testes para o servico de carregamento de prompts por grupo.

Cobre: carregamento por grupo, fallback global, listagem de tipos de peca,
duplicacao na migracao.
"""

import pytest
from unittest.mock import MagicMock, patch


# ========================================
# Fixtures e helpers
# ========================================

def _make_prompt_modulo(**kwargs):
    """Cria um mock de PromptModulo."""
    m = MagicMock()
    m.id = kwargs.get("id", 1)
    m.tipo = kwargs.get("tipo", "base")
    m.nome = kwargs.get("nome", "system_prompt")
    m.titulo = kwargs.get("titulo", "Prompt de Sistema")
    m.conteudo = kwargs.get("conteudo", "Conteudo do prompt")
    m.ativo = kwargs.get("ativo", True)
    m.ordem = kwargs.get("ordem", 0)
    m.group_id = kwargs.get("group_id", None)
    return m


def _make_prompt_group(**kwargs):
    """Cria um mock de PromptGroup."""
    g = MagicMock()
    g.id = kwargs.get("id", 1)
    g.slug = kwargs.get("slug", "ps")
    g.name = kwargs.get("name", "PS")
    return g


# ========================================
# Testes de carregar_prompt_sistema
# ========================================

class TestCarregarPromptSistema:
    """Testes para carregamento de prompts base (sistema)."""

    def test_carregar_base_com_grupo(self):
        """Carrega prompt base do grupo especifico."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_sistema

        modulo = _make_prompt_modulo(titulo="Base PS", conteudo="Instrucoes PS", group_id=1)

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [modulo]

        result = carregar_prompt_sistema(db, group_id=1)
        assert "Base PS" in result
        assert "Instrucoes PS" in result

    def test_carregar_base_fallback_global(self):
        """Quando grupo nao tem modulos, cai no fallback global."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_sistema

        modulo_global = _make_prompt_modulo(titulo="Base Global", conteudo="Instrucoes globais")

        db = MagicMock()
        # Primeira chamada (grupo): vazia. Segunda chamada (global): com modulo
        db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = [
            [],  # grupo: nada
            [modulo_global]  # fallback global
        ]

        result = carregar_prompt_sistema(db, group_id=5)
        assert "Base Global" in result

    def test_carregar_base_sem_grupo_retorna_global(self):
        """Sem group_id retorna modulos globais (retrocompat)."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_sistema

        modulo = _make_prompt_modulo(titulo="Global", conteudo="Prompt global")

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [modulo]

        result = carregar_prompt_sistema(db, group_id=None)
        assert "Global" in result

    def test_carregar_base_multiplos_modulos(self):
        """Multiplos modulos base sao concatenados."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_sistema

        m1 = _make_prompt_modulo(titulo="Identidade", conteudo="Voce e um advogado")
        m2 = _make_prompt_modulo(titulo="Formato", conteudo="Use linguagem formal")

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [m1, m2]

        result = carregar_prompt_sistema(db, group_id=1)
        assert "Identidade" in result
        assert "Formato" in result
        assert "Voce e um advogado" in result
        assert "Use linguagem formal" in result

    def test_carregar_base_grupo_vazio_retorna_vazio_se_sem_global(self):
        """Se grupo e global estao vazios, retorna string vazia."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_sistema

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = [
            [],  # grupo
            []   # global
        ]

        result = carregar_prompt_sistema(db, group_id=99)
        assert result == ""


# ========================================
# Testes de carregar_prompt_peca
# ========================================

class TestCarregarPromptPeca:
    """Testes para carregamento de prompts de peca."""

    def test_tipo_peca_none_retorna_vazio(self):
        """Se tipo_peca e None, retorna string vazia."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_peca

        db = MagicMock()
        result = carregar_prompt_peca(db, None, group_id=1)
        assert result == ""

    def test_carregar_peca_com_grupo(self):
        """Carrega peca do grupo especifico."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_peca

        modulo = _make_prompt_modulo(
            tipo="peca", nome="contestacao", titulo="Contestacao", conteudo="Estrutura", group_id=1
        )

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = modulo

        result = carregar_prompt_peca(db, "contestacao", group_id=1)
        assert "ESTRUTURA DA PECA" in result
        assert "Contestacao" in result

    def test_carregar_peca_fallback_global(self):
        """Peca nao encontrada no grupo cai no fallback global."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_peca

        modulo_global = _make_prompt_modulo(
            tipo="peca", nome="contestacao", titulo="Contestacao Global", conteudo="Global"
        )

        db = MagicMock()
        # Primeira chamada (grupo): None. Segunda chamada (global): modulo
        db.query.return_value.filter.return_value.first.side_effect = [None, modulo_global]

        result = carregar_prompt_peca(db, "contestacao", group_id=5)
        assert "Contestacao Global" in result

    def test_carregar_peca_inexistente_retorna_vazio(self):
        """Peca nao encontrada em nenhum lugar retorna vazio."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_peca

        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [None, None]

        result = carregar_prompt_peca(db, "tipo_inexistente", group_id=1)
        assert result == ""

    def test_carregar_peca_sem_grupo_retorna_global(self):
        """Sem group_id retorna peca global."""
        from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_peca

        modulo = _make_prompt_modulo(tipo="peca", nome="apelacao", titulo="Apelacao", conteudo="Estrut")

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = modulo

        result = carregar_prompt_peca(db, "apelacao", group_id=None)
        assert "Apelacao" in result


# ========================================
# Testes de listar_tipos_peca
# ========================================

class TestListarTiposPeca:
    """Testes para listagem de tipos de peca por grupo."""

    def test_listar_por_grupo(self):
        """Lista pecas do grupo especifico."""
        from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca

        modulo = _make_prompt_modulo(tipo="peca", nome="contestacao", titulo="Contestacao", conteudo="Descricao curta")

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [modulo]

        result = listar_tipos_peca(db, group_id=1)
        assert len(result) == 1
        assert result[0]["valor"] == "contestacao"
        assert result[0]["label"] == "Contestacao"

    def test_listar_sem_grupo_retorna_global(self):
        """Sem group_id retorna pecas globais."""
        from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca

        modulo = _make_prompt_modulo(tipo="peca", nome="apelacao", titulo="Apelacao", conteudo="Desc")

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [modulo]

        result = listar_tipos_peca(db, group_id=None)
        assert len(result) == 1
        assert result[0]["valor"] == "apelacao"

    def test_listar_fallback_quando_grupo_vazio(self):
        """Grupo sem pecas cai no fallback global."""
        from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca

        modulo_global = _make_prompt_modulo(tipo="peca", nome="recurso", titulo="Recurso", conteudo="Desc")

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = [
            [],  # grupo
            [modulo_global]  # global
        ]

        result = listar_tipos_peca(db, group_id=99)
        assert len(result) == 1
        assert result[0]["valor"] == "recurso"

    def test_descricao_truncada(self):
        """Descricao longa e truncada com reticencias."""
        from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca

        conteudo_longo = "X" * 200
        modulo = _make_prompt_modulo(tipo="peca", nome="x", titulo="X", conteudo=conteudo_longo)

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [modulo]

        result = listar_tipos_peca(db, group_id=1)
        assert result[0]["descricao"].endswith("...")
        assert len(result[0]["descricao"]) == 103  # 100 chars + "..."


# ========================================
# Testes de migracao
# ========================================

class TestMigracao:
    """Testes para a funcao de migracao migrate_per_group_prompts."""

    @patch("database.init_db.engine")
    def test_migracao_vincula_base_peca_ao_ps(self, mock_engine):
        """Modulos base/peca sem grupo sao vinculados ao PS."""
        from database.init_db import migrate_per_group_prompts

        grupo_ps = _make_prompt_group(id=1, slug="ps")
        modulo_base = _make_prompt_modulo(tipo="base", group_id=None)
        modulo_peca = _make_prompt_modulo(tipo="peca", group_id=None)

        db = MagicMock()

        mock_inspector = MagicMock()
        mock_inspector.get_unique_constraints.return_value = [
            {"name": "uq_prompt_modulo_group"}
        ]

        with patch("sqlalchemy.inspect", return_value=mock_inspector):
            # query(PromptGroup).filter(slug="ps").first() -> grupo_ps
            # query(PromptModulo).filter(tipo IN, group_id IS NULL).all() -> modulos sem grupo
            # query(PromptModulo).filter(tipo IN, group_id=ps).all() -> modulos do PS (para duplicar)
            # query(PromptGroup).filter(slug="pp").first() -> None (pula)
            # query(PromptGroup).filter(slug="detran").first() -> None (pula)
            db.query.return_value.filter.return_value.first.side_effect = [
                grupo_ps,  # busca PS
                None,  # busca PP (nao existe)
                None,  # busca DETRAN (nao existe)
            ]
            db.query.return_value.filter.return_value.all.side_effect = [
                [modulo_base, modulo_peca],  # modulos sem grupo
                [modulo_base, modulo_peca],  # modulos do PS (para duplicar)
            ]

            migrate_per_group_prompts(db)

            # Verifica que group_id foi setado para PS
            assert modulo_base.group_id == 1
            assert modulo_peca.group_id == 1

    @patch("database.init_db.engine")
    def test_migracao_idempotente(self, mock_engine):
        """Se modulos ja estao vinculados, nao duplica."""
        from database.init_db import migrate_per_group_prompts

        grupo_ps = _make_prompt_group(id=1, slug="ps")
        grupo_pp = _make_prompt_group(id=2, slug="pp")

        db = MagicMock()

        mock_inspector = MagicMock()
        mock_inspector.get_unique_constraints.return_value = [
            {"name": "uq_prompt_modulo_group"}
        ]

        with patch("sqlalchemy.inspect", return_value=mock_inspector):
            db.query.return_value.filter.return_value.first.side_effect = [
                grupo_ps,  # busca PS
                grupo_pp,  # busca PP
                None,  # busca DETRAN
            ]
            db.query.return_value.filter.return_value.all.side_effect = [
                [],  # modulos sem grupo (ja migrados)
                [],  # modulos do PS
            ]
            # PP ja tem modulos proprios
            db.query.return_value.filter.return_value.count.return_value = 3

            migrate_per_group_prompts(db)

            # Nao deve ter adicionado nada (db.add nao chamado)
            db.add.assert_not_called()
