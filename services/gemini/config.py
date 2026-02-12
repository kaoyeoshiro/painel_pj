# services/gemini/config.py
"""
Configuração HTTP, timeouts e retry para chamadas ao Gemini.

Extraído de gemini_service.py para melhor organização.
"""

import asyncio
import logging
from typing import Optional

import aiohttp
import httpx

# Tenta usar logging estruturado se disponível
try:
    from utils.logging_config import get_logger
    logger = get_logger(__name__)
except ImportError:
    logger = logging.getLogger(__name__)


# ============================================
# CONFIGURAÇÃO DE TIMEOUTS E RETRY
# ============================================

# Timeouts granulares (em segundos)
# NOTA: Aumentados para suportar prompts grandes em processos complexos
TIMEOUT_CONNECT = 15.0      # Tempo máximo para estabelecer conexão
TIMEOUT_READ = 180.0        # Tempo máximo para ler resposta (aumentado de 120s para 180s)
TIMEOUT_TOTAL = 240.0       # Tempo máximo total (aumentado para suportar prompts grandes)

# Retry com backoff exponencial
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0      # Delay inicial em segundos
RETRY_MAX_DELAY = 10.0      # Delay máximo
RETRY_ERRORS = (
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.ConnectError,
    aiohttp.ClientConnectorError,
    aiohttp.ServerDisconnectedError,
)

# Status codes HTTP que devem fazer retry (erros temporários)
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# HTTP Client singleton
_http_client: Optional[httpx.AsyncClient] = None
_http_client_lock = asyncio.Lock()


async def get_http_client() -> httpx.AsyncClient:
    """
    Retorna HTTP client singleton com connection pooling.

    PERFORMANCE: Reutiliza conexões TCP/TLS entre chamadas.
    """
    global _http_client

    if _http_client is None or _http_client.is_closed:
        async with _http_client_lock:
            # Double-check após adquirir lock
            if _http_client is None or _http_client.is_closed:
                _http_client = httpx.AsyncClient(
                    timeout=httpx.Timeout(
                        connect=TIMEOUT_CONNECT,
                        read=TIMEOUT_READ,
                        write=30.0,
                        pool=10.0
                    ),
                    limits=httpx.Limits(
                        max_keepalive_connections=10,
                        max_connections=20,
                        keepalive_expiry=30.0
                    ),
                    http2=True  # HTTP/2 para multiplexação
                )
                logger.info("[Gemini] HTTP client criado com connection pooling e HTTP/2")

    return _http_client


async def close_http_client():
    """Fecha o HTTP client (para shutdown graceful)"""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
        logger.info("[Gemini] HTTP client fechado")


__all__ = [
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
]
