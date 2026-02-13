"""
Testes para a padronizacao de feedback por estrelas (1-5).

Valida:
- Helper nota_para_avaliacao (mapeamento bidirecional)
- Validator validate_feedback_fields (derivacao, comentario obrigatorio)
- Schemas Pydantic de cada sistema (nota required, backward compat)

Autor: LAB/PGE-MS
Data: 2026-02-13
"""
import pytest
from pydantic import ValidationError

from utils.feedback_helpers import (
    nota_para_avaliacao,
    AVALIACAO_PARA_NOTA,
    validate_feedback_fields,
)


pytestmark = pytest.mark.unit


# ============================================
# Testes: nota_para_avaliacao
# ============================================


class TestNotaParaAvaliacao:
    """Mapeamento nota (1-5) -> string legada."""

    def test_nota_5_correto(self):
        assert nota_para_avaliacao(5) == "correto"

    def test_nota_4_correto(self):
        assert nota_para_avaliacao(4) == "correto"

    def test_nota_3_parcial(self):
        assert nota_para_avaliacao(3) == "parcial"

    def test_nota_2_incorreto(self):
        assert nota_para_avaliacao(2) == "incorreto"

    def test_nota_1_erro_ia(self):
        assert nota_para_avaliacao(1) == "erro_ia"


class TestAvaliacaoParaNota:
    """Mapeamento string legada -> nota."""

    def test_correto_5(self):
        assert AVALIACAO_PARA_NOTA["correto"] == 5

    def test_parcial_3(self):
        assert AVALIACAO_PARA_NOTA["parcial"] == 3

    def test_incorreto_2(self):
        assert AVALIACAO_PARA_NOTA["incorreto"] == 2

    def test_erro_ia_1(self):
        assert AVALIACAO_PARA_NOTA["erro_ia"] == 1


# ============================================
# Testes: validate_feedback_fields
# ============================================


class TestValidateFeedbackFields:
    """Validator compartilhado entre schemas."""

    def test_nota_deriva_avaliacao(self):
        values = {"nota": 5}
        result = validate_feedback_fields(values)
        assert result["avaliacao"] == "correto"

    def test_nota_3_deriva_parcial(self):
        values = {"nota": 3, "comentario": "motivo"}
        result = validate_feedback_fields(values)
        assert result["avaliacao"] == "parcial"

    def test_avaliacao_deriva_nota(self):
        values = {"avaliacao": "incorreto"}
        result = validate_feedback_fields(values)
        assert result["nota"] == 2

    def test_avaliacao_desconhecida_default_3(self):
        values = {"avaliacao": "outro_valor_qualquer"}
        result = validate_feedback_fields(values)
        assert result["nota"] == 3

    def test_nota_e_avaliacao_ambos_mantidos(self):
        """Se ambos fornecidos, nao sobrescreve."""
        values = {"nota": 4, "avaliacao": "parcial"}
        result = validate_feedback_fields(values)
        assert result["nota"] == 4
        assert result["avaliacao"] == "parcial"

    def test_comentario_obrigatorio_nota_1(self):
        with pytest.raises(ValueError, match="obrigatório"):
            validate_feedback_fields({"nota": 1})

    def test_comentario_obrigatorio_nota_2(self):
        with pytest.raises(ValueError, match="obrigatório"):
            validate_feedback_fields({"nota": 2, "comentario": ""})

    def test_comentario_obrigatorio_nota_3(self):
        with pytest.raises(ValueError, match="obrigatório"):
            validate_feedback_fields({"nota": 3, "comentario": "   "})

    def test_comentario_ok_nota_3(self):
        result = validate_feedback_fields({"nota": 3, "comentario": "motivo"})
        assert result["nota"] == 3
        assert result["comentario"] == "motivo"

    def test_comentario_opcional_nota_4(self):
        result = validate_feedback_fields({"nota": 4})
        assert result["nota"] == 4

    def test_comentario_opcional_nota_5(self):
        result = validate_feedback_fields({"nota": 5})
        assert result["nota"] == 5


