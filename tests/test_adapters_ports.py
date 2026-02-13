# -*- coding: utf-8 -*-
"""
Testes para ports (interfaces DIP) e conformidade dos adapters.

Verifica:
- Interfaces (ports) definem contratos corretos
- Mocks satisfazem as interfaces (para testes futuros)
- Ports consolidados em app.domain.shared.protocols

Nota: Os adapters concretos do diretorio raiz (adapters/) foram removidos.
      Adapters canonicos estao em app/adapters/.
      Ports foram consolidados em app/domain/shared/protocols.
"""

import sys
from pathlib import Path
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.domain.shared.protocols import IGeminiPort, ITJMSPort, IBertPort


# ============================================
# Testes de Interface (Ports)
# ============================================


class TestIGeminiPort:
    """Testes para a interface IGeminiPort."""

    def test_port_is_protocol(self):
        assert hasattr(IGeminiPort, "__protocol_attrs__") or hasattr(IGeminiPort, "_is_protocol")

    def test_port_defines_generate(self):
        assert hasattr(IGeminiPort, "generate")

    def test_port_defines_generate_stream(self):
        assert hasattr(IGeminiPort, "generate_stream")

    def test_mock_satisfies_protocol(self):
        """Mock com metodos corretos satisfaz IGeminiPort."""
        mock = MagicMock()
        mock.generate = AsyncMock()
        mock.generate_stream = AsyncMock()
        assert isinstance(mock, IGeminiPort)


class TestITJMSPort:
    """Testes para a interface ITJMSPort."""

    def test_port_defines_consultar_processo(self):
        assert hasattr(ITJMSPort, "consultar_processo")

    def test_port_defines_baixar_documento(self):
        assert hasattr(ITJMSPort, "baixar_documento")

    def test_port_defines_consultar_codigos(self):
        assert hasattr(ITJMSPort, "consultar_codigos_documentos")

    def test_mock_satisfies_protocol(self):
        mock = MagicMock()
        mock.consultar_processo = AsyncMock()
        mock.baixar_documento = AsyncMock()
        mock.consultar_codigos_documentos = AsyncMock()
        assert isinstance(mock, ITJMSPort)


class TestIBertPort:
    """Testes para a interface IBertPort."""

    def test_port_defines_classify(self):
        assert hasattr(IBertPort, "classify")

    def test_port_defines_is_available(self):
        assert hasattr(IBertPort, "is_available")

    def test_mock_satisfies_protocol(self):
        mock = MagicMock()
        mock.classify = AsyncMock()
        mock.is_available = AsyncMock()
        assert isinstance(mock, IBertPort)


# ============================================
# Testes Estruturais
# ============================================


class TestStructural:
    """Verifica integridade estrutural dos protocols consolidados."""

    def test_protocols_file_exists(self):
        protocols_path = Path(__file__).parent.parent / "app" / "domain" / "shared" / "protocols.py"
        assert protocols_path.exists()

    def test_app_adapters_exist(self):
        """Adapters canonicos estao em app/adapters/."""
        adapters_dir = Path(__file__).parent.parent / "app" / "adapters"
        assert (adapters_dir / "gemini_adapter.py").exists()
        assert (adapters_dir / "tjms_adapter.py").exists()
        assert (adapters_dir / "bert_adapter.py").exists()

    def test_root_adapters_removed(self):
        """Diretorio adapters/ na raiz NAO deve existir."""
        root_adapters = Path(__file__).parent.parent / "adapters"
        assert not root_adapters.exists(), (
            f"Diretorio {root_adapters} deveria ter sido removido na consolidacao"
        )

    def test_protocols_use_protocol(self):
        """Protocols usam typing.Protocol (runtime checkable)."""
        protocols_path = Path(__file__).parent.parent / "app" / "domain" / "shared" / "protocols.py"
        content = protocols_path.read_text(encoding="utf-8")
        assert "Protocol" in content
        assert "runtime_checkable" in content

    def test_ports_importable_from_protocols(self):
        """Ports devem ser importaveis de app.domain.shared.protocols."""
        from app.domain.shared.protocols import IGeminiPort, ITJMSPort, IBertPort
        assert IGeminiPort is not None
        assert ITJMSPort is not None
        assert IBertPort is not None


# ============================================
# Mock Adapters (para uso em testes futuros)
# ============================================


class MockGeminiAdapter:
    """Mock do adapter Gemini para testes."""

    def __init__(self, responses: dict[str, str] | None = None):
        self._responses = responses or {}
        self.calls: list[dict] = []

    async def generate(self, prompt: str, **kwargs) -> Any:
        self.calls.append({"method": "generate", "prompt": prompt, **kwargs})
        response = MagicMock()
        response.success = True
        response.content = self._responses.get("generate", "Resposta mock")
        response.error = None
        return response

    async def generate_stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        self.calls.append({"method": "generate_stream", "prompt": prompt, **kwargs})

        async def _stream():
            for word in self._responses.get("stream", "token1 token2").split():
                yield word

        return _stream()


class MockTJMSAdapter:
    """Mock do adapter TJ-MS para testes."""

    def __init__(self, xml_response: str = "<processo/>"):
        self._xml = xml_response
        self.calls: list[dict] = []

    async def consultar_processo(self, numero_cnj: str, **kwargs) -> str:
        self.calls.append({"method": "consultar_processo", "cnj": numero_cnj})
        return self._xml

    async def baixar_documento(self, numero_cnj: str, documento_id: str, **kwargs) -> bytes:
        self.calls.append({"method": "baixar_documento", "cnj": numero_cnj, "doc_id": documento_id})
        return b"%PDF-1.4 mock content"

    async def consultar_codigos_documentos(self, numero_cnj: str, **kwargs) -> list[int]:
        self.calls.append({"method": "consultar_codigos", "cnj": numero_cnj})
        return [500, 9500, 8369]


class TestMockAdapters:
    """Verifica que mocks satisfazem as interfaces."""

    def test_mock_gemini_satisfies_port(self):
        mock = MockGeminiAdapter()
        assert isinstance(mock, IGeminiPort)

    def test_mock_tjms_satisfies_port(self):
        mock = MockTJMSAdapter()
        assert isinstance(mock, ITJMSPort)
