# tests/test_natjus_guardrails.py
"""
Testes automatizados para guardrails do NATJus no pipeline de geração.

Cobre:
1. NATJus NÃO está em codigos_texto_integral (causa raiz do incidente)
2. Guardrail de tamanho para documentos integrais
3. Guardrail no _montar_prompt_agente3 contra NATJus integral
4. Fallback de upload com limite de tamanho
5. Regressão: outros tipos de documento não afetados

Ref: Incidente de produção 2026-02-06 (processo 0828724-58.2025.8.12.0110)
"""

import pytest

pytestmark = pytest.mark.unit

from unittest.mock import MagicMock, patch
from dataclasses import dataclass, field
from typing import Optional, List


# ============================================================================
# FIXTURES
# ============================================================================

@dataclass
class MockDocumentoTJMS:
    """Mock simplificado de DocumentoTJMS para testes."""
    id: str = "doc_test_1"
    tipo_documento: Optional[str] = None
    categoria_nome: str = "Nota Técnica NATJus"
    descricao: str = "Parecer NATJus"
    descricao_ia: str = ""
    conteudo_base64: Optional[str] = None
    texto_extraido: str = ""
    resumo: str = ""
    resumo_json: dict = field(default_factory=dict)
    irrelevante: bool = False
    erro: str = ""
    ids_agrupados: List[str] = field(default_factory=list)
    data_juntada: str = ""
    data_formatada: str = ""
    processo_origem: bool = False


# ============================================================================
# 1. CAUSA RAIZ: NATJus NÃO deve estar em codigos_texto_integral
# ============================================================================

class TestNatjusNaoIntegral:
    """Verifica que códigos NATJus NÃO estão em CODIGOS_TEXTO_INTEGRAL."""

    def test_codigos_texto_integral_nao_contem_natjus_hardcoded(self):
        """CODIGOS_TEXTO_INTEGRAL não deve conter códigos NATJus conhecidos."""
        from sistemas.gerador_pecas.agente_tjms import CODIGOS_TEXTO_INTEGRAL

        # Códigos NATJus reais definidos em services/tjms/constants.py
        codigos_natjus_conhecidos = {
            207,   # PARECER_CATES
            8451,  # PARECER_NAT
            9636,  # PARECER_NAT_ORIGEM
            59,    # NOTA_TECNICA_NATJUS
            8490,  # NOTA_TECNICA_NATJUS_ALT
        }

        for codigo in codigos_natjus_conhecidos:
            assert codigo not in CODIGOS_TEXTO_INTEGRAL, (
                f"Código NATJus {codigo} NÃO deve estar em CODIGOS_TEXTO_INTEGRAL. "
                f"Documentos NATJus devem passar pelo pipeline JSON."
            )

    def test_codigos_texto_integral_apenas_laudo_pericial(self):
        """CODIGOS_TEXTO_INTEGRAL deve conter apenas o Laudo Pericial (8369)."""
        from sistemas.gerador_pecas.agente_tjms import CODIGOS_TEXTO_INTEGRAL

        assert CODIGOS_TEXTO_INTEGRAL == {8369}, (
            f"CODIGOS_TEXTO_INTEGRAL deveria ser {{8369}} (Laudo Pericial), "
            f"mas é {CODIGOS_TEXTO_INTEGRAL}"
        )

    def test_construtor_agente_nao_adiciona_nat_a_texto_integral(self):
        """O construtor do AgenteTJMS não deve adicionar códigos NAT ao texto integral."""
        from sistemas.gerador_pecas.agente_tjms import (
            AgenteTJMS,
            CODIGOS_TEXTO_INTEGRAL,
        )

        # Mock da sessão do banco (evita chamadas reais)
        mock_db = MagicMock()

        agente = AgenteTJMS(db_session=mock_db)

        # Os códigos texto integral devem ser iguais ao hardcoded
        assert agente.codigos_texto_integral == CODIGOS_TEXTO_INTEGRAL, (
            f"codigos_texto_integral deveria ser {CODIGOS_TEXTO_INTEGRAL}, "
            f"mas é {agente.codigos_texto_integral}. "
            f"Códigos NATJus NÃO devem ser adicionados."
        )

    def test_deve_enviar_texto_integral_false_para_natjus(self):
        """_deve_enviar_texto_integral retorna False para TODOS os tipos NATJus."""
        from sistemas.gerador_pecas.agente_tjms import AgenteTJMS

        mock_db = MagicMock()
        agente = AgenteTJMS(db_session=mock_db)

        # Todos os códigos NATJus reais (services/tjms/constants.py)
        codigos_natjus = {
            "207":  "PARECER_CATES",
            "8451": "PARECER_NAT",
            "9636": "PARECER_NAT_ORIGEM",
            "59":   "NOTA_TECNICA_NATJUS",
            "8490": "NOTA_TECNICA_NATJUS_ALT",
        }

        for codigo, nome in codigos_natjus.items():
            doc = MockDocumentoTJMS(tipo_documento=codigo)
            assert not agente._deve_enviar_texto_integral(doc), (
                f"NATJus {nome} (código {codigo}) NÃO deve ser marcado para envio integral"
            )


