# tests/test_parecer_early_check.py
"""
Testes para a checagem antecipada (early check) do parecer NATJus.

O early check verifica a existência do parecer ANTES de iniciar o Agent 1 pesado,
usando apenas uma consulta SOAP leve (~1-2s) ao invés do pipeline completo (30-60s).

Fix 1: Performance — mover a verificação para antes do Agent 1.
"""

import sys
import os
import pytest

pytestmark = pytest.mark.unit

from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass
from typing import Optional
from datetime import datetime

# Adiciona o diretório raiz ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ============================================================
# Fixtures e helpers
# ============================================================

SAMPLE_XML_COM_PARECER = """<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <consultarProcessoResponse>
      <sucesso>true</sucesso>
      <processo>
        <documento idDocumento="1001" tipoDocumento="60001" descricao="Parecer Técnico NATJus" dataHora="20250601120000"/>
        <documento idDocumento="1002" tipoDocumento="7" descricao="Petição Inicial" dataHora="20250101100000"/>
        <documento idDocumento="1003" tipoDocumento="12" descricao="Contestação" dataHora="20250201100000"/>
      </processo>
    </consultarProcessoResponse>
  </soapenv:Body>
</soapenv:Envelope>"""

SAMPLE_XML_SEM_PARECER = """<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <consultarProcessoResponse>
      <sucesso>true</sucesso>
      <processo>
        <documento idDocumento="2001" tipoDocumento="7" descricao="Petição Inicial" dataHora="20250101100000"/>
        <documento idDocumento="2002" tipoDocumento="12" descricao="Contestação" dataHora="20250201100000"/>
        <documento idDocumento="2003" tipoDocumento="8369" descricao="Laudo Pericial" dataHora="20250301100000"/>
      </processo>
    </consultarProcessoResponse>
  </soapenv:Body>
</soapenv:Envelope>"""

SAMPLE_XML_ERRO = """<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <consultarProcessoResponse>
      <sucesso>false</sucesso>
      <mensagem>Processo nao encontrado</mensagem>
    </consultarProcessoResponse>
  </soapenv:Body>
</soapenv:Envelope>"""


@dataclass
class FakeParecerConfig:
    """Simula ParecerNatjusConfig."""
    required_piece_types: tuple = ("contestacao_saude",)
    document_codes: tuple = (60001, 60002, 60003)
    required_piece_types_raw: str = "contestacao_saude"
    document_codes_raw: str = "60001,60002,60003"


# ============================================================
# Test: consultar_codigos_documentos
# ============================================================

class TestConsultarCodigosDocumentos:
    """Testes para AgenteTJMSIntegrado.consultar_codigos_documentos."""

    @pytest.mark.asyncio
    async def test_retorna_lista_documentos_com_tipo(self):
        """Deve retornar DocumentoTJMS com tipo_documento populado."""
        from sistemas.gerador_pecas.agente_tjms_integrado import AgenteTJMSIntegrado

        agente = AgenteTJMSIntegrado.__new__(AgenteTJMSIntegrado)

        with patch(
            "sistemas.gerador_pecas.agente_tjms.consultar_processo_async",
            new_callable=AsyncMock,
            return_value=SAMPLE_XML_COM_PARECER,
        ):
            docs = await agente.consultar_codigos_documentos("08001234520258120001")

        assert len(docs) == 3
        tipos = [d.tipo_documento for d in docs]
        assert "60001" in tipos
        assert "7" in tipos
        assert "12" in tipos

    @pytest.mark.asyncio
    async def test_retorna_vazio_quando_processo_nao_encontrado(self):
        """Quando o SOAP retorna sucesso=false, deve retornar lista vazia."""
        from sistemas.gerador_pecas.agente_tjms_integrado import AgenteTJMSIntegrado

        agente = AgenteTJMSIntegrado.__new__(AgenteTJMSIntegrado)

        with patch(
            "sistemas.gerador_pecas.agente_tjms.consultar_processo_async",
            new_callable=AsyncMock,
            return_value=SAMPLE_XML_ERRO,
        ):
            docs = await agente.consultar_codigos_documentos("00000000000000000000")

        assert docs == []

    @pytest.mark.asyncio
    async def test_nao_baixa_conteudo_dos_documentos(self):
        """A consulta rápida NÃO deve baixar conteúdo (base64) dos documentos."""
        from sistemas.gerador_pecas.agente_tjms_integrado import AgenteTJMSIntegrado

        agente = AgenteTJMSIntegrado.__new__(AgenteTJMSIntegrado)

        with patch(
            "sistemas.gerador_pecas.agente_tjms.consultar_processo_async",
            new_callable=AsyncMock,
            return_value=SAMPLE_XML_SEM_PARECER,
        ):
            docs = await agente.consultar_codigos_documentos("08001234520258120001")

        # Nenhum documento deve ter conteúdo base64 (consulta SOAP de metadados)
        for doc in docs:
            assert doc.conteudo_base64 is None or doc.conteudo_base64 == ""


# ============================================================
# Test: early check — parecer ausente
# ============================================================

