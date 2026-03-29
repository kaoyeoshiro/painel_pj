# scripts/worker_revisao/config.py
"""Configuracao do worker local de insercao de observacoes."""
import os

PORTAL_URL = os.getenv("PORTAL_PGE_URL", "http://localhost:8000")
PORTAL_USER = os.getenv("PORTAL_PGE_USER", "admin")
PORTAL_PASS = os.getenv("PORTAL_PGE_PASS", "")
INTERVALO = int(os.getenv("WORKER_INTERVALO", "300"))
BD_PGE_SCRIPT = os.getenv(
    "BD_PGE_SCRIPT",
    r"E:\Projetos\Automacao_Total\BD_PGE.NET\scripts\inserir_observacao.py"
)