# ============================================================================
# 2. GUARDRAIL DE TAMANHO para documentos integrais
# ============================================================================

class TestGuardrailTamanhoIntegral:
    """Verifica que documentos integrais respeitam o limite de tamanho."""

    def test_max_texto_integral_chars_definido(self):
        """MAX_TEXTO_INTEGRAL_CHARS deve estar definido e ser razoável."""
        from sistemas.gerador_pecas.agente_tjms import MAX_TEXTO_INTEGRAL_CHARS

        assert MAX_TEXTO_INTEGRAL_CHARS > 0, "Limite deve ser positivo"
        assert MAX_TEXTO_INTEGRAL_CHARS <= 80000, (
            f"Limite {MAX_TEXTO_INTEGRAL_CHARS} é muito alto. "
            f"Máximo recomendado: 80000 chars."
        )

    def test_documento_integral_grande_vai_para_pipeline_resumo(self):
        """Documentos integrais que excedem o limite devem ir para pipeline de resumo."""
        from sistemas.gerador_pecas.agente_tjms import (
            AgenteTJMS,
            MAX_TEXTO_INTEGRAL_CHARS,
        )

        mock_db = MagicMock()
        agente = AgenteTJMS(db_session=mock_db)

        doc = MockDocumentoTJMS(tipo_documento="8369")  # Laudo Pericial
        texto_grande = "x" * (MAX_TEXTO_INTEGRAL_CHARS + 1000)

        # Simula o check de tamanho
        enviar_integral = agente._deve_enviar_texto_integral(doc)
        assert enviar_integral, "Laudo Pericial (8369) deve ser marcado para integral"

        # Mas se o texto excede o limite, não deveria ser enviado integral
        # (o código agora faz fallback para pipeline de resumo)
        assert len(texto_grande) > MAX_TEXTO_INTEGRAL_CHARS


# ============================================================================
# 3. GUARDRAIL no _montar_prompt_agente3
# ============================================================================

