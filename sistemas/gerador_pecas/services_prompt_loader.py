# sistemas/gerador_pecas/services_prompt_loader.py
"""
Servico de carregamento de prompts modulares por grupo.

Centraliza a logica de carregar prompts base (sistema) e peca,
filtrando pelo group_id do grupo selecionado.

Cada grupo tem seus proprios prompts base e peca.
Se nao encontrar no grupo, faz fallback para prompts globais (group_id=NULL).
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from admin.models_prompts import PromptModulo

logger = logging.getLogger(__name__)


def carregar_prompt_sistema(db: Session, group_id: int | None = None) -> str:
    """
    Carrega modulos BASE (prompt do sistema) para o grupo especificado.

    Se nenhum modulo encontrado no grupo, tenta fallback global (group_id=NULL).

    Args:
        db: Sessao do banco
        group_id: ID do grupo (opcional)

    Returns:
        Prompt do sistema montado a partir dos modulos base
    """
    # Tenta carregar do grupo
    if group_id is not None:
        modulos = db.query(PromptModulo).filter(
            PromptModulo.tipo == "base",
            PromptModulo.ativo == True,
            PromptModulo.group_id == group_id
        ).order_by(PromptModulo.ordem).all()

        if modulos:
            partes = [f"## {m.titulo}\n\n{m.conteudo}" for m in modulos]
            return "\n\n".join(partes)

        logger.debug(
            "Nenhum modulo base encontrado para grupo %s, tentando fallback global",
            group_id
        )

    # Fallback: modulos globais (group_id=NULL) — retrocompatibilidade
    modulos = db.query(PromptModulo).filter(
        PromptModulo.tipo == "base",
        PromptModulo.ativo == True,
        PromptModulo.group_id.is_(None)
    ).order_by(PromptModulo.ordem).all()

    partes = [f"## {m.titulo}\n\n{m.conteudo}" for m in modulos]
    return "\n\n".join(partes)


def carregar_prompt_peca(
    db: Session,
    tipo_peca: str | None,
    group_id: int | None = None
) -> str:
    """
    Carrega o modulo de PECA especifico para o grupo.

    Se nenhum modulo encontrado no grupo, tenta fallback global (group_id=NULL).

    Args:
        db: Sessao do banco
        tipo_peca: Tipo de peca (ex: 'contestacao')
        group_id: ID do grupo (opcional)

    Returns:
        Prompt da peca ou string vazia
    """
    if not tipo_peca:
        return ""

    # Tenta carregar do grupo
    if group_id is not None:
        modulo = db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.nome == tipo_peca,
            PromptModulo.ativo == True,
            PromptModulo.group_id == group_id
        ).first()

        if modulo:
            return f"## ESTRUTURA DA PECA: {modulo.titulo}\n\n{modulo.conteudo}"

        logger.debug(
            "Nenhum modulo peca '%s' encontrado para grupo %s, tentando fallback",
            tipo_peca, group_id
        )

    # Fallback: modulo global (group_id=NULL)
    modulo = db.query(PromptModulo).filter(
        PromptModulo.tipo == "peca",
        PromptModulo.nome == tipo_peca,
        PromptModulo.ativo == True,
        PromptModulo.group_id.is_(None)
    ).first()

    if modulo:
        return f"## ESTRUTURA DA PECA: {modulo.titulo}\n\n{modulo.conteudo}"
    return ""


def listar_tipos_peca(db: Session, group_id: int | None = None) -> list[dict]:
    """
    Lista tipos de peca disponiveis para o grupo.

    Faz fallback para global se o grupo nao tem pecas proprias.

    Args:
        db: Sessao do banco
        group_id: ID do grupo (opcional)

    Returns:
        Lista de dicts com valor, label e descricao de cada tipo
    """
    # Tenta carregar do grupo
    if group_id is not None:
        modulos = db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.ativo == True,
            PromptModulo.group_id == group_id
        ).order_by(PromptModulo.ordem).all()

        if modulos:
            return _formatar_tipos_peca(modulos)

    # Fallback: global
    modulos = db.query(PromptModulo).filter(
        PromptModulo.tipo == "peca",
        PromptModulo.ativo == True,
        PromptModulo.group_id.is_(None)
    ).order_by(PromptModulo.ordem).all()

    return _formatar_tipos_peca(modulos)


def _formatar_tipos_peca(modulos: list) -> list[dict]:
    """Formata modulos de peca para resposta da API."""
    return [
        {
            "valor": m.nome,
            "label": m.titulo,
            "descricao": m.conteudo[:100] + "..." if len(m.conteudo) > 100 else m.conteudo
        }
        for m in modulos
    ]
