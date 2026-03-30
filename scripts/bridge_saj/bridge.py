"""Bridge SAJ — Mini-server local que conecta o portal-pge ao Oracle do SAJ.

Roda na maquina do usuario (com VPN ativa) e expoe via Cloudflare Tunnel.
O portal-pge no Railway chama este bridge para inserir observacoes no SAJ.

Uso:
    python bridge.py                    # Inicia na porta 8081
    python bridge.py --port 9000        # Porta customizada
"""

import argparse
import logging
import os
import re
import socket
import subprocess
import time
from contextlib import contextmanager
from datetime import datetime

import oracledb
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from sshtunnel import SSHTunnelForwarder

import config

# ── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("bridge_saj.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("bridge_saj")

# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="Bridge SAJ", description="Ponte local para Oracle SAJ/PGE")

_started_at = datetime.now()

# ── Oracle thick mode ───────────────────────────────────────────────────────

_thick_initialized = False


def _init_thick_mode():
    """Inicializa Oracle thick mode se Instant Client disponivel."""
    global _thick_initialized
    if _thick_initialized:
        return
    _thick_initialized = True
    if os.path.isdir(config.INSTANT_CLIENT_DIR):
        try:
            oracledb.init_oracle_client(lib_dir=config.INSTANT_CLIENT_DIR)
            logger.info("Oracle thick mode ativo: %s", config.INSTANT_CLIENT_DIR)
        except oracledb.ProgrammingError:
            logger.info("Oracle thick mode ja inicializado.")
    else:
        logger.info("Instant Client nao encontrado, usando thin mode.")


# ── SQL ─────────────────────────────────────────────────────────────────────

USUARIO_SAJ = "KOSHIRO"
MAX_OBSERVACAO = 3000

SQL_BUSCAR_PROCESSO = """
    SELECT CDPROCESSO, NUFORMATADO, NUNAOFORMATADO
    FROM SAJ.ESPJPROCESSO
    WHERE NUFORMATADO = :numero
    ORDER BY CDPROCESSO
"""

SQL_BUSCAR_PROCESSO_LIKE = """
    SELECT CDPROCESSO, NUFORMATADO, NUNAOFORMATADO
    FROM SAJ.ESPJPROCESSO
    WHERE NUFORMATADO LIKE :numero
    ORDER BY CDPROCESSO
"""

SQL_PENDENCIAS_ATIVAS = """
    SELECT
        P.CDPENDENCIA, P.CDPROCESSO, P.DEOBSERVACOES,
        P.DEPENDENCIA, P.CDUSUARIO, P.DTINICIOPRAZO, P.DTVENCTOPRAZO,
        CP.DECATEGORIAPEND
    FROM SAJ.ESPJPENDENCIAPRAZO P
    LEFT JOIN SAJ.ESPJCATEGORIAPEND CP ON CP.CDCATEGORIAPEND = P.CDCATEGORIAPEND
    WHERE P.CDPROCESSO = :cdprocesso
      AND TRIM(P.CDUSUARIO) = :usuario
      AND P.FLEXCLUIDA = 'N'
      AND P.DTCUMPRIMENTO IS NULL
      AND P.FLMOVEXCLUIDA = 'N'
    ORDER BY P.DTUSUINCLUSAO DESC
"""

SQL_CONSULTAR_PENDENCIA = """
    SELECT
        P.CDPENDENCIA, P.CDPROCESSO, P.DEOBSERVACOES,
        P.DEPENDENCIA, P.CDUSUARIO, P.FLEXCLUIDA,
        P.DTCUMPRIMENTO, P.FLMOVEXCLUIDA,
        CP.DECATEGORIAPEND, PROC.NUFORMATADO
    FROM SAJ.ESPJPENDENCIAPRAZO P
    LEFT JOIN SAJ.ESPJCATEGORIAPEND CP ON CP.CDCATEGORIAPEND = P.CDCATEGORIAPEND
    LEFT JOIN SAJ.ESPJPROCESSO PROC ON PROC.CDPROCESSO = P.CDPROCESSO
    WHERE P.CDPENDENCIA = :cdpendencia
"""

