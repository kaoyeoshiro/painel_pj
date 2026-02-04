# -*- coding: utf-8 -*-
"""
Sanitizador de valores para serialização JSON segura.

Converte valores especiais (NaN, Inf, tipos NumPy/Pandas) para tipos
Python nativos compatíveis com JSON.

USO:
    from utils.json_sanitizer import sanitize_for_json, sanitize_dataframe_dict

    # Sanitiza dicionário com valores problemáticos
    safe_dict = sanitize_for_json({"value": np.nan, "count": np.int64(10)})

    # Sanitiza resultado de DataFrame.to_dict()
    safe_records = sanitize_dataframe_dict(df.to_dict(orient='records'))

    # Ambos podem ser serializados com json.dumps sem erro
    json.dumps(safe_dict)

Autor: LAB/PGE-MS
Data: 2026-02
"""

import math
from typing import Any, Dict, List, Union

# Type alias para valores compatíveis com JSON
JsonValue = Union[None, bool, int, float, str, Dict, List]


def sanitize_for_json(value: Any) -> JsonValue:
    """
    Sanitiza um valor para ser compatível com JSON.

    Conversões realizadas:
    - np.nan, pd.NA, math.nan, float('nan') -> None
    - np.inf, -np.inf, float('inf'), float('-inf') -> None
    - np.int64, np.int32, np.int16, np.int8 -> int
    - np.float64, np.float32, np.float16 -> float (ou None se NaN/Inf)
    - np.bool_ -> bool
    - np.ndarray -> list (valores sanitizados recursivamente)
    - pd.Timestamp -> string ISO 8601
    - pd.NaT -> None
    - dict -> dict (chaves e valores sanitizados recursivamente)
    - list/tuple -> list (valores sanitizados recursivamente)
    - Outros tipos -> tentativa de conversão para string

    Args:
        value: Qualquer valor Python/NumPy/Pandas

    Returns:
        Valor compatível com JSON (None, bool, int, float, str, dict, list)

    Examples:
        >>> sanitize_for_json(np.nan)
        None
        >>> sanitize_for_json(float('inf'))
        None
        >>> sanitize_for_json(np.int64(42))
        42
        >>> sanitize_for_json({"a": np.nan, "b": [1, np.inf]})
        {"a": None, "b": [1, None]}
    """
    # Lazy imports para evitar dependência obrigatória
    np = _get_numpy()
    pd = _get_pandas()

    # None já é compatível com JSON
    if value is None:
        return None

    # Verifica NaN e Infinity para floats Python nativos primeiro
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value

    # Verifica pd.NA e pd.NaT (Pandas)
    if pd is not None:
        try:
            if pd.isna(value):
                return None
        except (TypeError, ValueError):
            # pd.isna pode falhar para alguns tipos
            pass

    # Tipos NumPy
    if np is not None:
        # Inteiros NumPy -> int Python
        if isinstance(value, np.integer):
            return int(value)

        # Floats NumPy -> float Python (com verificação de NaN/Inf)
        if isinstance(value, np.floating):
            float_val = float(value)
            if math.isnan(float_val) or math.isinf(float_val):
                return None
            return float_val

        # Booleano NumPy -> bool Python
        if isinstance(value, np.bool_):
            return bool(value)

        # Array NumPy -> lista Python (recursivo)
        if isinstance(value, np.ndarray):
            return [sanitize_for_json(item) for item in value.tolist()]

    # Timestamp Pandas -> string ISO 8601
    if pd is not None:
        try:
            if isinstance(value, pd.Timestamp):
                if pd.isna(value):
                    return None
                return value.isoformat()
        except Exception:
            pass

    # Tipos primitivos Python (int, bool, str) são seguros
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        return value

    # Dicionário -> sanitiza chaves e valores recursivamente
    if isinstance(value, dict):
        return {
            _sanitize_key(k): sanitize_for_json(v)
            for k, v in value.items()
        }

    # Lista ou tupla -> sanitiza valores recursivamente
    if isinstance(value, (list, tuple)):
        return [sanitize_for_json(item) for item in value]

    # Outros tipos -> tenta converter para string
    try:
        return str(value)
    except Exception:
        return None


def _sanitize_key(key: Any) -> str:
    """
    Sanitiza uma chave de dicionário para JSON.

    JSON só aceita strings como chaves, então converte qualquer
    tipo para string, tratando NaN especialmente.

    Args:
        key: Chave original (pode ser qualquer tipo)

    Returns:
        String segura para uso como chave JSON
    """
    np = _get_numpy()

    # Verifica se é NaN (float ou numpy)
    if isinstance(key, float) and math.isnan(key):
        return "null"
    if np is not None and isinstance(key, np.floating) and np.isnan(key):
        return "null"

    # Converte para string
    return str(key)


def sanitize_dataframe_dict(df_dict: Union[Dict, List[Dict]]) -> Union[Dict, List[Dict]]:
    """
    Sanitiza resultado de DataFrame.to_dict().

    Wrapper conveniente para uso após to_dict() em DataFrames pandas.
    Funciona com qualquer orientação (records, dict, list, etc.).

    Args:
        df_dict: Resultado de df.to_dict() ou df.to_dict(orient='records')

    Returns:
        Dicionário ou lista de dicionários sanitizados

    Example:
        >>> df = pd.DataFrame({"a": [1, np.nan], "b": [np.inf, 3]})
        >>> result = sanitize_dataframe_dict(df.to_dict(orient='records'))
        >>> result
        [{"a": 1.0, "b": None}, {"a": None, "b": 3.0}]

        >>> # Pode ser serializado com json.dumps
        >>> import json
        >>> json.dumps(result)  # Não lança exceção
    """
    return sanitize_for_json(df_dict)


# Cache para imports opcionais
_numpy_cache = None
_pandas_cache = None
_numpy_checked = False
_pandas_checked = False


def _get_numpy():
    """Retorna módulo numpy se disponível, None caso contrário."""
    global _numpy_cache, _numpy_checked
    if not _numpy_checked:
        try:
            import numpy
            _numpy_cache = numpy
        except ImportError:
            _numpy_cache = None
        _numpy_checked = True
    return _numpy_cache


def _get_pandas():
    """Retorna módulo pandas se disponível, None caso contrário."""
    global _pandas_cache, _pandas_checked
    if not _pandas_checked:
        try:
            import pandas
            _pandas_cache = pandas
        except ImportError:
            _pandas_cache = None
        _pandas_checked = True
    return _pandas_cache


__all__ = [
    "sanitize_for_json",
    "sanitize_dataframe_dict",
]
