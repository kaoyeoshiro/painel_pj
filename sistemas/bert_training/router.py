# -*- coding: utf-8 -*-
"""
Router FastAPI para o sistema BERT Training.

Endpoints para:
- Upload e gestão de datasets
- Criação e monitoramento de runs
- Fila de jobs e comunicação com workers
- Métricas e logs em tempo real
"""

import hashlib
import json
import logging
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db

from sistemas.bert_training.models import (
    BertDataset, BertRun, BertJob, BertMetric, BertLog, BertWorker, BertTestHistory,
    TaskType, JobStatus
)
from sistemas.bert_training.schemas import (
    TaskTypeEnum, JobStatusEnum, LogLevel,
    DatasetUploadResponse, DatasetListItem, DatasetDetail, ExcelValidationResult,
    RunCreate, RunCreateSimple, RunResponse, RunListItem, RunDetailResponse,
    JobResponse, JobListItem, JobClaimRequest, JobClaimResponse, JobProgressUpdate, JobCompleteRequest, JobStatusRequest,
    MetricCreate, MetricResponse, MetricDetailResponse,
    LogCreate, LogResponse, LogBatchCreate,
    WorkerRegister, WorkerRegisterResponse, WorkerResponse, WorkerHeartbeat,
    ReproduceRequest, HyperparametersConfig,
    CompareCNJRequest, CompareCNJResponse, DocumentComparisonItem
)
from sistemas.bert_training import services
from sistemas.bert_training.presets import (
    get_all_presets, get_preset_by_name, get_all_presets_as_dicts, preset_to_dict
)
from sistemas.bert_training.error_translator import (
    get_friendly_error_message, translate_error, get_quality_alert
)
from utils.json_sanitizer import sanitize_dataframe_dict
from sistemas.bert_training.worker.worker_manager import (
    ensure_worker_running, ensure_inference_server_running,
    get_worker_status, get_full_status, get_inference_status,
    start_training_worker, stop_training_worker,
    start_inference_server, stop_inference_server,
)
import math
import re
import asyncio
import aiohttp
import httpx

logger = logging.getLogger(__name__)


def _auto_start_worker():
    """Tenta iniciar o worker automaticamente em background thread."""
    try:
        ensure_worker_running(api_url="http://localhost:8000")
    except Exception as e:
        logger.warning(f"Falha ao auto-iniciar worker BERT: {e}")

router = APIRouter(prefix="/bert-training", tags=["BERT Training"])


# ==================== Preset Endpoints ====================

