# -*- coding: utf-8 -*-
"""
Repositorio base generico para acesso a dados.

Fornece operacoes CRUD padrao via SQLAlchemy.
Sistemas devem criar repositorios especificos herdando desta base.

Uso:
    class GeracaoPecaRepository(BaseRepository[GeracaoPeca]):
        model = GeracaoPeca

        def find_by_user(self, usuario_id: int) -> list[GeracaoPeca]:
            return self.query().filter(
                GeracaoPeca.usuario_id == usuario_id
            ).all()
"""

import logging
from typing import TypeVar, Generic, Type

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """
    Repositorio base com operacoes CRUD genericas.

    Subclasses DEVEM definir o atributo `model` com o tipo do modelo SQLAlchemy.
    Todas as operacoes usam a mesma sessao injetada via construtor (Unit of Work).
    """

    model: Type[T]

    def __init__(self, db: Session):
        self.db = db

    def query(self):
        """Retorna query builder para o modelo."""
        return self.db.query(self.model)

    def get_by_id(self, id: int) -> T | None:
        """Busca entidade por ID primario."""
        return self.query().filter(self.model.id == id).first()

    def add(self, entity: T) -> T:
        """Adiciona entidade a sessao (nao persiste ate commit)."""
        self.db.add(entity)
        return entity

    def delete(self, entity: T) -> None:
        """Marca entidade para exclusao (efetiva no commit)."""
        self.db.delete(entity)

    def commit(self) -> None:
        """Persiste todas as alteracoes pendentes."""
        self.db.commit()

    def flush(self) -> None:
        """Envia alteracoes ao banco sem commit (para obter IDs gerados)."""
        self.db.flush()

    def refresh(self, entity: T) -> None:
        """Recarrega entidade do banco apos commit/flush."""
        self.db.refresh(entity)

    def rollback(self) -> None:
        """Desfaz alteracoes nao commitadas."""
        self.db.rollback()
