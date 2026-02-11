# -*- coding: utf-8 -*-
"""
Testes para sistemas/extrator_autos/services_bert_client.py.

Cobre normalize_label, classify (mock HTTP) e check_health.
"""

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from sistemas.extrator_autos.services_bert_client import BertClassifierClient


# ==================================================================
# Testes de normalize_label
# ==================================================================


class TestNormalizeLabel:
    """Testes de normalizacao de labels (acentos, caixa, espacos)."""

    def test_remove_acento_contestacao(self):
        """'Contestacao' com cedilha deve virar 'contestacao'."""
        assert BertClassifierClient.normalize_label("Contestacao") == "contestacao"

    def test_uppercase_para_lowercase(self):
        """Label em caixa alta deve virar caixa baixa."""
        assert BertClassifierClient.normalize_label("CONTESTACAO") == "contestacao"

    def test_ja_normalizado_permanece_igual(self):
        """Label ja em formato normalizado nao deve mudar."""
        assert BertClassifierClient.normalize_label("contestacao") == "contestacao"

    def test_remove_acento_replica(self):
        """'Replica' com acento agudo deve virar 'replica'."""
        assert BertClassifierClient.normalize_label("Réplica") == "replica"

    def test_string_vazia_retorna_vazia(self):
        """String vazia nao deve causar erro."""
        assert BertClassifierClient.normalize_label("") == ""


# ==================================================================
# Testes de classify (mock HTTP)
# ==================================================================


def _criar_mock_httpx_module(async_client_factory):
    """Cria um modulo httpx fake com AsyncClient configuravel."""
    mock_module = MagicMock()
    mock_module.AsyncClient = async_client_factory
    return mock_module


class TestClassify:
    """Testes de classificacao com dependencias externas mockadas."""

    @pytest.mark.asyncio
    async def test_classify_http_sucesso(self):
        """Retorna resultado correto quando o endpoint HTTP responde 200."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "predicted_label": "contestacao",
            "confidence": 0.95,
        }

        mock_async_client = AsyncMock()
        mock_async_client.post.return_value = mock_response
        mock_async_client.__aenter__.return_value = mock_async_client
        mock_async_client.__aexit__.return_value = False

        mock_httpx = _criar_mock_httpx_module(
            lambda **kwargs: mock_async_client
        )

        with patch.dict(sys.modules, {"httpx": mock_httpx}):
            client = BertClassifierClient(
                endpoint="http://fake:8765", model_path=""
            )
            resultado = await client.classify("texto de teste")

        assert resultado["predicted_label"] == "contestacao"
        assert resultado["confidence"] == 0.95
        assert resultado["source"] == "http"

    @pytest.mark.asyncio
    async def test_classify_http_falha_sem_fallback_local(self):
        """Retorna erro quando HTTP falha e nao ha modelo local."""
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.side_effect = Exception("Conexao recusada")

        mock_httpx = _criar_mock_httpx_module(
            lambda **kwargs: mock_async_client
        )

        with patch.dict(sys.modules, {"httpx": mock_httpx}):
            client = BertClassifierClient(
                endpoint="http://fake:8765", model_path=""
            )
            resultado = await client.classify("texto de teste")

        assert resultado["source"] == "error"
        assert resultado["predicted_label"] == ""
        assert resultado["confidence"] == 0.0
        assert "error" in resultado


# ==================================================================
# Testes de check_health
# ==================================================================


class TestCheckHealth:
    """Testes de verificacao de saude do servico BERT."""

    @pytest.mark.asyncio
    async def test_classify_com_model_name_override(self):
        """model_name passado ao classify() sobrepoe self.model_name."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "predicted_label": "contestacao",
            "confidence": 0.92,
        }

        captured_payloads = []
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.return_value = mock_async_client
        mock_async_client.__aexit__.return_value = False

        async def capture_post(url, json=None):
            captured_payloads.append(json)
            return mock_response
        mock_async_client.post.side_effect = capture_post

        mock_httpx = _criar_mock_httpx_module(
            lambda **kwargs: mock_async_client
        )

        with patch.dict(sys.modules, {"httpx": mock_httpx}):
            client = BertClassifierClient(
                endpoint="http://fake:8765",
                model_name="modelo_antigo",
            )
            resultado = await client.classify("texto", model_name="model_run_5")

        assert resultado["predicted_label"] == "contestacao"
        assert resultado["source"] == "http"
        assert len(captured_payloads) == 1
        assert captured_payloads[0]["model"] == "model_run_5"

    @pytest.mark.asyncio
    async def test_classify_sem_model_name_usa_default(self):
        """Sem model_name no classify(), usa self.model_name."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "predicted_label": "sentenca",
            "confidence": 0.88,
        }

        captured_payloads = []
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.return_value = mock_async_client
        mock_async_client.__aexit__.return_value = False

        async def capture_post(url, json=None):
            captured_payloads.append(json)
            return mock_response
        mock_async_client.post.side_effect = capture_post

        mock_httpx = _criar_mock_httpx_module(
            lambda **kwargs: mock_async_client
        )

        with patch.dict(sys.modules, {"httpx": mock_httpx}):
            client = BertClassifierClient(
                endpoint="http://fake:8765",
                model_name="modelo_default",
            )
            resultado = await client.classify("texto")

        assert resultado["predicted_label"] == "sentenca"
        assert captured_payloads[0]["model"] == "modelo_default"

    @pytest.mark.asyncio
    async def test_classify_http_payload_sem_model_quando_vazio(self):
        """Quando model_name efetivo e vazio, payload NAO inclui 'model'."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "predicted_label": "outro",
            "confidence": 0.70,
        }

        captured_payloads = []
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.return_value = mock_async_client
        mock_async_client.__aexit__.return_value = False

        async def capture_post(url, json=None):
            captured_payloads.append(json)
            return mock_response
        mock_async_client.post.side_effect = capture_post

        mock_httpx = _criar_mock_httpx_module(
            lambda **kwargs: mock_async_client
        )

        with patch.dict(sys.modules, {"httpx": mock_httpx}):
            client = BertClassifierClient(
                endpoint="http://fake:8765",
                model_name="",
            )
            await client.classify("texto")

        assert "model" not in captured_payloads[0]

    @pytest.mark.asyncio
    async def test_retorna_indisponivel_sem_endpoint_e_sem_modelo(self):
        """Sem endpoint HTTP e sem modelo local, available deve ser False."""
        mock_async_client = AsyncMock()
        mock_async_client.get.side_effect = Exception("Connection refused")
        mock_async_client.__aenter__.return_value = mock_async_client
        mock_async_client.__aexit__.return_value = False

        mock_httpx = _criar_mock_httpx_module(
            lambda **kwargs: mock_async_client
        )

        with patch.dict(sys.modules, {"httpx": mock_httpx}):
            client = BertClassifierClient(
                endpoint="http://fake:8765", model_path=""
            )
            resultado = await client.check_health()

        assert resultado["available"] is False
        assert resultado["mode"] == "none"
