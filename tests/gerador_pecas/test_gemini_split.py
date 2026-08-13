# tests/test_gemini_split.py
"""
Testes de compatibilidade da refatoração do gemini_service.

Garante que:
1. Imports antigos continuam funcionando
2. Imports novos funcionam
3. As classes/funções são as mesmas
4. Funcionalidade não quebrou
"""

import pytest

pytestmark = pytest.mark.unit


class TestGeminiSplitCompatibilidadeImports:
    """Testa que imports antigos e novos funcionam igualmente"""

    def test_import_antigo_gemini_service_funciona(self):
        """Import de services.gemini_service continua funcionando"""
        from services.gemini_service import GeminiService
        assert GeminiService is not None
        assert hasattr(GeminiService, "generate")
        assert hasattr(GeminiService, "generate_with_images")

    def test_import_antigo_gemini_response_funciona(self):
        """Import de GeminiResponse do módulo original"""
        from services.gemini_service import GeminiResponse
        assert GeminiResponse is not None

    def test_import_antigo_gemini_metrics_funciona(self):
        """Import de GeminiMetrics do módulo original"""
        from services.gemini_service import GeminiMetrics
        assert GeminiMetrics is not None

    def test_import_novo_submodulo_metrics(self):
        """Import direto do submódulo metrics"""
        from services.gemini.metrics import GeminiMetrics, GeminiResponse
        assert GeminiMetrics is not None
        assert GeminiResponse is not None

    def test_import_novo_submodulo_config(self):
        """Import direto do submódulo config"""
        from services.gemini.config import (
            TIMEOUT_CONNECT,
            MAX_RETRIES,
            get_http_client,
        )
        assert TIMEOUT_CONNECT > 0
        assert MAX_RETRIES > 0
        assert callable(get_http_client)

    def test_import_novo_submodulo_payloads(self):
        """Import direto do submódulo payloads"""
        from services.gemini.payloads import build_payload, build_payload_with_images
        assert callable(build_payload)
        assert callable(build_payload_with_images)

    def test_import_novo_submodulo_parsers(self):
        """Import direto do submódulo parsers"""
        from services.gemini.parsers import (
            extract_content,
            extract_tokens,
            extract_grounding_metadata,
        )
        assert callable(extract_content)
        assert callable(extract_tokens)
        assert callable(extract_grounding_metadata)


class TestGeminiSplitCompatibilidadeClasses:
    """Testa que as classes são idênticas entre imports"""

    def test_gemini_response_mesma_classe(self):
        """GeminiResponse importado de diferentes lugares deve ser a mesma classe"""
        from services.gemini_service import GeminiResponse as OldResponse
        from services.gemini.metrics import GeminiResponse as NewResponse
        assert OldResponse is NewResponse

    def test_gemini_metrics_mesma_classe(self):
        """GeminiMetrics importado de diferentes lugares deve ser a mesma classe"""
        from services.gemini_service import GeminiMetrics as OldMetrics
        from services.gemini.metrics import GeminiMetrics as NewMetrics
        assert OldMetrics is NewMetrics


