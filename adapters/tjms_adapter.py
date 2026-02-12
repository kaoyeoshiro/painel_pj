# -*- coding: utf-8 -*-
"""
Adapter concreto para o servico TJ-MS (SOAP/MNI).

Implementa ITJMSPort delegando para services/tjms/client.py.
Permite injecao de dependencia e testes com mock.
"""

import logging
from typing import Any

from adapters.ports import ITJMSPort

logger = logging.getLogger(__name__)


class TJMSAdapter:
    """
    Adapter que envolve o TJMSClient existente.

    Implementa ITJMSPort, delegando para services.tjms.
    """

    def __init__(self):
        # Import lazy para evitar circular imports no startup
        from services.tjms import TJMSClient
        self._client = TJMSClient()

    async def consultar_processo(
        self,
        numero_cnj: str,
        *,
        timeout: int = 30,
    ) -> str:
        """Consulta dados do processo via SOAP."""
        return await self._client.consultar_processo(
            numero_processo=numero_cnj,
            timeout=timeout,
        )

    async def baixar_documento(
        self,
        numero_cnj: str,
        documento_id: str,
        *,
        timeout: int = 60,
    ) -> bytes:
        """Baixa conteudo de um documento do processo."""
        return await self._client.baixar_documento(
            numero_processo=numero_cnj,
            documento_id=documento_id,
            timeout=timeout,
        )

    async def consultar_codigos_documentos(
        self,
        numero_cnj: str,
        *,
        timeout: int = 15,
    ) -> list[int]:
        """Consulta leve: retorna apenas codigos de tipo de documento."""
        # Delega para o agente_tjms que ja implementa esta logica
        from sistemas.gerador_pecas.agente_tjms import AgenteTJMSIntegrado
        agente = AgenteTJMSIntegrado()
        return await agente.consultar_codigos_documentos(numero_cnj)


# Singleton
_tjms_adapter: TJMSAdapter | None = None


def get_tjms_adapter() -> TJMSAdapter:
    """Factory / Depends para injecao do adapter TJ-MS."""
    global _tjms_adapter
    if _tjms_adapter is None:
        _tjms_adapter = TJMSAdapter()
    return _tjms_adapter
