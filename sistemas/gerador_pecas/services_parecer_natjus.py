"""
Servicos de configuracao e validacao do parecer NATJus.

Fonte de verdade:
- ConfiguracaoIA.sistema = "gerador_pecas"
- chave = "parecer_required_for_piece_types"
- chave = "parecer_document_codes"
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Sequence
from sqlalchemy import or_

from admin.models import ConfiguracaoIA
from services.config_cache import config_cache

logger = logging.getLogger(__name__)

CONFIG_KEY_REQUIRED_PIECE_TYPES = "parecer_required_for_piece_types"
CONFIG_KEY_DOCUMENT_CODES = "parecer_document_codes"


@dataclass(frozen=True)
class ParecerNatjusConfig:
    required_piece_types: tuple[str, ...]
    document_codes: tuple[int, ...]
    required_piece_types_raw: Any = None
    document_codes_raw: Any = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "parecer_required_for_piece_types": list(self.required_piece_types),
            "parecer_document_codes": list(self.document_codes),
        }


def _coerce_to_list(raw_value: Any) -> List[Any]:
    if raw_value is None:
        return []

    if isinstance(raw_value, list):
        return raw_value

    if isinstance(raw_value, (tuple, set)):
        return list(raw_value)

    if isinstance(raw_value, str):
        value = raw_value.strip()
        if not value:
            return []

        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

        if "," in value:
            return [item.strip() for item in value.split(",") if item.strip()]

        return [value]

    return []


def normalize_piece_type(value: Any) -> str:
    """
    Normaliza tipo de peça para comparação robusta.

    Regras:
    - case-insensitive
    - remove acentos/diacríticos
    - substitui separadores por "_"
    - remove caracteres não alfanuméricos
    """
    text = str(value or "").strip().lower()
    if not text:
        return ""

    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def _parse_piece_types(raw_value: Any) -> List[str]:
    parsed: List[str] = []
    for item in _coerce_to_list(raw_value):
        normalized = normalize_piece_type(item)
        if normalized and normalized not in parsed:
            parsed.append(normalized)
    return parsed


def _parse_document_codes(raw_value: Any) -> List[int]:
    parsed_codes: List[int] = []
    for item in _coerce_to_list(raw_value):
        try:
            code = int(str(item).strip())
        except (ValueError, TypeError):
            continue
        if code not in parsed_codes:
            parsed_codes.append(code)
    return sorted(parsed_codes)


def _load_raw_config_value(db, key: str, use_cache: bool = True) -> Any:
    if use_cache:
        return config_cache.get_config("gerador_pecas", key, db, default="[]")

    config = (
        db.query(ConfiguracaoIA)
        .filter(
            ConfiguracaoIA.sistema == "gerador_pecas",
            ConfiguracaoIA.chave == key,
        )
        .first()
    )
    return config.valor if config else "[]"


def _load_fallback_from_tipo_peca_categorias(db) -> tuple[List[str], List[int]]:
    """
    Fallback legado:
    deriva configuracao de parecer a partir do mapeamento TipoPeca <-> CategoriaDocumento.

    Regras:
    - categoria de parecer: nome/titulo contendo 'parecer' ou 'nat'
    - tipos exigentes: tipos de peça vinculados a essa(s) categoria(s)
    - codigos validos: união dos codigos_documento da(s) categoria(s) de parecer
    """
    try:
        from sistemas.gerador_pecas.models_config_pecas import (
            CategoriaDocumento,
            TipoPeca,
            tipo_peca_categorias,
        )
    except Exception as exc:
        logger.warning(
            "[PARECER-NATJUS] Falha ao importar modelos de fallback: %s",
            exc,
        )
        return [], []

    categorias_parecer = (
        db.query(CategoriaDocumento)
        .filter(CategoriaDocumento.ativo == True)
        .filter(
            or_(
                CategoriaDocumento.nome.ilike("%parecer%"),
                CategoriaDocumento.titulo.ilike("%parecer%"),
                CategoriaDocumento.nome.ilike("%nat%"),
                CategoriaDocumento.titulo.ilike("%nat%"),
            )
        )
        .all()
    )

    if not categorias_parecer:
        return [], []

    codigos: List[int] = []
    categoria_ids = []
    for categoria in categorias_parecer:
        categoria_ids.append(categoria.id)
        for code in _parse_document_codes(categoria.codigos_documento):
            if code not in codigos:
                codigos.append(code)

    tipos = (
        db.query(TipoPeca)
        .join(
            tipo_peca_categorias,
            tipo_peca_categorias.c.tipo_peca_id == TipoPeca.id,
        )
        .filter(
            TipoPeca.ativo == True,
            tipo_peca_categorias.c.categoria_documento_id.in_(categoria_ids),
        )
        .all()
    )

    required_types: List[str] = []
    for tipo in tipos:
        normalized = normalize_piece_type(tipo.nome)
        if normalized and normalized not in required_types:
            required_types.append(normalized)

    return sorted(required_types), sorted(codigos)


def load_parecer_natjus_config(db, use_cache: bool = True) -> ParecerNatjusConfig:
    required_raw = _load_raw_config_value(db, CONFIG_KEY_REQUIRED_PIECE_TYPES, use_cache=use_cache)
    codes_raw = _load_raw_config_value(db, CONFIG_KEY_DOCUMENT_CODES, use_cache=use_cache)

    required_piece_types = _parse_piece_types(required_raw)
    document_codes = _parse_document_codes(codes_raw)

    # Proteção contra cache stale: se ambos vierem vazios via cache, refaz leitura direta do banco.
    if use_cache and not required_piece_types and not document_codes:
        required_raw_db = _load_raw_config_value(db, CONFIG_KEY_REQUIRED_PIECE_TYPES, use_cache=False)
        codes_raw_db = _load_raw_config_value(db, CONFIG_KEY_DOCUMENT_CODES, use_cache=False)
        required_piece_types_db = _parse_piece_types(required_raw_db)
        document_codes_db = _parse_document_codes(codes_raw_db)

        if required_piece_types_db or document_codes_db:
            logger.warning(
                "[PARECER-NATJUS] Cache stale detectado. Recarregando config de parecer NATJus direto do banco."
            )
            required_raw = required_raw_db
            codes_raw = codes_raw_db
            required_piece_types = required_piece_types_db
            document_codes = document_codes_db

            cache_key_required = f"config:gerador_pecas:{CONFIG_KEY_REQUIRED_PIECE_TYPES}"
            cache_key_codes = f"config:gerador_pecas:{CONFIG_KEY_DOCUMENT_CODES}"
            config_cache.invalidate(cache_key_required)
            config_cache.invalidate(cache_key_codes)
            config_cache.set(cache_key_required, required_raw, ttl=config_cache.CONFIG_TTL)
            config_cache.set(cache_key_codes, codes_raw, ttl=config_cache.CONFIG_TTL)

    # Compatibilidade: se parecer_* nao foi configurado em ConfiguracaoIA,
    # deriva dos vínculos de tipos/categorias no admin para evitar falso-negativo.
    if not required_piece_types and not document_codes:
        fallback_required, fallback_codes = _load_fallback_from_tipo_peca_categorias(db)
        if fallback_required or fallback_codes:
            logger.warning(
                "[PARECER-NATJUS] Config parecer_* ausente em configuracoes_ia; "
                "usando fallback derivado de tipo_peca_categorias."
            )
            required_piece_types = fallback_required
            document_codes = fallback_codes

    return ParecerNatjusConfig(
        required_piece_types=tuple(required_piece_types),
        document_codes=tuple(document_codes),
        required_piece_types_raw=required_raw,
        document_codes_raw=codes_raw,
    )


def piece_requires_parecer(tipo_peca: str | None, config: ParecerNatjusConfig) -> bool:
    if not tipo_peca:
        return False
    required_piece_types = {
        normalize_piece_type(item) for item in (config.required_piece_types or []) if item
    }
    return normalize_piece_type(tipo_peca) in required_piece_types


def collect_document_codes(documentos: Sequence[Any] | None) -> List[int]:
    codes: List[int] = []
    if not documentos:
        return codes

    for doc in documentos:
        raw_code = None
        if isinstance(doc, dict):
            raw_code = doc.get("tipo_documento")
        else:
            raw_code = getattr(doc, "tipo_documento", None)

        if raw_code in (None, ""):
            continue

        try:
            code = int(str(raw_code).strip())
        except (ValueError, TypeError):
            continue

        if code not in codes:
            codes.append(code)

    return sorted(codes)


def find_matching_document_codes(documentos: Sequence[Any] | None, valid_codes: Iterable[int]) -> List[int]:
    available_codes = set(collect_document_codes(documentos))
    return sorted(code for code in set(valid_codes) if code in available_codes)


def evaluate_parecer_status(
    tipo_peca: str | None,
    documentos: Sequence[Any] | None,
    config: ParecerNatjusConfig,
    has_user_upload: bool = False,
) -> Dict[str, Any]:
    required = piece_requires_parecer(tipo_peca, config)
    matched_codes = find_matching_document_codes(documentos, config.document_codes)

    config_error = required and len(config.document_codes) == 0
    config_error_message = None
    if config_error:
        config_error_message = (
            "Configuracao invalida: a peca exige parecer NATJus, mas "
            "'parecer_document_codes' esta vazio em /api/gerador-pecas/config/admin."
        )

    if has_user_upload:
        source = "user_upload"
    elif matched_codes:
        source = "process_docs"
    else:
        source = "none"

    found = source != "none"

    return {
        "parecer_required": required,
        "parecer_found": found,
        "parecer_source": source,
        "matched_document_codes": matched_codes,
        "parecer_document_codes": list(config.document_codes),
        "parecer_required_for_piece_types": list(config.required_piece_types),
        "config_error": config_error,
        "config_error_message": config_error_message,
    }


def build_parecer_audit_payload(
    status: Dict[str, Any],
    user_choice_when_missing: str | None = None,
    mode_forced_to_semi_auto: bool = False,
) -> Dict[str, Any]:
    return {
        "parecer_required": bool(status.get("parecer_required")),
        "parecer_found": bool(status.get("parecer_found")),
        "parecer_source": status.get("parecer_source") or "none",
        "user_choice_when_missing": user_choice_when_missing,
        "mode_forced_to_semi_auto": bool(mode_forced_to_semi_auto),
    }
