"""
Testes unitários para os adaptadores (ports/adapters pattern).

Verifica que os adapters:
- Instanciam sem erro
- Implementam os protocolos corretos
- Expõem a interface esperada
"""

import pytest
from typing import Protocol, runtime_checkable
from unittest.mock import AsyncMock, MagicMock, patch

from app.adapters import GeminiAdapter, TJMSAdapter, BertAdapter
from app.domain.shared.protocols import (
    AIServiceProtocol,
    TJMSClientProtocol,
    DocumentClassifierProtocol,
)


pytestmark = pytest.mark.unit


# ==================== TESTES DO GEMINI ADAPTER ====================


class TestGeminiAdapter:
    """Testes para o GeminiAdapter."""

    def test_gemini_adapter_instancia_sem_erro(self):
        """GeminiAdapter deve instanciar sem erro."""
        with patch("services.gemini_service.GeminiService"):
            adapter = GeminiAdapter()
            assert adapter is not None

    def test_gemini_adapter_implementa_protocolo(self):
        """GeminiAdapter deve implementar AIServiceProtocol."""
        with patch("services.gemini_service.GeminiService"):
            adapter = GeminiAdapter()

            # Verifica que os métodos do protocolo existem
            assert hasattr(adapter, "gerar_texto")
            assert hasattr(adapter, "gerar_streaming")
            assert callable(adapter.gerar_texto)
            assert callable(adapter.gerar_streaming)

    @pytest.mark.asyncio
    async def test_gemini_adapter_gerar_texto(self):
        """gerar_texto deve chamar o GeminiService corretamente."""
        mock_response = MagicMock()
        mock_response.success = True
        mock_response.content = "Texto gerado pela IA"

        mock_service = MagicMock()
        mock_service.generate = AsyncMock(return_value=mock_response)

        with patch(
            "services.gemini_service.GeminiService",
            return_value=mock_service
        ):
            adapter = GeminiAdapter()
            result = await adapter.gerar_texto(
                prompt="Olá, mundo!",
                modelo="flash",
                temperatura=0.7
            )

            assert result == "Texto gerado pela IA"
            mock_service.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_gemini_adapter_gerar_texto_falha(self):
        """gerar_texto deve retornar string vazia em caso de falha."""
        mock_response = MagicMock()
        mock_response.success = False
        mock_response.content = ""

        mock_service = MagicMock()
        mock_service.generate = AsyncMock(return_value=mock_response)

        with patch(
            "services.gemini_service.GeminiService",
            return_value=mock_service
        ):
            adapter = GeminiAdapter()
            result = await adapter.gerar_texto("Prompt qualquer")

            assert result == ""

    @pytest.mark.asyncio
    async def test_gemini_adapter_gerar_streaming(self):
        """gerar_streaming deve fazer streaming corretamente."""
        async def mock_stream(*args, **kwargs):
            """Mock generator que simula streaming."""
            yield "Chunk 1"
            yield "Chunk 2"
            yield "Chunk 3"

        mock_service = MagicMock()
        mock_service.generate_stream = mock_stream

        with patch(
            "services.gemini_service.GeminiService",
            return_value=mock_service
        ):
            adapter = GeminiAdapter()
            chunks = []

            async for chunk in adapter.gerar_streaming("Prompt qualquer"):
                chunks.append(chunk)

            assert chunks == ["Chunk 1", "Chunk 2", "Chunk 3"]


# ==================== TESTES DO TJMS ADAPTER ====================


class TestTJMSAdapter:
    """Testes para o TJMSAdapter."""

    def test_tjms_adapter_instancia_sem_erro(self):
        """TJMSAdapter deve instanciar sem erro."""
        with patch("services.tjms.client.TJMSClient"):
            adapter = TJMSAdapter()
            assert adapter is not None

    def test_tjms_adapter_implementa_protocolo(self):
        """TJMSAdapter deve implementar TJMSClientProtocol."""
        with patch("services.tjms.client.TJMSClient"):
            adapter = TJMSAdapter()

            # Verifica que os métodos do protocolo existem
            assert hasattr(adapter, "consultar_processo")
            assert hasattr(adapter, "baixar_documento")
            assert callable(adapter.consultar_processo)
            assert callable(adapter.baixar_documento)

    @pytest.mark.asyncio
    async def test_tjms_adapter_consultar_processo(self):
        """consultar_processo deve chamar o TJMSClient corretamente."""
        mock_processo = MagicMock()
        mock_processo.model_dump = MagicMock(
            return_value={"numero": "0808281-22.2025.8.12.0002"}
        )

        mock_client = MagicMock()
        mock_client.consultar_processo = AsyncMock(return_value=mock_processo)

        with patch(
            "services.tjms.client.TJMSClient",
            return_value=mock_client
        ):
            adapter = TJMSAdapter()
            result = await adapter.consultar_processo("0808281-22.2025.8.12.0002")

            assert result == {"numero": "0808281-22.2025.8.12.0002"}
            mock_client.consultar_processo.assert_called_once()

    @pytest.mark.asyncio
    async def test_tjms_adapter_baixar_documento(self):
        """baixar_documento deve retornar bytes do PDF."""
        mock_documento = MagicMock()
        mock_documento.conteudo = b"PDF content"

        mock_client = MagicMock()
        mock_client.baixar_documento = AsyncMock(return_value=mock_documento)

        with patch(
            "services.tjms.client.TJMSClient",
            return_value=mock_client
        ):
            adapter = TJMSAdapter()
            result = await adapter.baixar_documento(
                codigo_documento=8369,
                numero_cnj="0808281-22.2025.8.12.0002"
            )

            assert result == b"PDF content"
            mock_client.baixar_documento.assert_called_once()


