# sistemas/revisao_pecas/router.py
"""Router principal do Sistema de Revisao de Pecas.

Endpoints:
- POST  /ingerir                           - Ingere item individual na fila
- POST  /ingerir-lote                      - Ingere multiplos itens de uma vez
- GET   /itens                             - Lista itens com filtros e paginacao
- GET   /itens/{id}                        - Detalhe de um item
- GET   /estatisticas                      - Contagem por status do usuario
- POST  /itens/{id}/iniciar-revisao        - Inicia revisao de um item
- POST  /itens/{id}/aprovar                - Aprova item (pode editar conteudo)
- POST  /itens/{id}/rejeitar               - Rejeita orientacao da IA
- POST  /itens/{id}/encaminhar             - Encaminha para assessor
- POST  /encaminhar-lote                   - Distribui itens para assessores
- POST  /itens/{id}/marcar-inserido        - Assessor marca DOCX como inserido
- PUT   /itens/{id}/conteudo               - Auto-save do conteudo editado
- GET   /itens/{id}/chat-historico         - Historico de chat do item
- GET   /assessores                        - Lista assessores disponiveis
- POST  /assessores                        - Adiciona assessor
- DELETE /assessores/{id}                  - Remove assessor
- PATCH /assessores/{id}                   - Ativa/desativa assessor
- GET   /observacoes-pendentes             - Worker: lista obs aguardando insercao
- POST  /observacoes/{id}/confirmar        - Worker: confirma resultado da insercao
- POST  /itens/{id}/exportar-docx          - Exporta conteudo da peca para DOCX
"""

