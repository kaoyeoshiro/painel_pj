# sistemas/revisao_pecas/services_bridge.py
"""Cliente para o Bridge SAJ local (via ngrok).

Tenta inserir observacoes no SAJ automaticamente via bridge local.
Se o bridge estiver offline, a observacao permanece como 'aguardando_insercao'
e sera processada pelo worker local como fallback.

Configuracao via variaveis de ambiente:
  SAJ_BRIDGE_URL = URL do proxy local (ngrok)
  SAJ_BRIDGE_API_KEY = API key para autenticacao
"""

import logging
import os

import httpx

from database.connection import SessionLocal
from sistemas.revisao_pecas.models import ItemRevisao
from utils.timezone import get_utc_now

logger = logging.getLogger(__name__)

BRIDGE_URL = os.getenv("SAJ_BRIDGE_URL", "").rstrip("/")
BRIDGE_API_KEY = os.getenv("SAJ_BRIDGE_API_KEY", "")
BRIDGE_TIMEOUT = 30  # segundos

# Status (mesmos valores de services.py)
_OBS_AGUARDANDO = "aguardando_insercao"
_OBS_INSERIDA = "inserida"
_STATUS_REJEITADO = "rejeitado"
_STATUS_APROVADO = "aprovado"
_STATUS_CONCLUIDO = "concluido"


def bridge_configurado() -> bool:
    """Retorna True se o bridge SAJ esta configurado."""
    return bool(BRIDGE_URL and BRIDGE_API_KEY)


async def tentar_inserir_via_bridge(
    item_id: int,
    cdpendencia: int,
    texto_observacao: str,
) -> None:
    """Background task: tenta inserir observacao via bridge e atualiza o DB.

    Chamado como BackgroundTask do FastAPI — roda APOS a resposta ao usuario.
    Se o bridge estiver offline ou falhar, a observacao permanece como
    'aguardando_insercao' para o worker local processar depois.
    """
    if not bridge_configurado():
        return

    try:
        async with httpx.AsyncClient(timeout=BRIDGE_TIMEOUT) as client:
            response = await client.post(
                f"{BRIDGE_URL}/saj/inserir-observacao",
                json={"cdpendencia": cdpendencia, "texto": texto_observacao},
                headers={
                    "X-API-Key": BRIDGE_API_KEY,
                    "ngrok-skip-browser-warning": "true",
                },
            )
            response.raise_for_status()
            resultado = response.json()

        if not resultado.get("ok"):
            logger.warning(
                "Bridge SAJ retornou ok=false: item=%d, resp=%s",
                item_id, resultado,
            )
            return

        # Sucesso — atualizar status no banco
        db = SessionLocal()
        try:
            item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
            if not item or item.obs_status != _OBS_AGUARDANDO:
                return

            item.obs_status = _OBS_INSERIDA

            # Auto-concluir itens sem peca a inserir (mesma logica de confirmar_observacao)
            tem_peca = bool(item.conteudo_peca or item.conteudo_editado)
            if item.status == _STATUS_REJEITADO or (
                item.status == _STATUS_APROVADO and not tem_peca
            ):
                item.status = _STATUS_CONCLUIDO
                item.concluido_em = get_utc_now()

            db.commit()
            logger.info(
                "Bridge SAJ: observacao inserida automaticamente — "
                "item=%d, cdpendencia=%d, verificado=%s",
                item_id, cdpendencia, resultado.get("verificado"),
            )
        finally:
            db.close()

    except httpx.ConnectError:
        logger.info(
            "Bridge SAJ offline — item=%d ficara como aguardando_insercao",
            item_id,
        )
    except httpx.TimeoutException:
        logger.warning(
            "Bridge SAJ timeout — item=%d ficara como aguardando_insercao",
            item_id,
        )
    except Exception as e:
        logger.warning(
            "Bridge SAJ erro — item=%d: %s: %s", item_id, type(e).__name__, e,
        )
