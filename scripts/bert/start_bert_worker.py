#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para iniciar o worker BERT automaticamente.

Uso:
    python start_bert_worker.py

Este script:
1. Registra um worker (se necessário)
2. Salva o token
3. Inicia o treinamento
"""

import json
import os
import sys
import subprocess
from pathlib import Path

import requests

# Configurações
API_URL = "http://localhost:8000"
WORKER_NAME = "worker-local"
TOKEN_FILE = Path(".bert_worker_token")


def get_admin_token():
    """Tenta obter token de admin de várias formas."""
    # 1. Variável de ambiente
    token = os.environ.get("ADMIN_TOKEN")
    if token:
        return token

    # 2. Arquivo .env
    env_file = Path(".env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("ADMIN_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"\'')

    # 3. Fazer login como admin
    print("\n=== Login Admin ===")
    print("Preciso de credenciais de admin para registrar o worker.\n")

    email = input("Email do admin: ").strip()
    password = input("Senha: ").strip()

    try:
        r = requests.post(
            f"{API_URL}/token",
            data={"username": email, "password": password}
        )
        if r.status_code == 200:
            return r.json().get("access_token")
        else:
            print(f"Erro no login: {r.text}")
            return None
    except Exception as e:
        print(f"Erro: {e}")
        return None


def get_saved_worker_token():
    """Verifica se já temos um token salvo."""
    if TOKEN_FILE.exists():
        data = json.loads(TOKEN_FILE.read_text())
        return data.get("token")
    return None


def save_worker_token(token: str, worker_id: int):
    """Salva o token do worker."""
    TOKEN_FILE.write_text(json.dumps({
        "token": token,
        "worker_id": worker_id,
        "name": WORKER_NAME
    }, indent=2))
    print(f"Token salvo em {TOKEN_FILE}")


def register_worker(admin_token: str) -> str:
    """Registra um novo worker e retorna o token."""
    print(f"\nRegistrando worker '{WORKER_NAME}'...")

    # Detecta GPU
    gpu_name = "CPU"
    gpu_vram = None
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            gpu_vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            print(f"GPU detectada: {gpu_name} ({gpu_vram:.1f} GB)")
    except ImportError:
        print("PyTorch não instalado - usando CPU")

    try:
        r = requests.post(
            f"{API_URL}/bert-training/api/workers/register",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": WORKER_NAME,
                "description": f"Worker local - {gpu_name}",
                "gpu_name": gpu_name,
                "gpu_vram_gb": gpu_vram
            }
        )

        if r.status_code == 200:
            data = r.json()
            print(f"Worker registrado! ID: {data['id']}")
            save_worker_token(data["token"], data["id"])
            return data["token"]
        elif r.status_code == 400 and "já existe" in r.text:
            print("Worker já existe. Tentando obter token existente...")
            # Precisa deletar e recriar ou usar token salvo
            saved = get_saved_worker_token()
            if saved:
                print("Usando token salvo.")
                return saved
            else:
                print("ERRO: Worker existe mas não temos o token salvo.")
                print("Delete o worker no banco ou use outro nome.")
                return None
        else:
            print(f"Erro ao registrar: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        print(f"Erro: {e}")
        return None


def start_worker(worker_token: str):
    """Inicia o worker de treinamento."""
    print("\n" + "="*50)
    print("INICIANDO WORKER BERT")
    print("="*50)
    print(f"API: {API_URL}")
    print(f"Worker: {WORKER_NAME}")
    print("\nO worker vai:")
    print("  1. Buscar jobs na fila a cada 30s")
    print("  2. Executar treinamento na GPU")
    print("  3. Enviar métricas em tempo real")
    print("\nPressione Ctrl+C para parar.\n")
    print("="*50 + "\n")

    # Importa e executa o worker
    sys.path.insert(0, str(Path(__file__).parent))

    from sistemas.bert_training.worker.bert_worker import BertWorker

    worker = BertWorker(
        api_url=API_URL,
        token=worker_token,
        models_dir="./bert_models",
        poll_interval=30
    )

    worker.run()


def main():
    print("="*50)
    print("BERT Worker - Setup Automático")
    print("="*50)

    # 1. Verifica se já temos token salvo
    worker_token = get_saved_worker_token()

    if worker_token:
        print(f"\nToken de worker encontrado em {TOKEN_FILE}")
        use_saved = input("Usar token salvo? [S/n]: ").strip().lower()
        if use_saved != 'n':
            start_worker(worker_token)
            return

    # 2. Precisa registrar - obter token admin
    admin_token = get_admin_token()
    if not admin_token:
        print("\nNão foi possível obter token de admin.")
        sys.exit(1)

    # 3. Registra worker
    worker_token = register_worker(admin_token)
    if not worker_token:
        print("\nNão foi possível registrar o worker.")
        sys.exit(1)

    # 4. Inicia worker
    start_worker(worker_token)


if __name__ == "__main__":
    main()
