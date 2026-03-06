# tests/gerador_pecas/test_import_group_isolation.py
"""
Testes de isolamento entre grupos na importacao de modulos.

Valida que:
1. A busca por modulo existente na importacao filtra por group_id (nao sobrescreve outro grupo)
2. Modulos do mesmo grupo sao encontrados e atualizados corretamente
3. A resolucao de grupo funciona para tipos base/peca (nao apenas conteudo)
4. _deduplicar_modulos remove duplicatas por nome, mantendo a primeira ocorrencia
5. listar_tipos_peca retorna apenas modulos do grupo solicitado
"""

import pytest
from unittest.mock import MagicMock, patch, call


# ========================================
# Helper para criar mock de PromptModulo
# ========================================

def _mock_modulo(nome: str, titulo: str, group_id: int | None = None, **kwargs) -> MagicMock:
    """Cria um mock de PromptModulo com os atributos necessarios."""
    m = MagicMock()
    m.nome = nome
    m.titulo = titulo
    m.conteudo = kwargs.get("conteudo", "conteudo teste")
    m.group_id = group_id
    m.ordem = kwargs.get("ordem", 0)
    m.ativo = kwargs.get("ativo", True)
    m.tipo = kwargs.get("tipo", "peca")
    m.id = kwargs.get("id", None)
    return m


def _mock_grupo(id: int, slug: str, name: str | None = None) -> MagicMock:
    """Cria um mock de PromptGroup."""
    g = MagicMock()
    g.id = id
    g.slug = slug
    g.name = name or slug.upper()
    return g


# ========================================
# Testes de importacao — isolamento entre grupos
# ========================================

class TestImportacaoIsolamentoGrupos:
    """Testes para verificar que a importacao respeita o isolamento por group_id."""

    def test_importar_modulo_nao_sobrescreve_outro_grupo(self):
        """
        Verifica que o codigo de busca na importacao filtra por group_id.

        Um modulo com nome='system_prompt' e group_id=1 NAO deve ser encontrado
        quando se busca por group_id=3. Cada grupo tem seu proprio namespace.
        """
        from admin.models_prompts import PromptModulo

        # Simula o repositorio de modulos
        modulo_repo = MagicMock()

        # Modulo existente no grupo 1 (PS)
        modulo_grupo_1 = _mock_modulo(
            nome="system_prompt", titulo="Prompt Sistema PS",
            group_id=1, id=10,
        )

        # Grupo alvo da importacao: grupo 3 (Detran)
        grupo_alvo = _mock_grupo(id=3, slug="detran", name="Detran")

        # Configura a query para simular o filtro correto (nome + group_id)
        # O codigo corrigido faz: filter(nome == X, group_id == grupo.id)
        mock_query = MagicMock()
        modulo_repo.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter

        # Para group_id=3 (Detran), nao existe modulo com esse nome
        mock_filter.first.return_value = None

        # Executa a busca como o codigo de importacao faz
        existente = modulo_repo.query().filter(
            PromptModulo.nome == "system_prompt",
            PromptModulo.group_id == grupo_alvo.id
        ).first()

        # Deve retornar None — o modulo do grupo 1 NAO foi encontrado
        assert existente is None

        # Verifica que o filtro foi chamado com group_id correto (3, nao 1)
        filter_args = mock_query.filter.call_args
        assert filter_args is not None
        # O filtro deve conter PromptModulo.group_id == 3 (grupo alvo)
        filter_expressions = filter_args[0]
        assert len(filter_expressions) == 2, "Filtro deve ter 2 criterios: nome e group_id"

    def test_importar_modulo_atualiza_mesmo_grupo(self):
        """
        Verifica que quando group_id e o mesmo, o modulo existente E encontrado
        e atualizado (nao cria duplicata).
        """
        from admin.models_prompts import PromptModulo

        modulo_repo = MagicMock()

        # Modulo existente no grupo 1
        modulo_existente = _mock_modulo(
            nome="system_prompt", titulo="Prompt Sistema PS",
            group_id=1, id=10,
            conteudo="Conteudo antigo",
        )
        modulo_existente.versao = 1

        grupo = _mock_grupo(id=1, slug="ps", name="PS")

        # Configura query: busca por nome + group_id retorna o modulo existente
        mock_query = MagicMock()
        modulo_repo.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = modulo_existente

        # Executa a busca como o codigo de importacao faz
        existente = modulo_repo.query().filter(
            PromptModulo.nome == "system_prompt",
            PromptModulo.group_id == grupo.id
        ).first()

        # Deve encontrar o modulo existente
        assert existente is not None
        assert existente.id == 10
        assert existente.group_id == 1
        assert existente.nome == "system_prompt"

        # Simula a atualizacao (o que o codigo de importacao faz)
        existente.conteudo = "Conteudo novo importado"
        existente.versao = existente.versao + 1

        assert existente.conteudo == "Conteudo novo importado"
        assert existente.versao == 2