@router.get("/api/presets")
async def list_presets(
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista os presets de treinamento disponiveis.

    Presets sao configuracoes pre-definidas que simplificam a criacao de runs:
    - rapido: Teste rapido para validar dataset
    - equilibrado: Recomendado para maioria dos casos
    - preciso: Maximo de qualidade, mais demorado
    """
    presets = get_all_presets_as_dicts()
    return {"presets": presets}


@router.get("/api/presets/{preset_name}")
async def get_preset(
    preset_name: str,
    current_user: User = Depends(get_current_active_user)
):
    """Obtem detalhes de um preset especifico."""
    preset = get_preset_by_name(preset_name)
    if not preset:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_name}' nao encontrado")

    return preset_to_dict(preset)


# ==================== Dataset Endpoints ====================

@router.post("/api/datasets/preview")
async def preview_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Faz preview de um arquivo Excel e retorna as colunas disponíveis.
    Use antes do upload para selecionar as colunas corretas.
    """
    import pandas as pd

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Apenas arquivos Excel (.xlsx, .xls) são aceitos"
        )

    # Salva arquivo temporário
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        df = pd.read_excel(tmp_path)

        # Detecta colunas que parecem texto (strings longas)
        text_candidates = []
        label_candidates = []

        for col in df.columns:
            col_str = str(col)
            # Verifica se é coluna de texto (strings longas)
            sample = df[col].dropna().head(10)
            if len(sample) > 0:
                avg_len = sample.astype(str).str.len().mean()
                unique_ratio = df[col].nunique() / len(df) if len(df) > 0 else 0

                if avg_len > 50:  # Textos longos
                    text_candidates.append(col_str)
                elif unique_ratio < 0.3:  # Poucas categorias únicas = label
                    label_candidates.append(col_str)

        # Preview dos dados (primeiras 5 linhas, sanitizado para JSON)
        preview_rows = sanitize_dataframe_dict(df.head(5).to_dict(orient='records'))

        # Estatísticas por coluna
        column_stats = []
        for col in df.columns:
            col_str = str(col)
            unique_count = df[col].nunique()
            null_count = df[col].isnull().sum()
            sample_values = df[col].dropna().head(3).tolist()

            column_stats.append({
                "name": col_str,
                "unique_values": int(unique_count),
                "null_count": int(null_count),
                "sample_values": [str(v)[:100] for v in sample_values],
                "is_text_candidate": col_str in text_candidates,
                "is_label_candidate": col_str in label_candidates
            })

        return {
            "filename": file.filename,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": [str(c) for c in df.columns],
            "column_stats": column_stats,
            "text_candidates": text_candidates,
            "label_candidates": label_candidates,
            "preview_rows": preview_rows
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler Excel: {str(e)}")
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/api/datasets/validate", response_model=ExcelValidationResult)
async def validate_dataset(
    file: UploadFile = File(...),
    task_type: TaskTypeEnum = Form(...),
    text_column: str = Form(...),
    label_column: str = Form(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Valida um arquivo Excel antes do upload.
    Retorna erros de validação e preview dos dados.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Apenas arquivos Excel (.xlsx, .xls) são aceitos"
        )

    # Salva arquivo temporário para validação
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        result = services.validate_excel_file(
            tmp_path, task_type, text_column, label_column
        )
        return result
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/api/datasets/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    task_type: TaskTypeEnum = Form(...),
    text_column: str = Form(...),
    label_column: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Faz upload de um dataset Excel para treinamento.

    O arquivo é validado, salvo com hash SHA256 (idempotência),
    e os metadados são extraídos.
    """
    if not current_user.pode_acessar_sistema("bert_training"):
        raise HTTPException(status_code=403, detail="Acesso negado ao BERT Training")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Apenas arquivos Excel (.xlsx, .xls) são aceitos"
        )

    # Lê conteúdo e calcula hash
    content = await file.read()

    # SECURITY: Valida magic bytes do Excel (previne upload de arquivos falsificados)
    _XLSX_MAGIC = b"\x50\x4b\x03\x04"  # ZIP (xlsx)
    _XLS_MAGIC = b"\xd0\xcf\x11\xe0"   # OLE2 (xls)
    if len(content) < 4 or (content[:4] != _XLSX_MAGIC and content[:4] != _XLS_MAGIC):
        raise HTTPException(
            status_code=400,
            detail="Arquivo não é um Excel válido. Verifique se o arquivo não foi renomeado."
        )

    sha256_hash = hashlib.sha256(content).hexdigest()

    # Verifica se já existe
    existing = db.query(BertDataset).filter(
        BertDataset.sha256_hash == sha256_hash
    ).first()

    if existing:
        # Retorna o existente
        return DatasetUploadResponse(
            id=existing.id,
            filename=existing.filename,
            sha256_hash=existing.sha256_hash,
            file_size_bytes=existing.file_size_bytes,
            task_type=TaskTypeEnum(existing.task_type.value),
            text_column=existing.text_column,
            label_column=existing.label_column,
            total_rows=existing.total_rows,
            total_labels=existing.total_labels,
            label_distribution=existing.label_distribution,
            sample_preview=existing.sample_preview,
            uploaded_at=existing.uploaded_at,
            is_duplicate=True
        )

    # Salva arquivo temporário para validação
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        # Valida
        validation = services.validate_excel_file(
            tmp_path, task_type, text_column, label_column
        )

        if not validation.is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Validação falhou: {'; '.join(validation.errors)}"
            )

        # Extrai metadados
        metadata = services.extract_dataset_metadata(
            tmp_path, task_type, text_column, label_column
        )

        # Salva arquivo no storage
        file_path = services.save_dataset_file(content, file.filename, sha256_hash)

        # Cria registro no banco
        dataset = BertDataset(
            filename=file.filename,
            file_path=str(file_path),
            sha256_hash=sha256_hash,
            file_size_bytes=len(content),
            task_type=TaskType(task_type.value),
            text_column=text_column,
            label_column=label_column,
            total_rows=metadata["total_rows"],
            total_labels=metadata["total_labels"],
            label_distribution=metadata["label_distribution"],
            sample_preview=metadata["sample_preview"],
            uploaded_by=current_user.id
        )

        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        logger.info(f"Dataset uploaded: id={dataset.id}, hash={sha256_hash[:8]}")

        return DatasetUploadResponse(
            id=dataset.id,
            filename=dataset.filename,
            sha256_hash=dataset.sha256_hash,
            file_size_bytes=dataset.file_size_bytes,
            task_type=TaskTypeEnum(dataset.task_type.value),
            text_column=dataset.text_column,
            label_column=dataset.label_column,
            total_rows=dataset.total_rows,
            total_labels=dataset.total_labels,
            label_distribution=dataset.label_distribution,
            sample_preview=dataset.sample_preview,
            uploaded_at=dataset.uploaded_at,
            is_duplicate=False
        )

    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/api/datasets", response_model=List[DatasetListItem])
async def list_datasets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista datasets do usuário."""
    if not current_user.pode_acessar_sistema("bert_training"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    query = db.query(BertDataset).order_by(desc(BertDataset.uploaded_at))

    # Se não for admin, filtra por usuário
    if current_user.role != "admin":
        query = query.filter(BertDataset.uploaded_by == current_user.id)

    datasets = query.offset(skip).limit(limit).all()

    return [
        DatasetListItem(
            id=d.id,
            filename=d.filename,
            sha256_hash=d.sha256_hash,
            task_type=TaskTypeEnum(d.task_type.value),
            total_rows=d.total_rows,
            total_labels=d.total_labels,
            uploaded_at=d.uploaded_at
        )
        for d in datasets
    ]


@router.get("/api/datasets/{dataset_id}", response_model=DatasetDetail)
async def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém detalhes de um dataset."""
    dataset = db.query(BertDataset).filter(BertDataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    if current_user.role != "admin" and dataset.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    runs_count = db.query(BertRun).filter(BertRun.dataset_id == dataset_id).count()

    return DatasetDetail(
        id=dataset.id,
        filename=dataset.filename,
        sha256_hash=dataset.sha256_hash,
        file_size_bytes=dataset.file_size_bytes,
        task_type=TaskTypeEnum(dataset.task_type.value),
        text_column=dataset.text_column,
        label_column=dataset.label_column,
        total_rows=dataset.total_rows,
        total_labels=dataset.total_labels,
        label_distribution=dataset.label_distribution,
        sample_preview=dataset.sample_preview,
        uploaded_at=dataset.uploaded_at,
        runs_count=runs_count
    )


@router.post("/api/datasets/analyze-quality")
async def analyze_dataset_quality(
    file: UploadFile = File(...),
    text_column: str = Form(...),
    label_column: str = Form(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Analisa a qualidade de um dataset antes do upload.

    Retorna:
    - quality_score: Pontuacao de qualidade (0-100)
    - warnings: Alertas sobre problemas encontrados
    - errors: Erros que impedem o treinamento
    - suggestions: Sugestoes de melhoria
    - label_distribution: Distribuicao das classes

    Use este endpoint para validar seu dataset ANTES de fazer upload.
    """
    import pandas as pd

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Apenas arquivos Excel (.xlsx, .xls) sao aceitos"
        )

    # Salva arquivo temporario
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        df = pd.read_excel(tmp_path)

        # Verifica colunas
        if text_column not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Coluna de texto '{text_column}' nao encontrada"
            )
        if label_column not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Coluna de labels '{label_column}' nao encontrada"
            )

        # Analisa qualidade
        analysis = services.analyze_dataset_quality(df, text_column, label_column)

        return analysis

    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/api/datasets/{dataset_id}/quality")
