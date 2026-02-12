"""
Registro de rotas legadas temporárias.

No estado atual, as rotas legadas de template/static ainda vivem em `main.py`.
Este módulo existe para fixar o boundary e permitir migração incremental.
"""


def register_legacy_routers(app):
    """
    Placeholder para inclusão de routers legados.

    Atualmente não registra nada para manter comportamento idêntico
    ao estado anterior (rotas legadas seguem em `main.py`).
    """
    return app

