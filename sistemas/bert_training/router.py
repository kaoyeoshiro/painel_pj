# -*- coding: utf-8 -*-
"""
Router agregador do sistema BERT Training.

Endpoints splitados em sub-routers (Fase 5c do plano de refatoracao):
- router_datasets.py  — Presets + upload/gestao de datasets
- router_runs.py       — Criacao, monitoramento e controle de runs
- router_worker_api.py — API para workers (jobs, metricas, logs)
- router_system.py     — Workers, fila, health, modelos e testes
- router_compare.py    — Comparacao BERT vs LLM (CNJ)
"""

from fastapi import APIRouter

from .router_datasets import router as datasets_router
from .router_runs import router as runs_router
from .router_worker_api import router as worker_api_router
from .router_system import router as system_router
from .router_compare import router as compare_router

router = APIRouter(prefix="/bert-training", tags=["BERT Training"])

router.include_router(datasets_router)
router.include_router(runs_router)
router.include_router(worker_api_router)
router.include_router(system_router)
router.include_router(compare_router)