class TestGeminiSplitFuncionalidade:
    """Testa que a funcionalidade não quebrou"""

    def test_gemini_response_criacao(self):
        """GeminiResponse pode ser criado normalmente"""
        from services.gemini_service import GeminiResponse

        response = GeminiResponse(
            success=True,
            content="Teste",
            tokens_used=10
        )

        assert response.success is True
        assert response.content == "Teste"
        assert response.tokens_used == 10

    def test_gemini_metrics_criacao(self):
        """GeminiMetrics pode ser criado e tem método to_dict"""
        from services.gemini_service import GeminiMetrics

        metrics = GeminiMetrics(
            model="gemini-3.6-flash",
            prompt_chars=100,
            response_tokens=50
        )

        assert metrics.model == "gemini-3.6-flash"
        assert metrics.prompt_chars == 100
        assert metrics.response_tokens == 50

        # Método to_dict deve funcionar
        metrics_dict = metrics.to_dict()
        assert isinstance(metrics_dict, dict)
        assert metrics_dict["model"] == "gemini-3.6-flash"

    def test_build_payload_funciona(self):
        """Função build_payload retorna estrutura correta"""
        from services.gemini.payloads import build_payload

        payload = build_payload(
            prompt="Teste",
            system_prompt="Sistema",
            temperature=0.5
        )

        assert isinstance(payload, dict)
        assert "contents" in payload
        assert "generationConfig" in payload
        assert payload["generationConfig"]["temperature"] == 0.5

    def test_build_payload_with_images_funciona(self):
        """Função build_payload_with_images retorna estrutura correta"""
        from services.gemini.payloads import build_payload_with_images

        payload = build_payload_with_images(
            prompt="Descreva",
            images_base64=["base64data"],
            temperature=0.3
        )

        assert isinstance(payload, dict)
        assert "contents" in payload
        assert len(payload["contents"][0]["parts"]) == 2  # imagem + texto

    def test_extract_content_resposta_vazia(self):
        """Parser extract_content retorna string vazia para resposta vazia"""
        from services.gemini.parsers import extract_content

        content = extract_content({})
        assert content == ""

    def test_extract_content_resposta_valida(self):
        """Parser extract_content extrai texto corretamente"""
        from services.gemini.parsers import extract_content

        data = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Resposta teste"}]
                    }
                }
            ]
        }

        content = extract_content(data)
        assert content == "Resposta teste"

    def test_extract_tokens_resposta_valida(self):
        """Parser extract_tokens extrai contagem corretamente"""
        from services.gemini.parsers import extract_tokens

        data = {
            "usageMetadata": {
                "totalTokenCount": 42
            }
        }

        tokens = extract_tokens(data)
        assert tokens == 42

    def test_gemini_service_normalize_model(self):
        """GeminiService.normalize_model funciona"""
        from services.gemini_service import GeminiService

        # Remove prefixo google/
        assert GeminiService.normalize_model("google/gemini-3.6-flash") == "gemini-3.6-flash"

        # Converte aliases
        assert "gemini" in GeminiService.normalize_model("flash")
        assert "gemini" in GeminiService.normalize_model("pro")

    def test_gemini_service_get_model_for_task(self):
        """GeminiService.get_model_for_task retorna modelo válido"""
        from services.gemini_service import GeminiService

        service = GeminiService()

        modelo_resumo = service.get_model_for_task("resumo")
        assert isinstance(modelo_resumo, str)
        assert "gemini" in modelo_resumo.lower()

        modelo_geracao = service.get_model_for_task("geracao")
        assert isinstance(modelo_geracao, str)
        assert "gemini" in modelo_geracao.lower()


class TestGeminiSplitSingleton:
    """Testa que singletons continuam funcionando"""

    def test_response_cache_singleton_acessivel(self):
        """Cache singleton _response_cache é acessível"""
        from services.gemini_service import _response_cache
        assert _response_cache is not None
        assert hasattr(_response_cache, "get")
        assert hasattr(_response_cache, "set")
        assert hasattr(_response_cache, "stats")

    def test_cache_stats_funciona(self):
        """Função get_cache_stats retorna dict"""
        from services.gemini_service import get_cache_stats

        stats = get_cache_stats()
        assert isinstance(stats, dict)
        assert "size" in stats
        assert "hits" in stats
        assert "misses" in stats


class TestGeminiSplitDelegacao:
    """Testa que métodos privados delegam corretamente aos submódulos"""

    def test_gemini_service_build_payload_delega(self):
        """GeminiService._build_payload delega para payloads.build_payload"""
        from services.gemini_service import GeminiService

        service = GeminiService()
        payload = service._build_payload(
            prompt="Teste",
            temperature=0.7
        )

        assert isinstance(payload, dict)
        assert payload["generationConfig"]["temperature"] == 0.7

    def test_gemini_service_extract_content_delega(self):
        """GeminiService._extract_content delega para parsers.extract_content"""
        from services.gemini_service import GeminiService

        service = GeminiService()
        data = {
            "candidates": [
                {"content": {"parts": [{"text": "Teste"}]}}
            ]
        }

        content = service._extract_content(data)
        assert content == "Teste"

    def test_gemini_service_extract_tokens_delega(self):
        """GeminiService._extract_tokens delega para parsers.extract_tokens"""
        from services.gemini_service import GeminiService

        service = GeminiService()
        data = {"usageMetadata": {"totalTokenCount": 99}}

        tokens = service._extract_tokens(data)
        assert tokens == 99