import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from auth.dependencies import get_current_active_user
from auth.models import User
from database.connection import get_db
from sistemas.revisao_pecas.models import (
    AssessorDisponivel,
    ItemRevisao,
    RevisaoChatHistorico,
)
from sistemas.revisao_pecas.schemas import (
    AdicionarAssessorRequest,
    AssessorResponse,
    AprovarRequest,
    AtivarDesativarRequest,
    ChatHistoricoResponse,
    ConfirmarObservacaoRequest,
    EncaminharLoteRequest,
    EncaminharRequest,
    EstatisticasResponse,
    IngerirItemRequest,
    IngerirLoteRequest,
    ItemRevisaoListResponse,
    ItemRevisaoResponse,
    ObservacaoPendenteResponse,
    RejeitarRequest,
    SalvarConteudoRequest,
)
from sistemas.revisao_pecas.services import (
    aprovar_item,
    confirmar_observacao,
    criar_item,
    distribuir_lote,
    encaminhar_item,
    iniciar_revisao,
    marcar_inserido,
    obter_estatisticas,
    rejeitar_item,
    OBS_AGUARDANDO,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Revisao de Pecas"])


# ---------------------------------------------------------------------------
# Helpers privados do router
# ---------------------------------------------------------------------------

def _require_admin(user: User) -> None:
    """Exige que o usuario seja administrador.

    Args:
        user: Usuario autenticado atual

    Raises:
        HTTPException 403: Se o usuario nao for administrador
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")


def _get_item_or_404(db: Session, item_id: int) -> ItemRevisao:
    """Busca item pelo ID ou levanta 404.

    Args:
        db: Sessao do banco de dados
        item_id: ID do item de revisao

    Returns:
        ItemRevisao: Item encontrado

    Raises:
        HTTPException 404: Se item nao encontrado
    """
    item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Item de revisao {item_id} nao encontrado.")
    return item


def _item_to_response(item: ItemRevisao) -> ItemRevisaoResponse:
    """Converte modelo ItemRevisao para schema de resposta.

    Popula os campos de nome dos relacionamentos (revisor e encaminhado).

    Args:
        item: Instancia do modelo ItemRevisao com relacionamentos carregados

    Returns:
        ItemRevisaoResponse: Schema de resposta populado
    """
    revisor_nome: str | None = None
    if item.usuario_revisor:
        revisor_nome = item.usuario_revisor.full_name or item.usuario_revisor.username

    encaminhado_nome: str | None = None
    if item.usuario_encaminhado:
        encaminhado_nome = (
            item.usuario_encaminhado.full_name or item.usuario_encaminhado.username
        )

    return ItemRevisaoResponse(
        id=item.id,
        numero_cnj=item.numero_cnj,
        source_session=item.source_session,
        categoria=item.categoria,
        resultado=item.resultado,
        acao_sugerida=item.acao_sugerida,
        tipo_peca=item.tipo_peca,
        resumo_revisor=item.resumo_revisor,
        classificacao_data=item.classificacao_data,
        status=item.status,
        obs_status=item.obs_status,
        conteudo_peca=item.conteudo_peca,
        conteudo_editado=item.conteudo_editado,
        observacao_pge=item.observacao_pge,
        motivo_rejeicao=item.motivo_rejeicao,
        acao_corrigida=item.acao_corrigida,
        cdpendencia=item.cdpendencia,
        usuario_revisor_id=item.usuario_revisor_id,
        usuario_encaminhado_id=item.usuario_encaminhado_id,
        revisor_nome=revisor_nome,
        encaminhado_nome=encaminhado_nome,
        criado_em=item.criado_em,
        revisado_em=item.revisado_em,
        concluido_em=item.concluido_em,
    )


# ---------------------------------------------------------------------------
# Ingestao
# ---------------------------------------------------------------------------

@router.post("/ingerir", response_model=ItemRevisaoResponse, status_code=201)
async def ingerir_item(
    payload: IngerirItemRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Ingere um item individual na fila de revisao.

    Cria um novo ItemRevisao no status 'pendente'.
    Acesso restrito a administradores (chamado pelo pipeline automatizado).
    """
    _require_admin(current_user)
    item = criar_item(db, payload)
    return _item_to_response(item)


@router.post("/ingerir-lote", status_code=201)
async def ingerir_lote(
    payload: IngerirLoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Ingere multiplos itens na fila de revisao em uma unica requisicao.

    Retorna contagem de itens criados com sucesso.
    Acesso restrito a administradores.
    """
    _require_admin(current_user)
    criados = 0
    for item_payload in payload.itens:
        criar_item(db, item_payload)
        criados += 1

    logger.info("Lote ingerido: %d itens criados por usuario_id=%d", criados, current_user.id)
    return {"criados": criados, "total_enviados": len(payload.itens)}


# ---------------------------------------------------------------------------
# Listagem
# ---------------------------------------------------------------------------

@router.get("/itens", response_model=ItemRevisaoListResponse)
async def listar_itens(
    tab: str = Query("pendentes", description="Aba: meus, pendentes, concluidos, para_revisar, para_inserir"),
    status: str | None = Query(None, description="Filtrar por status especifico"),
    urgencia: str | None = Query(None, description="Filtrar por urgencia: rotina, prazo_correndo, urgente"),
    categoria: str | None = Query(None, description="Filtrar por categoria"),
    numero_cnj: str | None = Query(None, description="Filtrar por numero CNJ (busca parcial)"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista itens da fila de revisao com filtros e paginacao.

    Tabs disponiveis:
    - meus: itens onde o usuario atual e revisor
    - pendentes: todos os itens pendentes (admin) ou encaminhados ao usuario (assessor)
    - concluidos: itens finalizados
    - para_revisar: itens encaminhados ao assessor atual (role=assessor)
    - para_inserir: itens aprovados/encaminhados aguardando insercao (role=assessor)

    Administradores visualizam todos os itens; assessores somente os seus.
    """
    query = db.query(ItemRevisao)

    # Escopo por perfil
    is_admin = current_user.role == "admin"
    is_assessor = current_user.role == "assessor"

    # Filtro por aba
    if tab == "meus":
        query = query.filter(ItemRevisao.usuario_revisor_id == current_user.id)
    elif tab == "pendentes":
        if is_admin:
            query = query.filter(ItemRevisao.status.in_(["pendente", "em_revisao"]))
        else:
            query = query.filter(
                ItemRevisao.status.in_(["pendente", "em_revisao"]),
                ItemRevisao.usuario_revisor_id == current_user.id,
            )
    elif tab == "concluidos":
        if is_admin:
            query = query.filter(ItemRevisao.status.in_(["aprovado", "rejeitado", "concluido"]))
        else:
            query = query.filter(
                ItemRevisao.status.in_(["aprovado", "rejeitado", "concluido"]),
                ItemRevisao.usuario_revisor_id == current_user.id,
            )
    elif tab == "para_revisar":
        # Assessores: itens encaminhados para eles
        query = query.filter(
            ItemRevisao.status == "encaminhado",
            ItemRevisao.usuario_encaminhado_id == current_user.id,
        )
    elif tab == "para_inserir":
        # Assessores: itens aprovados/encaminhados onde sao responsaveis pela insercao
        query = query.filter(
            ItemRevisao.status.in_(["aprovado", "encaminhado"]),
            ItemRevisao.usuario_encaminhado_id == current_user.id,
        )
    else:
        # Tab nao reconhecida: retorna todos (admin) ou apenas do usuario
        if not is_admin:
            query = query.filter(ItemRevisao.usuario_revisor_id == current_user.id)

    # Filtros adicionais
    if status:
        query = query.filter(ItemRevisao.status == status)

    if urgencia:
        query = query.filter(
            ItemRevisao.classificacao_data["urgencia"].as_string() == urgencia
        )

    if categoria:
        query = query.filter(ItemRevisao.categoria == categoria)

    if numero_cnj:
        query = query.filter(ItemRevisao.numero_cnj.ilike(f"%{numero_cnj}%"))

    total = query.count()
    offset = (pagina - 1) * por_pagina
    itens_db = query.order_by(desc(ItemRevisao.criado_em)).offset(offset).limit(por_pagina).all()

    itens_response = [_item_to_response(item) for item in itens_db]

    return ItemRevisaoListResponse(
        itens=itens_response,
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
    )


@router.get("/itens/{item_id}", response_model=ItemRevisaoResponse)
async def obter_item(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna detalhes completos de um item de revisao.

    Assessores so podem acessar itens encaminhados a eles.
    Admins e revisores podem acessar qualquer item.
    """
    item = _get_item_or_404(db, item_id)

    # Assessores: verificar acesso
    if current_user.role == "assessor":
        if item.usuario_encaminhado_id != current_user.id:
            raise HTTPException(status_code=403, detail="Acesso negado a este item.")

    return _item_to_response(item)


@router.get("/estatisticas", response_model=EstatisticasResponse)
async def estatisticas(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna contagem de itens por status para o usuario atual.

    Assessores visualizam apenas seus itens; admins visualizam todos.
    """
    return obter_estatisticas(db, current_user)


# ---------------------------------------------------------------------------
# Acoes de revisao
# ---------------------------------------------------------------------------

@router.post("/itens/{item_id}/iniciar-revisao", response_model=ItemRevisaoResponse)
async def iniciar_revisao_item(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Inicia a revisao de um item, atribuindo-o ao usuario atual.

    Valida que o item esta em status 'pendente' ou 'em_revisao' (re-atribuicao).
    """
    item = _get_item_or_404(db, item_id)
    item = iniciar_revisao(db, item, current_user)
    return _item_to_response(item)


@router.post("/itens/{item_id}/aprovar", response_model=ItemRevisaoResponse)
async def aprovar(
    item_id: int,
    payload: AprovarRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Aprova a orientacao da IA para um item em revisao.

    Pode incluir conteudo final editado e observacao para o pge.net.
    """
    item = _get_item_or_404(db, item_id)
    item = aprovar_item(db, item, current_user, payload)
    return _item_to_response(item)


@router.post("/itens/{item_id}/rejeitar", response_model=ItemRevisaoResponse)
async def rejeitar(
    item_id: int,
    payload: RejeitarRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Rejeita a orientacao da IA para um item em revisao.

    Registra o motivo da rejeicao e a acao corrigida pelo revisor.
    """
    item = _get_item_or_404(db, item_id)
    item = rejeitar_item(db, item, current_user, payload)
    return _item_to_response(item)


@router.post("/itens/{item_id}/encaminhar", response_model=ItemRevisaoResponse)
async def encaminhar(
    item_id: int,
    payload: EncaminharRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Encaminha um item para um assessor inserir no processo.

    Valida que o assessor esta ativo antes de encaminhar.
    """
    item = _get_item_or_404(db, item_id)
    item = encaminhar_item(db, item, current_user, payload.assessor_id)
    return _item_to_response(item)


@router.post("/encaminhar-lote")
async def encaminhar_lote(
    payload: EncaminharLoteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Distribui multiplos itens entre assessores.

    Modos: 'aleatorio' (cada item recebe assessor aleatorio) ou
    'manual' (round-robin pela lista de assessores fornecida).
    """
    resultado = distribuir_lote(db, current_user, payload)
    return resultado


@router.post("/itens/{item_id}/marcar-inserido", response_model=ItemRevisaoResponse)
async def marcar_item_inserido(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Assessor confirma que inseriu o DOCX no processo.

    Transiciona o item para status 'concluido'.
    """
    item = _get_item_or_404(db, item_id)
    item = marcar_inserido(db, item)
    return _item_to_response(item)


# ---------------------------------------------------------------------------
# Edicao (auto-save e chat)
# ---------------------------------------------------------------------------

@router.put("/itens/{item_id}/conteudo", response_model=ItemRevisaoResponse)
async def salvar_conteudo(
    item_id: int,
    payload: SalvarConteudoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Salva o conteudo editado da peca (auto-save).

    Permite atualizacoes parciais durante a revisao sem alterar o status.
    """
    item = _get_item_or_404(db, item_id)
    item.conteudo_editado = payload.conteudo
    db.commit()
    db.refresh(item)
    logger.debug("Auto-save: item_id=%d usuario_id=%d", item.id, current_user.id)
    return _item_to_response(item)


@router.get("/itens/{item_id}/chat-historico", response_model=list[ChatHistoricoResponse])
async def chat_historico(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna o historico de mensagens do chat de revisao para um item.

    Ordenado cronologicamente por criado_em.
    """
    item = _get_item_or_404(db, item_id)
    historico = (
        db.query(RevisaoChatHistorico)
        .filter(RevisaoChatHistorico.item_revisao_id == item.id)
        .order_by(RevisaoChatHistorico.criado_em)
        .all()
    )
    return historico


# ---------------------------------------------------------------------------
# Assessores
# ---------------------------------------------------------------------------

@router.get("/assessores", response_model=list[AssessorResponse])
async def listar_assessores(
    apenas_ativos: bool = Query(True, description="Se True, retorna apenas assessores ativos"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Lista os assessores disponiveis para encaminhamento.

    Por padrao retorna apenas os ativos.
    """
    query = db.query(AssessorDisponivel)
    if apenas_ativos:
        query = query.filter(AssessorDisponivel.ativo.is_(True))

    assessores = query.order_by(AssessorDisponivel.criado_em).all()

    return [
        AssessorResponse(
            id=a.id,
            usuario_id=a.usuario_id,
            nome=a.usuario.full_name or a.usuario.username if a.usuario else "",
            ativo=a.ativo,
            criado_em=a.criado_em,
        )
        for a in assessores
    ]


@router.post("/assessores", response_model=AssessorResponse, status_code=201)
async def adicionar_assessor(
    payload: AdicionarAssessorRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Adiciona um usuario como assessor disponivel para encaminhamentos.

    Acesso restrito a administradores.
    Retorna 422 se o usuario ja estiver cadastrado como assessor.
    """
    _require_admin(current_user)

    existente = db.query(AssessorDisponivel).filter(
        AssessorDisponivel.usuario_id == payload.usuario_id
    ).first()
    if existente:
        raise HTTPException(
            status_code=422,
            detail=f"Usuario {payload.usuario_id} ja esta cadastrado como assessor."
        )

    assessor = AssessorDisponivel(usuario_id=payload.usuario_id, ativo=True)
    db.add(assessor)
    db.commit()
    db.refresh(assessor)

    logger.info(
        "Assessor adicionado: assessor_id=%d usuario_id=%d por admin_id=%d",
        assessor.id, assessor.usuario_id, current_user.id,
    )

    return AssessorResponse(
        id=assessor.id,
        usuario_id=assessor.usuario_id,
        nome=assessor.usuario.full_name or assessor.usuario.username if assessor.usuario else "",
        ativo=assessor.ativo,
        criado_em=assessor.criado_em,
    )


@router.delete("/assessores/{assessor_id}", status_code=204)
async def remover_assessor(
    assessor_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Remove um assessor do cadastro de disponiveis.

    Acesso restrito a administradores.
    """
    _require_admin(current_user)

    assessor = db.query(AssessorDisponivel).filter(
        AssessorDisponivel.id == assessor_id
    ).first()
    if not assessor:
        raise HTTPException(status_code=404, detail="Assessor nao encontrado.")

    db.delete(assessor)
    db.commit()
    logger.info(
        "Assessor removido: assessor_id=%d por admin_id=%d",
        assessor_id, current_user.id,
    )


@router.patch("/assessores/{assessor_id}", response_model=AssessorResponse)
async def ativar_desativar_assessor(
    assessor_id: int,
    payload: AtivarDesativarRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Ativa ou desativa um assessor para recebimento de encaminhamentos.

    Acesso restrito a administradores.
    """
    _require_admin(current_user)

    assessor = db.query(AssessorDisponivel).filter(
        AssessorDisponivel.id == assessor_id
    ).first()
    if not assessor:
        raise HTTPException(status_code=404, detail="Assessor nao encontrado.")

    assessor.ativo = payload.ativo
    db.commit()
    db.refresh(assessor)

    logger.info(
        "Assessor %s: assessor_id=%d por admin_id=%d",
        "ativado" if payload.ativo else "desativado",
        assessor_id,
        current_user.id,
    )

    return AssessorResponse(
        id=assessor.id,
        usuario_id=assessor.usuario_id,
        nome=assessor.usuario.full_name or assessor.usuario.username if assessor.usuario else "",
        ativo=assessor.ativo,
        criado_em=assessor.criado_em,
    )


# ---------------------------------------------------------------------------
# Worker: observacoes pendentes
# ---------------------------------------------------------------------------

@router.get("/observacoes-pendentes", response_model=list[ObservacaoPendenteResponse])
async def observacoes_pendentes(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retorna itens com observacao aguardando insercao no pge.net.

    Usado pelo worker automatizado para processar a fila de observacoes.
    Acesso restrito a administradores.
    """
    _require_admin(current_user)

    itens = (
        db.query(ItemRevisao)
        .filter(
            ItemRevisao.obs_status == OBS_AGUARDANDO,
            ItemRevisao.cdpendencia.isnot(None),
            ItemRevisao.observacao_pge.isnot(None),
        )
        .order_by(ItemRevisao.revisado_em)
        .limit(limit)
        .all()
    )

    return [
        ObservacaoPendenteResponse(
            item_id=item.id,
            numero_cnj=item.numero_cnj,
            cdpendencia=item.cdpendencia,
            observacao_pge=item.observacao_pge,
            status=item.status,
        )
        for item in itens
    ]


@router.post("/observacoes/{item_id}/confirmar", response_model=ItemRevisaoResponse)
async def confirmar_obs(
    item_id: int,
    payload: ConfirmarObservacaoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Worker confirma o resultado da insercao de observacao no pge.net.

    Atualiza obs_status e pode auto-concluir itens sem peca a inserir.
    Acesso restrito a administradores.
    """
    _require_admin(current_user)
    item = _get_item_or_404(db, item_id)
    item = confirmar_observacao(db, item, payload.sucesso, payload.erro_mensagem)
    return _item_to_response(item)


# ---------------------------------------------------------------------------
# Export DOCX
# ---------------------------------------------------------------------------

@router.post("/itens/{item_id}/exportar-docx")
async def exportar_docx(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Exporta o conteudo da peca revisada para um arquivo DOCX.

    Utiliza o conversor do modulo gerador-pecas (markdown_to_docx).
    Retorna URL de download do documento gerado.
    """
    item = _get_item_or_404(db, item_id)

    conteudo = item.conteudo_editado or item.conteudo_peca
    if not conteudo:
        raise HTTPException(
            status_code=422,
            detail="Este item nao possui conteudo de peca para exportar."
        )

    try:
        from sistemas.gerador_pecas.docx_converter import markdown_to_docx

        temp_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "gerador_pecas",
            "temp_docs",
        )
        os.makedirs(temp_dir, exist_ok=True)

        # Monta nome de arquivo amigavel
        tipo_nome = (item.tipo_peca or "peca").replace(" ", "_").lower()
        cnj_limpo = "".join(c for c in item.numero_cnj if c.isdigit() or c == "-")
        filename = f"{tipo_nome}_{cnj_limpo}_{uuid.uuid4().hex[:8]}.docx"
        filepath = os.path.join(temp_dir, filename)

        sucesso = markdown_to_docx(conteudo, filepath)
        if not sucesso:
            raise HTTPException(status_code=500, detail="Erro ao converter conteudo para DOCX.")

        logger.info(
            "DOCX exportado: item_id=%d filename=%s usuario_id=%d",
            item.id, filename, current_user.id,
        )

        return {
            "status": "sucesso",
            "url_download": f"/gerador-pecas/api/download/{filename}",
            "filename": filename,
        }

    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Modulo de conversao nao disponivel: {exc}"
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erro ao exportar DOCX: item_id=%d", item_id)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao exportar documento: {exc}"
        ) from exc