async def get_dataset_quality(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Analisa a qualidade de um dataset ja salvo.
    """
    import pandas as pd

    dataset = db.query(BertDataset).filter(BertDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset nao encontrado")

    if current_user.role != "admin" and dataset.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    file_path = Path(dataset.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado")

    df = pd.read_excel(file_path)
    analysis = services.analyze_dataset_quality(df, dataset.text_column, dataset.label_column)

    return analysis


@router.get("/api/datasets/{dataset_id}/download")
async def download_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Download do arquivo Excel do dataset."""
    dataset = db.query(BertDataset).filter(BertDataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    file_path = Path(dataset.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    return FileResponse(
        path=file_path,
        filename=dataset.filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.get("/api/datasets/{dataset_id}/download-worker")
async def download_dataset_for_worker(
    dataset_id: int,
    worker_token: str,
    db: Session = Depends(get_db)
):
    """
    Download do dataset para workers.

    Autenticação via token de worker (query param).
    """
    # Valida token do worker
    worker = services.get_worker_by_token(db, worker_token)
    if not worker:
        raise HTTPException(status_code=401, detail="Token de worker inválido")

    dataset = db.query(BertDataset).filter(BertDataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    file_path = Path(dataset.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    return FileResponse(
        path=file_path,
        filename=dataset.filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# ==================== Run Endpoints ====================

@router.post("/api/runs", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    run_data: RunCreate,
    request: "Request" = None,
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
    from fastapi import Request

    if not current_user.pode_acessar_sistema("bert_training"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca dataset
    dataset = db.query(BertDataset).filter(BertDataset.id == run_data.dataset_id).first()
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
    request: "Request" = None,
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
    from fastapi import Request

    if not current_user.pode_acessar_sistema("bert_training"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca dataset
    dataset = db.query(BertDataset).filter(BertDataset.id == run_data.dataset_id).first()
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

    query = db.query(BertRun).order_by(desc(BertRun.created_at))

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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()

    if not run:
        raise HTTPException(status_code=404, detail="Run não encontrado")

    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca dataset filename
    dataset = db.query(BertDataset).filter(BertDataset.id == run.dataset_id).first()

    # Busca jobs
    jobs = db.query(BertJob).filter(BertJob.run_id == run_id).order_by(desc(BertJob.created_at)).all()

    # Busca últimas métricas
    metrics = db.query(BertMetric).filter(
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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run nao encontrado")

    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Busca job ativo
    job = db.query(BertJob).filter(
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
            worker = db.query(BertWorker).filter(BertWorker.id == job.worker_id).first()
            if worker:
                result["worker_info"] = {
                    "name": worker.name,
                    "gpu_name": worker.gpu_name,
                    "gpu_vram_gb": worker.gpu_vram_gb,
                    "cuda_version": worker.cuda_version,
                    "is_active": worker.is_active
                }

        # Últimas métricas (mais recente)
        latest_metric = db.query(BertMetric).filter(
            BertMetric.run_id == run_id
        ).order_by(desc(BertMetric.epoch)).first()

        # Melhor métrica (maior val_accuracy)
        best_metric = db.query(BertMetric).filter(
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
        all_metrics = db.query(BertMetric).filter(
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
        batch_log = db.query(BertLog).filter(
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
                        prev_batch_log = db.query(BertLog).filter(
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
        recent_logs = db.query(BertLog).filter(
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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()
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
    final_metric = db.query(BertMetric).filter(
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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()
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
    job = db.query(BertJob).filter(
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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()
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
    job = db.query(BertJob).filter(
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
    best_metric = db.query(BertMetric).filter(
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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()
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
        job = db.query(BertJob).filter(
            BertJob.run_id == run_id,
            BertJob.status.notin_([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED])
        ).first()
        if job:
            job.status = JobStatus.CANCELLED

    # Exclui dados associados (cascade deveria cuidar, mas vamos garantir)
    db.query(BertMetric).filter(BertMetric.run_id == run_id).delete()
    db.query(BertLog).filter(BertLog.run_id == run_id).delete()
    db.query(BertJob).filter(BertJob.run_id == run_id).delete()

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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run não encontrado")

    if current_user.role != "admin" and run.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    metrics = db.query(BertMetric).filter(
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

    run = db.query(BertRun).filter(BertRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run não encontrado")

    async def event_generator():
        current_last_id = last_id
        consecutive_empty = 0

        while True:
            # Busca novos logs
            logs = db.query(BertLog).filter(
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

    original_run = db.query(BertRun).filter(BertRun.id == run_id).first()
    dataset = db.query(BertDataset).filter(BertDataset.id == original_run.dataset_id).first()

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
    run = db.query(BertRun).filter(BertRun.id == job.run_id).first()
    dataset = db.query(BertDataset).filter(BertDataset.id == run.dataset_id).first()

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

    job = db.query(BertJob).filter(BertJob.id == job_id).first()
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

    job = db.query(BertJob).filter(BertJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    if job.worker_id != worker.id:
        raise HTTPException(status_code=403, detail="Job pertence a outro worker")

    # Atualiza job
    services.update_job_progress(db, job, status=JobStatus.COMPLETED, progress_percent=100.0)

    # Finaliza run
    run = db.query(BertRun).filter(BertRun.id == job.run_id).first()
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

    job = db.query(BertJob).filter(BertJob.id == job_id).first()
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
    existing = db.query(BertWorker).filter(BertWorker.name == worker.name).first()
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

    workers = db.query(BertWorker).order_by(desc(BertWorker.created_at)).all()

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
    pending = db.query(BertJob).filter(BertJob.status == JobStatus.PENDING).count()
    training = db.query(BertJob).filter(BertJob.status == JobStatus.TRAINING).count()
    completed = db.query(BertJob).filter(BertJob.status == JobStatus.COMPLETED).count()
    failed = db.query(BertJob).filter(BertJob.status == JobStatus.FAILED).count()

    active_workers = db.query(BertWorker).filter(
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
    runs = db.query(BertRun).filter(
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
    tests = db.query(BertTestHistory).filter(
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
    run = db.query(BertRun).filter(BertRun.id == run_id).first()
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
    test = db.query(BertTestHistory).filter(
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
    deleted = db.query(BertTestHistory).filter(
        BertTestHistory.user_id == current_user.id
    ).delete()

    db.commit()

    return {"message": f"{deleted} teste(s) deletado(s)"}


# ==================== Compare CNJ Endpoints ====================

def _limpar_cnj(numero_cnj: str) -> str:
    """
    Limpa numero CNJ removendo formatacao e sufixos.

    Exemplos:
        - 0804330-09.2024.8.12.0017 -> 08043300920248120017
        - 0804330-09.2024.8.12.0017/50003 -> 08043300920248120017
    """
    if '/' in numero_cnj:
        numero_cnj = numero_cnj.split('/')[0]
    return re.sub(r'\D', '', numero_cnj)


def _sanitize_float(value: float) -> Optional[float]:
    """Sanitiza float para evitar NaN/Infinity em JSON."""
    if value is None:
        return None
    if math.isnan(value) or math.isinf(value):
        return None
    return value


PROMPT_CLASSIFICACAO_LLM = """Classifique o documento juridico abaixo em UMA das categorias listadas.

CATEGORIAS VALIDAS:
{labels}

DOCUMENTO:
{texto}

Responda APENAS com o nome exato da categoria, sem explicacoes ou texto adicional."""


async def _classificar_bert(
    texto: str,
    model_path: str,
    client: httpx.AsyncClient
) -> tuple:
    """Classifica texto via BERT worker local."""
    try:
        response = await client.post(
            "http://127.0.0.1:8765/predict",
            json={"model": model_path, "text": texto},
            timeout=60.0
        )
        if response.status_code == 200:
            data = response.json()
            label = data.get("predicted_label", "ERRO")
            conf = _sanitize_float(data.get("confidence", 0.0)) or 0.0
            return label, conf, None
        else:
            return "ERRO", 0.0, f"HTTP {response.status_code}"
    except Exception as e:
        return "ERRO", 0.0, str(e)


async def _classificar_llm(
    texto: str,
    labels: List[str],
    temperature: float
) -> tuple:
    """Classifica texto via Gemini LLM."""
    try:
        from services.gemini_service import gemini_service

        prompt = PROMPT_CLASSIFICACAO_LLM.format(
            labels="\n".join(f"- {l}" for l in labels),
            texto=texto
        )

        response = await gemini_service.generate(
            prompt=prompt,
            model="gemini-3-flash-preview",
            temperature=temperature,
            thinking_level="minimal",
            max_tokens=100,
            use_cache=False,
            context={"sistema": "bert_training", "modulo": "compare_cnj"}
        )

        if not response.success:
            return None, True, response.error

        # Normaliza resposta
        label = response.content.strip()
        # Remove possivel pontuacao no final
        label = label.rstrip('.,;:')

        # Valida se esta na lista de labels (case-insensitive)
        label_lower = label.lower()
        for valid_label in labels:
            if valid_label.lower() == label_lower:
                return valid_label, False, None

        # Aceita mesmo se nao exato (para analise)
        return label, False, None

    except Exception as e:
        return None, True, str(e)


async def _baixar_documentos_tjms(
    session: aiohttp.ClientSession,
    cnj_limpo: str,
    codigos_permitidos: set
) -> List[dict]:
    """Consulta processo e baixa documentos filtrados por categoria."""
    from sistemas.gerador_pecas.agente_tjms import (
        consultar_processo_async,
        extrair_documentos_xml,
        baixar_documentos_paralelo,
        documento_permitido
    )

    # 1. Consulta processo para obter lista de documentos
    xml_consulta = await consultar_processo_async(session, cnj_limpo, timeout=60)
    documentos_meta = extrair_documentos_xml(xml_consulta)

    # 2. Filtra por categoria
    docs_filtrados = []
    for doc in documentos_meta:
        tipo = int(doc.tipo_documento) if doc.tipo_documento else 0
        if documento_permitido(tipo, codigos_permitidos):
            docs_filtrados.append(doc)

    if not docs_filtrados:
        return []

    # 3. Baixa conteudo dos documentos
    ids_para_baixar = [doc.id for doc in docs_filtrados]
    conteudo_map = await baixar_documentos_paralelo(
        session, cnj_limpo, ids_para_baixar, batch_size=5, max_paralelo=4, timeout=180
    )

    # 4. Monta lista final com conteudo
    resultado = []
    for doc in docs_filtrados:
        conteudo_b64 = conteudo_map.get(doc.id)
        if conteudo_b64:
            resultado.append({
                "id": doc.id,
                "tipo_codigo": int(doc.tipo_documento) if doc.tipo_documento else 0,
                "descricao": doc.descricao,
                "data_juntada": doc.data_juntada,
                "conteudo_base64": conteudo_b64
            })

    return resultado


def _extrair_texto_documento(conteudo_base64: str) -> str:
    """Extrai texto de documento PDF em base64."""
    import base64
    from sistemas.classificador_documentos.services_extraction import get_text_extractor

    try:
        pdf_bytes = base64.b64decode(conteudo_base64)
        extractor = get_text_extractor()
        result = extractor.extrair_texto(pdf_bytes)
        return result.texto
    except Exception as e:
        logger.warning(f"Erro ao extrair texto: {e}")
        return ""


@router.post("/api/comparar-cnj", response_model=CompareCNJResponse)
async def comparar_cnj(
    request: CompareCNJRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Compara classificacoes BERT vs LLM (Gemini) para documentos de um CNJ.

    O LLM atua como "ground truth" para calcular accuracy do modelo BERT.

    Fluxo:
    1. Busca documentos do processo no TJ-MS
    2. Filtra pela categoria selecionada
    3. Para cada documento: executa BERT e LLM em paralelo
    4. Calcula accuracy (LLM como ground truth)
    """
    from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento
    from sistemas.classificador_documentos.services_extraction import get_text_extractor

    # 0. Verificar inference server - auto-start se necessario
    if not ensure_inference_server_running():
        raise HTTPException(
            status_code=503,
            detail="Servidor de inferencia BERT nao esta ativo e nao foi possivel inicia-lo automaticamente. "
                   "Inicie o servidor manualmente pelo botao 'Iniciar Servidor'."
        )

    # 1. Validar e buscar categoria
    categoria = db.query(CategoriaDocumento).filter(
        CategoriaDocumento.id == request.categoria_id,
        CategoriaDocumento.ativo == True
    ).first()

    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")

    codigos_permitidos = set(categoria.codigos_documento or [])
    if not codigos_permitidos:
        raise HTTPException(status_code=400, detail="Categoria sem codigos de documento configurados")

    # 2. Validar e buscar modelo BERT
    bert_run = db.query(BertRun).filter(
        BertRun.id == request.bert_model_id,
        BertRun.status == "completed"
    ).first()

    if not bert_run:
        raise HTTPException(status_code=404, detail="Modelo BERT nao encontrado ou nao esta completado")

    # 3. Obter labels do modelo BERT (do ultimo metric com classification_report)
    # Ordena por epoch desc E id desc para pegar o registro mais recente em caso de empate
    last_metric = db.query(BertMetric).filter(
        BertMetric.run_id == bert_run.id,
        BertMetric.classification_report.isnot(None)
    ).order_by(desc(BertMetric.epoch), desc(BertMetric.id)).first()

    labels = []
    if last_metric and last_metric.classification_report:
        # Labels estao nas chaves do classification_report (exceto accuracy, macro avg, weighted avg)
        excluded_keys = {"accuracy", "macro avg", "weighted avg"}
        labels = [k for k in last_metric.classification_report.keys() if k not in excluded_keys]

    if not labels:
        raise HTTPException(status_code=400, detail="Nao foi possivel obter labels do modelo BERT")

    # 4. Obter caminho local do modelo BERT
    # O servidor de inferencia espera o nome do diretorio do modelo (ex: "model_run_4")
    model_path = bert_run.config_json.get("local_path") if bert_run.config_json else None
    if not model_path:
        # Usa padrao do servidor de inferencia: bert_models/model_run_{id}
        model_path = f"model_run_{bert_run.id}"

    # 5. Limpar CNJ
    cnj_limpo = _limpar_cnj(request.cnj)
    if len(cnj_limpo) != 20:
        raise HTTPException(status_code=400, detail="CNJ invalido - deve ter 20 digitos apos limpeza")

    # 6. Buscar documentos do TJ-MS
    connector = aiohttp.TCPConnector(limit=10, force_close=True)
    async with aiohttp.ClientSession(connector=connector) as session:
        try:
            documentos = await _baixar_documentos_tjms(session, cnj_limpo, codigos_permitidos)
        except Exception as e:
            logger.error(f"Erro ao buscar documentos TJ-MS: {e}")
            raise HTTPException(status_code=502, detail=f"Erro ao consultar TJ-MS: {str(e)}")

    if not documentos:
        raise HTTPException(
            status_code=404,
            detail=f"Nenhum documento encontrado para a categoria '{categoria.titulo}'"
        )

    # 7. Processar documentos em paralelo
    extractor = get_text_extractor()
    semaphore = asyncio.Semaphore(3)  # Limite de concorrencia
    comparisons = []

    # Criar diretorio temporario para PDFs
    import tempfile
    import uuid
    import base64
    temp_dir = Path(tempfile.gettempdir()) / "bert_compare_pdfs"
    temp_dir.mkdir(exist_ok=True)
    session_id = str(uuid.uuid4())[:8]

    async def processar_documento(doc: dict, idx: int) -> DocumentComparisonItem:
        async with semaphore:
            # Salvar PDF temporariamente
            pdf_filename = f"{session_id}_{idx}_{doc['id']}.pdf"
            pdf_path = temp_dir / pdf_filename
            try:
                pdf_bytes = base64.b64decode(doc["conteudo_base64"])
                pdf_path.write_bytes(pdf_bytes)
                pdf_url = f"/bert-training/api/compare-pdf/{pdf_filename}"
            except Exception as e:
                logger.warning(f"Erro ao salvar PDF temporario: {e}")
                pdf_url = None

            # Extrair texto
            texto = _extrair_texto_documento(doc["conteudo_base64"])

            if not texto or len(texto.strip()) < 50:
                return DocumentComparisonItem(
                    doc_id=str(doc["id"]),
                    doc_title=doc["descricao"] or f"Documento {doc['tipo_codigo']}",
                    doc_tipo_codigo=doc["tipo_codigo"],
                    texto_preview="[Documento sem texto extraivel]",
                    bert_label="N/A",
                    bert_confidence=0.0,
                    llm_label=None,
                    llm_failed=True,
                    llm_error="Documento sem texto extraivel",
                    match=False,
                    pdf_url=pdf_url
                )

            # Calcular tokens do texto original
            texto_tokens = int(extractor.contar_tokens(texto))

            # Recortar texto para LLM
            texto_chunk = extractor.extrair_chunk(
                texto,
                request.llm_token_limit,
                request.llm_token_window
            )

            # Calcular tokens do chunk
            chunk_tokens = int(extractor.contar_tokens(texto_chunk))

            # Executar BERT e LLM em paralelo
            async with httpx.AsyncClient() as http_client:
                bert_task = asyncio.create_task(
                    _classificar_bert(texto_chunk, model_path, http_client)
                )
                llm_task = asyncio.create_task(
                    _classificar_llm(texto_chunk, labels, request.llm_temperature)
                )

                bert_result, llm_result = await asyncio.gather(bert_task, llm_task)

            bert_label, bert_conf, bert_error = bert_result
            llm_label, llm_failed, llm_error = llm_result

            # Comparar (case-insensitive)
            match = False
            if not llm_failed and llm_label and bert_label != "ERRO":
                match = bert_label.lower() == llm_label.lower()

            texto_preview = texto[:200] + "..." if len(texto) > 200 else texto
            chunk_preview = texto_chunk[:500] + "..." if len(texto_chunk) > 500 else texto_chunk

            return DocumentComparisonItem(
                doc_id=str(doc["id"]),
                doc_title=doc["descricao"] or f"Documento {doc['tipo_codigo']}",
                doc_tipo_codigo=doc["tipo_codigo"],
                texto_preview=texto_preview,
                bert_label=bert_label,
                bert_confidence=_sanitize_float(bert_conf) or 0.0,
                llm_label=llm_label,
                llm_failed=llm_failed,
                llm_error=llm_error if llm_failed else (bert_error if bert_label == "ERRO" else None),
                match=match,
                pdf_url=pdf_url,
                texto_tokens=texto_tokens,
                chunk_tokens=chunk_tokens,
                chunk_preview=chunk_preview
            )

    # Processar todos os documentos
    tasks = [processar_documento(doc, idx) for idx, doc in enumerate(documentos)]
    comparisons = await asyncio.gather(*tasks)

    # 8. Calcular metricas
    total = len(comparisons)
    llm_failed_count = sum(1 for c in comparisons if c.llm_failed)
    valid_comparisons = [c for c in comparisons if not c.llm_failed and c.bert_label != "ERRO"]
    matches = sum(1 for c in valid_comparisons if c.match)
    accuracy = matches / len(valid_comparisons) if valid_comparisons else 0.0

    # 9. Montar resposta
    return CompareCNJResponse(
        cnj=request.cnj,
        categoria={
            "id": categoria.id,
            "nome": categoria.nome,
            "titulo": categoria.titulo
        },
        bert_model={
            "id": bert_run.id,
            "name": bert_run.name
        },
        llm={
            "model": "gemini-3-flash-preview",
            "thinking": "minimal",
            "temperature": request.llm_temperature,
            "token_limit": request.llm_token_limit,
            "token_window": request.llm_token_window
        },
        summary={
            "total": total,
            "matches": matches,
            "accuracy": _sanitize_float(accuracy) or 0.0,
            "llm_failed": llm_failed_count
        },
        items=comparisons
    )


# ==================== Endpoint para servir PDFs temporarios ====================

@router.get("/api/compare-pdf/{filename}")
async def get_compare_pdf(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Serve um PDF temporario salvo durante a comparacao BERT vs LLM.
    Os PDFs sao salvos no diretorio temporario do sistema.
    """
    import tempfile
    from fastapi.responses import FileResponse

    # Validar nome do arquivo (previne path traversal)
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo invalido")

    temp_dir = Path(tempfile.gettempdir()) / "bert_compare_pdfs"
    pdf_path = temp_dir / filename

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF nao encontrado ou expirado")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )
