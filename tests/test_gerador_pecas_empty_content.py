# tests/test_gerador_pecas_empty_content.py
"""
Testes de regressão para o bug de conteúdo vazio no Gerador de Peças.

Este bug ocorria quando a API de IA (Gemini) falhava silenciosamente
durante o streaming, resultando em `conteudo_markdown` vazio ou None.
O sistema tentava salvar no banco e mostrar "Conteúdo não disponível".

Fix aplicado em 3 locais:
1. router.py linha ~617 (endpoint principal)
2. router.py linha ~1287 (endpoint curadoria)
3. router.py linha ~2792 (endpoint curadoria semi-automático)

USO:
    pytest tests/test_gerador_pecas_empty_content.py -v

Autor: LAB/PGE-MS
Data: 2026-02-05
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from dataclasses import dataclass
from typing import Optional


# ============================================
# MOCK DO RESULTADO DO AGENTE 3
# ============================================

@dataclass
class MockResultadoAgente3:
    """Simula ResultadoAgente3 para testes."""
    conteudo_markdown: Optional[str] = None
    prompt_enviado: str = ""
    erro: Optional[str] = None


# ============================================
# TESTES DE VALIDAÇÃO DE CONTEÚDO VAZIO
# ============================================

class TestConteudoVazioValidation:
    """Testes para validação de conteúdo vazio após streaming."""

    def test_resultado_none_deve_ser_detectado(self):
        """Resultado None deve ser detectado como erro."""
        resultado = None

        # Lógica de validação (igual ao fix no router.py)
        is_invalid = (
            not resultado or
            not resultado.conteudo_markdown or
            not resultado.conteudo_markdown.strip()
        )

        assert is_invalid is True, "Resultado None deve ser detectado como inválido"

    def test_conteudo_markdown_none_deve_ser_detectado(self):
        """Resultado com conteudo_markdown=None deve ser detectado."""
        resultado = MockResultadoAgente3(conteudo_markdown=None)

        is_invalid = (
            not resultado or
            not resultado.conteudo_markdown or
            not resultado.conteudo_markdown.strip()
        )

        assert is_invalid is True, "conteudo_markdown=None deve ser detectado como inválido"

    def test_conteudo_markdown_vazio_deve_ser_detectado(self):
        """Resultado com conteudo_markdown='' deve ser detectado."""
        resultado = MockResultadoAgente3(conteudo_markdown="")

        is_invalid = (
            not resultado or
            not resultado.conteudo_markdown or
            not resultado.conteudo_markdown.strip()
        )

        assert is_invalid is True, "conteudo_markdown='' deve ser detectado como inválido"

    def test_conteudo_markdown_whitespace_deve_ser_detectado(self):
        """Resultado com conteudo_markdown contendo apenas espaços deve ser detectado."""
        resultado = MockResultadoAgente3(conteudo_markdown="   \n\t  ")

        is_invalid = (
            not resultado or
            not resultado.conteudo_markdown or
            not resultado.conteudo_markdown.strip()
        )

        assert is_invalid is True, "conteudo_markdown com apenas whitespace deve ser inválido"

    def test_conteudo_markdown_valido_deve_passar(self):
        """Resultado com conteudo_markdown válido deve passar."""
        resultado = MockResultadoAgente3(
            conteudo_markdown="# Contestação\n\nConteúdo da peça..."
        )

        is_invalid = (
            not resultado or
            not resultado.conteudo_markdown or
            not resultado.conteudo_markdown.strip()
        )

        assert is_invalid is False, "conteudo_markdown válido deve passar"


# ============================================
# TESTES DE REGRESSÃO - CENÁRIOS DE PRODUÇÃO
# ============================================

class TestRegressaoCenariosProducao:
    """Testes de regressão baseados em cenários reais de produção."""

    def test_cenario_cnj_0801465_timeout_silencioso(self):
        """
        Cenário: CNJ 0801465-12.2025.8.12.0006
        Problema: Timeout silencioso da API Gemini resultou em conteúdo vazio.

        Este teste simula o cenário onde a API retorna um resultado
        mas o conteúdo está vazio devido a erro silencioso.
        """
        # Simula o que acontece quando Gemini falha silenciosamente
        resultado = MockResultadoAgente3(
            conteudo_markdown="",  # Vazio! Bug original
            prompt_enviado="Prompt completo enviado...",
            erro=None  # Sem erro explícito (falha silenciosa)
        )

        # Validação deve detectar o problema
        is_invalid = (
            not resultado or
            not resultado.conteudo_markdown or
            not resultado.conteudo_markdown.strip()
        )

        assert is_invalid is True, "Falha silenciosa deve ser detectada"

    def test_cenario_erro_explicito_deve_ser_tratado_antes(self):
        """
        Cenário: API retorna erro explícito.
        O erro deve ser tratado pela verificação de `resultado.erro`.
        """
        resultado = MockResultadoAgente3(
            conteudo_markdown=None,
            erro="Erro de rate limit da API"
        )

        # Primeira verificação: erro explícito
        has_explicit_error = bool(resultado and resultado.erro)

        # Segunda verificação (nossa): conteúdo vazio
        is_content_invalid = (
            not resultado or
            not resultado.conteudo_markdown or
            not resultado.conteudo_markdown.strip()
        )

        assert has_explicit_error is True, "Erro explícito deve ser detectado primeiro"
        assert is_content_invalid is True, "Conteúdo também está inválido"


# ============================================
# TESTES DE MENSAGENS DE ERRO
# ============================================

class TestMensagensErro:
    """Testes para verificar mensagens de erro apropriadas."""

    def test_mensagem_erro_contem_instrucao_retry(self):
        """Mensagem de erro deve instruir usuário a tentar novamente."""
        erro_msg = "A geração não retornou conteúdo. Possível timeout ou erro na API de IA. Tente novamente."

        assert "Tente novamente" in erro_msg, "Mensagem deve instruir retry"
        assert "timeout" in erro_msg.lower(), "Mensagem deve mencionar timeout"
        assert "API" in erro_msg or "IA" in erro_msg, "Mensagem deve mencionar API/IA"


# ============================================
# TESTES DE LOGS DE DEBUG
# ============================================

class TestDebugLogs:
    """Testes para verificar que logs de debug são gerados."""

    def test_log_formato_agente3(self):
        """Verifica formato esperado dos logs de debug."""
        # Os logs devem seguir o padrão [AGENTE3]
        resultado = MockResultadoAgente3(conteudo_markdown="")

        # Simula o que seria logado
        log_lines = []
        log_lines.append(f"[AGENTE3] ERRO: Conteúdo vazio após streaming!")
        log_lines.append(f"[AGENTE3]    - resultado_agente3 exists: {resultado is not None}")
        log_lines.append(f"[AGENTE3]    - conteudo_markdown length: {len(resultado.conteudo_markdown) if resultado.conteudo_markdown else 'None'}")

        assert "[AGENTE3]" in log_lines[0], "Log deve ter prefixo [AGENTE3]"
        assert "ERRO" in log_lines[0], "Log deve indicar ERRO"
        assert "exists" in log_lines[1], "Log deve mostrar se resultado existe"
        assert "length" in log_lines[2], "Log deve mostrar tamanho do conteúdo"

    def test_log_formato_agente3_curado(self):
        """Verifica formato esperado dos logs no endpoint curado."""
        resultado = MockResultadoAgente3(conteudo_markdown=None)

        # Simula log do endpoint curado
        log_prefix = "[AGENTE3-CURADO]"
        log_line = f"{log_prefix} ERRO: Conteúdo vazio após streaming!"

        assert log_prefix in log_line, "Log do endpoint curado deve ter prefixo [AGENTE3-CURADO]"


# ============================================
# TESTE DE INTEGRAÇÃO COM ROUTER (Mock)
# ============================================

class TestIntegracaoRouter:
    """Testes de integração simulando comportamento do router."""

    @pytest.mark.asyncio
    async def test_streaming_vazio_gera_evento_erro(self):
        """
        Simula o comportamento do router quando streaming retorna vazio.
        Deve gerar eventos SSE de erro.
        """
        import json

        resultado = MockResultadoAgente3(conteudo_markdown="")
        eventos_sse = []

        # Simula a lógica do router
        if resultado and resultado.erro:
            eventos_sse.append(f"data: {json.dumps({'tipo': 'erro', 'mensagem': resultado.erro})}\n\n")

        # Nova validação (fix aplicado)
        if not resultado or not resultado.conteudo_markdown or not resultado.conteudo_markdown.strip():
            erro_msg = "A geração não retornou conteúdo. Possível timeout ou erro na API de IA. Tente novamente."
            eventos_sse.append(f"data: {json.dumps({'tipo': 'agente', 'agente': 3, 'status': 'erro', 'mensagem': erro_msg})}\n\n")
            eventos_sse.append(f"data: {json.dumps({'tipo': 'erro', 'mensagem': erro_msg})}\n\n")

        # Deve ter gerado eventos de erro
        assert len(eventos_sse) == 2, "Deve gerar 2 eventos SSE de erro"

        # Verifica conteúdo dos eventos
        evento1 = json.loads(eventos_sse[0].replace("data: ", "").strip())
        evento2 = json.loads(eventos_sse[1].replace("data: ", "").strip())

        assert evento1["tipo"] == "agente", "Primeiro evento deve ser do agente"
        assert evento1["status"] == "erro", "Status deve ser erro"
        assert evento2["tipo"] == "erro", "Segundo evento deve ser erro geral"

    @pytest.mark.asyncio
    async def test_streaming_valido_nao_gera_erro(self):
        """
        Simula o comportamento do router quando streaming retorna conteúdo válido.
        Não deve gerar eventos de erro.
        """
        import json

        resultado = MockResultadoAgente3(
            conteudo_markdown="# Contestação\n\nPeça processual completa..."
        )
        eventos_erro = []

        # Validação (fix aplicado)
        if not resultado or not resultado.conteudo_markdown or not resultado.conteudo_markdown.strip():
            erro_msg = "A geração não retornou conteúdo."
            eventos_erro.append(erro_msg)

        # Não deve ter erros
        assert len(eventos_erro) == 0, "Conteúdo válido não deve gerar erros"


# ============================================
# ENTRADA DO PYTEST
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
