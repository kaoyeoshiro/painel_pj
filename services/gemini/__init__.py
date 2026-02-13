# services/gemini/__init__.py
"""
Subpacote Gemini — acesso à API Google Gemini.

Estrutura modular:
- metrics.py: Métricas e cache de respostas
- config.py: Configuração HTTP, timeouts e retry
- payloads.py: Construção de payloads para API
- parsers.py: Extração de conteúdo das respostas

COMPATIBILIDADE: Este módulo mantém 100% de compatibilidade com imports existentes.
A classe GeminiService ainda está em services/gemini_service.py até migração completa.
"""

# Re-exporta componentes para uso direto
from .metrics import (
    GeminiMetrics,
    GeminiResponse,
    ResponseCache,
    _response_cache,
)
from .config import (
    TIMEOUT_CONNECT,
    TIMEOUT_READ,
    TIMEOUT_TOTAL,
    MAX_RETRIES,
    RETRY_BASE_DELAY,
    RETRY_MAX_DELAY,
    RETRY_ERRORS,
    RETRYABLE_STATUS_CODES,
    get_http_client,
    close_http_client,
)
from .payloads import (
    build_payload,
    build_payload_with_images,
)
from .parsers import (
    extract_content,
    extract_tokens,
    extract_grounding_metadata,
)

# GeminiService permanece em services/gemini_service.py
# Re-export aqui causaria ciclo (gemini_service importa services.gemini.*)
# Para acessar: from services.gemini_service import GeminiService

__all__ = [
    # Métricas
    "GeminiMetrics",
    "GeminiResponse",
    "ResponseCache",
    "_response_cache",
    # Config
    "TIMEOUT_CONNECT",
    "TIMEOUT_READ",
    "TIMEOUT_TOTAL",
    "MAX_RETRIES",
    "RETRY_BASE_DELAY",
    "RETRY_MAX_DELAY",
    "RETRY_ERRORS",
    "RETRYABLE_STATUS_CODES",
    "get_http_client",
    "close_http_client",
    # Payloads
    "build_payload",
    "build_payload_with_images",
    # Parsers
    "extract_content",
    "extract_tokens",
    "extract_grounding_metadata",
]
