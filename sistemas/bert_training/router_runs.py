# -*- coding: utf-8 -*-
"""
Router FastAPI para endpoints de Run (BERT Training).

Endpoints para:
- Criação de runs (modo simples e avançado)
- Listagem e detalhes de runs
- Progresso e avaliação
- Métricas e logs
- Cancelamento e exclusão
- Reprodução de runs
"""

import json
import logging
import re
import asyncio
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from sqlalchemy import desc

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db

from sistemas.bert_training.models import (
    BertDataset, BertRun, BertJob, BertMetric, BertLog, BertWorker,
    TaskType, JobStatus
)
from sistemas.bert_training.schemas import (
    TaskTypeEnum, JobStatusEnum,
    RunCreate, RunCreateSimple, RunResponse, RunListItem, RunDetailResponse,
    JobListItem,
    MetricResponse,
    HyperparametersConfig
)
from sistemas.bert_training import services
from sistemas.bert_training.error_translator import (
    get_friendly_error_message, translate_error, get_quality_alert
)
from sistemas.bert_training.worker.worker_manager import (
    ensure_worker_running
)

logger = logging.getLogger(__name__)


def _auto_start_worker():
    """Tenta iniciar o worker automaticamente em background thread."""
    try:
        ensure_worker_running(api_url="http://localhost:8000")
    except Exception as e:
        logger.warning(f"Falha ao auto-iniciar worker BERT: {e}")


router = APIRouter(tags=["BERT Training"])


# ==================== Run Endpoints ====================

