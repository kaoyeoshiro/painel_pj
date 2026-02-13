"""
Compat layer de configuração.
"""

import os

from config import DATABASE_URL, IS_PRODUCTION

ENV = os.getenv("ENV", "development")

__all__ = ["DATABASE_URL", "ENV", "IS_PRODUCTION"]
