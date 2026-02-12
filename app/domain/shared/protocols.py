"""
Protocolos (interfaces) compartilhados do domínio.

Este módulo define contratos neutros para serviços, evitando ciclos de import.
"""

from typing import Protocol, Any, Dict, Optional, AsyncGenerator


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