# ============================================
# Testes: Schemas Pydantic por sistema
# ============================================


class TestSchemaGeradorPecas:
    """Schema do Gerador de Pecas."""

    def test_nota_required(self):
        from sistemas.gerador_pecas.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(geracao_id=1)

    def test_nota_range_valido(self):
        from sistemas.gerador_pecas.schemas import FeedbackRequest

        fb = FeedbackRequest(geracao_id=1, nota=4)
        assert fb.nota == 4
        assert fb.avaliacao == "correto"

    def test_nota_fora_range(self):
        from sistemas.gerador_pecas.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(geracao_id=1, nota=6)

    def test_nota_zero_invalido(self):
        from sistemas.gerador_pecas.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(geracao_id=1, nota=0)

    def test_backward_compat_avaliacao(self):
        from sistemas.gerador_pecas.schemas import FeedbackRequest

        fb = FeedbackRequest(geracao_id=1, avaliacao="correto")
        assert fb.nota == 5
        assert fb.avaliacao == "correto"

    def test_comentario_obrigatorio_nota_baixa(self):
        from sistemas.gerador_pecas.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(geracao_id=1, nota=2)

    def test_comentario_ok_nota_baixa(self):
        from sistemas.gerador_pecas.schemas import FeedbackRequest

        fb = FeedbackRequest(geracao_id=1, nota=2, comentario="incorreto aqui")
        assert fb.nota == 2
        assert fb.comentario == "incorreto aqui"


class TestSchemaRelatorioCumprimento:
    """Schema do Relatorio de Cumprimento."""

    def test_nota_required(self):
        from sistemas.relatorio_cumprimento.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(geracao_id=1)

    def test_nota_com_derivacao(self):
        from sistemas.relatorio_cumprimento.schemas import FeedbackRequest

        fb = FeedbackRequest(geracao_id=1, nota=5)
        assert fb.avaliacao == "correto"


class TestSchemaPrestacaoContas:
    """Schema da Prestacao de Contas — mantem campos legados."""

    def test_nota_required(self):
        from sistemas.prestacao_contas.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(geracao_id=1)

    def test_campos_legados_opcionais(self):
        from sistemas.prestacao_contas.schemas import FeedbackRequest

        fb = FeedbackRequest(geracao_id=1, nota=5, parecer_correto=True)
        assert fb.parecer_correto is True
        assert fb.valores_corretos is None


class TestSchemaPedidoCalculo:
    """Schema do Pedido de Calculo."""

    def test_nota_required(self):
        from sistemas.pedido_calculo.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(geracao_id=1)

    def test_nota_com_derivacao(self):
        from sistemas.pedido_calculo.schemas import FeedbackRequest

        fb = FeedbackRequest(geracao_id=1, nota=3, comentario="motivo")
        assert fb.avaliacao == "parcial"


class TestSchemaAssistenciaJudiciaria:
    """Schema da Assistencia Judiciaria."""

    def test_nota_required(self):
        from sistemas.assistencia_judiciaria.schemas import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(consulta_id=1)

    def test_nota_com_derivacao(self):
        from sistemas.assistencia_judiciaria.schemas import FeedbackRequest

        fb = FeedbackRequest(consulta_id=1, nota=1, comentario="erro")
        assert fb.avaliacao == "erro_ia"


class TestSchemaMatriculas:
    """Schema inline de Matriculas Confrontantes."""

    def test_nota_required(self):
        from sistemas.matriculas_confrontantes.router import FeedbackMatriculaRequest

        with pytest.raises(ValidationError):
            FeedbackMatriculaRequest(analise_id=1)

    def test_nota_com_derivacao(self):
        from sistemas.matriculas_confrontantes.router import FeedbackMatriculaRequest

        fb = FeedbackMatriculaRequest(analise_id=1, nota=4)
        assert fb.avaliacao == "correto"
