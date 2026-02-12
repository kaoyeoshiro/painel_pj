# -*- coding: utf-8 -*-
"""
Adapter concreto para o servico Gemini.

Implementa IGeminiPort delegando para services/gemini_service.py.
Permite injecao de dependencia e testes com mock.
"""

import logging
from typing import Any, AsyncIterator

from adapters.ports import IGeminiPort

logger = logging.getLogger(__name__)


class GeminiAdapter:
    """
    Adapter que envolve o GeminiService existente.

    Implementa IGeminiPort, delegando para a instancia singleton
    de services.gemini_service.gemini_service.
    """

    def __init__(self):
        # Import lazy para evitar circular imports
        from services.gemini_service import gemini_service
        self._service = gemini_service

    async def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        thinking_level: str | None = None,
        use_cache: bool = True,
        context: dict[str, str] | None = None,
    ) -> Any:
        """Gera resposta via Gemini service."""
        return await self._service.generate(
            prompt=prompt,
            model=model,
            temperature=temperature or 0.3,
            max_tokens=max_tokens,
            thinking_level=thinking_level,
            use_cache=use_cache,
            context=context,
        )

    async def generate_stream(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        thinking_level: str | None = None,
        context: dict[str, str] | None = None,
    ) -> AsyncIterator[str]:
        """Gera resposta em streaming via Gemini service."""
        return await self._service.generate_stream(
            prompt=prompt,
            model=model,
            temperature=temperature or 0.3,
            max_tokens=max_tokens,
            thinking_level=thinking_level,
            context=context,
        )


# Singleton para uso direto (quando DI nao disponivel)
_gemini_adapter: GeminiAdapter | None = None


def get_gemini_adapter() -> GeminiAdapter:
    """Factory / Depends para injecao do adapter Gemini."""
    global _gemini_adapter
    if _gemini_adapter is None:
        _gemini_adapter = GeminiAdapter()
    return _gemini_adapter
