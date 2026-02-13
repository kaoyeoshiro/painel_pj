# sistemas/extrator_autos/router.py
"""
Router do Extrator de Autos - Download de documentos processuais do TJ-MS.

Endpoints:
- Consulta: consultar processo(s) no TJ-MS
- Categorias: listar e resolver categorias de documentos
- Preview: pre-visualizar documentos antes do download
- Download: baixar documentos (direto ou via SSE com progresso)
- Lote: download em lote de multiplos processos
- BERT: health check e teste de classificacao
- Historico: consultar downloads anteriores

Autor: LAB/PGE-MS
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db
from utils.timezone import get_utc_now, to_iso_utc

from .models import ExtracaoAutos
from .schemas import (
    BaixarDocumentosRequest,
    BaixarLoteRequest,
    ClassificarBertRequest,
    ClassificarBertResponse,
    ConsultarLoteRequest,
    ConsultarProcessoRequest,
    PreviewDocumentosRequest,
    ResolverCategoriasRequest,
    ResumoLoteRequest,
)
from .services_bert_client import BertClassifierClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/extrator-autos/api", tags=["extrator-autos"])


# ============================================
# Armazenamento temporario de jobs de download
# ============================================

JOB_EXPIRATION_MINUTES = 120  # 2 horas — lotes grandes podem demorar

_download_jobs: Dict[str, Dict] = {}


def _limpar_jobs_expirados() -> None:
    """Remove jobs com mais de JOB_EXPIRATION_MINUTES minutos."""
    agora = get_utc_now()
    expirados = [
        job_id
        for job_id, job in _download_jobs.items()
        if agora - job["created_at"] > timedelta(minutes=JOB_EXPIRATION_MINUTES)
    ]
    for job_id in expirados:
        del _download_jobs[job_id]
        logger.debug("Job expirado removido: %s", job_id)


# ============================================
# Consultar processo(s)
# ============================================


@router.post("/consultar")
async def consultar_processo(
    req: ConsultarProcessoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Consulta um processo no TJ-MS e retorna metadados + lista de documentos."""
    from .services import ExtratorAutosService

    logger.info(
        "Consulta processo %s por usuario %s",
        req.numero_cnj,
        current_user.id,
    )

    service = ExtratorAutosService(db)
    resultado = await service.consultar_processo(
        numero_cnj=req.numero_cnj,
        buscar_instancias=req.buscar_todas_instancias,
    )

    return resultado


