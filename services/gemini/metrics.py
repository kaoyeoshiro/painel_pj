# services/gemini/metrics.py
"""
Métricas e cache para chamadas ao Gemini.

Extraído de gemini_service.py para melhor organização.
"""

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

# Tenta usar logging estruturado se disponível
try:
    from utils.logging_config import get_logger
    logger = get_logger(__name__)
except ImportError:
    logger = logging.getLogger(__name__)


# ============================================
# INSTRUMENTAÇÃO DE MÉTRICAS
# ============================================

@dataclass
class GeminiMetrics:
    """Métricas de uma chamada ao Gemini para diagnóstico de latência"""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    model: str = ""
    prompt_chars: int = 0
    prompt_tokens_estimated: int = 0
    response_tokens: int = 0

    # Tempos em milissegundos
    time_prepare_ms: float = 0      # Tempo preparando payload
    time_connect_ms: float = 0      # Tempo conectando (TCP + TLS)
    time_ttft_ms: float = 0         # Time to First Token (ou first byte)
    time_generation_ms: float = 0   # Tempo gerando resposta
    time_total_ms: float = 0        # Tempo total

    # Status
    success: bool = True
    cached: bool = False
    retry_count: int = 0
    error: str = ""

    # Auditoria de parâmetros por agente (novo)
    sistema: str = ""               # Sistema que fez a chamada
    agente: str = ""                # Agente específico
    temperatura: float = 0.0        # Temperatura usada
    max_tokens: Optional[int] = None  # Max tokens usado
    thinking_level: Optional[str] = None  # Thinking level usado

    # Fontes dos parâmetros (para auditoria)
    modelo_source: str = ""         # "agent", "system", "global", "default"
    temperatura_source: str = ""
    max_tokens_source: str = ""

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "timestamp": self.timestamp.isoformat(),
            "model": self.model,
            "prompt_chars": self.prompt_chars,
            "prompt_tokens_est": self.prompt_tokens_estimated,
            "response_tokens": self.response_tokens,
            "time_prepare_ms": round(self.time_prepare_ms, 2),
            "time_connect_ms": round(self.time_connect_ms, 2),
            "time_ttft_ms": round(self.time_ttft_ms, 2),
            "time_generation_ms": round(self.time_generation_ms, 2),
            "time_total_ms": round(self.time_total_ms, 2),
            "success": self.success,
            "cached": self.cached,
            "retry_count": self.retry_count,
            "error": self.error
        }
        # Adiciona campos de auditoria se preenchidos
        if self.sistema:
            result["sistema"] = self.sistema
        if self.agente:
            result["agente"] = self.agente
        if self.modelo_source:
            result["sources"] = {
                "modelo": self.modelo_source,
                "temperatura": self.temperatura_source,
                "max_tokens": self.max_tokens_source,
            }
        return result

    def log(self):
        """Log estruturado das métricas"""
        # Monta sufixo de auditoria se disponível
        audit_suffix = ""
        if self.sistema and self.agente:
            sources_short = ""
            if self.modelo_source:
                sources_short = f" sources={{modelo:{self.modelo_source[:3]}, temp:{self.temperatura_source[:3]}, tokens:{self.max_tokens_source[:3]}}}"
            audit_suffix = f" sistema={self.sistema} agente={self.agente}{sources_short}"

        if self.success:
            logger.info(
                f"[Gemini] model={self.model} "
                f"prompt={self.prompt_chars}chars "
                f"response={self.response_tokens}tok "
                f"prepare={self.time_prepare_ms:.0f}ms "
                f"ttft={self.time_ttft_ms:.0f}ms "
                f"total={self.time_total_ms:.0f}ms "
                f"cached={self.cached}{audit_suffix}"
            )
        else:
            logger.warning(
                f"[Gemini] ERRO model={self.model} "
                f"total={self.time_total_ms:.0f}ms "
                f"retries={self.retry_count} "
                f"error={self.error[:100]}{audit_suffix}"
            )


# ============================================
# CACHE DE RESPOSTAS
# ============================================

class ResponseCache:
    """Cache LRU com TTL para respostas do Gemini"""

    def __init__(self, max_size: int = 100, ttl_seconds: int = 300):
        self._cache: Dict[str, Tuple[Any, datetime]] = {}
        self._max_size = max_size
        self._ttl = timedelta(seconds=ttl_seconds)
        self._hits = 0
        self._misses = 0

    def _make_key(self, prompt: str, system_prompt: str, model: str, temperature: float) -> str:
        """Gera chave hash do prompt"""
        content = f"{model}:{temperature}:{system_prompt}:{prompt}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def get(self, prompt: str, system_prompt: str, model: str, temperature: float) -> Optional[Any]:
        """Busca no cache, retorna None se não encontrado ou expirado"""
        key = self._make_key(prompt, system_prompt, model, temperature)

        if key in self._cache:
            value, timestamp = self._cache[key]
            if datetime.utcnow() - timestamp < self._ttl:
                self._hits += 1
                return value
            else:
                del self._cache[key]

        self._misses += 1
        return None

    def set(self, prompt: str, system_prompt: str, model: str, temperature: float, value: Any):
        """Armazena no cache"""
        # Evict se cheio (remove mais antigo)
        if len(self._cache) >= self._max_size:
            oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]

        key = self._make_key(prompt, system_prompt, model, temperature)
        self._cache[key] = (value, datetime.utcnow())

    def stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache"""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{hit_rate:.1f}%"
        }


# Cache global (singleton)
_response_cache = ResponseCache(max_size=100, ttl_seconds=300)


@dataclass
class GeminiResponse:
    """Resposta padronizada do Gemini"""
    success: bool
    content: str = ""
    error: Optional[str] = None
    tokens_used: int = 0
    metrics: Optional[GeminiMetrics] = None  # Métricas de latência


__all__ = [
    "GeminiMetrics",
    "GeminiResponse",
    "ResponseCache",
    "_response_cache",
]
