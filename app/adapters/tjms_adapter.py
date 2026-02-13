"""
Adaptador para o serviço TJ-MS - implementa TJMSClientProtocol.

Este adaptador wrappeia o TJMSClient legado e expõe uma interface
padronizada para uso pelos módulos de domínio.
"""

from typing import Any, Dict

from app.domain.shared.protocols import TJMSClientProtocol


class TJMSAdapter(TJMSClientProtocol):
    """
    Wrapper sobre TJMSClient que implementa a interface padrão.

    Permite que módulos de domínio dependam de TJMSClientProtocol
    em vez de importar diretamente o cliente SOAP/MNI.

    Uso:
        adapter = TJMSAdapter()
        processo = await adapter.consultar_processo("0808281-22.2025.8.12.0002")
        pdf = await adapter.baixar_documento(8369, "0808281-22.2025.8.12.0002")
    """

    def __init__(self):
        """Inicializa o adaptador."""
        # Import lazy para evitar ciclos e permitir testes
        from services.tjms.client import TJMSClient

        self._client = TJMSClient()

    async def consultar_processo(
        self,
        numero_cnj: str,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Consulta dados de um processo no TJ-MS.

        Args:
            numero_cnj: Número CNJ (com ou sem formatação)
            **kwargs: Opções adicionais (ConsultaOptions)

        Returns:
            Dict com dados do processo (XML parseado)
        """
        # TJMSClient.consultar_processo retorna ProcessoTJMS (Pydantic model)
        # Convertemos para dict para manter interface neutra
        from services.tjms.models import ConsultaOptions

        options = None
        if kwargs:
            options = ConsultaOptions(**kwargs)

        processo = await self._client.consultar_processo(
            numero_cnj=numero_cnj,
            options=options
        )

        # ProcessoTJMS tem método .model_dump() (Pydantic v2)
        return processo.model_dump() if hasattr(processo, 'model_dump') else processo.dict()

    async def baixar_documento(
        self,
        codigo_documento: int,
        numero_cnj: str,
        **kwargs: Any
    ) -> bytes:
        """
        Baixa um documento do TJ-MS.

        Args:
            codigo_documento: Código do documento (ex: 8369 para Laudo Pericial)
            numero_cnj: Número CNJ do processo
            **kwargs: Opções adicionais (DownloadOptions)

        Returns:
            Bytes do PDF baixado
        """
        # TJMSClient.baixar_documento retorna DocumentoTJMS
        # DocumentoTJMS.conteudo contém o bytes do PDF
        from services.tjms.models import DownloadOptions

        options = None
        if kwargs:
            options = DownloadOptions(**kwargs)

        documento = await self._client.baixar_documento(
            numero_cnj=numero_cnj,
            doc_id=str(codigo_documento),
            options=options
        )

        # DocumentoTJMS.conteudo é bytes (base64 decoded)
        return documento.conteudo