@router.post("/api/runs", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    run_data: RunCreate,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria um novo run de treinamento e coloca na fila de jobs.

    Modos de uso:
    1. Modo Simples: Use preset_name ou preset_id (sem hyperparameters)
    2. Modo Avancado: Forneca hyperparameters customizados
    3. Modo Hibrido: Use preset + override de alguns hyperparameters

    Se nenhum preset/hyperparameters for fornecido, usa preset "equilibrado".
    """

    if not current_user.pode_acessar_sistema("bert_training"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca dataset
    dataset = session_query(db, BertDataset).filter(BertDataset.id == run_data.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset nao encontrado")

    # Verifica acesso ao dataset
    if current_user.role != "admin" and dataset.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado ao dataset")

    # Obtem IP do cliente para auditoria
    ip_address = None
    if request:
        ip_address = request.client.host if request.client else None

    # Cria run
    run = services.create_run(
        db=db,
        name=run_data.name,
        description=run_data.description,
        dataset=dataset,
        base_model=run_data.base_model,
        user_id=current_user.id,
        preset_name=run_data.preset_name,
        hyperparameters=run_data.hyperparameters,
        ip_address=ip_address
    )

    # Cria job na fila
    services.create_job_for_run(db, run)

    # Auto-inicia worker se nao estiver rodando
    _auto_start_worker()

    # Traduz mensagem de erro se houver
    error_friendly = None
    if run.error_message:
        error_friendly = get_friendly_error_message(run.error_message)

    return RunResponse(
        id=run.id,
        name=run.name,
        description=run.description,
        dataset_id=run.dataset_id,
        dataset_sha256=run.dataset_sha256,
        task_type=TaskTypeEnum(run.task_type.value),
        base_model=run.base_model,
        config_json=run.config_json,
        status=run.status,
        error_message=run.error_message,
        error_message_friendly=error_friendly,
        final_accuracy=run.final_accuracy,
        final_macro_f1=run.final_macro_f1,
        final_weighted_f1=run.final_weighted_f1,
        git_commit_hash=run.git_commit_hash,
        environment_fingerprint=run.environment_fingerprint,
        model_fingerprint=run.model_fingerprint,
        created_at=run.created_at,
        started_at=run.started_at,
        completed_at=run.completed_at
    )


@router.post("/api/runs/simple", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run_simple(
    run_data: RunCreateSimple,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria um novo run no modo SIMPLES (recomendado para usuarios amadores).

    Apenas forneca:
    - name: Nome do seu treino
    - dataset_id: ID do dataset
    - preset_name: rapido, equilibrado ou preciso

    O sistema cuida do resto!
    """

    if not current_user.pode_acessar_sistema("bert_training"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca dataset
    dataset = session_query(db, BertDataset).filter(BertDataset.id == run_data.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset nao encontrado")

    # Verifica acesso ao dataset
    if current_user.role != "admin" and dataset.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado ao dataset")

    # Obtem IP do cliente
    ip_address = None
    if request:
        ip_address = request.client.host if request.client else None

    # Cria run com preset
    run = services.create_run(
        db=db,
        name=run_data.name,
        description=run_data.description,
        dataset=dataset,
        base_model=run_data.base_model,
        user_id=current_user.id,
        preset_name=run_data.preset_name,
        ip_address=ip_address
    )

    # Cria job na fila
    services.create_job_for_run(db, run)

    # Auto-inicia worker se nao estiver rodando
    _auto_start_worker()

    return RunResponse(
        id=run.id,
        name=run.name,
        description=run.description,
        dataset_id=run.dataset_id,
        dataset_sha256=run.dataset_sha256,
        task_type=TaskTypeEnum(run.task_type.value),
        base_model=run.base_model,
        config_json=run.config_json,
        status=run.status,
        error_message=run.error_message,
        error_message_friendly=None,
        final_accuracy=run.final_accuracy,
        final_macro_f1=run.final_macro_f1,
        final_weighted_f1=run.final_weighted_f1,
        git_commit_hash=run.git_commit_hash,
        environment_fingerprint=run.environment_fingerprint,
        model_fingerprint=run.model_fingerprint,
        created_at=run.created_at,
        started_at=run.started_at,
        completed_at=run.completed_at
    )


@router.get("/api/runs", response_model=List[RunListItem])
async def list_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista runs de treinamento."""
    if not current_user.pode_acessar_sistema("bert_training"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    query = session_query(db, BertRun).order_by(desc(BertRun.created_at))

    if current_user.role != "admin":
        query = query.filter(BertRun.created_by == current_user.id)

    if status:
        query = query.filter(BertRun.status == status)

    runs = query.offset(skip).limit(limit).all()

    return [
        RunListItem(
            id=r.id,
            name=r.name,
            task_type=TaskTypeEnum(r.task_type.value),
            base_model=r.base_model,
            status=r.status,
            final_accuracy=r.final_accuracy,
            final_macro_f1=r.final_macro_f1,
            created_at=r.created_at,
            completed_at=r.completed_at
        )
        for r in runs
    ]


@router.get("/api/runs/{run_id}", response_model=RunDetailResponse)
async def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém detalhes de um run."""
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()

    if not run:
        raise HTTPException(status_code=404, detail="Run não encontrado")

    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca dataset filename
    dataset = session_query(db, BertDataset).filter(BertDataset.id == run.dataset_id).first()

    # Busca jobs
    jobs = session_query(db, BertJob).filter(BertJob.run_id == run_id).order_by(desc(BertJob.created_at)).all()

    # Busca últimas métricas
    metrics = session_query(db, BertMetric).filter(
        BertMetric.run_id == run_id
    ).order_by(BertMetric.epoch.asc()).limit(100).all()

    # Traduz erro se houver
    error_friendly = None
    if run.error_message:
        error_friendly = get_friendly_error_message(run.error_message)

    return RunDetailResponse(
        id=run.id,
        name=run.name,
        description=run.description,
        dataset_id=run.dataset_id,
        dataset_sha256=run.dataset_sha256,
        task_type=TaskTypeEnum(run.task_type.value),
        base_model=run.base_model,
        config_json=run.config_json,
        status=run.status,
        error_message=run.error_message,
        error_message_friendly=error_friendly,
        final_accuracy=run.final_accuracy,
        final_macro_f1=run.final_macro_f1,
        final_weighted_f1=run.final_weighted_f1,
        git_commit_hash=run.git_commit_hash,
        environment_fingerprint=run.environment_fingerprint,
        model_fingerprint=run.model_fingerprint,
        created_at=run.created_at,
        started_at=run.started_at,
        completed_at=run.completed_at,
        dataset_filename=dataset.filename if dataset else "Unknown",
        jobs=[
            JobListItem(
                id=j.id,
                run_id=j.run_id,
                status=JobStatusEnum(j.status.value),
                progress_percent=j.progress_percent,
                created_at=j.created_at
            )
            for j in jobs
        ],
        recent_metrics=[
            MetricResponse(
                id=m.id,
                run_id=m.run_id,
                epoch=m.epoch,
                train_loss=m.train_loss,
                val_loss=m.val_loss,
                val_accuracy=m.val_accuracy,
                val_macro_f1=m.val_macro_f1,
                val_weighted_f1=m.val_weighted_f1,
                recorded_at=m.recorded_at
            )
            for m in metrics
        ]
    )


@router.get("/api/runs/{run_id}/progress")
async def get_run_progress(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtem progresso do run com estimativa de tempo.

    Retorna:
    - progress_percent: Porcentagem de progresso
    - current_epoch: Rodada atual
    - total_epochs: Total de rodadas
    - current_epoch_label: "Rodada X de Y"
    - estimated_remaining_minutes: Tempo estimado restante
    - estimated_remaining_label: "~X minutos restantes"
    - status: Status atual do run
    - quality_alert: Alerta de qualidade (se aplicavel)
    """
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run nao encontrado")

    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca job ativo
    job = session_query(db, BertJob).filter(
        BertJob.run_id == run_id
    ).order_by(desc(BertJob.created_at)).first()

    result = {
        "run_id": run_id,
        "status": run.status,
        "status_label": _translate_status(run.status)
    }

    if job:
        current_epoch = job.current_epoch or 0
        total_epochs = run.epochs or 10

        progress = services.calculate_progress_with_estimate(job, run, current_epoch)
        result.update(progress)

        result["job_status"] = job.status.value
        result["job_status_label"] = _translate_status(job.status.value)

        # Informações do worker/GPU
        if job.worker_id:
            worker = session_query(db, BertWorker).filter(BertWorker.id == job.worker_id).first()
            if worker:
                result["worker_info"] = {
                    "name": worker.name,
                    "gpu_name": worker.gpu_name,
                    "gpu_vram_gb": worker.gpu_vram_gb,
                    "cuda_version": worker.cuda_version,
                    "is_active": worker.is_active
                }

        # Últimas métricas (mais recente)
        latest_metric = session_query(db, BertMetric).filter(
            BertMetric.run_id == run_id
        ).order_by(desc(BertMetric.epoch)).first()

        # Melhor métrica (maior val_accuracy)
        best_metric = session_query(db, BertMetric).filter(
            BertMetric.run_id == run_id,
            BertMetric.val_accuracy.isnot(None)
        ).order_by(desc(BertMetric.val_accuracy)).first()

        if latest_metric:
            result["latest_metrics"] = {
                "epoch": latest_metric.epoch,
                "train_loss": round(latest_metric.train_loss, 4) if latest_metric.train_loss else None,
                "val_loss": round(latest_metric.val_loss, 4) if latest_metric.val_loss else None,
                "val_accuracy": round(latest_metric.val_accuracy, 4) if latest_metric.val_accuracy else None,
                "val_macro_f1": round(latest_metric.val_macro_f1, 4) if latest_metric.val_macro_f1 else None
            }

        if best_metric:
            result["best_metrics"] = {
                "epoch": best_metric.epoch,
                "val_accuracy": round(best_metric.val_accuracy, 4) if best_metric.val_accuracy else None,
                "val_loss": round(best_metric.val_loss, 4) if best_metric.val_loss else None
            }

        # Histórico completo de métricas (para o gráfico)
        all_metrics = session_query(db, BertMetric).filter(
            BertMetric.run_id == run_id,
            BertMetric.val_accuracy.isnot(None)
        ).order_by(BertMetric.epoch).all()

        if all_metrics:
            result["metrics_history"] = [
                {
                    "epoch": m.epoch,
                    "train_loss": round(m.train_loss, 4) if m.train_loss else None,
                    "val_loss": round(m.val_loss, 4) if m.val_loss else None,
                    "val_accuracy": round(m.val_accuracy, 4) if m.val_accuracy else None
                }
                for m in all_metrics
            ]

        # Extrai progresso intra-epoch dos logs (Batch X/Y)
        batch_log = session_query(db, BertLog).filter(
            BertLog.run_id == run_id,
            BertLog.message.like('%Batch %/%')
        ).order_by(desc(BertLog.timestamp)).first()

        if batch_log:
            import re
            # Parse "Epoch X - Batch 565/1135 - Loss: 0.1234"
            match = re.search(r'Epoch (\d+) - Batch (\d+)/(\d+)', batch_log.message)
            if match:
                log_epoch = int(match.group(1))
                batch_current = int(match.group(2))
                batch_total = int(match.group(3))

                # Calcula progresso intra-epoch
                epoch_progress_percent = (batch_current / batch_total) * 100

                result["batch_progress"] = {
                    "current": batch_current,
                    "total": batch_total,
                    "percent": round(epoch_progress_percent, 1),
                    "epoch": log_epoch
                }

                # Estima tempo restante para o epoch atual
                if job.started_at and batch_current > 0:
                    # Usa o timestamp do log para calcular velocidade
                    if batch_log.timestamp:
                        # Calcula batches restantes neste epoch
                        batches_remaining = batch_total - batch_current

                        # Estima tempo por batch baseado nos logs recentes
                        # Busca log de batch anterior para calcular velocidade
                        prev_batch_log = session_query(db, BertLog).filter(
                            BertLog.run_id == run_id,
                            BertLog.message.like(f'%Epoch {log_epoch} - Batch%'),
                            BertLog.timestamp < batch_log.timestamp
                        ).order_by(desc(BertLog.timestamp)).first()

                        if prev_batch_log:
                            prev_match = re.search(r'Batch (\d+)/(\d+)', prev_batch_log.message)
                            if prev_match:
                                prev_batch = int(prev_match.group(1))
                                batch_diff = batch_current - prev_batch
                                if batch_diff > 0:
                                    time_diff = (batch_log.timestamp - prev_batch_log.timestamp).total_seconds()
                                    seconds_per_batch = time_diff / batch_diff
                                    epoch_remaining_seconds = batches_remaining * seconds_per_batch

                                    result["batch_progress"]["epoch_remaining_seconds"] = int(epoch_remaining_seconds)
                                    if epoch_remaining_seconds < 60:
                                        result["batch_progress"]["epoch_remaining_label"] = f"~{int(epoch_remaining_seconds)}s restantes"
                                    else:
                                        result["batch_progress"]["epoch_remaining_label"] = f"~{int(epoch_remaining_seconds/60)}min restantes"

        # Últimos logs (últimos 5)
        recent_logs = session_query(db, BertLog).filter(
            BertLog.run_id == run_id
        ).order_by(desc(BertLog.timestamp)).limit(5).all()

        if recent_logs:
            result["recent_logs"] = [
                {
                    "level": log.level,
                    "message": log.message[:200],  # Trunca mensagens longas
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None
                }
                for log in reversed(recent_logs)  # Ordem cronológica
            ]

    # Se completado, adiciona metricas finais
    if run.status == "completed":
        result["final_accuracy"] = run.final_accuracy
        result["final_accuracy_label"] = f"{int(run.final_accuracy * 100)}% de acertos" if run.final_accuracy else None

        # Alerta de qualidade
        alert = get_quality_alert({
            "accuracy": run.final_accuracy,
            "macro_f1": run.final_macro_f1
        })
        if alert:
            result["quality_alert"] = alert

    # Se falhou, adiciona erro amigavel
    if run.status == "failed" and run.error_message:
        error = translate_error(run.error_message)
        result["error"] = {
            "title": error.title,
            "message": error.message,
            "suggestion": error.suggestion,
            "can_auto_retry": error.can_auto_retry
        }

    return result


@router.get("/api/runs/{run_id}/evaluation")
async def get_run_evaluation(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna resultados detalhados da avaliação final do modelo.

    Inclui:
    - Métricas gerais (accuracy, precision, recall, f1)
    - Classification report por classe
    - Confusion matrix
    - Lista de classificações incorretas (erros)
    """
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run não encontrado")

    # Verifica permissão (dono ou admin)
    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if run.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Avaliação disponível apenas para runs concluídos. Status atual: {run.status}"
        )

    # Busca a última métrica com classification_report (normalmente a avaliação final)
    final_metric = session_query(db, BertMetric).filter(
        BertMetric.run_id == run_id,
        BertMetric.classification_report.isnot(None)
    ).order_by(desc(BertMetric.epoch)).first()

    if not final_metric:
        raise HTTPException(
            status_code=404,
            detail="Métricas de avaliação não encontradas para este run"
        )

    # Monta resposta
    result = {
        "run_id": run_id,
        "run_name": run.name,
        "epoch": final_metric.epoch,
        "metrics": {
            "accuracy": round(final_metric.val_accuracy, 4) if final_metric.val_accuracy else None,
            "macro_f1": round(final_metric.val_macro_f1, 4) if final_metric.val_macro_f1 else None,
            "weighted_f1": round(final_metric.val_weighted_f1, 4) if final_metric.val_weighted_f1 else None,
            "train_loss": round(final_metric.train_loss, 4) if final_metric.train_loss else None,
            "val_loss": round(final_metric.val_loss, 4) if final_metric.val_loss else None,
        },
        "classification_report": final_metric.classification_report,
        "confusion_matrix": final_metric.confusion_matrix,
    }

    # Calcula estatísticas resumidas da confusion matrix
    if final_metric.confusion_matrix and final_metric.classification_report:
        cm = final_metric.confusion_matrix
        report = final_metric.classification_report

        # Total de amostras
        total_samples = sum(sum(row) for row in cm)
        total_correct = sum(cm[i][i] for i in range(len(cm)))
        total_errors = total_samples - total_correct

        # Lista de classes com seus erros
        labels = list(report.keys())
        # Remove métricas agregadas
        labels = [l for l in labels if l not in ['accuracy', 'macro avg', 'weighted avg']]

        class_stats = []
        for i, label in enumerate(labels):
            if i < len(cm):
                correct = cm[i][i]
                total = sum(cm[i])
                errors = total - correct
                class_stats.append({
                    "label": label,
                    "total": total,
                    "correct": correct,
                    "errors": errors,
                    "precision": round(report.get(label, {}).get('precision', 0), 4),
                    "recall": round(report.get(label, {}).get('recall', 0), 4),
                    "f1": round(report.get(label, {}).get('f1-score', 0), 4),
                    "support": report.get(label, {}).get('support', 0)
                })

        result["summary"] = {
            "total_samples": total_samples,
            "total_correct": total_correct,
            "total_errors": total_errors,
            "classes": class_stats,
            "labels": labels
        }

    return result


@router.post("/api/runs/{run_id}/cancel")
async def cancel_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancela um treinamento em andamento ou na fila.

    - Se o run estiver pendente: remove da fila
    - Se estiver treinando: marca como cancelado (worker deve parar)

    Retorna erro se o run já estiver concluído ou cancelado.
    """
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run nao encontrado")

    # Verifica permissão
    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Verifica se pode cancelar
    if run.status in ["completed", "failed", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail=f"Nao e possivel cancelar um run com status '{run.status}'"
        )

    # Atualiza status do run
    old_status = run.status
    run.status = "cancelled"
    run.error_message = f"Cancelado pelo usuario (status anterior: {old_status})"

    # Cancela job associado (se houver)
    job = session_query(db, BertJob).filter(
        BertJob.run_id == run_id,
        BertJob.status.notin_([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED])
    ).first()

    if job:
        job.status = JobStatus.CANCELLED
        job.error_message = "Cancelado pelo usuario"

    db.commit()

    logger.info(f"Run {run_id} cancelado por usuario {current_user.id} (status anterior: {old_status})")

    return {
        "success": True,
        "message": "Treinamento cancelado com sucesso",
        "run_id": run_id,
        "old_status": old_status,
        "new_status": "cancelled"
    }


@router.post("/api/runs/{run_id}/stop-early")
async def stop_run_early(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Solicita parada antecipada do treinamento com salvamento do melhor modelo.

    Diferente de cancelar:
    - O worker finaliza a epoch atual
    - Salva o modelo com melhor accuracy
    - Marca como COMPLETED (nao CANCELLED)

    Ideal para quando o modelo ja atingiu uma boa accuracy e nao esta melhorando.
    """
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run nao encontrado")

    # Verifica permissão
    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Só pode parar se estiver treinando
    if run.status != "training":
        raise HTTPException(
            status_code=400,
            detail=f"Parada antecipada so e possivel durante treinamento. Status atual: '{run.status}'"
        )

    # Busca job ativo
    job = session_query(db, BertJob).filter(
        BertJob.run_id == run_id,
        BertJob.status == JobStatus.TRAINING
    ).first()

    if not job:
        raise HTTPException(
            status_code=400,
            detail="Nenhum job de treinamento ativo encontrado"
        )

    # Marca job como STOPPING (worker deve verificar e parar graciosamente)
    job.status = JobStatus.STOPPING

    # Busca melhor accuracy ate agora
    best_metric = session_query(db, BertMetric).filter(
        BertMetric.run_id == run_id,
        BertMetric.val_accuracy.isnot(None)
    ).order_by(desc(BertMetric.val_accuracy)).first()

    best_accuracy = best_metric.val_accuracy if best_metric else None
    best_epoch = best_metric.epoch if best_metric else None

    db.commit()

    logger.info(
        f"Run {run_id} marcado para parada antecipada por usuario {current_user.id}. "
        f"Melhor accuracy: {f'{best_accuracy:.4f}' if best_accuracy else 'N/A'} (epoch {best_epoch})"
    )

    return {
        "success": True,
        "message": "Parada antecipada solicitada. O modelo com melhor accuracy sera salvo.",
        "run_id": run_id,
        "job_id": job.id,
        "current_epoch": job.current_epoch,
        "best_accuracy": round(best_accuracy * 100, 2) if best_accuracy else None,
        "best_epoch": best_epoch
    }


@router.delete("/api/runs/{run_id}")
async def delete_run(
    run_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Exclui um run e todos os dados associados (metricas, logs, jobs).

    - Por padrao, nao permite excluir runs em andamento
    - Use force=true para cancelar e excluir simultaneamente

    CUIDADO: Esta acao e irreversivel!
    """
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run nao encontrado")

    # Verifica permissão (apenas admin ou dono)
    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Verifica se está em andamento
    if run.status in ["pending", "claimed", "downloading", "training", "evaluating"]:
        if not force:
            raise HTTPException(
                status_code=400,
                detail=f"Nao e possivel excluir um run em andamento (status: {run.status}). Use force=true para cancelar e excluir."
            )
        # Se force, primeiro cancela
        run.status = "cancelled"
        job = session_query(db, BertJob).filter(
            BertJob.run_id == run_id,
            BertJob.status.notin_([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED])
        ).first()
        if job:
            job.status = JobStatus.CANCELLED

    # Exclui dados associados (cascade deveria cuidar, mas vamos garantir)
    session_query(db, BertMetric).filter(BertMetric.run_id == run_id).delete()
    session_query(db, BertLog).filter(BertLog.run_id == run_id).delete()
    session_query(db, BertJob).filter(BertJob.run_id == run_id).delete()

    # Exclui o run
    run_name = run.name
    db.delete(run)
    db.commit()

    logger.info(f"Run {run_id} ({run_name}) excluido por usuario {current_user.id}")

    return {
        "success": True,
        "message": f"Run '{run_name}' excluido com sucesso",
        "run_id": run_id
    }


def _translate_status(status: str) -> str:
    """Traduz status para portugues amigavel."""
    translations = {
        "pending": "Na fila",
        "claimed": "Preparando",
        "downloading": "Baixando dados",
        "training": "Treinando",
        "evaluating": "Avaliando",
        "completed": "Concluido",
        "failed": "Falhou",
        "cancelled": "Cancelado"
    }
    return translations.get(status, status)


@router.get("/api/runs/{run_id}/metrics", response_model=List[MetricResponse])
async def get_run_metrics(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém todas as métricas de um run."""
    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run não encontrado")

    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    metrics = session_query(db, BertMetric).filter(
        BertMetric.run_id == run_id
    ).order_by(BertMetric.epoch.asc()).all()

    return [
        MetricResponse(
            id=m.id,
            run_id=m.run_id,
            epoch=m.epoch,
            train_loss=m.train_loss,
            val_loss=m.val_loss,
            val_accuracy=m.val_accuracy,
            val_macro_f1=m.val_macro_f1,
            val_weighted_f1=m.val_weighted_f1,
            recorded_at=m.recorded_at
        )
        for m in metrics
    ]


@router.get("/api/runs/{run_id}/logs")
async def get_run_logs_sse(
    run_id: int,
    last_id: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Server-Sent Events para logs em tempo real.
    """
    import asyncio

    run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run não encontrado")

    async def event_generator():
        current_last_id = last_id
        consecutive_empty = 0

        while True:
            # Busca novos logs
            logs = session_query(db, BertLog).filter(
                BertLog.run_id == run_id,
                BertLog.id > current_last_id
            ).order_by(BertLog.id.asc()).limit(50).all()

            for log in logs:
                data = {
                    "id": log.id,
                    "level": log.level,
                    "message": log.message,
                    "timestamp": log.timestamp.isoformat(),
                    "epoch": log.epoch,
                    "batch": log.batch
                }
                yield f"data: {json.dumps(data)}\n\n"
                current_last_id = log.id
                consecutive_empty = 0

            if not logs:
                consecutive_empty += 1

            # Verifica se run terminou
            db.refresh(run)
            if run.status in ["completed", "failed", "cancelled"]:
                yield f"data: {json.dumps({'status': run.status, 'done': True})}\n\n"
                break

            # Para se muito tempo sem novos logs
            if consecutive_empty > 60:  # ~2 minutos
                yield f"data: {json.dumps({'timeout': True})}\n\n"
                break

            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@router.post("/api/runs/{run_id}/reproduce", response_model=RunResponse)
async def reproduce_run(
    run_id: int,
    new_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Reproduz um run existente com a mesma configuração.
    """
    can_reproduce, message = services.validate_reproduce_run(db, run_id)
    if not can_reproduce:
        raise HTTPException(status_code=400, detail=message)

    original_run = session_query(db, BertRun).filter(BertRun.id == run_id).first()
    dataset = session_query(db, BertDataset).filter(BertDataset.id == original_run.dataset_id).first()

    from sistemas.bert_training.schemas import HyperparametersConfig
    hyperparams = HyperparametersConfig(**original_run.config_json)

    run = services.create_run(
        db=db,
        name=new_name or f"{original_run.name} (reprodução)",
        description=f"Reprodução do run #{run_id}",
        dataset=dataset,
        base_model=original_run.base_model,
        hyperparameters=hyperparams,
        user_id=current_user.id
    )

    services.create_job_for_run(db, run)

    # Auto-inicia worker se nao estiver rodando
    _auto_start_worker()

    return RunResponse(
        id=run.id,
        name=run.name,
        description=run.description,
        dataset_id=run.dataset_id,
        dataset_sha256=run.dataset_sha256,
        task_type=TaskTypeEnum(run.task_type.value),
        base_model=run.base_model,
        config_json=run.config_json,
        status=run.status,
        error_message=run.error_message,
        final_accuracy=run.final_accuracy,
        final_macro_f1=run.final_macro_f1,
        final_weighted_f1=run.final_weighted_f1,
        git_commit_hash=run.git_commit_hash,
        environment_fingerprint=run.environment_fingerprint,
        model_fingerprint=run.model_fingerprint,
        created_at=run.created_at,
        started_at=run.started_at,
        completed_at=run.completed_at
    )





