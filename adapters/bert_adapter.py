# -*- coding: utf-8 -*-
"""
Adapter concreto para o servico BERT (classificacao).

Implementa IBertPort delegando para o BertClassifierClient existente.
Permite injecao de dependencia e testes com mock.
"""

import logging
from typing import Any

from adapters.ports import IBertPort

logger = logging.getLogger(__name__)


class BertAdapter:
    """
    Adapter que envolve o BertClassifierClient existente.

    Implementa IBertPort, delegando para
    sistemas.extrator_autos.services_bert_client.BertClassifierClient.
    """

    def __init__(self):
        from sistemas.extrator_autos.services_bert_client import BertClassifierClient
        self._client = BertClassifierClient()

    async def classify(
        self,
        text: str,
        *,
        model_name: str | None = None,
    ) -> dict[str, Any]:
        """Classifica texto via BERT worker."""
        result = await self._client.classify(text, model_name=model_name)
        return result

    async def is_available(self) -> bool:
        """Verifica se o servidor de inferencia esta ativo."""
        try:
            status = await self._client.health_check()
            return status.get("status") == "ok"
        except Exception:
            return False


# Singleton
_bert_adapter: BertAdapter | None = None


def get_bert_adapter() -> BertAdapter:
    """Factory / Depends para injecao do adapter BERT."""
    global _bert_adapter
    if _bert_adapter is None:
        _bert_adapter = BertAdapter()
    return _bert_adapter