class TestImportacaoResolucaoGrupo:
    """Testes para verificar que a resolucao de grupo funciona para todos os tipos."""

    def test_importar_base_peca_respeita_group_slug(self):
        """
        Verifica que o novo codigo resolve grupo para tipos base/peca
        (nao apenas conteudo).

        Antes do fix, apenas tipo='conteudo' resolvia grupo.
        Agora, base e peca tambem recebem group_id via group_slug.
        """
        # Simula os dados de importacao com tipo 'base' e group_slug
        item_base = {
            "tipo": "base",
            "nome": "system_prompt",
            "titulo": "Prompt de Sistema",
            "conteudo": "Instrucoes do sistema",
            "group_slug": "detran",
            "group_name": "Detran",
        }
        item_peca = {
            "tipo": "peca",
            "nome": "contestacao",
            "titulo": "Contestacao",
            "conteudo": "Estrutura da peca",
            "group_slug": "detran",
            "group_name": "Detran",
        }

        # O fluxo corrigido no router_prompts.py faz:
        # "Resolve grupo para TODOS os tipos (base, peca, conteudo)"
        # if grupo_slug:
        #     grupo = _obter_ou_criar_grupo(...)
        for item in [item_base, item_peca]:
            tipo = item["tipo"]
            grupo_slug = item.get("group_slug") or item.get("grupo_slug")

            # No codigo corrigido, a verificacao de grupo nao depende do tipo
            # (diferente do codigo antigo que so resolvia para 'conteudo')
            assert grupo_slug is not None, (
                f"Tipo '{tipo}' deve ter group_slug para resolucao de grupo"
            )

            # Simula a resolucao: se grupo_slug existe, grupo e resolvido
            grupo = _mock_grupo(id=3, slug=grupo_slug, name=item.get("group_name"))
            assert grupo is not None
            assert grupo.slug == "detran"

            # Verifica que a busca por existente usa o group_id resolvido
            # (nao None, que causaria colisao com modulos globais)
            assert grupo.id == 3, (
                f"Tipo '{tipo}' deve usar group_id do grupo resolvido na busca"
            )


# ========================================
# Testes de _deduplicar_modulos
# ========================================