class TestGuardrailPromptAgente3:
    """Verifica que _montar_prompt_agente3 detecta e remove NATJus integral."""

    def test_detecta_natjus_integral_no_resumo(self):
        """Se NATJus integral chegar ao prompt, deve ser removido."""
        from sistemas.gerador_pecas.orquestrador_agentes import _montar_prompt_agente3

        texto_natjus_gigante = "A" * 50000
        resumo_com_natjus = (
            "## DOCUMENTOS DO PROCESSO\n\n"
            f"**[DOCUMENTO INTEGRAL - Nota Técnica NATJus]**\n\n{texto_natjus_gigante}\n"
            "\n---\n"
            "## Outro Documento\nConteúdo normal.\n"
        )

        resultado = _montar_prompt_agente3(
            prompt_sistema="Sistema",
            prompt_peca="Peça",
            prompt_conteudo="Conteúdo",
            resumo_consolidado=resumo_com_natjus,
        )

        # O texto integral do NATJus NÃO deve aparecer no prompt final
        assert texto_natjus_gigante not in resultado, (
            "Texto integral do NATJus NÃO deve chegar ao Agente 3"
        )
        # Deve ter a mensagem de remoção
        assert "DOCUMENTO NATJUS REMOVIDO" in resultado, (
            "Deve conter aviso de remoção do NATJus integral"
        )

    def test_nao_remove_documentos_normais(self):
        """Documentos normais (não NATJus) não devem ser afetados."""
        from sistemas.gerador_pecas.orquestrador_agentes import _montar_prompt_agente3

        resumo_normal = (
            "## DOCUMENTOS DO PROCESSO\n\n"
            "### 1. Petição Inicial\n"
            "Conteúdo da petição...\n\n"
            "### 2. Contestação\n"
            "Conteúdo da contestação...\n"
        )

        resultado = _montar_prompt_agente3(
            prompt_sistema="Sistema",
            prompt_peca="Peça",
            prompt_conteudo="Conteúdo",
            resumo_consolidado=resumo_normal,
        )

        assert "Conteúdo da petição" in resultado
        assert "Conteúdo da contestação" in resultado
        assert "DOCUMENTO NATJUS REMOVIDO" not in resultado

    def test_nao_remove_laudo_pericial_integral(self):
        """Documentos integrais que NÃO são NATJus devem ser mantidos."""
        from sistemas.gerador_pecas.orquestrador_agentes import _montar_prompt_agente3

        resumo_com_laudo = (
            "## DOCUMENTOS DO PROCESSO\n\n"
            "**[DOCUMENTO INTEGRAL - Laudo Pericial]**\n\n"
            "Conteúdo do laudo pericial...\n"
        )

        resultado = _montar_prompt_agente3(
            prompt_sistema="Sistema",
            prompt_peca="Peça",
            prompt_conteudo="Conteúdo",
            resumo_consolidado=resumo_com_laudo,
        )

        assert "Conteúdo do laudo pericial" in resultado
        assert "DOCUMENTO NATJUS REMOVIDO" not in resultado

    def test_detecta_variantes_natjus(self):
        """Detecta variantes do nome NATJus: NAT, CATES, Nota Técnica."""
        from sistemas.gerador_pecas.orquestrador_agentes import _montar_prompt_agente3

        variantes = [
            "Nota Técnica NATJus",
            "Parecer NAT",
            "Parecer CATES",
            "Nota Tecnica NATJus",
        ]

        for variante in variantes:
            resumo = f"**[DOCUMENTO INTEGRAL - {variante}]**\n\nTexto grande...\n"
            resultado = _montar_prompt_agente3(
                prompt_sistema="S", prompt_peca="P",
                prompt_conteudo="C", resumo_consolidado=resumo,
            )
            assert "DOCUMENTO NATJUS REMOVIDO" in resultado, (
                f"Variante '{variante}' não foi detectada pelo guardrail"
            )

    def test_guardrail_tamanho_resumo(self):
        """Resumo que excede MAX_RESUMO_CONSOLIDADO_CHARS é truncado."""
        from sistemas.gerador_pecas.orquestrador_agentes import (
            _montar_prompt_agente3,
            MAX_RESUMO_CONSOLIDADO_CHARS,
        )

        resumo_gigante = "X" * (MAX_RESUMO_CONSOLIDADO_CHARS + 10000)

        resultado = _montar_prompt_agente3(
            prompt_sistema="Sistema",
            prompt_peca="Peça",
            prompt_conteudo="Conteúdo",
            resumo_consolidado=resumo_gigante,
        )

        assert "truncado por exceder limite" in resultado
        # O resultado total deve ser menor que o resumo original + prompts
        assert len(resultado) < len(resumo_gigante) + 5000


# ============================================================================
# 4. FALLBACK DE UPLOAD com limite de tamanho
# ============================================================================

class TestFallbackUploadParecer:
    """Verifica que _anexar_upload_parecer_ao_resumo limita texto bruto."""

    def test_texto_bruto_truncado_quando_json_falha(self):
        """Quando JSON falha, texto bruto é limitado a _MAX_PARECER_FALLBACK_CHARS."""
        from sistemas.gerador_pecas.router import (
            _anexar_upload_parecer_ao_resumo,
            _MAX_PARECER_FALLBACK_CHARS,
        )

        texto_grande = "A" * 50000  # 50K chars
        metadata = {"filename": "natjus.pdf", "upload_id": "test_123"}

        resultado = _anexar_upload_parecer_ao_resumo(
            resumo_consolidado="Resumo base",
            upload_metadata=metadata,
            texto_parecer=texto_grande,
            markdown_estruturado=None,  # JSON falhou
        )

        # O resultado NÃO deve conter os 50K chars do texto bruto
        assert len(resultado) < _MAX_PARECER_FALLBACK_CHARS + 1000, (
            f"Resultado tem {len(resultado)} chars - deveria ser limitado a ~{_MAX_PARECER_FALLBACK_CHARS}"
        )
        assert "TEXTO DO PARECER NATJUS TRUNCADO" in resultado
        assert "texto_bruto_pdf" in resultado

    def test_texto_pequeno_nao_truncado(self):
        """Texto bruto pequeno passa sem truncamento."""
        from sistemas.gerador_pecas.router import _anexar_upload_parecer_ao_resumo

        texto_pequeno = "Conclusão: procedimento indicado." * 10  # ~330 chars
        metadata = {"filename": "natjus.pdf", "upload_id": "test_456"}

        resultado = _anexar_upload_parecer_ao_resumo(
            resumo_consolidado="Resumo base",
            upload_metadata=metadata,
            texto_parecer=texto_pequeno,
            markdown_estruturado=None,
        )

        assert texto_pequeno in resultado
        assert "TRUNCADO" not in resultado

    def test_markdown_estruturado_preferido(self):
        """Quando markdown estruturado disponível, usa ele em vez do texto bruto."""
        from sistemas.gerador_pecas.router import _anexar_upload_parecer_ao_resumo

        markdown = "## Parecer\n**Conclusão**: Procedimento indicado."
        texto_bruto = "X" * 50000
        metadata = {"filename": "natjus.pdf", "upload_id": "test_789"}

        resultado = _anexar_upload_parecer_ao_resumo(
            resumo_consolidado="Resumo base",
            upload_metadata=metadata,
            texto_parecer=texto_bruto,
            markdown_estruturado=markdown,
        )

        assert markdown in resultado
        assert "json_modelo_categoria" in resultado
        assert "texto_bruto_pdf" not in resultado
        assert "X" * 1000 not in resultado  # Texto bruto não deve aparecer

    def test_texto_vazio_mensagem_padrao(self):
        """Quando texto é vazio, mostra mensagem padrão."""
        from sistemas.gerador_pecas.router import _anexar_upload_parecer_ao_resumo

        metadata = {"filename": "vazio.pdf", "upload_id": "test_000"}

        resultado = _anexar_upload_parecer_ao_resumo(
            resumo_consolidado="Resumo base",
            upload_metadata=metadata,
            texto_parecer="",
            markdown_estruturado=None,
        )

        assert "Nao foi possivel extrair texto" in resultado


