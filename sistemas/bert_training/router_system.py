# -*- coding: utf-8 -*-
"""
Router FastAPI para endpoints de sistema do BERT Training.

Endpoints extraídos de router.py:
- Worker Management (start, stop, status, register, list, heartbeat)
- Queue Status
- Watchdog & Health
- Models for Testing
- Test History CRUD
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from sqlalchemy import desc

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db

from sistemas.bert_training.models import (
    BertDataset, BertRun, BertJob, BertWorker, BertTestHistory, BertMetric,
    JobStatus
)
from sistemas.bert_training.schemas import (
    WorkerRegister, WorkerRegisterResponse, WorkerResponse, WorkerHeartbeat
)
from sistemas.bert_training import services
from sistemas.bert_training.worker.worker_manager import (
    get_worker_status, get_full_status, get_inference_status,
    start_training_worker, start_inference_server, stop_inference_server
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["BERT Training"])


# ==================== Worker Management ====================

@router.post("/api/workers/start-local")
async def start_local_worker(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Inicia o training worker local em background."""
    success = start_training_worker()
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Falha ao iniciar training worker. Verifique .bert_worker_token e logs."
        )
    logger.info(f"Training worker iniciado por {current_user.email}")
    return {"status": "started", **get_worker_status()}


@router.post("/api/workers/start-inference")
async def start_inference_endpoint(
    current_user: User = Depends(get_current_active_user)
):
    """Inicia o servidor de inferencia local (porta 8765)."""
    success = start_inference_server()
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Falha ao iniciar inference server. Verifique bert_inference.log."
        )
    logger.info(f"Inference server iniciado por {current_user.email}")
    return {"status": "started", **get_inference_status()}


@router.post("/api/workers/stop-inference")
async def stop_inference_endpoint(
    current_user: User = Depends(get_current_active_user)
):
    """Para o servidor de inferencia."""
    stop_inference_server()
    return {"status": "stopped", **get_inference_status()}


@router.get("/api/workers/status")
async def workers_status_endpoint(
    current_user: User = Depends(get_current_active_user)
):
    """Status de todos os processos BERT (training worker + inference server)."""
    return get_full_status()


