"""
Servico generico de obrigatoriedade de categorias de documento.

Permite verificar se determinadas categorias de documento sao obrigatorias
para um tipo de peca em um grupo, e se os documentos necessarios estao
presentes nos autos do processo.

Substitui a logica especifica de parecer NATJus por uma abordagem generica
e data-driven, baseada no campo `obrigatoriedade` de CategoriaResumoJSON.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Sequence

from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query

from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON
from sistemas.gerador_pecas.services_parecer_natjus import (
    normalize_piece_type,
    collect_document_codes,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RequisitoCategoria:
    """Representa uma categoria obrigatoria para determinados tipos de peca."""

    categoria_id: int
    categoria_nome: str
    codigos_documento: tuple[int, ...]
    tipos_peca: tuple[str, ...]
    mensagem_quando_ausente: str


@dataclass(frozen=True)
class ResultadoRequisito:
    """Resultado da verificacao de um requisito de obrigatoriedade."""

    requisito: RequisitoCategoria
    satisfeito: bool
    codigos_encontrados: tuple[int, ...]


def load_requisitos_obrigatorios(
    db: Session,
    group_id: int,
) -> list[RequisitoCategoria]:
    """
    Carrega categorias com obrigatoriedade ativa para o grupo.

    Retorna lista de RequisitoCategoria para categorias que possuem
    obrigatoriedade.ativo == True no grupo especificado.
    """
    categorias = (
        session_query(db, CategoriaResumoJSON)
        .filter(
            CategoriaResumoJSON.ativo == True,
            CategoriaResumoJSON.group_id == group_id,
            CategoriaResumoJSON.obrigatoriedade.isnot(None),
        )
        .all()
    )

    requisitos: list[RequisitoCategoria] = []
    for cat in categorias:
        config = cat.obrigatoriedade
        if not isinstance(config, dict):
            continue
        if not config.get("ativo", False):
            continue

        tipos_raw = config.get("tipos_peca", [])
        if not isinstance(tipos_raw, list):
            continue

        tipos_normalizados = tuple(
            normalize_piece_type(t) for t in tipos_raw if t
        )
        if not tipos_normalizados:
            continue

        codigos = tuple(
            int(c) for c in (cat.codigos_documento or [])
            if isinstance(c, (int, float, str)) and str(c).strip().isdigit()
        )

        mensagem = config.get(
            "mensagem_quando_ausente",
            f"Documento obrigatorio '{cat.titulo}' nao encontrado nos autos.",
        )

        requisitos.append(
            RequisitoCategoria(
                categoria_id=cat.id,
                categoria_nome=cat.nome,
                codigos_documento=codigos,
                tipos_peca=tipos_normalizados,
                mensagem_quando_ausente=str(mensagem),
            )
        )

    return requisitos


def check_requisitos(
    tipo_peca: str | None,
    group_id: int,
    documentos: Sequence[Any] | None,
    db: Session,
) -> list[dict[str, Any]]:
    """
    Verifica quais categorias obrigatorias estao satisfeitas.

    Retorna lista de dicts com:
    - categoria_id, categoria_nome
    - obrigatorio: True se a categoria se aplica ao tipo_peca
    - satisfeito: True se pelo menos um codigo da categoria esta nos documentos
    - codigos_encontrados: codigos da categoria presentes nos documentos
    - mensagem: mensagem configurada para exibir quando ausente
    """
    if not tipo_peca or not group_id:
        return []

    tipo_normalizado = normalize_piece_type(tipo_peca)
    if not tipo_normalizado:
        return []

    requisitos = load_requisitos_obrigatorios(db, group_id)
    if not requisitos:
        return []

    codigos_processo = set(collect_document_codes(documentos))

    resultados: list[dict[str, Any]] = []
    for req in requisitos:
        # Verifica se o tipo de peca esta na lista de tipos obrigatorios
        if tipo_normalizado not in req.tipos_peca:
            continue

        codigos_encontrados = sorted(
            c for c in req.codigos_documento if c in codigos_processo
        )
        satisfeito = len(codigos_encontrados) > 0

        resultados.append({
            "categoria_id": req.categoria_id,
            "categoria_nome": req.categoria_nome,
            "obrigatorio": True,
            "satisfeito": satisfeito,
            "codigos_encontrados": codigos_encontrados,
            "codigos_esperados": list(req.codigos_documento),
            "mensagem": req.mensagem_quando_ausente if not satisfeito else None,
        })

    return resultados


def has_missing_requisitos(
    tipo_peca: str | None,
    group_id: int,
    documentos: Sequence[Any] | None,
    db: Session,
) -> bool:
    """Retorna True se alguma categoria obrigatoria esta ausente."""
    resultados = check_requisitos(tipo_peca, group_id, documentos, db)
    return any(not r["satisfeito"] for r in resultados)


def tipo_peca_tem_obrigatoriedade(
    tipo_peca: str | None,
    group_id: int,
    db: Session,
) -> bool | None:
    """
    Verifica se alguma categoria tem obrigatoriedade configurada para este tipo_peca + grupo.

    Retorna:
    - True: existe obrigatoriedade configurada que se aplica a este tipo de peca
    - False: existem categorias com obrigatoriedade mas nenhuma se aplica a este tipo
    - None: nenhuma categoria tem obrigatoriedade configurada (fallback para modelo legado)
    """
    if not tipo_peca or not group_id:
        return None

    tipo_normalizado = normalize_piece_type(tipo_peca)
    if not tipo_normalizado:
        return None

    requisitos = load_requisitos_obrigatorios(db, group_id)
    if not requisitos:
        return None

    return any(tipo_normalizado in req.tipos_peca for req in requisitos)
