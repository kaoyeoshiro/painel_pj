# tests/gerador_pecas/test_prompt_edicao_guardrails.py
"""
Testes para garantir que o prompt de edicao de minutas contem
os guardrails contra invencao de jurisprudencia.

Segue padrao de TestModoAutomaticoInabalterado — testes de regressao
que impedem remocao acidental dos guardrails.
"""

import pytest

pytestmark = pytest.mark.unit

from sistemas.gerador_pecas.services import PROMPT_CHAT_EDICAO_PADRAO


class TestGuardrailsPromptEdicao:
    """Verifica que a constante PROMPT_CHAT_EDICAO_PADRAO contem vedacoes obrigatorias."""

    def test_contem_secao_vedacao_absoluta(self):
        """Secao de vedacao deve existir com titulo enfatico."""
        assert "VEDAÇÃO ABSOLUTA" in PROMPT_CHAT_EDICAO_PADRAO

    def test_contem_proibicao_nunca(self):
        """Palavra NUNCA deve aparecer na vedacao de invencao."""
        assert "NUNCA" in PROMPT_CHAT_EDICAO_PADRAO

    def test_contem_certeza_absoluta(self):
        """Teste mental obrigatorio com CERTEZA ABSOLUTA."""
        assert "CERTEZA ABSOLUTA" in PROMPT_CHAT_EDICAO_PADRAO

    def test_proibe_temas_repercussao_geral(self):
        """Deve vedar explicitamente temas de repercussao geral fabricados."""
        assert "Temas de repercussão geral" in PROMPT_CHAT_EDICAO_PADRAO

    def test_proibe_sumulas(self):
        """Deve vedar explicitamente sumulas fabricadas."""
        assert "Súmulas vinculantes" in PROMPT_CHAT_EDICAO_PADRAO

    def test_proibe_decisoes_judiciais(self):
        """Deve vedar explicitamente decisoes judiciais fabricadas."""
        assert "REsp" in PROMPT_CHAT_EDICAO_PADRAO
        assert "ADI" in PROMPT_CHAT_EDICAO_PADRAO

    def test_permite_raciocinio_juridico(self):
        """Deve permitir construcao de raciocinio juridico."""
        assert "Construir raciocínio jurídico" in PROMPT_CHAT_EDICAO_PADRAO

    def test_permite_principios_gerais(self):
        """Deve permitir referencia a principios gerais do Direito."""
        assert "princípios gerais do Direito" in PROMPT_CHAT_EDICAO_PADRAO

    def test_contem_teste_mental_obrigatorio(self):
        """Deve conter secao de teste mental obrigatorio."""
        assert "TESTE MENTAL OBRIGATÓRIO" in PROMPT_CHAT_EDICAO_PADRAO

    def test_mantem_formatos_resposta(self):
        """Deve manter os formatos de resposta existentes (PERGUNTA e MINUTA EDITADA)."""
        assert "[PERGUNTA]" in PROMPT_CHAT_EDICAO_PADRAO
        assert "MINUTA EDITADA" in PROMPT_CHAT_EDICAO_PADRAO

    def test_mantem_regras_argumentos_base(self):
        """Deve manter regras para uso de argumentos da base de conhecimento."""
        assert "BASE DE CONHECIMENTO" in PROMPT_CHAT_EDICAO_PADRAO
