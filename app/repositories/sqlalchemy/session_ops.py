"""
Operacoes SQLAlchemy encapsuladas para uso em camadas de aplicacao.

Permite remover chamadas diretas `db.query(...)` de routers legados
durante a migracao incremental para repositories dedicados.
"""

from sqlalchemy.orm import Session


def session_query(db: Session, *entities):
    """Wrapper fino para Session.query."""
    return db.query(*entities)


__all__ = ["session_query"]