SQL_UPDATE_OBSERVACAO = """
    UPDATE SAJ.ESPJPENDENCIAPRAZO
    SET DEOBSERVACOES = :observacao
    WHERE CDPENDENCIA = :cdpendencia
      AND FLEXCLUIDA = 'N'
"""

SQL_VERIFICAR_UPDATE = """
    SELECT DEOBSERVACOES
    FROM SAJ.ESPJPENDENCIAPRAZO
    WHERE CDPENDENCIA = :cdpendencia
"""


# ── Helpers ─────────────────────────────────────────────────────────────────

def _require_api_key(request: Request) -> None:
    key = request.headers.get("X-API-Key", "")
    if key != config.API_KEY:
        raise HTTPException(403, "API key invalida")


def _is_vpn_connected() -> bool:
    """Verifica se a VPN esta conectada (Windows rasdial)."""
    try:
        result = subprocess.run(
            ["rasdial"], capture_output=True, text=True, timeout=5,
        )
        return config.VPN_NAME in result.stdout
    except Exception:
        return False


def _is_tunnel_open() -> bool:
    """Verifica se ja existe um tunel SSH ativo em localhost:1521."""
    try:
        sock = socket.create_connection(("localhost", config.ORACLE_PORT), timeout=2)
        sock.close()
        return True
    except (ConnectionRefusedError, TimeoutError, OSError):
        return False


@contextmanager
def oracle_connection():
    """Context manager que abre SSH tunnel + conexao Oracle.

    Se ja existe tunnel em localhost:1521, usa direto (caso o BD_PGE.NET
    ou outro processo ja tenha aberto).
    """
    _init_thick_mode()

    # Garantir encoding UTF-8
    if "NLS_LANG" not in os.environ:
        os.environ["NLS_LANG"] = ".AL32UTF8"

    tunnel = None
    conn = None

    try:
        if _is_tunnel_open():
            logger.info("Tunnel existente detectado em localhost:%d", config.ORACLE_PORT)
            dsn = f"localhost:{config.ORACLE_PORT}/{config.ORACLE_SID}"
        else:
            logger.info("Abrindo SSH tunnel via %s...", config.SSH_HOST)
            tunnel = SSHTunnelForwarder(
                (config.SSH_HOST, config.SSH_PORT),
                ssh_username=config.SSH_USER,
                ssh_password=config.SSH_PASSWORD,
                remote_bind_address=(config.ORACLE_HOST, config.ORACLE_PORT),
                local_bind_address=("127.0.0.1", 0),
                set_keepalive=60,
            )
            tunnel.start()
            local_port = tunnel.local_bind_port
            logger.info("Tunnel ativo: localhost:%d", local_port)
            dsn = f"127.0.0.1:{local_port}/{config.ORACLE_SID}"

        conn = oracledb.connect(
            user=config.ORACLE_USER,
            password=config.ORACLE_PASSWORD,
            dsn=dsn,
        )
        cursor = conn.cursor()
        cursor.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'")
        cursor.close()

        yield conn

    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        if tunnel:
            try:
                tunnel.stop()
            except Exception:
                pass


def _execute_read(conn, sql: str, params: dict) -> list[dict]:
    cursor = conn.cursor()
    cursor.execute(sql, params)
    columns = [col[0] for col in cursor.description]
    rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    cursor.close()
    return rows


def _serializar(row: dict) -> dict:
    result = {}
    for k, v in row.items():
        if hasattr(v, "isoformat"):
            result[k] = v.isoformat()
        elif isinstance(v, bytes):
            result[k] = v.decode("utf-8", errors="replace")
        elif isinstance(v, str):
            result[k] = v.strip()
        else:
            result[k] = v
    return result


def _normalizar_texto(texto: str) -> str:
    """Normaliza Unicode para ASCII seguro (Oracle/cp1252)."""
    return (
        texto
        .replace("\u2014", "-")   # em-dash
        .replace("\u2013", "-")   # en-dash
        .replace("\u2018", "'")   # left single quote
        .replace("\u2019", "'")   # right single quote
        .replace("\u201c", '"')   # left double quote
        .replace("\u201d", '"')   # right double quote
        .replace("\u2026", "...")  # ellipsis
    )


