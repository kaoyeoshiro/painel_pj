"""
Adaptador para o serviço Gemini - implementa AIServiceProtocol.

Este adaptador wrappeia o GeminiService legado e expõe uma interface
padronizada para uso pelos módulos de domínio.
"""

from typing import Optional, Any, AsyncGenerator

from app.domain.shared.protocols import AIServiceProtocol


class GeminiAdapter(AIServiceProtocol):
    """
    Wrapper sobre GeminiService que implementa a interface padrão.

    Permite que módulos de domínio dependam de AIServiceProtocol
    em vez de importar diretamente o serviço concreto.

    Uso:
        adapter = GeminiAdapter()
        texto = await adapter.gerar_texto("Olá, mundo!")

        async for chunk in adapter.gerar_streaming("Gere um texto..."):
            print(chunk)
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Inicializa o adaptador.

        Args:
            api_key: API key do Gemini (opcional, usa GEMINI_KEY do ambiente)
        """
        # Import lazy para evitar ciclos e permitir testes sem GeminiService
        from services.gemini_service import GeminiService

        self._service = GeminiService(api_key=api_key)

    async def gerar_texto(
        self,
        prompt: str,
        modelo: Optional[str] = None,
        temperatura: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> str:
        """
        Gera texto a partir de um prompt.

        Args:
            prompt: Texto do prompt
            modelo: Nome do modelo (ex: "flash", "pro")
            temperatura: Criatividade (0.0-2.0)
            max_tokens: Limite de tokens de saída
            **kwargs: Parâmetros adicionais (system_instruction, etc)

        Returns:
            Texto gerado pela IA
        """
        # Mapeia parâmetros do protocolo para API do GeminiService
        response = await self._service.generate(
            prompt=prompt,
            model=modelo,
            temperature=temperatura,
            max_tokens=max_tokens,
            **kwargs
        )

        # GeminiService retorna GeminiResponse com atributo 'content'
        return response.content if response.success else ""

    async def gerar_streaming(
        self,
        prompt: str,
        modelo: Optional[str] = None,
        temperatura: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """
        Gera texto em modo streaming.

        Args:
            prompt: Texto do prompt
            modelo: Nome do modelo
            temperatura: Criatividade
            max_tokens: Limite de tokens
            **kwargs: Parâmetros adicionais

        Yields:
            Chunks de texto conforme gerados
        """
        # GeminiService.generate_stream retorna AsyncGenerator[str, None]
        async for chunk in self._service.generate_stream(
            prompt=prompt,
            model=modelo,
            temperature=temperatura,
            max_tokens=max_tokens,
            **kwargs
        ):
            yield chunk
