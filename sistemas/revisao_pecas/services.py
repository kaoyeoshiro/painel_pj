# sistemas/revisao_pecas/services.py
"""Servicos de negocio para o Sistema de Revisao de Pecas.

Implementa as transicoes de estado dos itens da fila de revisao:
pendente -> em_revisao -> aprovado/rejeitado/encaminhado -> concluido
"""

import logging
import random

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth.models import User
from sistemas.revisao_pecas.models import AssessorDisponivel, ItemRevisao
from sistemas.revisao_pecas.schemas import (
    AprovarRequest,
    EncaminharLoteRequest,
    EstatisticasResponse,
    IngerirItemRequest,
    RejeitarRequest,
)
from sistemas.revisao_pecas.services_observacao import gerar_texto_observacao
from utils.timezone import get_utc_now

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes de status
# ---------------------------------------------------------------------------
STATUS_PENDENTE = "pendente"
STATUS_EM_REVISAO = "em_revisao"
STATUS_APROVADO = "aprovado"
STATUS_ENCAMINHADO = "encaminhado"
STATUS_REJEITADO = "rejeitado"
STATUS_CONCLUIDO = "concluido"

# Constantes de status de observacao
OBS_NAO_APLICAVEL = "nao_aplicavel"
OBS_AGUARDANDO = "aguardando_insercao"
OBS_INSERIDA = "inserida"
OBS_ERRO = "erro_insercao"


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _nome_usuario(usuario: User | None) -> str:
    """Retorna o nome de exibicao do usuario ou string vazia."""
    if usuario is None:
        return ""
    return usuario.full_name or usuario.username or ""


def _validar_assessor_ativo(db: Session, assessor_id: int) -> AssessorDisponivel:
    """Valida que o assessor existe e esta ativo.

    Args:
        db: Sessao do banco de dados
        assessor_id: ID do registro na tabela assessores_disponiveis

    Returns:
        AssessorDisponivel: Registro do assessor validado

    Raises:
        HTTPException 404: Se assessor nao encontrado
        HTTPException 422: Se assessor inativo
    """
    assessor = db.query(AssessorDisponivel).filter(
        AssessorDisponivel.id == assessor_id
    ).first()
    if not assessor:
        raise HTTPException(status_code=404, detail="Assessor nao encontrado.")
    if not assessor.ativo:
        raise HTTPException(status_code=422, detail="Assessor inativo. Ative-o antes de encaminhar.")
    return assessor


# ---------------------------------------------------------------------------
# Funcoes publicas
# ---------------------------------------------------------------------------