# ==================== TESTES DO BERT ADAPTER ====================


class TestBertAdapter:
    """Testes para o BertAdapter."""

    def test_bert_adapter_instancia_sem_erro(self):
        """BertAdapter deve instanciar sem erro."""
        with patch("sistemas.extrator_autos.services_bert_client.BertClassifierClient"):
            adapter = BertAdapter()
            assert adapter is not None

    def test_bert_adapter_implementa_protocolo(self):
        """BertAdapter deve implementar DocumentClassifierProtocol."""
        with patch("sistemas.extrator_autos.services_bert_client.BertClassifierClient"):
            adapter = BertAdapter()

            # Verifica que os métodos do protocolo existem
            assert hasattr(adapter, "classificar")
            assert callable(adapter.classificar)

    @pytest.mark.asyncio
    async def test_bert_adapter_classificar(self):
        """classificar deve chamar o BertClassifierClient corretamente."""
        mock_result = {
            "predicted_label": "contestacao",
            "confidence": 0.95,
            "source": "http"
        }

        mock_client = MagicMock()
        mock_client.classify = AsyncMock(return_value=mock_result)

        with patch(
            "sistemas.extrator_autos.services_bert_client.BertClassifierClient",
            return_value=mock_client
        ):
            adapter = BertAdapter()
            result = await adapter.classificar("Texto do documento...")

            assert result["categoria"] == "contestacao"
            assert result["confianca"] == 0.95
            assert result["fonte"] == "http"
            mock_client.classify.assert_called_once()

    @pytest.mark.asyncio
    async def test_bert_adapter_classificar_abaixo_threshold(self):
        """classificar deve retornar categoria vazia se confiança < threshold."""
        mock_result = {
            "predicted_label": "contestacao",
            "confidence": 0.4,
            "source": "http"
        }

        mock_client = MagicMock()
        mock_client.classify = AsyncMock(return_value=mock_result)

        with patch(
            "sistemas.extrator_autos.services_bert_client.BertClassifierClient",
            return_value=mock_client
        ):
            adapter = BertAdapter()
            result = await adapter.classificar(
                "Texto duvidoso...",
                threshold=0.5
            )

            # Confiança 0.4 < threshold 0.5 → categoria vazia
            assert result["categoria"] == ""
            assert result["confianca"] == 0.4

    @pytest.mark.asyncio
    async def test_bert_adapter_classificar_com_model_name(self):
        """classificar deve passar model_name para o cliente."""
        mock_result = {
            "predicted_label": "contestacao",
            "confidence": 0.95,
            "source": "http"
        }

        mock_client = MagicMock()
        mock_client.classify = AsyncMock(return_value=mock_result)

        with patch(
            "sistemas.extrator_autos.services_bert_client.BertClassifierClient",
            return_value=mock_client
        ):
            adapter = BertAdapter()
            await adapter.classificar(
                "Texto...",
                model_name="model_run_5"
            )

            # Verifica que model_name foi passado
            call_args = mock_client.classify.call_args
            assert call_args.kwargs["model_name"] == "model_run_5"


# ==================== TESTE DE CONFORMIDADE COM PROTOCOLOS ====================


def test_todos_adapters_exportados():
    """__all__ deve exportar todos os adapters."""
    from app.adapters import __all__

    assert "GeminiAdapter" in __all__
    assert "TJMSAdapter" in __all__
    assert "BertAdapter" in __all__


def test_adapters_podem_ser_importados():
    """Adapters devem ser importáveis do módulo principal."""
    from app.adapters import GeminiAdapter, TJMSAdapter, BertAdapter

    assert GeminiAdapter is not None
    assert TJMSAdapter is not None
    assert BertAdapter is not None
