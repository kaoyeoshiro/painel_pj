"""
Glue para inicialização de banco/migrations no namespace novo.
"""

from database.init_db import init_database

__all__ = ["init_database"]

