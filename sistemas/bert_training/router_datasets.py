# -*- coding: utf-8 -*-
"""
Router FastAPI para endpoints de Presets e Datasets do BERT Training.

Endpoints para:
- Listagem e detalhes de presets de treinamento
- Preview, validação, upload e gestão de datasets
- Análise de qualidade de datasets
- Download de datasets para usuários e workers
"""

import hashlib
import json
import logging
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from sqlalchemy import desc

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db

from sistemas.bert_training.models import (
    BertDataset, BertRun,
    TaskType
)
from sistemas.bert_training.schemas import (
    TaskTypeEnum,
    DatasetUploadResponse, DatasetListItem, DatasetDetail, ExcelValidationResult
)
from sistemas.bert_training import services
from sistemas.bert_training.presets import (
    get_all_presets, get_preset_by_name, get_all_presets_as_dicts, preset_to_dict
)
from utils.json_sanitizer import sanitize_dataframe_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["BERT Training"])


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
    existing = session_query(db, BertDataset).filter(
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

    query = session_query(db, BertDataset).order_by(desc(BertDataset.uploaded_at))

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
    dataset = session_query(db, BertDataset).filter(BertDataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset não encontrado")

    if current_user.role != "admin" and dataset.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    runs_count = session_query(db, BertRun).filter(BertRun.dataset_id == dataset_id).count()

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

    dataset = session_query(db, BertDataset).filter(BertDataset.id == dataset_id).first()
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
    dataset = session_query(db, BertDataset).filter(BertDataset.id == dataset_id).first()

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

    dataset = session_query(db, BertDataset).filter(BertDataset.id == dataset_id).first()

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