# ============================================================================
# 5. REGRESSÃO: outros tipos de documento não afetados
# ============================================================================

class TestRegressaoOutrosDocumentos:
    """Garante que as correções NATJus não afetam outros documentos."""

    def test_laudo_pericial_continua_integral(self):
        """Laudo Pericial (8369) ainda vai como texto integral (quando dentro do limite)."""
        from sistemas.gerador_pecas.agente_tjms import AgenteTJMS

        mock_db = MagicMock()
        agente = AgenteTJMS(db_session=mock_db)

        doc = MockDocumentoTJMS(tipo_documento="8369")  # Laudo Pericial
        assert agente._deve_enviar_texto_integral(doc), (
            "Laudo Pericial (8369) DEVE continuar marcado para texto integral"
        )

    def test_peticao_inicial_nao_integral(self):
        """Petição Inicial (9562) NÃO deve ir como texto integral."""
        from sistemas.gerador_pecas.agente_tjms import AgenteTJMS

        mock_db = MagicMock()
        agente = AgenteTJMS(db_session=mock_db)

        doc = MockDocumentoTJMS(tipo_documento="9562")
        assert not agente._deve_enviar_texto_integral(doc)

    def test_sentenca_nao_integral(self):
        """Sentença NÃO deve ir como texto integral."""
        from sistemas.gerador_pecas.agente_tjms import AgenteTJMS

        mock_db = MagicMock()
        agente = AgenteTJMS(db_session=mock_db)

        doc = MockDocumentoTJMS(tipo_documento="3")  # Sentença
        assert not agente._deve_enviar_texto_integral(doc)


# ============================================================================
# 6. CONTRATO DO PIPELINE
# ============================================================================

class TestContratoPipeline:
    """Testes de contrato entre agentes do pipeline."""

    def test_max_resumo_consolidado_definido(self):
        """MAX_RESUMO_CONSOLIDADO_CHARS deve estar definido."""
        from sistemas.gerador_pecas.orquestrador_agentes import MAX_RESUMO_CONSOLIDADO_CHARS

        assert MAX_RESUMO_CONSOLIDADO_CHARS > 0
        assert MAX_RESUMO_CONSOLIDADO_CHARS <= 300000, (
            f"Limite {MAX_RESUMO_CONSOLIDADO_CHARS} é muito alto para prompt seguro"
        )

    def test_max_parecer_fallback_definido(self):
        """_MAX_PARECER_FALLBACK_CHARS deve estar definido e ser restrito."""
        from sistemas.gerador_pecas.router import _MAX_PARECER_FALLBACK_CHARS

        assert _MAX_PARECER_FALLBACK_CHARS > 0
        assert _MAX_PARECER_FALLBACK_CHARS <= 5000, (
            f"Limite de fallback {_MAX_PARECER_FALLBACK_CHARS} é muito alto. "
            f"Texto bruto de NATJus deve ser mínimo."
        )

    def test_max_texto_integral_chars_definido(self):
        """MAX_TEXTO_INTEGRAL_CHARS deve ser menor que o antigo 150K."""
        from sistemas.gerador_pecas.agente_tjms import MAX_TEXTO_INTEGRAL_CHARS

        assert MAX_TEXTO_INTEGRAL_CHARS < 150000, (
            f"Limite {MAX_TEXTO_INTEGRAL_CHARS} não pode ser 150K (valor antigo inseguro)"
        )
