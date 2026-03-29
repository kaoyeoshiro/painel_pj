"""Endpoints de chat SSE para edicao de pecas com streaming."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db
from utils.rate_limit import limiter, LIMITS, get_user_identifier
from utils.quota_manager import check_ai_quota
from sistemas.revisao_pecas.models import ItemRevisao, RevisaoChatHistorico
from sistemas.revisao_pecas.schemas import ChatMensagemRequest
from sistemas.revisao_pecas.services_chat import (
    montar_contexto_chat,
    salvar_mensagem_chat,
)

router = APIRouter(tags=["Revisao Chat"])

logger = logging.getLogger(__name__)


@router.post("/itens/{item_id}/chat")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def chat_editar_peca(
    request: Request,
    item_id: int,
    chat_request: ChatMensagemRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Envia mensagem ao chat de edicao e retorna resposta via SSE streaming.

    O modelo retorna o texto completo da peca com a alteracao solicitada.
    Apos o streaming, salva o historico e atualiza conteudo_editado do item.

    Retorna stream SSE com eventos:
    - data: {"tipo": "inicio"} — inicio do processamento
    - data: {"tipo": "chunk", "texto": "..."} — chunk de texto gerado
    - data: {"tipo": "sucesso", "conteudo": "..."} — peca completa apos streaming
    - data: {"tipo": "erro", "mensagem": "..."} — erro durante o processo
    """
    await check_ai_quota(current_user)

    # Carrega o item e valida acesso
    item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item de revisao nao encontrado")

    # Carrega historico de chat do item
    historico = (
        db.query(RevisaoChatHistorico)
        .filter(RevisaoChatHistorico.item_revisao_id == item_id)
        .order_by(RevisaoChatHistorico.criado_em)
        .all()
    )

    # Salva mensagem do usuario antes de iniciar streaming
    salvar_mensagem_chat(db, item_id, "user", chat_request.mensagem)

    # Monta contexto enriquecido
    contexto = montar_contexto_chat(item, historico)

    # Monta prompt completo com historico para o modelo
    prompt_partes = []
    prompt_partes.append(contexto)
    prompt_partes.append("\n## INSTRUCAO")
    prompt_partes.append(
        "Voce e um assistente juridico especializado em editar pecas processuais. "
        "O usuario e um procurador do Estado revisando uma peca gerada por IA. "
        "Responda SEMPRE com o texto completo da peca atualizado, "
        "incorporando a alteracao solicitada. Mantenha a formatacao em Markdown. "
        "NAO adicione explicacoes — retorne apenas o texto da peca editado."
    )
    prompt_partes.append(f"\n## CONTEUDO ATUAL DA PECA\n{chat_request.conteudo_atual}")

    if historico:
        prompt_partes.append("\n## HISTORICO DA CONVERSA")
        for msg in historico:
            papel = "Usuario" if msg.role == "user" else "Assistente"
            prompt_partes.append(f"{papel}: {msg.conteudo[:500]}")

    prompt_partes.append(f"\n## PEDIDO DO USUARIO\n{chat_request.mensagem}")
    prompt_completo = "\n".join(prompt_partes)

    async def gerar_eventos():
        """Gera eventos SSE com streaming do Gemini."""
        from services.gemini_service import gemini_service, stream_to_sse

        # Sinaliza inicio
        yield f"data: {json.dumps({'tipo': 'inicio'})}\n\n"

        conteudo_acumulado = ""

        try:
            gen = gemini_service.generate_stream(
                prompt=prompt_completo,
                model=None,
                task="geracao",
                max_tokens=32000,
                temperature=0.3,
                context={"sistema": "revisao_pecas", "item_id": item_id},
            )

            async for chunk in gen:
                conteudo_acumulado += chunk
                yield f"data: {json.dumps({'tipo': 'chunk', 'texto': chunk})}\n\n"

            # Salva resposta do assistente e atualiza conteudo_editado
            _item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
            if _item:
                salvar_mensagem_chat(
                    db,
                    item_id,
                    "assistant",
                    conteudo_acumulado,
                    snapshot=conteudo_acumulado,
                )
                _item.conteudo_editado = conteudo_acumulado
                db.commit()
                logger.info(
                    "Chat revisao: item %d atualizado (%d chars)",
                    item_id,
                    len(conteudo_acumulado),
                )

            yield f"data: {json.dumps({'tipo': 'sucesso', 'conteudo': conteudo_acumulado})}\n\n"

        except Exception as exc:
            logger.error("Erro no chat de revisao item %d: %s", item_id, exc)
            yield f"data: {json.dumps({'tipo': 'erro', 'mensagem': str(exc)})}\n\n"

    return StreamingResponse(
        gerar_eventos(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/itens/{item_id}/chat/historico")
async def obter_historico_chat(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna o historico de mensagens do chat de um item de revisao."""
    item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item de revisao nao encontrado")

    historico = (
        db.query(RevisaoChatHistorico)
        .filter(RevisaoChatHistorico.item_revisao_id == item_id)
        .order_by(RevisaoChatHistorico.criado_em)
        .all()
    )

    return {
        "item_id": item_id,
        "mensagens": [
            {
                "id": msg.id,
                "role": msg.role,
                "conteudo": msg.conteudo,
                "conteudo_peca_snapshot": msg.conteudo_peca_snapshot,
                "criado_em": msg.criado_em.isoformat() if msg.criado_em else None,
            }
            for msg in historico
        ],
    }


@router.delete("/itens/{item_id}/chat/historico")
async def limpar_historico_chat(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Limpa o historico de mensagens do chat de um item de revisao."""
    item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item de revisao nao encontrado")

    deleted = (
        db.query(RevisaoChatHistorico)
        .filter(RevisaoChatHistorico.item_revisao_id == item_id)
        .delete()
    )
    db.commit()

    return {"removidas": deleted}
