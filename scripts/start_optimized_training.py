# -*- coding: utf-8 -*-
"""
Script para iniciar treinamento BERT otimizado para 95%+.

Automatiza:
1. Upload do dataset otimizado
2. Criação de run com preset "maximo"
3. Criação de job para o worker
"""

import requests
import json
import sys
from pathlib import Path

# Configurações
API_BASE = "http://localhost:8000"
DATASET_FILE = Path(r"E:\Projetos\PGE\portal-pge\data\bert_datasets\dataset_otimizado_95.xlsx")
WORKER_TOKEN_FILE = Path(r"E:\Projetos\PGE\portal-pge\.bert_worker_token")

# Ler credenciais do usuário
def get_auth_token():
    """Faz login e retorna token JWT."""
    print("Fazendo login...")
    # Usar credenciais de admin
    response = requests.post(
        f"{API_BASE}/auth/login",
        data={"username": "admin", "password": "m0301052271"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if response.status_code != 200:
        print(f"Erro no login: {response.text}")
        sys.exit(1)

    token = response.json().get("access_token")
    print(f"Login OK. Token: {token[:20]}...")
    return token


def upload_dataset(token: str) -> int:
    """Faz upload do dataset e retorna o ID."""
    print(f"\nFazendo upload de {DATASET_FILE.name}...")

    with open(DATASET_FILE, "rb") as f:
        response = requests.post(
            f"{API_BASE}/bert-training/api/datasets/upload",
            files={"file": (DATASET_FILE.name, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={
                "task_type": "text_classification",
                "text_column": "tokens_extraidos",
                "label_column": "categoria"
            },
            headers={"Authorization": f"Bearer {token}"}
        )

    if response.status_code not in [200, 201]:
        print(f"Erro no upload: {response.status_code}")
        print(response.text)
        sys.exit(1)

    dataset = response.json()
    dataset_id = dataset.get("id") or dataset.get("dataset_id")
    print(f"Dataset criado com ID: {dataset_id}")
    return dataset_id


def create_run(token: str, dataset_id: int) -> int:
    """Cria um run com preset maximo."""
    print(f"\nCriando run com preset 'maximo'...")

    response = requests.post(
        f"{API_BASE}/bert-training/api/runs",
        json={
            "name": "Treinamento Otimizado 95%",
            "dataset_id": dataset_id,
            "preset_name": "maximo"
        },
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )

    if response.status_code not in [200, 201]:
        print(f"Erro ao criar run: {response.status_code}")
        print(response.text)
        sys.exit(1)

    run = response.json()
    run_id = run.get("id") or run.get("run_id")
    print(f"Run criado com ID: {run_id}")
    print(f"Configuração: {json.dumps(run.get('hyperparameters', {}), indent=2)}")
    return run_id


def create_job(token: str, run_id: int) -> int:
    """Cria job para o run."""
    print(f"\nCriando job para run {run_id}...")

    response = requests.post(
        f"{API_BASE}/bert-training/api/runs/{run_id}/start",
        headers={"Authorization": f"Bearer {token}"}
    )

    if response.status_code not in [200, 201]:
        print(f"Erro ao criar job: {response.status_code}")
        print(response.text)
        sys.exit(1)

    job = response.json()
    job_id = job.get("id") or job.get("job_id")
    print(f"Job criado com ID: {job_id}")
    print("Status: Na fila, aguardando worker...")
    return job_id


def main():
    print("="*60)
    print("INICIANDO TREINAMENTO OTIMIZADO PARA 95%+")
    print("="*60)

    # 1. Login
    token = get_auth_token()

    # 2. Upload dataset
    dataset_id = upload_dataset(token)

    # 3. Criar run
    run_id = create_run(token, dataset_id)

    # 4. Criar job
    job_id = create_job(token, run_id)

    print("\n" + "="*60)
    print("PRONTO!")
    print("="*60)
    print(f"Dataset ID: {dataset_id}")
    print(f"Run ID: {run_id}")
    print(f"Job ID: {job_id}")
    print("\nO worker irá iniciar o treinamento automaticamente.")
    print("Acompanhe em: http://localhost:8000/bert-training/")


if __name__ == "__main__":
    main()
