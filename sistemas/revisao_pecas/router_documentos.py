"""Proxy de documentos TJ-MS para o sistema de revisao de pecas."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db
from sistemas.revisao_pecas.models import ItemRevisao

router = APIRouter(tags=["Revisao Documentos"])

logger = logging.getLogger(__name__)


@router.get("/itens/{item_id}/documentos")
async def listar_documentos_item(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Lista documentos disponíveis no TJ-MS para o processo associado ao item.

    Retorna metadados de cada documento (ID, tipo, data, descricao) sem
    baixar o conteudo. Use o endpoint de download para obter o PDF.
    """
    item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item de revisao nao encontrado")

    try:
        from services.tjms.client import TJMSClient
        from services.tjms.models import ConsultaOptions, TipoConsulta

        client = TJMSClient()
        opts = ConsultaOptions(tipo=TipoConsulta.COMPLETA)
        processo = await client.consultar_processo(item.numero_cnj, opts)

        documentos = [doc.to_dict() for doc in processo.documentos]
        logger.info(
            "Listados %d documentos para item %d (processo %s)",
            len(documentos),
            item_id,
            item.numero_cnj,
        )
        return {"numero_cnj": item.numero_cnj, "documentos": documentos}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Erro ao listar documentos TJ-MS para item %d: %s", item_id, exc
        )
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao consultar TJ-MS: {str(exc)}",
        )


@router.get("/documentos/{processo}/{doc_id}")
async def baixar_documento(
    processo: str,
    doc_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Faz proxy do download de documento PDF do TJ-MS.

    Retorna o PDF com cabecalho Cache-Control de 1 hora para evitar
    chamadas repetidas ao TJ-MS para o mesmo documento.

    Args:
        processo: Numero CNJ do processo (com ou sem formatacao)
        doc_id: ID do documento no TJ-MS
    """
    try:
        from services.tjms.client import TJMSClient

        client = TJMSClient()
        doc = await client.baixar_documento(processo, doc_id)

        if not doc.sucesso:
            raise HTTPException(
                status_code=404,
                detail=f"Documento nao encontrado ou sem conteudo: {doc.erro}",
            )

        logger.info(
            "Download de documento %s do processo %s (%d bytes)",
            doc_id,
            processo,
            len(doc.conteudo_bytes) if doc.conteudo_bytes else 0,
        )

        return Response(
            content=doc.conteudo_bytes,
            media_type="application/pdf",
            headers={
                "Cache-Control": "private, max-age=3600",
                "Content-Disposition": f'inline; filename="doc_{doc_id}.pdf"',
            },
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Erro ao baixar documento %s do processo %s: %s", doc_id, processo, exc
        )
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao baixar documento do TJ-MS: {str(exc)}",
        )