# ── Schemas ─────────────────────────────────────────────────────────────────

class InserirObservacaoRequest(BaseModel):
    cdpendencia: int
    texto: str


class InserirPorProcessoRequest(BaseModel):
    numero_processo: str
    texto: str


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health(request: Request):
    """Health check — nao exige API key (para monitoramento)."""
    vpn = _is_vpn_connected()
    tunnel = _is_tunnel_open()
    uptime = str(datetime.now() - _started_at).split(".")[0]

    return {
        "status": "ok" if vpn else "degraded",
        "service": "bridge-saj",
        "vpn_conectada": vpn,
        "tunnel_existente": tunnel,
        "uptime": uptime,
        "started_at": _started_at.isoformat(),
    }


@app.get("/saj/test")
def test_connectivity(request: Request):
    """Testa conexao completa: VPN → SSH tunnel → Oracle."""
    _require_api_key(request)

    result = {
        "vpn_conectada": _is_vpn_connected(),
        "tunnel_existente": _is_tunnel_open(),
        "oracle_ok": False,
    }

    if not result["vpn_conectada"]:
        result["erro"] = "VPN nao esta conectada"
        return result

    try:
        with oracle_connection() as conn:
            rows = _execute_read(conn, "SELECT 1 AS OK FROM DUAL", {})
            result["oracle_ok"] = True
            result["oracle_test"] = str(rows)
    except Exception as e:
        result["oracle_ok"] = False
        result["erro"] = f"{type(e).__name__}: {e}"

    return result


@app.get("/saj/pendencias/{numero_processo}")
def listar_pendencias(request: Request, numero_processo: str):
    """Lista pendencias ativas do KOSHIRO para um processo."""
    _require_api_key(request)

    with oracle_connection() as conn:
        processos = _execute_read(conn, SQL_BUSCAR_PROCESSO, {"numero": numero_processo})
        if not processos:
            processos = _execute_read(
                conn, SQL_BUSCAR_PROCESSO_LIKE, {"numero": f"{numero_processo}%"},
            )
        if not processos:
            return {"processo": numero_processo, "encontrado": False, "pendencias": []}

        todas = []
        for proc in processos:
            pends = _execute_read(
                conn, SQL_PENDENCIAS_ATIVAS,
                {"cdprocesso": proc["CDPROCESSO"], "usuario": USUARIO_SAJ},
            )
            todas.extend([_serializar(p) for p in pends])

        return {
            "processo": numero_processo,
            "encontrado": True,
            "cdprocessos": [p["CDPROCESSO"].strip() for p in processos],
            "total_pendencias": len(todas),
            "pendencias": todas,
        }


@app.post("/saj/inserir-observacao")
def inserir_observacao(request: Request, body: InserirObservacaoRequest):
    """Insere observacao em uma pendencia especifica (por cdpendencia)."""
    _require_api_key(request)

    texto = _normalizar_texto(body.texto.strip())
    if not texto:
        raise HTTPException(400, "Texto vazio")
    if len(texto) > MAX_OBSERVACAO:
        raise HTTPException(400, f"Texto excede {MAX_OBSERVACAO} chars (tem {len(texto)})")

    with oracle_connection() as conn:
        # Validar pendencia
        pend_rows = _execute_read(conn, SQL_CONSULTAR_PENDENCIA, {"cdpendencia": body.cdpendencia})
        if not pend_rows:
            raise HTTPException(404, f"Pendencia {body.cdpendencia} nao encontrada")

        pend = pend_rows[0]
        usuario = pend["CDUSUARIO"].strip()
        if usuario != USUARIO_SAJ:
            raise HTTPException(403, f"Pendencia pertence a '{usuario}', nao ao '{USUARIO_SAJ}'")
        if pend.get("FLEXCLUIDA") == "S":
            raise HTTPException(400, "Pendencia excluida")
        if pend.get("DTCUMPRIMENTO"):
            raise HTTPException(400, "Pendencia ja cumprida")

        # UPDATE
        cursor = conn.cursor()
        cursor.execute(SQL_UPDATE_OBSERVACAO, {"observacao": texto, "cdpendencia": body.cdpendencia})
        affected = cursor.rowcount

        if affected == 0:
            conn.rollback()
            raise HTTPException(500, "0 linhas afetadas")

        conn.commit()
        logger.info("Observacao inserida: cdpendencia=%d, %d linha(s)", body.cdpendencia, affected)

        # Verificar
        rows = _execute_read(conn, SQL_VERIFICAR_UPDATE, {"cdpendencia": body.cdpendencia})
        gravado = rows[0]["DEOBSERVACOES"] if rows else None

        return {
            "ok": True,
            "cdpendencia": body.cdpendencia,
            "processo": (pend.get("NUFORMATADO") or "").strip(),
            "linhas_afetadas": affected,
            "verificado": gravado == texto,
        }


