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
