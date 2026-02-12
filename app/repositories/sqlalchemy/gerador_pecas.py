# -*- coding: utf-8 -*-
"""
Repositórios SQLAlchemy do domínio Gerador de Peças.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.repositories.sqlalchemy.base import BaseRepository
from admin.models_prompt_groups import PromptGroup, PromptSubcategoria, PromptSubgroup
from admin.models_prompts import PromptModulo
from database.connection import get_db
from sistemas.gerador_pecas.models import FeedbackPeca, GeracaoPeca, VersaoPeca
from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON


class GeracaoPecaRepository(BaseRepository[GeracaoPeca]):
    """Repositório para gerações de peças jurídicas."""

    model = GeracaoPeca

    def find_by_user(self, usuario_id: int, limit: int = 50) -> list[GeracaoPeca]:
        return (
            self.query()
            .filter(GeracaoPeca.usuario_id == usuario_id)
            .order_by(GeracaoPeca.criado_em.desc())
            .limit(limit)
            .all()
        )

    def find_by_id_and_user(self, geracao_id: int, usuario_id: int) -> GeracaoPeca | None:
        return (
            self.query()
            .filter(
                GeracaoPeca.id == geracao_id,
                GeracaoPeca.usuario_id == usuario_id,
            )
            .first()
        )

    def find_latest_with_docs(self, numero_cnj: str) -> GeracaoPeca | None:
        return (
            self.query()
            .filter(
                GeracaoPeca.numero_cnj == numero_cnj,
                GeracaoPeca.documentos_processados.isnot(None),
            )
            .order_by(GeracaoPeca.criado_em.desc())
            .first()
        )


class FeedbackPecaRepository(BaseRepository[FeedbackPeca]):
    """Repositório para feedbacks de peças."""

    model = FeedbackPeca

    def find_by_geracao(self, geracao_id: int) -> FeedbackPeca | None:
        return (
            self.query()
            .filter(FeedbackPeca.geracao_id == geracao_id)
            .first()
        )


class VersaoPecaRepository(BaseRepository[VersaoPeca]):
    """Repositório para versões de peças."""

    model = VersaoPeca

    def has_versions(self, geracao_id: int) -> bool:
        return (
            self.query()
            .filter(VersaoPeca.geracao_id == geracao_id)
            .first()
            is not None
        )


class PromptGroupReadRepository(BaseRepository[PromptGroup]):
    """Consultas de leitura de grupos de prompts para o Gerador de Peças."""

    model = PromptGroup

    def list_active_ordered(self) -> list[PromptGroup]:
        return (
            self.query()
            .filter(PromptGroup.active == True)
            .order_by(PromptGroup.order, PromptGroup.name)
            .all()
        )

    def list_active_by_ids(self, group_ids: list[int]) -> list[PromptGroup]:
        if not group_ids:
            return []
        return (
            self.query()
            .filter(
                PromptGroup.active == True,
                PromptGroup.id.in_(group_ids),
            )
            .order_by(PromptGroup.order, PromptGroup.name)
            .all()
        )

    def get_active_by_id(self, group_id: int) -> PromptGroup | None:
        return (
            self.query()
            .filter(
                PromptGroup.id == group_id,
                PromptGroup.active == True,
            )
            .first()
        )


class PromptSubgroupReadRepository(BaseRepository[PromptSubgroup]):
    """Consultas de leitura de subgrupos de prompts."""

    model = PromptSubgroup

    def list_active_by_group(self, group_id: int) -> list[PromptSubgroup]:
        return (
            self.query()
            .filter(
                PromptSubgroup.group_id == group_id,
                PromptSubgroup.active == True,
            )
            .order_by(PromptSubgroup.order, PromptSubgroup.name)
            .all()
        )


class PromptSubcategoriaReadRepository(BaseRepository[PromptSubcategoria]):
    """Consultas de leitura de subcategorias de prompts."""

    model = PromptSubcategoria

    def list_active_by_ids_and_group(
        self,
        subcategoria_ids: list[int],
        group_id: int,
    ) -> list[PromptSubcategoria]:
        if not subcategoria_ids:
            return []
        return (
            self.query()
            .filter(
                PromptSubcategoria.id.in_(subcategoria_ids),
                PromptSubcategoria.group_id == group_id,
                PromptSubcategoria.active == True,
            )
            .all()
        )


class PromptModuloReadRepository(BaseRepository[PromptModulo]):
    """Consultas de leitura de módulos de prompt para fluxos de curadoria."""

    model = PromptModulo

    def list_active_conteudo_by_ids(
        self,
        modulo_ids: list[int],
        group_id: int | None = None,
    ) -> list[PromptModulo]:
        if not modulo_ids:
            return []

        query = self.query().filter(
            PromptModulo.id.in_(modulo_ids),
            PromptModulo.tipo == "conteudo",
            PromptModulo.ativo == True,
        )
        if group_id:
            query = query.filter(PromptModulo.group_id == group_id)

        return query.order_by(PromptModulo.categoria, PromptModulo.ordem).all()


class CategoriaResumoJSONRepository(BaseRepository[CategoriaResumoJSON]):
    """Consultas de leitura de categorias de extração JSON."""

    model = CategoriaResumoJSON

    def list_active(self) -> list[CategoriaResumoJSON]:
        return (
            self.query()
            .filter(CategoriaResumoJSON.ativo == True)
            .all()
        )

    def get_active_by_id(self, categoria_id: int) -> CategoriaResumoJSON | None:
        return (
            self.query()
            .filter(
                CategoriaResumoJSON.id == categoria_id,
                CategoriaResumoJSON.ativo == True,
            )
            .first()
        )


def get_geracao_repo(db: Session = Depends(get_db)) -> GeracaoPecaRepository:
    return GeracaoPecaRepository(db)


def get_feedback_repo(db: Session = Depends(get_db)) -> FeedbackPecaRepository:
    return FeedbackPecaRepository(db)


def get_versao_repo(db: Session = Depends(get_db)) -> VersaoPecaRepository:
    return VersaoPecaRepository(db)


__all__ = [
    "GeracaoPecaRepository",
    "FeedbackPecaRepository",
    "VersaoPecaRepository",
    "PromptGroupReadRepository",
    "PromptSubgroupReadRepository",
    "PromptSubcategoriaReadRepository",
    "PromptModuloReadRepository",
    "CategoriaResumoJSONRepository",
    "get_geracao_repo",
    "get_feedback_repo",
    "get_versao_repo",
]
