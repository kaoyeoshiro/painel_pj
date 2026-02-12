"""
Dependências compartilhadas da API v1.
"""

from .auth import (
    get_current_active_user,
    get_current_user,
    get_current_user_from_token_or_query,
    require_admin,
)

__all__ = [
    "get_current_user",
    "get_current_active_user",
    "get_current_user_from_token_or_query",
    "require_admin",
]

