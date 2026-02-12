# -*- coding: utf-8 -*-
"""
Ports (interfaces) para inversao de dependencia.

Define contratos que adapters concretos devem implementar.
Services dependem destas interfaces, nunca das implementacoes concretas.

Uso:
    class MeuService:
        def __init__(self, gemini: IGeminiPort, tjms: ITJMSPort):
            self.gemini = gemini
            self.tjms = tjms
"""

from typing import Protocol, Any, AsyncIterator, runtime_checkable


@runtime_checkable
class IGeminiPort(Protocol):
    """Interface para servico de IA generativa (Gemini)."""

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
        """Gera resposta a partir de um prompt."""
        ...

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
        """Gera resposta em streaming (token por token)."""
        ...


@runtime_checkable
class ITJMSPort(Protocol):
    """Interface para servico do TJ-MS (SOAP/MNI)."""

    async def consultar_processo(
        self,
        numero_cnj: str,
        *,
        timeout: int = 30,
    ) -> str:
        """Consulta dados do processo e retorna XML."""
        ...

    async def baixar_documento(
        self,
        numero_cnj: str,
        documento_id: str,
        *,
        timeout: int = 60,
    ) -> bytes:
        """Baixa conteudo de um documento do processo."""
        ...

    async def consultar_codigos_documentos(
        self,
        numero_cnj: str,
        *,
        timeout: int = 15,
    ) -> list[int]:
        """Consulta leve: retorna apenas codigos de tipo de documento."""
        ...


@runtime_checkable
class IBertPort(Protocol):
    """Interface para servico de classificacao BERT."""

    async def classify(
        self,
        text: str,
        *,
        model_name: str | None = None,
    ) -> dict[str, Any]:
        """Classifica texto e retorna label + confianca."""
        ...

    async def is_available(self) -> bool:
        """Verifica se o servidor de inferencia esta ativo."""
        ...