def criar_item(db: Session, payload: IngerirItemRequest) -> ItemRevisao:
    """Cria um novo ItemRevisao a partir do payload de ingestao.

    Args:
        db: Sessao do banco de dados
        payload: Dados do item a ser criado

    Returns:
        ItemRevisao: Item criado e persistido
    """
    item = ItemRevisao(
        numero_cnj=payload.numero_cnj,
        source_session=payload.source_session,
        categoria=payload.categoria,
        resultado=payload.resultado,
        acao_sugerida=payload.acao_sugerida,
        tipo_peca=payload.tipo_peca,
        conteudo_peca=payload.conteudo_peca,
        resumo_revisor=payload.resumo_revisor,
        classificacao_data=payload.classificacao_data.model_dump(),
        cdpendencia=payload.cdpendencia,
        usuario_revisor_id=payload.usuario_revisor_id,
        status=STATUS_PENDENTE,
        obs_status=OBS_NAO_APLICAVEL,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info("ItemRevisao criado: id=%d cnj=%s", item.id, item.numero_cnj)
    return item


def iniciar_revisao(db: Session, item: ItemRevisao, usuario: User) -> ItemRevisao:
    """Inicia a revisao de um item, atribuindo-o ao usuario.

    Permite transicao somente de pendente ou em_revisao (re-atribuicao).

    Args:
        db: Sessao do banco de dados
        item: Item a ser revisado
        usuario: Usuario que assumira a revisao

    Returns:
        ItemRevisao: Item atualizado

    Raises:
        HTTPException 422: Se item nao estiver em estado revisavel
    """
    if item.status not in (STATUS_PENDENTE, STATUS_EM_REVISAO):
        raise HTTPException(
            status_code=422,
            detail=f"Item nao pode ser iniciado no status '{item.status}'."
        )
    item.status = STATUS_EM_REVISAO
    item.usuario_revisor_id = usuario.id
    db.commit()
    db.refresh(item)
    logger.info("Revisao iniciada: item_id=%d usuario_id=%d", item.id, usuario.id)
    return item


def aprovar_item(
    db: Session,
    item: ItemRevisao,
    usuario: User,
    payload: AprovarRequest,
) -> ItemRevisao:
    """Aprova um item com conteudo opcional editado pelo revisor.

    Gera texto de observacao para lancamento no pge.net.
    Define obs_status=aguardando_insercao se cdpendencia presente.

    Args:
        db: Sessao do banco de dados
        item: Item a ser aprovado
        usuario: Usuario revisor
        payload: Dados da aprovacao (conteudo_final, observacao_pge opcionais)

    Returns:
        ItemRevisao: Item aprovado

    Raises:
        HTTPException 422: Se item nao estiver em revisao
    """
    if item.status != STATUS_EM_REVISAO:
        raise HTTPException(
            status_code=422,
            detail=f"Item precisa estar em revisao para ser aprovado (status atual: '{item.status}')."
        )

    nome_revisor = _nome_usuario(usuario)
    houve_edicao = bool(payload.conteudo_final)

    if houve_edicao:
        item.conteudo_editado = payload.conteudo_final
        cenario = "aprovado_editado"
    else:
        cenario = "aprovado_sem_alteracao"

    # Verifica se e "nada a fazer" (sem peca) para usar cenario correto
    if not item.conteudo_peca and not payload.conteudo_final:
        cenario = "nada_a_fazer_confirmado"

    obs_texto = gerar_texto_observacao(
        cenario=cenario,
        tipo_peca=item.tipo_peca,
        nome_revisor=nome_revisor,
    )

    item.observacao_pge = payload.observacao_pge or obs_texto
    item.status = STATUS_APROVADO
    item.revisado_em = get_utc_now()

    # Define obs_status conforme presenca de cdpendencia
    if item.cdpendencia:
        item.obs_status = OBS_AGUARDANDO
    else:
        item.obs_status = OBS_NAO_APLICAVEL

    db.commit()
    db.refresh(item)
    logger.info(
        "Item aprovado: item_id=%d usuario_id=%d cenario=%s obs_status=%s",
        item.id, usuario.id, cenario, item.obs_status,
    )
    return item


def rejeitar_item(
    db: Session,
    item: ItemRevisao,
    usuario: User,
    payload: RejeitarRequest,
) -> ItemRevisao:
    """Rejeita a orientacao da IA e registra a acao correta.

    Usado quando a IA sugeriu "Nada a Fazer" mas o procurador discorda.

    Args:
        db: Sessao do banco de dados
        item: Item a ser rejeitado
        usuario: Usuario revisor
        payload: Motivo da rejeicao e acao corrigida

    Returns:
        ItemRevisao: Item rejeitado

    Raises:
        HTTPException 422: Se item nao estiver em revisao
    """
    if item.status != STATUS_EM_REVISAO:
        raise HTTPException(
            status_code=422,
            detail=f"Item precisa estar em revisao para ser rejeitado (status atual: '{item.status}')."
        )

    nome_revisor = _nome_usuario(usuario)
    obs_texto = gerar_texto_observacao(
        cenario="rejeitado",
        nome_revisor=nome_revisor,
        acao_corrigida=payload.acao_corrigida,
        motivo=payload.motivo_rejeicao,
    )

    item.motivo_rejeicao = payload.motivo_rejeicao
    item.acao_corrigida = payload.acao_corrigida
    item.observacao_pge = obs_texto
    item.status = STATUS_REJEITADO
    item.revisado_em = get_utc_now()

    # Define obs_status conforme presenca de cdpendencia
    if item.cdpendencia:
        item.obs_status = OBS_AGUARDANDO
    else:
        item.obs_status = OBS_NAO_APLICAVEL

    db.commit()
    db.refresh(item)
    logger.info(
        "Item rejeitado: item_id=%d usuario_id=%d acao_corrigida=%s",
        item.id, usuario.id, payload.acao_corrigida,
    )
    return item


def encaminhar_item(
    db: Session,
    item: ItemRevisao,
    usuario: User,
    assessor_id: int,
) -> ItemRevisao:
    """Encaminha item para um assessor inserir no processo.

    Args:
        db: Sessao do banco de dados
        item: Item a ser encaminhado
        usuario: Usuario revisor que encaminha
        assessor_id: ID do registro AssessorDisponivel (nao usuario_id)

    Returns:
        ItemRevisao: Item encaminhado

    Raises:
        HTTPException 404: Se assessor nao encontrado
        HTTPException 422: Se assessor inativo ou item nao estiver em revisao
    """
    if item.status != STATUS_EM_REVISAO:
        raise HTTPException(
            status_code=422,
            detail=f"Item precisa estar em revisao para ser encaminhado (status atual: '{item.status}')."
        )

    assessor = _validar_assessor_ativo(db, assessor_id)
    nome_revisor = _nome_usuario(usuario)
    nome_assessor = _nome_usuario(assessor.usuario)

    obs_texto = gerar_texto_observacao(
        cenario="encaminhado",
        tipo_peca=item.tipo_peca,
        nome_revisor=nome_revisor,
        nome_assessor=nome_assessor,
    )

    item.status = STATUS_ENCAMINHADO
    item.usuario_encaminhado_id = assessor.usuario_id
    item.observacao_pge = obs_texto
    item.revisado_em = get_utc_now()

    # Define obs_status conforme presenca de cdpendencia
    if item.cdpendencia:
        item.obs_status = OBS_AGUARDANDO
    else:
        item.obs_status = OBS_NAO_APLICAVEL

    db.commit()
    db.refresh(item)
    logger.info(
        "Item encaminhado: item_id=%d revisor_id=%d assessor_usuario_id=%d",
        item.id, usuario.id, assessor.usuario_id,
    )
    return item


def distribuir_lote(
    db: Session,
    usuario: User,
    payload: EncaminharLoteRequest,
) -> dict[str, int]:
    """Distribui itens pendentes/em_revisao para assessores.

    Modos suportados:
    - aleatorio: cada item recebe um assessor aleatorio da lista
    - manual: distribui em round-robin pela lista de assessor_ids

    Args:
        db: Sessao do banco de dados
        usuario: Usuario revisor que realiza a distribuicao
        payload: IDs dos itens, IDs dos assessores e modo de distribuicao

    Returns:
        dict: {'distribuidos': N, 'nao_encontrados': M, 'assessores_invalidos': K}

    Raises:
        HTTPException 422: Se nenhum assessor ativo for encontrado
    """
    # Valida assessores
    assessores_ativos: list[AssessorDisponivel] = []
    assessores_invalidos = 0
    for aid in payload.assessor_ids:
        registro = db.query(AssessorDisponivel).filter(
            AssessorDisponivel.id == aid,
            AssessorDisponivel.ativo.is_(True),
        ).first()
        if registro:
            assessores_ativos.append(registro)
        else:
            assessores_invalidos += 1

    if not assessores_ativos:
        raise HTTPException(
            status_code=422,
            detail="Nenhum assessor ativo encontrado na lista fornecida."
        )

    distribuidos = 0
    nao_encontrados = 0

    for idx, item_id in enumerate(payload.item_ids):
        item = db.query(ItemRevisao).filter(ItemRevisao.id == item_id).first()
        if not item:
            nao_encontrados += 1
            continue

        # Ignora itens em estados finais
        if item.status in (STATUS_APROVADO, STATUS_REJEITADO, STATUS_CONCLUIDO, STATUS_ENCAMINHADO):
            nao_encontrados += 1
            continue

        # Seleciona assessor conforme modo
        if payload.modo == "aleatorio":
            assessor = random.choice(assessores_ativos)
        else:
            assessor = assessores_ativos[idx % len(assessores_ativos)]

        nome_revisor = _nome_usuario(usuario)
        nome_assessor = _nome_usuario(assessor.usuario)
        obs_texto = gerar_texto_observacao(
            cenario="encaminhado",
            tipo_peca=item.tipo_peca,
            nome_revisor=nome_revisor,
            nome_assessor=nome_assessor,
        )

        item.status = STATUS_ENCAMINHADO
        item.usuario_revisor_id = usuario.id
        item.usuario_encaminhado_id = assessor.usuario_id
        item.observacao_pge = obs_texto
        item.revisado_em = get_utc_now()

        if item.cdpendencia:
            item.obs_status = OBS_AGUARDANDO
        else:
            item.obs_status = OBS_NAO_APLICAVEL

        distribuidos += 1

    db.commit()
    logger.info(
        "Lote distribuido: distribuidos=%d nao_encontrados=%d usuario_id=%d",
        distribuidos, nao_encontrados, usuario.id,
    )
    return {
        "distribuidos": distribuidos,
        "nao_encontrados": nao_encontrados,
        "assessores_invalidos": assessores_invalidos,
    }


def marcar_inserido(db: Session, item: ItemRevisao) -> ItemRevisao:
    """Marca o DOCX do item como inserido e transiciona para concluido.

    Args:
        db: Sessao do banco de dados
        item: Item cuja insercao foi confirmada pelo assessor

    Returns:
        ItemRevisao: Item concluido
    """
    item.status = STATUS_CONCLUIDO
    item.concluido_em = get_utc_now()
    db.commit()
    db.refresh(item)
    logger.info("Item marcado como inserido: item_id=%d", item.id)
    return item


def confirmar_observacao(
    db: Session,
    item: ItemRevisao,
    sucesso: bool,
    erro_msg: str | None = None,
) -> ItemRevisao:
    """Worker confirma resultado da insercao de observacao no pge.net.

    Transicoes automaticas pos-confirmacao:
    - Itens rejeitados (sem peca): transicionam para concluido ao confirmar obs
    - Itens aprovados sem peca: transicionam para concluido ao confirmar obs
    - Itens aprovados com peca: permanecem aprovados aguardando marcar_inserido

    Args:
        db: Sessao do banco de dados
        item: Item com observacao a confirmar
        sucesso: True se observacao inserida com sucesso, False se erro
        erro_msg: Mensagem de erro quando sucesso=False

    Returns:
        ItemRevisao: Item atualizado com novo obs_status
    """
    if sucesso:
        item.obs_status = OBS_INSERIDA
        # Auto-concluir itens que nao tem peca a inserir
        tem_peca = bool(item.conteudo_peca or item.conteudo_editado)
        if item.status in (STATUS_REJEITADO,) or (item.status == STATUS_APROVADO and not tem_peca):
            item.status = STATUS_CONCLUIDO
            item.concluido_em = get_utc_now()
            logger.info(
                "Item auto-concluido apos confirmacao de obs: item_id=%d status_anterior=%s",
                item.id, item.status,
            )
    else:
        item.obs_status = OBS_ERRO
        logger.warning(
            "Erro ao inserir observacao: item_id=%d erro=%s",
            item.id, erro_msg or "desconhecido",
        )

    db.commit()
    db.refresh(item)
    logger.info(
        "Observacao confirmada: item_id=%d sucesso=%s obs_status=%s",
        item.id, sucesso, item.obs_status,
    )
    return item


def obter_estatisticas(db: Session, usuario: User) -> EstatisticasResponse:
    """Retorna contagem de itens por status para o usuario atual.

    Assessores veem apenas itens encaminhados a eles.
    Revisores/admins veem todos os itens.

    Args:
        db: Sessao do banco de dados
        usuario: Usuario solicitante

    Returns:
        EstatisticasResponse: Contagens por status
    """
    query_base = db.query(ItemRevisao.status, func.count(ItemRevisao.id))

    # Assessores veem somente os seus itens
    if usuario.role == "assessor":
        query_base = query_base.filter(ItemRevisao.usuario_encaminhado_id == usuario.id)

    contagens_raw = query_base.group_by(ItemRevisao.status).all()
    contagens: dict[str, int] = {status: count for status, count in contagens_raw}

    total = sum(contagens.values())
    aguardando = db.query(func.count(ItemRevisao.id)).filter(
        ItemRevisao.obs_status == OBS_AGUARDANDO
    )
    if usuario.role == "assessor":
        aguardando = aguardando.filter(ItemRevisao.usuario_encaminhado_id == usuario.id)
    aguardando_count = aguardando.scalar() or 0

    logger.debug(
        "Estatisticas consultadas: usuario_id=%d total=%d",
        usuario.id, total,
    )

    return EstatisticasResponse(
        total=total,
        pendentes=contagens.get(STATUS_PENDENTE, 0),
        em_revisao=contagens.get(STATUS_EM_REVISAO, 0),
        aprovados=contagens.get(STATUS_APROVADO, 0),
        encaminhados=contagens.get(STATUS_ENCAMINHADO, 0),
        rejeitados=contagens.get(STATUS_REJEITADO, 0),
        concluidos=contagens.get(STATUS_CONCLUIDO, 0),
        aguardando_insercao=aguardando_count,
    )