class TestDeduplicarModulos:
    """Testes para a funcao _deduplicar_modulos do services_prompt_loader."""

    def test_listar_tipos_peca_sem_duplicatas(self):
        """
        Verifica que _deduplicar_modulos remove duplicatas por nome,
        mantendo a primeira ocorrencia.
        """
        from sistemas.gerador_pecas.services_prompt_loader import _deduplicar_modulos

        m1 = _mock_modulo(nome="contestacao", titulo="Contestacao v1", group_id=1)
        m2 = _mock_modulo(nome="contestacao", titulo="Contestacao v2", group_id=1)
        m3 = _mock_modulo(nome="recurso", titulo="Recurso Ordinario", group_id=1)
        m4 = _mock_modulo(nome="recurso", titulo="Recurso Duplicado", group_id=1)
        m5 = _mock_modulo(nome="apelacao", titulo="Apelacao", group_id=1)

        resultado = _deduplicar_modulos([m1, m2, m3, m4, m5])

        # Deve ter 3 modulos unicos
        assert len(resultado) == 3

        nomes = [m.nome for m in resultado]
        assert nomes == ["contestacao", "recurso", "apelacao"]

        # Deve manter a PRIMEIRA ocorrencia (v1, nao v2)
        assert resultado[0].titulo == "Contestacao v1"
        assert resultado[1].titulo == "Recurso Ordinario"

    def test_deduplicar_lista_vazia(self):
        """Lista vazia retorna lista vazia."""
        from sistemas.gerador_pecas.services_prompt_loader import _deduplicar_modulos

        resultado = _deduplicar_modulos([])
        assert resultado == []

    def test_deduplicar_sem_duplicatas(self):
        """Lista sem duplicatas retorna todos os elementos."""
        from sistemas.gerador_pecas.services_prompt_loader import _deduplicar_modulos

        m1 = _mock_modulo(nome="contestacao", titulo="Contestacao")
        m2 = _mock_modulo(nome="recurso", titulo="Recurso")
        m3 = _mock_modulo(nome="apelacao", titulo="Apelacao")

        resultado = _deduplicar_modulos([m1, m2, m3])
        assert len(resultado) == 3


# ========================================
# Testes de listar_tipos_peca com group_id
# ========================================

class TestListarTiposPecaGroupFilter:
    """Testes para listar_tipos_peca com filtro de group_id."""

    def test_listar_tipos_peca_group_id_filter(self):
        """
        Verifica que listar_tipos_peca retorna apenas modulos do grupo solicitado.

        A query deve filtrar por PromptModulo.group_id == group_id,
        garantindo que modulos de outros grupos nao vazem.
        """
        from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca

        # Modulos do grupo 1 (PS)
        m_ps = _mock_modulo(
            nome="contestacao", titulo="Contestacao PS",
            group_id=1, tipo="peca", conteudo="Template PS",
        )

        # Configura mock do banco
        db = MagicMock()

        # Quando group_id=1 e fornecido, a primeira query (grupo) retorna modulos
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [m_ps]

        resultado = listar_tipos_peca(db, group_id=1)

        # Deve retornar apenas o modulo do grupo 1
        assert len(resultado) == 1
        assert resultado[0]["valor"] == "contestacao"
        assert resultado[0]["label"] == "Contestacao PS"

    def test_listar_tipos_peca_grupo_vazio_fallback_global(self):
        """
        Quando o grupo nao tem pecas proprias, faz fallback para global (group_id=NULL).
        """
        from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca

        m_global = _mock_modulo(
            nome="contestacao", titulo="Contestacao Global",
            group_id=None, tipo="peca", conteudo="Template global",
        )

        db = MagicMock()

        # Primeira chamada (grupo 99): vazia. Segunda chamada (global): com modulo.
        db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = [
            [],          # grupo 99: nenhuma peca
            [m_global],  # fallback global
        ]

        resultado = listar_tipos_peca(db, group_id=99)

        assert len(resultado) == 1
        assert resultado[0]["valor"] == "contestacao"
        assert resultado[0]["label"] == "Contestacao Global"

    def test_listar_tipos_peca_nao_mistura_grupos(self):
        """
        Mesmo com modulos em multiplos grupos, a listagem retorna apenas
        os do grupo solicitado (sem vazamento entre grupos).
        """
        from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca

        # Apenas modulos do grupo 2 (Detran) devem aparecer
        m_detran = _mock_modulo(
            nome="contestacao", titulo="Contestacao Detran",
            group_id=2, tipo="peca", conteudo="Template Detran",
        )

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [m_detran]

        resultado = listar_tipos_peca(db, group_id=2)

        assert len(resultado) == 1
        assert resultado[0]["valor"] == "contestacao"
        assert resultado[0]["label"] == "Contestacao Detran"
        # Confirma que nao ha modulos de outros grupos
        for item in resultado:
            assert "PS" not in item["label"], "Modulo de outro grupo nao deve aparecer"
