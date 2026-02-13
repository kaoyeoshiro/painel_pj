# -*- coding: utf-8 -*-
"""
Fixtures para testes E2E do BERT Training.
"""

import os
import pytest
import hashlib
import secrets
from pathlib import Path
from unittest.mock import MagicMock
from typing import Dict, Optional

import pandas as pd

os.environ.setdefault("ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-e2e-tests")
os.environ.setdefault("GEMINI_KEY", "test-gemini-key")


@pytest.fixture(scope="function")
def synthetic_dataframe():
    """Gera DataFrame sintetico para testes CI-friendly."""
    categories = ["Contrato", "Licitacao", "Parecer", "Decreto", "Portaria"]
    texts = []
    labels = []
    for i in range(100):
        category = categories[i % len(categories)]
        if category == "Contrato":
            text = f"Contrato administrativo numero {i} referente a prestacao de servicos."
        elif category == "Licitacao":
            text = f"Processo licitatorio {i}/2024 modalidade pregao eletronico."
        elif category == "Parecer":
            text = f"Parecer juridico {i} sobre regularidade do procedimento."
        elif category == "Decreto":
            text = f"Decreto estadual numero {i} que regulamenta a Lei {i + 1000}."
        else:
            text = f"Portaria {i} que designa servidor para comissao especial."
        texts.append(text)
        labels.append(category)
    return pd.DataFrame({"tokens_extraidos": texts, "categoria": labels})


@pytest.fixture(scope="function")
def synthetic_excel_path(synthetic_dataframe, tmp_path):
    """Salva DataFrame sintetico como Excel temporario."""
    excel_path = tmp_path / "synthetic_dataset.xlsx"
    synthetic_dataframe.to_excel(excel_path, index=False)
    return excel_path


@pytest.fixture(scope="session")
def real_excel_path():
    """Caminho do Excel real para testes locais."""
    path = Path(r"C:\Users\kaoye\Downloads\5ae06325-eaca-4fdd-8586-a5f178143c7f_resultados.xlsx")
    if not path.exists():
        pytest.skip(f"Arquivo Excel nao encontrado: {path}")
    return path


@pytest.fixture(scope="function")
def reduced_real_dataframe(real_excel_path):
    """Le Excel real e retorna amostra reduzida (20-30 linhas)."""
    df_full = pd.read_excel(real_excel_path)
    df_clean = df_full.dropna(subset=["tokens_extraidos", "categoria"])
    top_categories = df_clean["categoria"].value_counts().head(5).index.tolist()
    samples = []
    for cat in top_categories:
        cat_samples = df_clean[df_clean["categoria"] == cat].head(6)
        samples.append(cat_samples)
    df_reduced = pd.concat(samples).reset_index(drop=True)
    if len(df_reduced) < 20:
        remaining = df_clean[~df_clean.index.isin(df_reduced.index)].head(20 - len(df_reduced))
        df_reduced = pd.concat([df_reduced, remaining]).reset_index(drop=True)
    return df_reduced


@pytest.fixture(scope="function")
def reduced_real_excel_path(reduced_real_dataframe, tmp_path):
    """Salva amostra reduzida como Excel temporario."""
    excel_path = tmp_path / "reduced_real_dataset.xlsx"
    reduced_real_dataframe.to_excel(excel_path, index=False)
    return excel_path


class MockBertWorkerInProcess:
    """Worker mock que executa em-processo."""

    def __init__(self, test_client, worker_token: str, dry_run: bool = True):
        self.client = test_client
        self.token = worker_token
        self.dry_run = dry_run
        self.current_job_id = None

    def claim_job(self) -> Optional[Dict]:
        """Tenta pegar um job da fila."""
        response = self.client.post(
            "/bert-training/api/jobs/claim",
            json={
                "worker_token": self.token,
                "gpu_name": "Test GPU",
                "gpu_vram_gb": 8.0,
                "cuda_version": "11.8"
            }
        )
        if response.status_code == 200:
            job = response.json()
            self.current_job_id = job.get("job_id")
            return job
        return None