@router.post("/consultar-lote")
async def consultar_lote(
    req: ConsultarLoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Consulta multiplos processos no TJ-MS com paralelismo controlado."""
    from .services import ExtratorAutosService

    logger.info(
        "Consulta lote de %d processo(s) por usuario %s",
        len(req.numeros_cnj),
        current_user.id,
    )

    service = ExtratorAutosService(db)
    resultados: list = []
    erros: list = []
    lock = asyncio.Lock()

    # Limita consultas simultaneas para nao sobrecarregar o TJ-MS
    semaphore = asyncio.Semaphore(5)

    async def _consultar_um(numero_cnj: str) -> None:
        async with semaphore:
            try:
                resultado = await service.consultar_processo(
                    numero_cnj=numero_cnj,
                    buscar_instancias=req.buscar_todas_instancias,
                )
                resultado["numero_cnj"] = numero_cnj
                async with lock:
                    resultados.append(resultado)
            except Exception as e:
                logger.warning("Erro ao consultar %s: %s", numero_cnj, e)
                async with lock:
                    erros.append({"numero_cnj": numero_cnj, "erro": str(e)})

    await asyncio.gather(*[_consultar_um(cnj) for cnj in req.numeros_cnj])

    return {
        "total_consultados": len(req.numeros_cnj),
        "total_sucesso": len(resultados),
        "total_erros": len(erros),
        "resultados": resultados,
        "erros": erros,
    }


# ============================================
# Categorias de documentos
# ============================================


@router.get("/categorias")
async def listar_categorias(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista categorias de documentos disponiveis com informacoes de resolver."""
    from .services import ExtratorAutosService

    service = ExtratorAutosService(db)
    categorias = await service.obter_categorias_disponiveis()

    return {"categorias": categorias}


@router.post("/resolver-categorias")
async def resolver_categorias(
    req: ResolverCategoriasRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Resolve categorias em lista de codigos + regras especiais."""
    from .services import ExtratorAutosService

    service = ExtratorAutosService(db)
    resultado = await service.resolver_categorias(
        categorias_ids=req.categorias_ids,
        codigos_add=req.codigos_manuais_add,
        codigos_remove=req.codigos_manuais_remove,
    )

    return resultado


# ============================================
# Preview de documentos
# ============================================


@router.post("/preview")
async def preview_documentos(
    req: PreviewDocumentosRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Pre-visualiza documentos que serao baixados, sem efetuar o download."""
    from .services import ExtratorAutosService

    service = ExtratorAutosService(db)
    resultado = await service.preview_documentos(
        numero_cnj=req.numero_cnj,
        codigos=req.codigos_resolvidos if req.modo_selecao == "manual" else None,
        doc_ids=req.documento_ids,
        categorias_ids=req.categorias_ids if req.categorias_ids else None,
        filtro_anos=req.filtro_anos if req.filtro_anos else None,
        filtro_mes=req.filtro_mes,
    )

    return resultado


# ============================================
# Download direto (ZIP)
# ============================================


@router.post("/baixar")
async def baixar_documentos(
    req: BaixarDocumentosRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Baixa documentos selecionados e retorna ZIP diretamente.

    Indicado para poucos documentos. Para downloads maiores,
    use /baixar-stream que fornece progresso via SSE.
    """
    from .services import ExtratorAutosService

    logger.info(
        "Download direto de %d doc(s) do processo %s por usuario %s",
        len(req.documento_ids),
        req.numero_cnj,
        current_user.id,
    )

    service = ExtratorAutosService(db)
    zip_bytes = await service.baixar_documentos(
        numero_cnj=req.numero_cnj,
        documento_ids=req.documento_ids,
        modo_saida=req.modo_saida,
        mesclar=req.mesclar_pdfs,
        salvar_xml=req.salvar_xml_completo,
        resolucoes_especiais=req.resolucoes_especiais if req.resolucoes_especiais else None,
    )

    if not zip_bytes:
        raise HTTPException(status_code=404, detail="Nenhum documento foi baixado")

    # Registra no historico
    _registrar_extracao(
        db=db,
        usuario_id=current_user.id,
        numero_cnj=req.numero_cnj,
        modo_selecao=req.modo_selecao,
        modo_saida=req.modo_saida,
        mesclar_pdfs=req.mesclar_pdfs,
        total_docs=len(req.documento_ids),
        status="concluido",
    )

    nome_arquivo = f"extrator_{req.numero_cnj}.zip"

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
        },
    )


# ============================================
# Download com SSE (progresso)
# ============================================


@router.post("/baixar-stream")
async def baixar_stream(
    req: BaixarDocumentosRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Baixa documentos com progresso via SSE (Server-Sent Events).

    Retorna stream de eventos de progresso. Ao concluir, armazena
    o ZIP em memoria e envia evento com job_id para download posterior
    via GET /download/{job_id}.
    """
    from .services import ExtratorAutosService

    job_id = str(uuid.uuid4())
    logger.info(
        "[SSE] Download stream job=%s, %d doc(s) do processo %s por usuario %s",
        job_id,
        len(req.documento_ids),
        req.numero_cnj,
        current_user.id,
    )

    service = ExtratorAutosService(db)

    async def gerar_eventos():
        try:
            yield _sse_event("progresso", percentual=0, mensagem="Iniciando download...")

            total = len(req.documento_ids)
            ultimo_percentual = 0

            async def callback_progresso(percentual: int, mensagem: str):
                nonlocal ultimo_percentual
                ultimo_percentual = percentual

            zip_bytes = await service.baixar_documentos(
                numero_cnj=req.numero_cnj,
                documento_ids=req.documento_ids,
                modo_saida=req.modo_saida,
                mesclar=req.mesclar_pdfs,
                salvar_xml=req.salvar_xml_completo,
                callback=callback_progresso,
                resolucoes_especiais=req.resolucoes_especiais if req.resolucoes_especiais else None,
            )

            if not zip_bytes:
                yield _sse_event("erro", mensagem="Nenhum documento foi baixado")
                return

            # Armazena ZIP para download posterior
            _limpar_jobs_expirados()
            _download_jobs[job_id] = {
                "zip_bytes": zip_bytes,
                "created_at": get_utc_now(),
                "nome": f"extrator_{req.numero_cnj}.zip",
            }

            # Registra no historico
            _registrar_extracao(
                db=db,
                usuario_id=current_user.id,
                numero_cnj=req.numero_cnj,
                modo_selecao=req.modo_selecao,
                modo_saida=req.modo_saida,
                mesclar_pdfs=req.mesclar_pdfs,
                total_docs=total,
                status="concluido",
            )

            yield _sse_event(
                "concluido",
                job_id=job_id,
                mensagem=f"Download concluido: {total} documento(s)",
                total_baixados=total,
            )

        except Exception as e:
            logger.exception("[SSE] Erro no download stream job=%s: %s", job_id, e)
            yield _sse_event("erro", mensagem=f"Erro no download: {str(e)}")

    return StreamingResponse(
        gerar_eventos(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================
# Resumo do lote (sem consultar TJ-MS)
# ============================================


@router.post("/resumo-lote")
async def resumo_lote(
    req: ResumoLoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Retorna resumo leve do lote (categorias, codigos, metodo) sem consultar TJ-MS.

    Usado no modo lote para mostrar ao usuario o que sera baixado antes de iniciar.
    """
    from .services import ExtratorAutosService

    service = ExtratorAutosService(db)
    resumo = await service.resumo_lote(
        categorias_ids=req.categorias_ids,
        codigos_add=req.codigos_manuais_add,
        codigos_remove=req.codigos_manuais_remove,
    )

    return {
        "total_processos": len(req.numeros_cnj),
        **resumo,
    }


# ============================================
# Download em lote (SSE com progresso real-time)
# ============================================


@router.post("/baixar-lote")
async def baixar_lote(
    req: BaixarLoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Download em lote com pipeline completo de CategoryResolver e SSE real-time.

    Usa asyncio.Queue para emitir eventos de progresso enquanto processar_lote_v2 roda.
    """
    from .services import ExtratorAutosService

    job_id = str(uuid.uuid4())
    logger.info(
        "[SSE] Download lote v2 job=%s, %d processo(s) por usuario %s",
        job_id,
        len(req.numeros_cnj),
        current_user.id,
    )

    service = ExtratorAutosService(db)

    async def gerar_eventos():
        queue: asyncio.Queue = asyncio.Queue()
        heartbeat_interval = 15  # segundos entre keepalives

        async def callback_sse(percentual: int, mensagem: str):
            await queue.put(_sse_event("progresso", percentual=percentual, mensagem=mensagem))

        yield _sse_event(
            "progresso",
            percentual=0,
            mensagem=f"Iniciando lote com {len(req.numeros_cnj)} processo(s)...",
        )

        # Determina codigos fallback (backward compat com codigos_resolvidos)
        codigos_fallback = req.codigos_resolvidos if req.codigos_resolvidos else None

        task = asyncio.create_task(service.processar_lote_v2(
            numeros_cnj=req.numeros_cnj,
            categorias_ids=req.categorias_ids,
            codigos_fallback=codigos_fallback,
            modo_saida=req.modo_saida,
            mesclar=req.mesclar_pdfs,
            salvar_xml=req.salvar_xml_completo,
            agrupar_subpastas=req.agrupar_subpastas,
            pausa=req.pausa_entre_processos,
            filtro_anos=req.filtro_anos if req.filtro_anos else None,
            filtro_mes=req.filtro_mes,
            max_processos_paralelos=req.max_processos_paralelos,
            callback=callback_sse,
        ))

        # Drena fila enquanto task roda, com heartbeat periodico
        import time as _time
        ultimo_evento = _time.monotonic()

        while not task.done():
            try:
                event = await asyncio.wait_for(queue.get(), timeout=0.5)
                yield event
                ultimo_evento = _time.monotonic()
            except asyncio.TimeoutError:
                # Emite heartbeat se nenhum evento real foi enviado recentemente
                if _time.monotonic() - ultimo_evento >= heartbeat_interval:
                    yield ": keepalive\n\n"
                    ultimo_evento = _time.monotonic()
                continue

        # Drena eventos remanescentes
        while not queue.empty():
            yield queue.get_nowait()

        if task.exception():
            logger.exception(
                "[SSE] Erro no download lote job=%s", job_id,
                exc_info=task.exception(),
            )
            yield _sse_event("erro", mensagem=f"Erro no lote: {str(task.exception())}")
            return

        resultado = task.result()

        if not resultado.zip_bytes:
            yield _sse_event("erro", mensagem="Nenhum documento foi baixado no lote")
            return

        # Armazena ZIP para download posterior
        _limpar_jobs_expirados()
        _download_jobs[job_id] = {
            "zip_bytes": resultado.zip_bytes,
            "created_at": get_utc_now(),
            "nome": f"extrator_lote_{resultado.total_processos}processos.zip",
        }

        # Registra no historico
        try:
            _registrar_extracao(
                db=db,
                usuario_id=current_user.id,
                numero_cnj=req.numeros_cnj[0],
                numeros_cnj_lote=req.numeros_cnj,
                modo_selecao=req.modo_selecao,
                modo_saida=req.modo_saida,
                mesclar_pdfs=req.mesclar_pdfs,
                total_docs=resultado.total_docs_baixados,
                status="concluido",
            )
        except Exception as e:
            logger.error("Erro ao registrar extracao do lote: %s", e)

        yield _sse_event(
            "concluido",
            job_id=job_id,
            mensagem=f"Lote concluido: {resultado.total_processados}/{resultado.total_processos} processo(s)",
            total_processos=resultado.total_processos,
            total_processados=resultado.total_processados,
            total_docs=resultado.total_docs_baixados,
            total_erros=resultado.total_erros,
            bert_filtrados=resultado.total_docs_filtrados_bert,
        )

    return StreamingResponse(
        gerar_eventos(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================
# Token refresh (mantem sessao viva durante downloads longos)
# ============================================


@router.post("/refresh-token")
async def refresh_token(
    current_user: User = Depends(get_current_active_user),
):
    """
    Renova o token JWT do usuario sem exigir login.

    Chamado periodicamente pelo frontend durante downloads longos
    para evitar que o token expire antes do download concluir.
    """
    from auth.security import create_access_token
    from config import ACCESS_TOKEN_EXPIRE_MINUTES

    new_token = create_access_token(
        data={
            "sub": current_user.username,
            "user_id": current_user.id,
            "role": current_user.role,
            "must_change_password": getattr(current_user, "must_change_password", False),
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"access_token": new_token, "token_type": "bearer"}


# ============================================
# Download de ZIP por job_id
# ============================================


@router.get("/download/{job_id}")
async def download_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Faz download de um ZIP gerado previamente via /baixar-stream ou /baixar-lote.

    O ZIP e armazenado em memoria por 10 minutos apos a conclusao.
    """
    _limpar_jobs_expirados()

    job = _download_jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail="Download nao encontrado ou expirado. Tente gerar novamente.",
        )

    zip_bytes = job["zip_bytes"]
    nome = job["nome"]

    # Remove o job apos o download para liberar memoria
    del _download_jobs[job_id]

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{nome}"',
        },
    )


# ============================================
# Mapa de codigos
# ============================================


@router.get("/codigos-map")
async def obter_codigos_map(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna mapeamento completo de codigo -> descricao de tipo de documento."""
    from .services import ExtratorAutosService

    service = ExtratorAutosService(db)
    codigos = await service.obter_codigos_map()

    return {"codigos": codigos}


# ============================================
# BERT - Health e classificacao
# ============================================


@router.get("/bert/health")
async def bert_health(
    current_user: User = Depends(get_current_active_user),
):
    """Verifica disponibilidade do servico BERT de classificacao."""
    client = BertClassifierClient()
    health = await client.check_health()

    # Enriquece com config atual
    health["config"] = {
        "endpoint": client.endpoint,
        "model_path": client.model_path,
        "model_name": client.model_name,
    }

    return health


@router.get("/bert/config")
async def bert_get_config(
    current_user: User = Depends(get_current_active_user),
):
    """Retorna configuracao atual do BERT (apenas endpoint do worker)."""
    import os
    return {
        "endpoint": os.getenv("BERT_ENDPOINT", "http://127.0.0.1:8765"),
    }


@router.put("/bert/config")
async def bert_update_config(
    config: Dict,
    current_user: User = Depends(get_current_active_user),
):
    """Atualiza endpoint do worker BERT."""
    import os
    updated = {}
    if "endpoint" in config and config["endpoint"]:
        os.environ["BERT_ENDPOINT"] = config["endpoint"]
        updated["endpoint"] = config["endpoint"]

    logger.info("BERT config atualizada por usuario %s: %s", current_user.id, updated)
    return {"status": "ok", "updated": updated}


@router.get("/bert/categorias")
async def bert_listar_categorias(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista categorias que usam BERT com modelo associado."""
    from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento
    from sistemas.bert_training.models import BertRun

    cats = session_query(db, CategoriaDocumento).filter(
        CategoriaDocumento.resolver_config.isnot(None)
    ).all()

    bert_cats = []
    for cat in cats:
        config = cat.resolver_config or {}
        if config.get("type") != "bert":
            continue

        model_run_id = config.get("model_run_id")
        model_info = None
        if model_run_id:
            run = session_query(db, BertRun).filter(BertRun.id == model_run_id).first()
            if run:
                model_info = {
                    "id": run.id,
                    "name": run.name,
                    "accuracy": run.final_accuracy,
                    "f1": run.final_macro_f1,
                    "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                }

        bert_cats.append({
            "categoria_id": cat.id,
            "categoria_nome": cat.titulo or cat.nome,
            "label_match": config.get("label_match", ""),
            "model_run_id": model_run_id,
            "model_info": model_info,
        })

    return bert_cats


@router.put("/bert/categorias/{cat_id}/modelo")
async def bert_associar_modelo(
    cat_id: int,
    body: Dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Associa um modelo BERT treinado a uma categoria."""
    from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento
    from sistemas.bert_training.models import BertRun
    from sqlalchemy.orm.attributes import flag_modified

    cat = session_query(db, CategoriaDocumento).filter(CategoriaDocumento.id == cat_id).first()
    if not cat or not cat.resolver_config or cat.resolver_config.get("type") != "bert":
        raise HTTPException(status_code=404, detail="Categoria BERT nao encontrada")

    model_run_id = body.get("model_run_id")  # None = desassociar

    if model_run_id is not None:
        run = session_query(db, BertRun).filter(BertRun.id == model_run_id).first()
        if not run or run.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="Modelo nao encontrado ou nao completado",
            )

    config = dict(cat.resolver_config)
    config["model_run_id"] = model_run_id
    cat.resolver_config = config
    flag_modified(cat, "resolver_config")
    db.commit()

    logger.info(
        "Modelo BERT %s associado a categoria %s (%s) por usuario %s",
        model_run_id, cat_id, cat.nome, current_user.id,
    )

    return {"status": "ok", "categoria_id": cat_id, "model_run_id": model_run_id}


@router.post("/bert/classificar", response_model=ClassificarBertResponse)
async def bert_classificar(
    req: ClassificarBertRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Testa classificacao BERT em um texto fornecido."""
    client = BertClassifierClient(model_name=req.modelo)
    resultado = await client.classify(req.texto)

    label = resultado.get("predicted_label", "")
    confidence = resultado.get("confidence", 0.0)
    normalized = BertClassifierClient.normalize_label(label)
    source = resultado.get("source", "error")
    erro = resultado.get("error")

    return ClassificarBertResponse(
        predicted_label=label,
        normalized_label=normalized,
        confidence=confidence,
        is_contestacao=normalized == "contestacao",
        source=source,
        erro=erro,
    )


# ============================================
# Historico de downloads
# ============================================


@router.get("/historico")
async def listar_historico(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista historico de downloads do usuario."""
    offset = (pagina - 1) * por_pagina

    query = (
        session_query(db, ExtracaoAutos)
        .filter(ExtracaoAutos.usuario_id == current_user.id)
        .order_by(ExtracaoAutos.criado_em.desc())
    )

    total = query.count()
    extracoes = query.offset(offset).limit(por_pagina).all()

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "itens": [
            {
                "id": e.id,
                "numero_cnj": e.numero_cnj,
                "numeros_cnj_lote": e.numeros_cnj_lote,
                "modo_selecao": e.modo_selecao,
                "modo_saida": e.modo_saida,
                "mesclar_pdfs": e.mesclar_pdfs,
                "total_processos": e.total_processos,
                "total_docs_encontrados": e.total_docs_encontrados,
                "total_docs_baixados": e.total_docs_baixados,
                "total_docs_erro": e.total_docs_erro,
                "status": e.status,
                "progresso_percent": e.progresso_percent,
                "erro_mensagem": e.erro_mensagem,
                "criado_em": to_iso_utc(e.criado_em),
                "concluido_em": to_iso_utc(e.concluido_em),
            }
            for e in extracoes
        ],
    }


# ============================================
# Funcoes auxiliares
# ============================================


def _sse_event(tipo: str, **kwargs) -> str:
    """Formata um evento SSE como string data: {json}."""
    payload = {"tipo": tipo, **kwargs}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _registrar_extracao(
    db: Session,
    usuario_id: int,
    numero_cnj: str,
    modo_selecao: str,
    modo_saida: str,
    mesclar_pdfs: bool,
    total_docs: int,
    status: str,
    numeros_cnj_lote: Optional[List[str]] = None,
) -> ExtracaoAutos:
    """Registra uma extracao no historico do banco de dados."""
    extracao = ExtracaoAutos(
        numero_cnj=numero_cnj,
        numeros_cnj_lote=numeros_cnj_lote,
        modo_selecao=modo_selecao,
        modo_saida=modo_saida,
        mesclar_pdfs=mesclar_pdfs,
        total_processos=len(numeros_cnj_lote) if numeros_cnj_lote else 1,
        total_docs_baixados=total_docs,
        status=status,
        progresso_percent=100 if status == "concluido" else 0,
        usuario_id=usuario_id,
        concluido_em=get_utc_now() if status == "concluido" else None,
    )
    db.add(extracao)
    db.commit()
    db.refresh(extracao)

    logger.info(
        "Extracao registrada id=%d, cnj=%s, status=%s, docs=%d",
        extracao.id,
        numero_cnj,
        status,
        total_docs,
    )

    return extracao





