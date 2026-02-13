# -*- coding: utf-8 -*-
"""
Gerenciador dos processos BERT (training worker + inference server).

Responsavel por:
- Iniciar/parar o training worker (bert_worker.py)
- Iniciar/parar o inference server (inference_server.py, porta 8765)
- Healthcheck via PID file + HTTP ping
- Auto-start quando necessario
"""

import hashlib
import json
import logging
import os
import signal
import subprocess
import sys
from pathlib import Path
from typing import Optional

import requests as http_requests

logger = logging.getLogger(__name__)

# Diretorio raiz do projeto
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent

# PID files
TRAINING_PID_FILE = PROJECT_ROOT / "bert_worker.pid"
INFERENCE_PID_FILE = PROJECT_ROOT / "bert_inference.pid"
TOKEN_FILE = PROJECT_ROOT / ".bert_worker_token"

INFERENCE_HOST = "127.0.0.1"
INFERENCE_PORT = 8765
INFERENCE_URL = f"http://{INFERENCE_HOST}:{INFERENCE_PORT}"


# ==================== Utilitarios ====================

def _get_worker_token() -> Optional[str]:
    """Le o token do worker salvo em disco."""
    if TOKEN_FILE.exists():
        try:
            data = json.loads(TOKEN_FILE.read_text())
            return data.get("token")
        except Exception as e:
            logger.error(f"Erro ao ler token do worker: {e}")
    return None


def _is_process_alive(pid: int) -> bool:
    """Verifica se um processo com dado PID esta vivo."""
    try:
        if sys.platform == "win32":
            import ctypes
            kernel32 = ctypes.windll.kernel32
            SYNCHRONIZE = 0x00100000
            handle = kernel32.OpenProcess(SYNCHRONIZE, False, pid)
            if handle:
                kernel32.CloseHandle(handle)
                return True
            return False
        else:
            os.kill(pid, 0)
            return True
    except (OSError, ProcessLookupError):
        return False


def _read_pid(pid_file: Path) -> Optional[int]:
    """Le PID de um arquivo, retorna None se invalido."""
    if not pid_file.exists():
        return None
    try:
        pid = int(pid_file.read_text().strip())
        if _is_process_alive(pid):
            return pid
        pid_file.unlink(missing_ok=True)
        return None
    except (ValueError, OSError):
        pid_file.unlink(missing_ok=True)
        return None


def _kill_process(pid: int) -> bool:
    """Mata um processo por PID."""
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True)
        else:
            os.kill(pid, signal.SIGTERM)
        return True
    except Exception:
        return False


def _get_env_with_pythonpath() -> dict:
    """Retorna environment com PYTHONPATH configurado."""
    env = os.environ.copy()
    pythonpath = env.get("PYTHONPATH", "")
    root = str(PROJECT_ROOT)
    if root not in pythonpath:
        env["PYTHONPATH"] = f"{root}{os.pathsep}{pythonpath}" if pythonpath else root
    return env


def _start_subprocess(cmd: list, log_filename: str) -> Optional[int]:
    """Inicia subprocess desacoplado. Retorna PID ou None."""
    try:
        log_file = open(str(PROJECT_ROOT / log_filename), "a")
        env = _get_env_with_pythonpath()

        if sys.platform == "win32":
            process = subprocess.Popen(
                cmd,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                cwd=str(PROJECT_ROOT),
                env=env,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
            )
        else:
            process = subprocess.Popen(
                cmd,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                cwd=str(PROJECT_ROOT),
                env=env,
                start_new_session=True,
            )
        return process.pid
    except Exception as e:
        logger.error(f"Erro ao iniciar subprocess: {e}")
        return None


# ==================== Training Worker ====================

def is_training_worker_running() -> bool:
    return _read_pid(TRAINING_PID_FILE) is not None


def start_training_worker(api_url: str = "http://localhost:8000", poll_interval: int = 15) -> bool:
    if is_training_worker_running():
        logger.info("Training worker ja esta rodando")
        return True

    token = _get_worker_token()
    if not token:
        logger.error("Token do worker nao encontrado em .bert_worker_token")
        return False

    worker_script = Path(__file__).parent / "bert_worker.py"
    cmd = [
        sys.executable,
        str(worker_script),
        "--api-url", api_url,
        "--token", token,
        "--models-dir", str(PROJECT_ROOT / "bert_models"),
        "--poll-interval", str(poll_interval),
    ]

    pid = _start_subprocess(cmd, "bert_worker.log")
    if pid:
        TRAINING_PID_FILE.write_text(str(pid))
        logger.info(f"Training worker iniciado (PID: {pid})")
        return True
    return False


