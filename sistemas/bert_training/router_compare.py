# -*- coding: utf-8 -*-
"""
Router FastAPI para Compare CNJ - BERT Training.

Endpoints para comparação de classificações BERT vs LLM (Gemini).
Extraído de router.py (linhas 2094-2519).
"""

import asyncio
import base64
import json
import logging
import math
import re
import tempfile
import uuid
from pathlib import Path
from typing import List, Optional

import aiohttp
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db

from sistemas.bert_training.models import BertRun, BertMetric
from sistemas.bert_training.schemas import (
    CompareCNJRequest,
    CompareCNJResponse,
    DocumentComparisonItem
)
from sistemas.bert_training.worker.worker_manager import ensure_inference_server_running

logger = logging.getLogger(__name__)

router = APIRouter(tags=["BERT Training"])


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
            model="gemini-3.7-flash",
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
    categoria = session_query(db, CategoriaDocumento).filter(
        CategoriaDocumento.id == request.categoria_id,
        CategoriaDocumento.ativo == True
    ).first()

    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")

    codigos_permitidos = set(categoria.codigos_documento or [])
    if not codigos_permitidos:
        raise HTTPException(status_code=400, detail="Categoria sem codigos de documento configurados")

    # 2. Validar e buscar modelo BERT
    bert_run = session_query(db, BertRun).filter(
        BertRun.id == request.bert_model_id,
        BertRun.status == "completed"
    ).first()

    if not bert_run:
        raise HTTPException(status_code=404, detail="Modelo BERT nao encontrado ou nao esta completado")

    # 3. Obter labels do modelo BERT (do ultimo metric com classification_report)
    # Ordena por epoch desc E id desc para pegar o registro mais recente em caso de empate
    last_metric = session_query(db, BertMetric).filter(
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
            "model": "gemini-3.7-flash",
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