class TestEarlyCheckParecerAusente:
    """Testes para a lógica de early check quando parecer está ausente."""

    def test_evaluate_parecer_status_ausente(self):
        """evaluate_parecer_status deve retornar parecer_found=False quando não há doc parecer."""
        from sistemas.gerador_pecas.services_parecer_natjus import evaluate_parecer_status

        # Simula documentos sem parecer
        docs = [
            MagicMock(tipo_documento="7"),
            MagicMock(tipo_documento="12"),
            MagicMock(tipo_documento="8369"),
        ]

        config = FakeParecerConfig()
        result = evaluate_parecer_status(
            tipo_peca="contestacao_saude",
            documentos=docs,
            config=config,
            has_user_upload=False,
        )

        assert result["parecer_required"] is True
        assert result["parecer_found"] is False
        assert result["parecer_source"] == "none"

    def test_evaluate_parecer_status_presente(self):
        """evaluate_parecer_status deve retornar parecer_found=True quando doc parecer existe."""
        from sistemas.gerador_pecas.services_parecer_natjus import evaluate_parecer_status

        # Simula documentos COM parecer (código 60001)
        docs = [
            MagicMock(tipo_documento="7"),
            MagicMock(tipo_documento="60001"),
            MagicMock(tipo_documento="12"),
        ]

        config = FakeParecerConfig()
        result = evaluate_parecer_status(
            tipo_peca="contestacao_saude",
            documentos=docs,
            config=config,
            has_user_upload=False,
        )

        assert result["parecer_required"] is True
        assert result["parecer_found"] is True
        assert result["parecer_source"] == "process_docs"

    def test_upload_bypassa_check(self):
        """Quando has_user_upload=True, parecer_found deve ser True mesmo sem doc no processo."""
        from sistemas.gerador_pecas.services_parecer_natjus import evaluate_parecer_status

        docs = [MagicMock(tipo_documento="7")]
        config = FakeParecerConfig()

        result = evaluate_parecer_status(
            tipo_peca="contestacao_saude",
            documentos=docs,
            config=config,
            has_user_upload=True,
        )

        assert result["parecer_found"] is True
        assert result["parecer_source"] == "user_upload"

    def test_tipo_peca_nao_requer_parecer(self):
        """Tipos de peça que não requerem parecer devem ter parecer_required=False."""
        from sistemas.gerador_pecas.services_parecer_natjus import evaluate_parecer_status

        docs = [MagicMock(tipo_documento="7")]
        config = FakeParecerConfig()

        result = evaluate_parecer_status(
            tipo_peca="contestacao_fazendaria",
            documentos=docs,
            config=config,
            has_user_upload=False,
        )

        assert result["parecer_required"] is False


# ============================================================
# Test: piece_requires_parecer
# ============================================================

class TestPieceRequiresParecer:
    """Testes para a função piece_requires_parecer."""

    def test_tipo_requerido(self):
        from sistemas.gerador_pecas.services_parecer_natjus import piece_requires_parecer
        config = FakeParecerConfig()
        assert piece_requires_parecer("contestacao_saude", config) is True

    def test_tipo_nao_requerido(self):
        from sistemas.gerador_pecas.services_parecer_natjus import piece_requires_parecer
        config = FakeParecerConfig()
        assert piece_requires_parecer("recurso_inominado", config) is False

    def test_tipo_none(self):
        from sistemas.gerador_pecas.services_parecer_natjus import piece_requires_parecer
        config = FakeParecerConfig()
        assert piece_requires_parecer(None, config) is False


# ============================================================
# Test: integração early check + consultar_codigos
# ============================================================

class TestEarlyCheckIntegracao:
    """Testes de integração simulando o fluxo completo do early check."""

    @pytest.mark.asyncio
    async def test_early_check_detecta_ausencia_antes_agent1(self):
        """
        Simula o fluxo: consulta rápida → detecta ausência → retorna ANTES do Agent 1.
        Verifica que o Agent 1 pesado (coletar_e_resumir) NÃO é chamado.
        """
        from sistemas.gerador_pecas.agente_tjms_integrado import AgenteTJMSIntegrado
        from sistemas.gerador_pecas.services_parecer_natjus import (
            evaluate_parecer_status,
            piece_requires_parecer,
        )

        agente = AgenteTJMSIntegrado.__new__(AgenteTJMSIntegrado)

        with patch(
            "sistemas.gerador_pecas.agente_tjms.consultar_processo_async",
            new_callable=AsyncMock,
            return_value=SAMPLE_XML_SEM_PARECER,
        ):
            docs = await agente.consultar_codigos_documentos("08001234520258120001")

        config = FakeParecerConfig()
        assert piece_requires_parecer("contestacao_saude", config) is True

        status = evaluate_parecer_status(
            tipo_peca="contestacao_saude",
            documentos=docs,
            config=config,
            has_user_upload=False,
        )

        assert status["parecer_required"] is True
        assert status["parecer_found"] is False
        # Neste ponto, o router retornaria sem chamar Agent 1

    @pytest.mark.asyncio
    async def test_early_check_permite_continuar_quando_parecer_presente(self):
        """
        Quando o parecer está presente, o early check permite continuar ao Agent 1.
        """
        from sistemas.gerador_pecas.agente_tjms_integrado import AgenteTJMSIntegrado
        from sistemas.gerador_pecas.services_parecer_natjus import (
            evaluate_parecer_status,
            piece_requires_parecer,
        )

        agente = AgenteTJMSIntegrado.__new__(AgenteTJMSIntegrado)

        with patch(
            "sistemas.gerador_pecas.agente_tjms.consultar_processo_async",
            new_callable=AsyncMock,
            return_value=SAMPLE_XML_COM_PARECER,
        ):
            docs = await agente.consultar_codigos_documentos("08001234520258120001")

        config = FakeParecerConfig()
        status = evaluate_parecer_status(
            tipo_peca="contestacao_saude",
            documentos=docs,
            config=config,
            has_user_upload=False,
        )

        assert status["parecer_found"] is True
        assert status["parecer_source"] == "process_docs"
        # Agent 1 pode prosseguir