@router.post("/api/workers/register", response_model=WorkerRegisterResponse)
async def register_worker(
    worker: WorkerRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Registra um novo worker (apenas admin).
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode registrar workers")

    # Verifica se nome já existe
    existing = session_query(db, BertWorker).filter(BertWorker.name == worker.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Nome de worker já existe")

    new_worker, token = services.create_worker(
        db=db,
        name=worker.name,
        description=worker.description,
        gpu_name=worker.gpu_name,
        gpu_vram_gb=worker.gpu_vram_gb,
        cuda_version=worker.cuda_version
    )

    return WorkerRegisterResponse(
        id=new_worker.id,
        name=new_worker.name,
        token=token,  # Mostrado apenas uma vez!
        created_at=new_worker.created_at
    )


@router.get("/api/workers", response_model=List[WorkerResponse])
async def list_workers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista workers registrados (apenas admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    workers = session_query(db, BertWorker).order_by(desc(BertWorker.created_at)).all()

    return [
        WorkerResponse(
            id=w.id,
            name=w.name,
            description=w.description,
            gpu_name=w.gpu_name,
            gpu_vram_gb=w.gpu_vram_gb,
            cuda_version=w.cuda_version,
            is_active=w.is_active,
            last_heartbeat=w.last_heartbeat,
            current_job_id=w.current_job_id,
            total_jobs_completed=w.total_jobs_completed,
            total_training_hours=w.total_training_hours,
            created_at=w.created_at
        )
        for w in workers
    ]


@router.post("/api/workers/heartbeat")
async def worker_heartbeat(
    heartbeat: WorkerHeartbeat,
    db: Session = Depends(get_db)
):
    """Worker envia heartbeat."""
    worker = services.get_worker_by_token(db, heartbeat.worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    services.update_worker_heartbeat(db, worker, heartbeat.current_job_id)

    return {"status": "ok"}


# ==================== Queue Status ====================

@router.get("/api/queue/status")
async def get_queue_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém status da fila de jobs."""
    pending = session_query(db, BertJob).filter(BertJob.status == JobStatus.PENDING).count()
    training = session_query(db, BertJob).filter(BertJob.status == JobStatus.TRAINING).count()
    completed = session_query(db, BertJob).filter(BertJob.status == JobStatus.COMPLETED).count()
    failed = session_query(db, BertJob).filter(BertJob.status == JobStatus.FAILED).count()

    active_workers = session_query(db, BertWorker).filter(
        BertWorker.is_active == True,
        BertWorker.current_job_id != None
    ).count()

    return {
        "pending": pending,
        "training": training,
        "completed": completed,
        "failed": failed,
        "active_workers": active_workers
    }


# ==================== Watchdog & Health ====================

@router.get("/api/system/health")
async def get_system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna status de saude do sistema.

    Util para dashboards e monitoramento.
    """
    from sistemas.bert_training.watchdog import get_system_health as watchdog_health
    return watchdog_health(db)


@router.post("/api/system/watchdog/run")
async def run_watchdog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Executa verificacao do watchdog manualmente (apenas admin).

    Normalmente o watchdog roda automaticamente via cron/scheduler.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode executar watchdog")

    from sistemas.bert_training.watchdog import run_watchdog_check
    results = run_watchdog_check(db)

    return results


@router.get("/api/system/calculate-batch")
async def calculate_optimal_batch(
    vram_gb: float = Query(..., description="VRAM disponivel em GB"),
    max_length: int = Query(512, description="Tamanho maximo de sequencia"),
    model: str = Query("neuralmind/bert-base-portuguese-cased", description="Nome do modelo"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Calcula batch size otimo baseado na VRAM disponivel.

    Use este endpoint para descobrir qual batch size usar
    baseado na GPU do seu computador.
    """
    model_size = services.detect_model_size(model)
    optimal_batch = services.calculate_optimal_batch_size(vram_gb, max_length, model_size)

    return {
        "vram_gb": vram_gb,
        "max_length": max_length,
        "model": model,
        "model_size": model_size,
        "optimal_batch_size": optimal_batch,
        "explanation": f"Para {vram_gb}GB de VRAM com max_length={max_length} e modelo {model_size}, "
                      f"recomendamos batch_size={optimal_batch}"
    }


# ==================== Modelos para Teste ====================

@router.get("/api/models/completed")
async def get_completed_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista modelos treinados com sucesso disponiveis para teste.

    Retorna apenas runs com status 'completed'.
    """
    runs = session_query(db, BertRun).filter(
        BertRun.status == "completed"
    ).order_by(desc(BertRun.completed_at)).all()

    return [
        {
            "id": run.id,
            "name": run.name,
            "description": run.description,
            "base_model": run.base_model,
            "final_accuracy": run.final_accuracy,
            "f1_score": run.final_macro_f1,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "dataset_name": run.dataset.filename if run.dataset else None,
            "total_labels": run.dataset.total_labels if run.dataset else None,
            "labels": list(run.dataset.label_distribution.keys()) if run.dataset and run.dataset.label_distribution else []
        }
        for run in runs
    ]


# ==================== Historico de Testes ====================

@router.get("/api/tests")
async def get_test_history(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista historico de testes do usuario."""
    tests = session_query(db, BertTestHistory).filter(
        BertTestHistory.user_id == current_user.id
    ).order_by(desc(BertTestHistory.created_at)).limit(limit).all()

    return [
        {
            "id": test.id,
            "run_id": test.run_id,
            "run_name": test.run.name if test.run else None,
            "input_type": test.input_type,
            "input_text": test.input_text[:200] + "..." if len(test.input_text) > 200 else test.input_text,
            "input_filename": test.input_filename,
            "predicted_label": test.predicted_label,
            "confidence": test.confidence,
            "created_at": test.created_at.isoformat()
        }
        for test in tests
    ]


@router.post("/api/tests")
async def create_test_record(
    run_id: int = Form(...),
    input_type: str = Form(...),
    input_text: str = Form(...),
    predicted_label: str = Form(...),
    confidence: float = Form(...),
    input_filename: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Salva registro de teste no historico."""
    # Verifica se o run existe
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run nao encontrado")

    test = BertTestHistory(
        run_id=run_id,
        input_type=input_type,
        input_text=input_text,
        input_filename=input_filename,
        predicted_label=predicted_label,
        confidence=confidence,
        user_id=current_user.id
    )

    db.add(test)
    db.commit()
    db.refresh(test)

    return {
        "id": test.id,
        "message": "Teste salvo com sucesso"
    }


@router.delete("/api/tests/{test_id}")
async def delete_test_record(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Deleta um registro de teste."""
    test = session_query(db, BertTestHistory).filter(
        BertTestHistory.id == test_id,
        BertTestHistory.user_id == current_user.id
    ).first()

    if not test:
        raise HTTPException(status_code=404, detail="Teste nao encontrado")

    db.delete(test)
    db.commit()

    return {"message": "Teste deletado com sucesso"}


@router.delete("/api/tests")
async def clear_test_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Limpa todo historico de testes do usuario."""
    deleted = session_query(db, BertTestHistory).filter(
        BertTestHistory.user_id == current_user.id
    ).delete()

    db.commit()

    return {"message": f"Historico limpo: {deleted} testes removidos"}