def stop_training_worker() -> bool:
    pid = _read_pid(TRAINING_PID_FILE)
    if pid is None:
        return True
    _kill_process(pid)
    TRAINING_PID_FILE.unlink(missing_ok=True)
    logger.info(f"Training worker parado (PID: {pid})")
    return True


# ==================== Inference Server ====================

def _ping_inference_server() -> bool:
    """Verifica se o inference server esta respondendo via HTTP."""
    try:
        r = http_requests.get(f"{INFERENCE_URL}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def is_inference_server_running() -> bool:
    """Verifica se o inference server esta ativo (PID + health check)."""
    pid = _read_pid(INFERENCE_PID_FILE)
    if pid is not None:
        # PID existe, verifica se responde HTTP
        if _ping_inference_server():
            return True
        # Processo existe mas nao responde - pode estar iniciando
        return True

    # Sem PID file, mas talvez tenha sido iniciado externamente
    if _ping_inference_server():
        return True

    return False


def start_inference_server() -> bool:
    if _ping_inference_server():
        logger.info("Inference server ja esta rodando")
        return True

    # Mata processo antigo se existir mas nao responder
    old_pid = _read_pid(INFERENCE_PID_FILE)
    if old_pid:
        _kill_process(old_pid)
        INFERENCE_PID_FILE.unlink(missing_ok=True)

    inference_script = Path(__file__).parent / "inference_server.py"
    cmd = [
        sys.executable,
        str(inference_script),
        "--models-dir", str(PROJECT_ROOT / "bert_models"),
        "--port", str(INFERENCE_PORT),
        "--host", INFERENCE_HOST,
    ]

    pid = _start_subprocess(cmd, "bert_inference.log")
    if pid:
        INFERENCE_PID_FILE.write_text(str(pid))
        logger.info(f"Inference server iniciado (PID: {pid})")
        return True
    return False


def stop_inference_server() -> bool:
    pid = _read_pid(INFERENCE_PID_FILE)
    if pid is None:
        return True
    _kill_process(pid)
    INFERENCE_PID_FILE.unlink(missing_ok=True)
    logger.info(f"Inference server parado (PID: {pid})")
    return True


# ==================== Status Combinado ====================

def get_inference_status() -> dict:
    """Status detalhado do inference server."""
    pid = _read_pid(INFERENCE_PID_FILE)
    responding = _ping_inference_server()

    status = "running" if responding else ("starting" if pid else "stopped")

    result = {
        "running": responding,
        "status": status,
        "pid": pid,
        "url": INFERENCE_URL,
    }

    # Se respondendo, pegar info dos modelos
    if responding:
        try:
            r = http_requests.get(f"{INFERENCE_URL}/health", timeout=3)
            result["health"] = r.json()
        except Exception:
            pass

    return result


def get_training_worker_status() -> dict:
    """Status detalhado do training worker."""
    pid = _read_pid(TRAINING_PID_FILE)
    return {
        "running": pid is not None,
        "status": "running" if pid else "stopped",
        "pid": pid,
        "has_token": TOKEN_FILE.exists(),
    }


def get_full_status() -> dict:
    """Status combinado de todos os processos BERT."""
    return {
        "training_worker": get_training_worker_status(),
        "inference_server": get_inference_status(),
    }


# ==================== Auto-start ====================

def _reactivate_worker_in_db(token: str) -> bool:
    """Reativa o worker no banco se estiver marcado como inativo."""
    try:
        from database.connection import SessionLocal
        from sistemas.bert_training.models import BertWorker

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db = SessionLocal()
        try:
            worker = db.query(BertWorker).filter(
                BertWorker.token_hash == token_hash
            ).first()
            if worker and not worker.is_active:
                worker.is_active = True
                db.commit()
                logger.info(f"Worker '{worker.name}' reativado no banco")
                return True
            return worker is not None
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Nao foi possivel reativar worker no banco: {e}")
        return False


def ensure_training_worker_running(api_url: str = "http://localhost:8000") -> bool:
    """Garante que o training worker esta rodando."""
    if is_training_worker_running():
        return True
    logger.info("Training worker nao esta rodando. Iniciando automaticamente...")
    token = _get_worker_token()
    if token:
        _reactivate_worker_in_db(token)
    return start_training_worker(api_url=api_url)


def ensure_inference_server_running() -> bool:
    """Garante que o inference server esta rodando."""
    if _ping_inference_server():
        return True
    logger.info("Inference server nao esta rodando. Iniciando automaticamente...")
    return start_inference_server()


# ==================== Aliases de compatibilidade ====================

# Manter compatibilidade com imports anteriores
is_worker_running = is_training_worker_running
start_worker = start_training_worker
stop_worker = stop_training_worker
get_worker_status = get_training_worker_status
ensure_worker_running = ensure_training_worker_running
