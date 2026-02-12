"""
Protocolos (interfaces) compartilhados do domínio.

Este módulo define contratos neutros para serviços, evitando ciclos de import.

Há dois conjuntos de protocolos:
- Protocolos em português (AIServiceProtocol, TJMSClientProtocol, DocumentClassifierProtocol)
  usados pelos adapters em app/adapters/.
- Protocolos em inglês (IGeminiPort, ITJMSPort, IBertPort)
  usados para DIP com runtime_checkable.
"""

from typing import Protocol, Any, Dict, Optional, AsyncGenerator, AsyncIterator, runtime_checkable


class AIServiceProtocol(Protocol):
    """
    Interface para serviços de IA (Gemini, etc.).

    Permite que módulos dependam de uma interface abstrata
    em vez de importar diretamente o serviço concreto.
    """

    async def gerar_texto(
        self,
        prompt: str,
        modelo: Optional[str] = None,
        temperatura: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> str:
        """Gera texto a partir de um prompt."""
        ...

    async def gerar_streaming(
        self,
        prompt: str,
        modelo: Optional[str] = None,
        temperatura: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Gera texto em modo streaming."""
        ...


class DocumentClassifierProtocol(Protocol):
    """
    Interface para classificadores de documentos.

    Usado pelo Extrator de Autos e outros sistemas que precisam
    categorizar documentos sem acoplamento direto ao classificador BERT.
    """

    async def classificar(
        self,
        texto: str,
        model_name: Optional[str] = None,
        threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Classifica um texto.

        Returns:
            {
                "categoria": str,
                "confianca": float,
                "alternativas": List[Dict]
            }
        """
        ...


class TJMSClientProtocol(Protocol):
    """
    Interface para cliente do TJ-MS.

    Permite que módulos consultem o TJ-MS sem acoplamento direto
    ao cliente SOAP/MNI.
    """

    async def consultar_processo(
        self,
        numero_cnj: str,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """Consulta dados de um processo no TJ-MS."""
        ...

    async def baixar_documento(
        self,
        codigo_documento: int,
        numero_cnj: str,
        **kwargs: Any
    ) -> bytes:
        """Baixa um documento do TJ-MS."""
        ...


# ============================================
# Ports com runtime_checkable (interface inglês)
# Originalmente em adapters/ports.py, consolidados aqui.
# ============================================


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
