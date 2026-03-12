# tests/gerador_pecas/test_arvore_decisao.py
"""Testes para a feature árvore de decisão."""

import pytest
from sistemas.gerador_pecas.schemas_arvore import (
    SwimlaneDTO, ModuloDTO, VariavelDTO, StatsDTO, ArvoreDecisaoResponse
)


class TestSchemas:
    """Testes de serialização dos DTOs."""

    def test_swimlane_dto_valido(self):
        """Deve criar SwimlaneDTO com campos obrigatórios."""
        dto = SwimlaneDTO(
            id="merito", label="Mérito",
            modulos_count=90, variaveis_count=52, pct_deterministico=85.0
        )
        assert dto.id == "merito"
        assert dto.pct_deterministico == 85.0

    def test_modulo_dto_com_regra(self):
        """Deve criar ModuloDTO com regra AST."""
        dto = ModuloDTO(
            id=27, titulo="Não Comparecimento",
            categoria="Mérito", modo_ativacao="deterministic",
            regra={"type": "condition", "variable": "var_x", "operator": "equals", "value": True},
            fallback_habilitado=False,
            variaveis_usadas=["var_x"],
            tipos_peca=["contestacao"]
        )
        assert dto.regra["type"] == "condition"
        assert dto.regras_tipo_peca == {}

    def test_modulo_dto_llm_sem_regra(self):
        """Deve criar ModuloDTO LLM com regra None."""
        dto = ModuloDTO(
            id=28, titulo="Módulo LLM",
            categoria="Preliminar", modo_ativacao="llm",
            regra=None, fallback_habilitado=False,
            variaveis_usadas=[], tipos_peca=["contestacao"]
        )
        assert dto.regra is None

    def test_variavel_dto_orfa(self):
        """Deve marcar variável como órfã."""
        dto = VariavelDTO(
            slug="var_sem_uso", label="Sem Uso", tipo="text",
            fonte="extraction", pergunta="Pergunta?",
            is_orfa=True, modulos_ids=[]
        )
        assert dto.is_orfa is True
        assert dto.depends_on is None

    def test_variavel_dto_com_dependencia(self):
        """Deve incluir dados de dependência."""
        dto = VariavelDTO(
            slug="var_filha", label="Filha", tipo="boolean",
            fonte="extraction", pergunta="Pergunta?",
            is_orfa=False, modulos_ids=[27],
            depends_on="var_pai", dependency_operator="equals",
            dependency_value="true"
        )
        assert dto.depends_on == "var_pai"

    def test_arvore_response_completa(self):
        """Deve montar response completa."""
        resp = ArvoreDecisaoResponse(
            swimlanes=[SwimlaneDTO(id="m", label="Mérito", modulos_count=1, variaveis_count=1, pct_deterministico=100.0)],
            modulos=[ModuloDTO(id=1, titulo="T", categoria="Mérito", modo_ativacao="deterministic",
                               regra=None, fallback_habilitado=False, variaveis_usadas=[], tipos_peca=[])],
            variaveis=[VariavelDTO(slug="v", label="V", tipo="text", fonte="extraction",
                                   pergunta=None, is_orfa=True, modulos_ids=[])],
            stats=StatsDTO(total_modulos=1, total_variaveis=1, total_orfas=1, total_vinculos=0)
        )
        assert len(resp.swimlanes) == 1
        assert resp.stats.total_orfas == 1


from unittest.mock import MagicMock, patch
from sistemas.gerador_pecas.services_arvore_decisao import ArvoreDecisaoService


class TestArvoreDecisaoService:
    """Testes para o service que monta o grafo."""

    def _make_modulo(self, id, titulo, categoria, modo_ativacao="deterministic",
                     regra=None, group_id=1, ativo=True, tipo="conteudo"):
        """Helper para criar mock de PromptModulo."""
        m = MagicMock()
        m.id = id
        m.titulo = titulo
        m.categoria = categoria
        m.modo_ativacao = modo_ativacao
        m.regra_deterministica = regra
        m.regra_deterministica_secundaria = None
        m.fallback_habilitado = False
        m.group_id = group_id
        m.ativo = ativo
        m.tipo = tipo
        return m

    def _make_variavel(self, slug, label, tipo="boolean", categoria_id=1,
                       depends_on=None, dep_operator=None, dep_value=None):
        """Helper para criar mock de ExtractionVariable."""
        v = MagicMock()
        v.slug = slug
        v.label = label
        v.tipo = tipo
        v.categoria_id = categoria_id
        v.is_conditional = depends_on is not None
        v.depends_on_variable = depends_on
        v.dependency_config = {"operator": dep_operator, "value": dep_value} if dep_operator else None
        v.source_question = MagicMock()
        v.source_question.pergunta = f"Pergunta sobre {slug}?"
        return v

    def test_extrair_variaveis_de_regra_simples(self):
        """Deve extrair slugs de uma regra condition simples."""
        regra = {"type": "condition", "variable": "var_a", "operator": "equals", "value": True}
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(regra)
        assert slugs == {"var_a"}

    def test_extrair_variaveis_de_regra_and(self):
        """Deve extrair slugs de regra AND com múltiplas condições."""
        regra = {
            "type": "and",
            "conditions": [
                {"type": "condition", "variable": "var_a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "var_b", "operator": "in_list", "value": [1, 2]}
            ]
        }
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(regra)
        assert slugs == {"var_a", "var_b"}

    def test_extrair_variaveis_de_regra_aninhada(self):
        """Deve extrair slugs de regra com AND/OR/NOT aninhados."""
        regra = {
            "type": "or",
            "conditions": [
                {"type": "and", "conditions": [
                    {"type": "condition", "variable": "var_a", "operator": "equals", "value": True},
                    {"type": "not", "condition": {
                        "type": "condition", "variable": "var_b", "operator": "equals", "value": False
                    }}
                ]},
                {"type": "condition", "variable": "var_c", "operator": "exists", "value": None}
            ]
        }
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(regra)
        assert slugs == {"var_a", "var_b", "var_c"}

    def test_extrair_variaveis_regra_none(self):
        """Deve retornar set vazio para regra None."""
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(None)
        assert slugs == set()

    def test_montar_swimlanes(self):
        """Deve agrupar módulos em swimlanes por categoria."""
        modulos_dto = [
            ModuloDTO(id=1, titulo="M1", categoria="Mérito", modo_ativacao="deterministic",
                      regra=None, fallback_habilitado=False, variaveis_usadas=["v1"], tipos_peca=[]),
            ModuloDTO(id=2, titulo="M2", categoria="Mérito", modo_ativacao="llm",
                      regra=None, fallback_habilitado=False, variaveis_usadas=[], tipos_peca=[]),
            ModuloDTO(id=3, titulo="M3", categoria="Preliminar", modo_ativacao="deterministic",
                      regra=None, fallback_habilitado=False, variaveis_usadas=["v2"], tipos_peca=[]),
        ]
        swimlanes = ArvoreDecisaoService._montar_swimlanes(modulos_dto)
        assert len(swimlanes) == 2

        merito = next(s for s in swimlanes if s.label == "Mérito")
        assert merito.modulos_count == 2
        assert merito.pct_deterministico == 50.0

        preliminar = next(s for s in swimlanes if s.label == "Preliminar")
        assert preliminar.modulos_count == 1
        assert preliminar.pct_deterministico == 100.0
