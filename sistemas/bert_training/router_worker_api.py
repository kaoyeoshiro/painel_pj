# -*- coding: utf-8 -*-
"""
Worker API Router para o sistema BERT Training.

Endpoints exclusivos para comunicação worker <-> servidor:
- Jobs: claim, progress, complete, status
- Metrics: record_metric
- Logs: record_log, record_logs_batch

Extraído de router.py para separação de responsabilidades.
"""

import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from auth.models import User
from database.connection import get_db

from sistemas.bert_training.models import (
    BertDataset, BertRun, BertJob, BertWorker,
    JobStatus
)
from sistemas.bert_training.schemas import (
    TaskTypeEnum,
    JobClaimRequest, JobClaimResponse, JobProgressUpdate, JobCompleteRequest, JobStatusRequest,
    MetricCreate,
    LogCreate, LogBatchCreate
)
from sistemas.bert_training import services


logger = logging.getLogger(__name__)

router = APIRouter(tags=["BERT Training"])


# ==================== Job Endpoints (Worker API) ====================

@router.post("/api/jobs/claim", response_model=JobClaimResponse)
async def claim_job(
    request: JobClaimRequest,
    db: Session = Depends(get_db)
):
    """
    Worker tenta pegar um job da fila.
    """
    worker = services.get_worker_by_token(db, request.worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    # Atualiza info do worker se fornecido
    if request.gpu_name:
        worker.gpu_name = request.gpu_name
    if request.gpu_vram_gb:
        worker.gpu_vram_gb = request.gpu_vram_gb
    if request.cuda_version:
        worker.cuda_version = request.cuda_version
    db.commit()

    # Busca job pendente
    job = services.get_pending_job(db)
    if not job:
        raise HTTPException(status_code=404, detail="Nenhum job pendente")

    # Tenta pegar o job
    if not services.claim_job(db, worker, job):
        raise HTTPException(status_code=409, detail="Job já foi pego por outro worker")

    # Busca dados do run
    run = session_query(db, BertRun).filter(BertRun.id == job.run_id).first()
    dataset = session_query(db, BertDataset).filter(BertDataset.id == run.dataset_id).first()

    # Gera URL de download para worker (com token)
    download_url = f"/bert-training/api/datasets/{dataset.id}/download-worker?worker_token={request.worker_token}"

    return JobClaimResponse(
        job_id=job.id,
        run_id=run.id,
        dataset_download_url=download_url,
        dataset_sha256=dataset.sha256_hash,
        config=run.config_json,
        base_model=run.base_model,
        task_type=TaskTypeEnum(run.task_type.value),
        text_column=dataset.text_column,
        label_column=dataset.label_column
    )


@router.post("/api/jobs/{job_id}/progress")
async def update_job_progress(
    job_id: int,
    update: JobProgressUpdate,
    db: Session = Depends(get_db)
):
    """
    Worker atualiza progresso do job.
    """
    worker = services.get_worker_by_token(db, update.worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    job = session_query(db, BertJob).filter(BertJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    if job.worker_id != worker.id:
        raise HTTPException(status_code=403, detail="Job pertence a outro worker")

    services.update_job_progress(
        db=db,
        job=job,
        status=JobStatus(update.status.value) if update.status else None,
        current_epoch=update.current_epoch,
        progress_percent=update.progress_percent,
        error_message=update.error_message
    )

    # Atualiza heartbeat
    services.update_worker_heartbeat(db, worker, job_id)

    return {"status": "ok"}


@router.post("/api/jobs/{job_id}/complete")
async def complete_job(
    job_id: int,
    request: JobCompleteRequest,
    db: Session = Depends(get_db)
):
    """
    Worker marca job como completo.
    """
    worker = services.get_worker_by_token(db, request.worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    job = session_query(db, BertJob).filter(BertJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    if job.worker_id != worker.id:
        raise HTTPException(status_code=403, detail="Job pertence a outro worker")

    # Atualiza job
    services.update_job_progress(db, job, status=JobStatus.COMPLETED, progress_percent=100.0)

    # Finaliza run
    run = session_query(db, BertRun).filter(BertRun.id == job.run_id).first()
    services.finalize_run(
        db=db,
        run=run,
        success=True,
        final_accuracy=request.final_accuracy,
        final_macro_f1=request.final_macro_f1,
        final_weighted_f1=request.final_weighted_f1,
        model_fingerprint=request.model_fingerprint
    )

    # Atualiza stats do worker
    worker.total_jobs_completed += 1
    if job.started_at and job.completed_at:
        hours = (job.completed_at - job.started_at).total_seconds() / 3600
        worker.total_training_hours += hours
    worker.current_job_id = None
    db.commit()

    return {"status": "ok"}


@router.get("/api/jobs/{job_id}/status")
async def get_job_status(
    job_id: int,
    worker_token: str,
    db: Session = Depends(get_db)
):
    """
    Worker verifica status do job (para detectar STOPPING).
    """
    worker = services.get_worker_by_token(db, worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    job = session_query(db, BertJob).filter(BertJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    return {
        "job_id": job.id,
        "status": job.status.value if hasattr(job.status, 'value') else str(job.status),
        "should_stop": job.status == JobStatus.STOPPING
    }


# ==================== Metric Endpoints (Worker API) ====================

@router.post("/api/metrics")
async def record_metric(
    metric: MetricCreate,
    db: Session = Depends(get_db)
):
    """
    Worker registra métricas de uma época.
    """
    worker = services.get_worker_by_token(db, metric.worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    services.record_metric(
        db=db,
        run_id=metric.run_id,
        epoch=metric.epoch,
        train_loss=metric.train_loss,
        val_loss=metric.val_loss,
        val_accuracy=metric.val_accuracy,
        val_macro_f1=metric.val_macro_f1,
        val_weighted_f1=metric.val_weighted_f1,
        val_macro_precision=metric.val_macro_precision,
        val_macro_recall=metric.val_macro_recall,
        seqeval_f1=metric.seqeval_f1,
        seqeval_precision=metric.seqeval_precision,
        seqeval_recall=metric.seqeval_recall,
        classification_report=metric.classification_report,
        confusion_matrix=metric.confusion_matrix
    )

    return {"status": "ok"}


# ==================== Log Endpoints (Worker API) ====================

@router.post("/api/logs")
async def record_log(
    log: LogCreate,
    db: Session = Depends(get_db)
):
    """
    Worker registra um log.
    """
    worker = services.get_worker_by_token(db, log.worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    services.record_log(
        db=db,
        run_id=log.run_id,
        level=log.level.value,
        message=log.message,
        extra_data=log.extra_data,
        source=log.source,
        epoch=log.epoch,
        batch=log.batch
    )

    return {"status": "ok"}


@router.post("/api/logs/batch")
async def record_logs_batch(
    batch: LogBatchCreate,
    db: Session = Depends(get_db)
):
    """
    Worker registra múltiplos logs de uma vez.
    """
    worker = services.get_worker_by_token(db, batch.worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token inválido")

    for log in batch.logs:
        services.record_log(
            db=db,
            run_id=log.run_id,
            level=log.level.value,
            message=log.message,
            extra_data=log.extra_data,
            source=log.source,
            epoch=log.epoch,
            batch=log.batch
        )

    return {"status": "ok", "count": len(batch.logs)}





