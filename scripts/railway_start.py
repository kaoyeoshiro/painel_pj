#!/usr/bin/env python
"""
Script de startup para Railway com diagnostico completo.

Substitui o chaining de && no startCommand para garantir
que erros sejam capturados e logados corretamente.
"""
import subprocess
import sys
import os
import time

def log(level: str, msg: str):
    """Log com flush imediato para garantir visibilidade no Railway."""
    print(f"[{level}] {msg}", flush=True)


def run_command(cmd: list[str], desc: str, timeout: int = 60) -> int:
    """Executa comando com timeout e captura stdout+stderr."""
    log("RUN", f"{desc}: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            timeout=timeout,
            capture_output=True,
            text=True,
        )
        if result.stdout.strip():
            for line in result.stdout.strip().split("\n"):
                log("OUT", line)
        if result.stderr.strip():
            for line in result.stderr.strip().split("\n"):
                log("ERR", line)
        if result.returncode != 0:
            log("FAIL", f"{desc} exit code={result.returncode}")
        else:
            log("OK", desc)
        return result.returncode
    except subprocess.TimeoutExpired:
        log("FAIL", f"{desc} TIMEOUT apos {timeout}s")
        return 1


def main():
    port = os.environ.get("PORT", "8000")
    db_url = os.environ.get("DATABASE_URL", "NOT SET")
    db_display = "SET" if db_url != "NOT SET" else "NOT SET"
    if db_display == "SET":
        # Mostra apenas host:port para diagnostico (sem senha)
        try:
            from urllib.parse import urlparse
            parsed = urlparse(db_url)
            db_display = f"{parsed.hostname}:{parsed.port}/{parsed.path.lstrip('/')}"
        except Exception:
            db_display = "SET (parse error)"

    log("START", f"Railway startup — PORT={port}, DB={db_display}")
    log("START", f"Python {sys.version}")
    log("START", f"CWD={os.getcwd()}")

    # Etapa 1: Pre-deploy (verifica alembic version)
    rc = run_command(
        [sys.executable, "-u", "scripts/pre_deploy.py"],
        "pre_deploy.py",
        timeout=30,
    )
    if rc != 0:
        log("FATAL", "pre_deploy.py falhou, abortando")
        sys.exit(rc)

    # Etapa 2: Alembic upgrade
    rc = run_command(
        ["alembic", "upgrade", "head"],
        "alembic upgrade head",
        timeout=60,
    )
    if rc != 0:
        log("FATAL", "alembic upgrade head falhou, abortando")
        sys.exit(rc)

    # Etapa 3: Testa import do main (captura erros de import)
    log("RUN", "Testando import do main.py...")
    try:
        # Importa config primeiro para validar variaveis
        import config
        log("OK", f"config importado (IS_PRODUCTION={config.IS_PRODUCTION})")
    except Exception as e:
        log("FATAL", f"Erro ao importar config: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    try:
        import main  # noqa: F401
        log("OK", "main.py importado com sucesso")
    except Exception as e:
        log("FATAL", f"Erro ao importar main: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Etapa 4: Inicia uvicorn via exec (substitui este processo)
    log("START", f"Iniciando uvicorn na porta {port}...")
    os.execvp(
        "uvicorn",
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", port],
    )


if __name__ == "__main__":
    main()
