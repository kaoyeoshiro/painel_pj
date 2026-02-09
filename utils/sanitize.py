# -*- coding: utf-8 -*-
"""
Funcoes de sanitizacao para prevencao de XSS persistente.

SECURITY: Campos de texto livre (full_name, setor) podem conter payloads
XSS que sao persistidos no banco e renderizados no frontend legado
(Jinja2 sem escape adequado). Este modulo:
1. Detecta e rejeita payloads HTML/JS perigosos
2. Remove tags HTML de campos que nao devem conter markup

Uso:
    from utils.sanitize import validate_no_html, sanitize_user_field

    # Em Pydantic validators:
    @field_validator('full_name')
    @classmethod
    def validate_name(cls, v):
        return validate_no_html(v, "Nome completo")
"""

import re
import logging

logger = logging.getLogger(__name__)

# Padroes perigosos que indicam tentativa de XSS
_DANGEROUS_PATTERNS = [
    re.compile(r"<\s*script", re.IGNORECASE),
    re.compile(r"<\s*iframe", re.IGNORECASE),
    re.compile(r"<\s*object", re.IGNORECASE),
    re.compile(r"<\s*embed", re.IGNORECASE),
    re.compile(r"<\s*svg\b.*?on\w+\s*=", re.IGNORECASE | re.DOTALL),
    re.compile(r"on\w+\s*=\s*[\"']", re.IGNORECASE),  # onerror=, onclick=, etc
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"data\s*:\s*text/html", re.IGNORECASE),
    re.compile(r"expression\s*\(", re.IGNORECASE),  # CSS expression()
    re.compile(r"url\s*\(\s*[\"']?\s*javascript:", re.IGNORECASE),
]

# Regex para detectar qualquer tag HTML
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")


def validate_no_html(value: str, field_name: str = "campo") -> str:
    """
    Valida que o valor nao contem HTML/scripts perigosos.

    Rejeita com ValueError se encontrar payloads XSS.
    Remove tags HTML benignas (ex: <b>, <i>) silenciosamente.

    Args:
        value: Valor a validar
        field_name: Nome do campo para mensagem de erro

    Returns:
        Valor sanitizado (sem tags HTML)

    Raises:
        ValueError: Se payloads XSS perigosos forem detectados
    """
    if not value:
        return value

    # Verifica padroes perigosos primeiro
    for pattern in _DANGEROUS_PATTERNS:
        if pattern.search(value):
            logger.warning(
                "SECURITY: Payload XSS detectado em %s: %s",
                field_name,
                value[:100],
            )
            raise ValueError(
                f"O campo '{field_name}' contém conteúdo não permitido (HTML/scripts)."
            )

    # Remove tags HTML benignas
    cleaned = _HTML_TAG_PATTERN.sub("", value).strip()

    if cleaned != value.strip():
        logger.info(
            "Sanitizacao: tags HTML removidas de %s (original: %s, limpo: %s)",
            field_name,
            value[:50],
            cleaned[:50],
        )

    return cleaned


def sanitize_user_field(value: str | None, field_name: str = "campo") -> str | None:
    """
    Wrapper de sanitizacao que aceita None.

    Util para campos opcionais como setor.

    Args:
        value: Valor a sanitizar (pode ser None)
        field_name: Nome do campo para mensagem de erro

    Returns:
        Valor sanitizado ou None
    """
    if value is None:
        return None

    return validate_no_html(value, field_name)