@app.post("/saj/inserir-por-processo")
def inserir_por_processo(request: Request, body: InserirPorProcessoRequest):
    """Insere observacao localizando pendencia ativa pelo numero do processo."""
    _require_api_key(request)

    texto = _normalizar_texto(body.texto.strip())
    if not texto:
        raise HTTPException(400, "Texto vazio")
    if len(texto) > MAX_OBSERVACAO:
        raise HTTPException(400, f"Texto excede {MAX_OBSERVACAO} chars")

    with oracle_connection() as conn:
        processos = _execute_read(conn, SQL_BUSCAR_PROCESSO, {"numero": body.numero_processo})
        if not processos:
            processos = _execute_read(
                conn, SQL_BUSCAR_PROCESSO_LIKE, {"numero": f"{body.numero_processo}%"},
            )
        if not processos:
            raise HTTPException(404, f"Processo '{body.numero_processo}' nao encontrado")

        pendencias = []
        for proc in processos:
            pends = _execute_read(
                conn, SQL_PENDENCIAS_ATIVAS,
                {"cdprocesso": proc["CDPROCESSO"], "usuario": USUARIO_SAJ},
            )
            pendencias.extend(pends)

        if not pendencias:
            raise HTTPException(404, f"Nenhuma pendencia ativa do {USUARIO_SAJ}")

        if len(pendencias) > 1:
            return {
                "ok": False,
                "multiplas_pendencias": True,
                "total": len(pendencias),
                "pendencias": [_serializar(p) for p in pendencias],
                "mensagem": "Multiplas pendencias. Use /saj/inserir-observacao com cdpendencia.",
            }

        pend = pendencias[0]
        cdpendencia = pend["CDPENDENCIA"]

        cursor = conn.cursor()
        cursor.execute(SQL_UPDATE_OBSERVACAO, {"observacao": texto, "cdpendencia": cdpendencia})
        affected = cursor.rowcount

        if affected == 0:
            conn.rollback()
            raise HTTPException(500, "0 linhas afetadas")

        conn.commit()
        logger.info("Observacao inserida por processo: %s, cdpendencia=%d", body.numero_processo, cdpendencia)

        rows = _execute_read(conn, SQL_VERIFICAR_UPDATE, {"cdpendencia": cdpendencia})
        gravado = rows[0]["DEOBSERVACOES"] if rows else None

        return {
            "ok": True,
            "cdpendencia": cdpendencia,
            "processo": body.numero_processo,
            "linhas_afetadas": affected,
            "verificado": gravado == texto,
        }


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Bridge SAJ — ponte local para Oracle")
    parser.add_argument("--port", type=int, default=config.BRIDGE_PORT, help="Porta (default: 8081)")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Bridge SAJ iniciando na porta %d", args.port)
    logger.info("VPN: %s", "CONECTADA" if _is_vpn_connected() else "DESCONECTADA")
    logger.info("Oracle: %s@%s:%d/%s", config.ORACLE_USER, config.ORACLE_HOST, config.ORACLE_PORT, config.ORACLE_SID)
    logger.info("SSH: %s@%s:%d", config.SSH_USER, config.SSH_HOST, config.SSH_PORT)
    logger.info("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")


if __name__ == "__main__":
    main()
