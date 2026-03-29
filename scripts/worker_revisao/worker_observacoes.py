# scripts/worker_revisao/worker_observacoes.py
"""Worker local que consulta observacoes pendentes no portal-pge
e insere no BD_PGE.NET via VPN."""

import sys
import time
import logging
import subprocess
import requests
from config import PORTAL_URL, PORTAL_USER, PORTAL_PASS, INTERVALO, BD_PGE_SCRIPT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("worker_revisao.log")],
)
logger = logging.getLogger(__name__)


def autenticar() -> str:
    resp = requests.post(
        f"{PORTAL_URL}/auth/login",
        data={"username": PORTAL_USER, "password": PORTAL_PASS},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json().get("access_token")
    if not token:
        raise ValueError("Token nao retornado pelo portal-pge")
    return token


def buscar_pendentes(token: str) -> list[dict]:
    resp = requests.get(
        f"{PORTAL_URL}/revisao/api/observacoes-pendentes",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def inserir_observacao(cdpendencia: int, texto: str) -> bool:
    """Insere observacao no BD_PGE.NET via script externo."""
    # Normalizar texto para ASCII seguro (Oracle/Windows cp1252)
    texto_safe = texto.replace("\u2014", "-").replace("\u2013", "-").replace("\u2018", "'").replace("\u2019", "'")
    try:
        resultado = subprocess.run(
            [sys.executable, BD_PGE_SCRIPT,
             "--cdpendencia", str(cdpendencia),
             "--texto", texto_safe, "--sem-confirmacao"],
            capture_output=True, timeout=120,
        )
        if resultado.returncode == 0:
            logger.info(f"Observacao inserida: cdpendencia={cdpendencia}")
            return True
        else:
            stderr = resultado.stderr.decode("utf-8", errors="replace")
            logger.error(f"Erro ao inserir (rc={resultado.returncode}): {stderr[:500]}")
            return False
    except Exception as e:
        logger.error(f"Excecao ao inserir observacao: {e}")
        return False


def confirmar_no_portal(token: str, item_id: int, sucesso: bool, erro_msg: str | None = None):
    resp = requests.post(
        f"{PORTAL_URL}/revisao/api/observacoes/{item_id}/confirmar",
        headers={"Authorization": f"Bearer {token}"},
        json={"sucesso": sucesso, "erro_mensagem": erro_msg},
        timeout=10,
    )
    resp.raise_for_status()
    logger.info(f"Confirmacao enviada: item={item_id}, sucesso={sucesso}")


def executar_ciclo(token: str):
    pendentes = buscar_pendentes(token)
    if not pendentes:
        logger.info("Nenhuma observacao pendente")
        return
    logger.info(f"Encontradas {len(pendentes)} observacoes pendentes")
    for obs in pendentes:
        item_id = obs["item_id"]
        cdpendencia = obs["cdpendencia"]
        texto = obs["observacao_pge"]
        logger.info(f"Inserindo: item={item_id}, cdpendencia={cdpendencia}")
        sucesso = inserir_observacao(cdpendencia, texto)
        erro_msg = None if sucesso else "Falha na execucao do script de insercao"
        try:
            confirmar_no_portal(token, item_id, sucesso, erro_msg)
        except Exception as e:
            logger.error(f"Erro ao confirmar no portal: {e}")


def main():
    logger.info(f"Worker de revisao iniciado. Intervalo: {INTERVALO}s")
    logger.info(f"Portal URL: {PORTAL_URL}")
    while True:
        try:
            token = autenticar()
            executar_ciclo(token)
        except KeyboardInterrupt:
            logger.info("Worker encerrado pelo usuario")
            break
        except Exception as e:
            logger.error(f"Erro no ciclo: {e}")
        logger.info(f"Aguardando {INTERVALO}s...")
        time.sleep(INTERVALO)


if __name__ == "__main__":
    main()
