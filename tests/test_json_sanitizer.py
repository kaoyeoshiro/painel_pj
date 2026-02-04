# -*- coding: utf-8 -*-
"""
Testes unitários para utils/json_sanitizer.py

Testa a função sanitize_for_json() e sanitize_dataframe_dict()
para garantir que valores NaN, Infinity e tipos NumPy/Pandas
são corretamente convertidos para tipos JSON-compatíveis.
"""

import json
import math
import pytest


def _has_numpy():
    """Verifica se NumPy está disponível."""
    try:
        import numpy
        return True
    except ImportError:
        return False


def _has_pandas():
    """Verifica se Pandas está disponível."""
    try:
        import pandas
        return True
    except ImportError:
        return False


# ==================== Testes Básicos (sem dependências) ====================

class TestSanitizeBasic:
    """Testes básicos da função sanitize_for_json com tipos Python nativos."""

    def test_none_passthrough(self):
        """None deve retornar None."""
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(None) is None

    def test_python_nan_becomes_none(self):
        """float('nan') deve virar None."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(float('nan'))
        assert result is None

    def test_python_positive_inf_becomes_none(self):
        """float('inf') deve virar None."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(float('inf'))
        assert result is None

    def test_python_negative_inf_becomes_none(self):
        """float('-inf') deve virar None."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(float('-inf'))
        assert result is None

    def test_math_nan_becomes_none(self):
        """math.nan deve virar None."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(math.nan)
        assert result is None

    def test_math_inf_becomes_none(self):
        """math.inf deve virar None."""
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(math.inf) is None
        assert sanitize_for_json(-math.inf) is None

    def test_normal_float_preserved(self):
        """Floats normais devem ser preservados."""
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(3.14) == 3.14
        assert sanitize_for_json(0.0) == 0.0
        assert sanitize_for_json(-1.5) == -1.5
        assert sanitize_for_json(1e10) == 1e10

    def test_int_preserved(self):
        """Inteiros devem ser preservados."""
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(42) == 42
        assert sanitize_for_json(0) == 0
        assert sanitize_for_json(-10) == -10
        assert sanitize_for_json(10**18) == 10**18

    def test_bool_preserved(self):
        """Booleanos devem ser preservados."""
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(True) is True
        assert sanitize_for_json(False) is False

    def test_string_preserved(self):
        """Strings devem ser preservadas."""
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json("hello") == "hello"
        assert sanitize_for_json("") == ""
        assert sanitize_for_json("português com acentuação") == "português com acentuação"


class TestSanitizeRecursive:
    """Testes de sanitização recursiva em estruturas compostas."""

    def test_dict_recursive_with_nan(self):
        """Dicionários devem ser sanitizados recursivamente."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json({
            "a": float('nan'),
            "b": 42,
            "c": {"nested": float('inf')}
        })
        assert result == {"a": None, "b": 42, "c": {"nested": None}}

    def test_list_recursive_with_nan(self):
        """Listas devem ser sanitizadas recursivamente."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json([1, float('nan'), 3, float('inf')])
        assert result == [1, None, 3, None]

    def test_tuple_becomes_list(self):
        """Tuplas devem virar listas sanitizadas."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json((1, float('nan'), 3))
        assert result == [1, None, 3]
        assert isinstance(result, list)

    def test_nested_structure(self):
        """Estruturas profundamente aninhadas devem ser sanitizadas."""
        from utils.json_sanitizer import sanitize_for_json
        data = {
            "level1": {
                "level2": {
                    "level3": [1, float('nan'), {"deep": float('inf')}]
                }
            }
        }
        result = sanitize_for_json(data)
        assert result["level1"]["level2"]["level3"] == [1, None, {"deep": None}]

    def test_empty_containers(self):
        """Containers vazios devem ser preservados."""
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json({}) == {}
        assert sanitize_for_json([]) == []
        assert sanitize_for_json(()) == []

    def test_mixed_types_in_list(self):
        """Listas com tipos mistos devem ser sanitizadas corretamente."""
        from utils.json_sanitizer import sanitize_for_json
        data = [1, "two", 3.0, True, None, float('nan'), {"key": float('inf')}]
        result = sanitize_for_json(data)
        assert result == [1, "two", 3.0, True, None, None, {"key": None}]


class TestSanitizeJsonSerializable:
    """Testes de garantia de serialização JSON."""

    def test_result_is_json_serializable(self):
        """Resultado deve ser serializável com json.dumps sem erro."""
        from utils.json_sanitizer import sanitize_for_json

        complex_data = {
            "nan_value": float('nan'),
            "inf_value": float('inf'),
            "neg_inf_value": float('-inf'),
            "list": [1, float('nan'), {"nested_inf": float('-inf')}],
            "normal": 42,
            "string": "text"
        }

        result = sanitize_for_json(complex_data)

        # Não deve lançar exceção
        json_str = json.dumps(result)

        # Verifica que valores NaN/Inf viraram null, não literais JavaScript
        # (literais NaN/Infinity causariam erro em json.dumps ou apareceriam como NaN/Infinity)
        assert ": NaN" not in json_str  # Literal NaN de JavaScript
        assert ": Infinity" not in json_str
        assert ": -Infinity" not in json_str

        # Os valores devem ser null
        parsed = json.loads(json_str)
        assert parsed["nan_value"] is None
        assert parsed["inf_value"] is None
        assert parsed["neg_inf_value"] is None

    def test_nan_key_in_dict(self):
        """Chave NaN em dicionário deve ser convertida para string 'null'."""
        from utils.json_sanitizer import sanitize_for_json

        # Dicionário com NaN como chave
        data = {float('nan'): "value", "normal": 123}
        result = sanitize_for_json(data)

        # Deve ser serializável
        json_str = json.dumps(result)
        assert "null" in json_str


# ==================== Testes NumPy (se disponível) ====================

@pytest.mark.skipif(not _has_numpy(), reason="NumPy não disponível")
class TestSanitizeNumpy:
    """Testes específicos para tipos NumPy."""

    def test_numpy_nan_becomes_none(self):
        """np.nan deve virar None."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(np.nan) is None

    def test_numpy_inf_becomes_none(self):
        """np.inf deve virar None."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(np.inf) is None
        assert sanitize_for_json(-np.inf) is None

    def test_numpy_int64_becomes_int(self):
        """np.int64 deve virar int Python."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(np.int64(42))
        assert result == 42
        assert isinstance(result, int)
        assert type(result).__name__ == 'int'

    def test_numpy_int32_becomes_int(self):
        """np.int32 deve virar int Python."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(np.int32(100))
        assert result == 100
        assert isinstance(result, int)

    def test_numpy_float64_becomes_float(self):
        """np.float64 deve virar float Python."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(np.float64(3.14))
        assert result == 3.14
        assert isinstance(result, float)

    def test_numpy_float64_nan_becomes_none(self):
        """np.float64 com NaN deve virar None."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(np.float64('nan'))
        assert result is None

    def test_numpy_bool_becomes_bool(self):
        """np.bool_ deve virar bool Python."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(np.bool_(True)) is True
        assert sanitize_for_json(np.bool_(False)) is False
        assert type(sanitize_for_json(np.bool_(True))).__name__ == 'bool'

    def test_numpy_array_becomes_list(self):
        """np.ndarray deve virar lista."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(np.array([1, 2, 3]))
        assert result == [1, 2, 3]
        assert isinstance(result, list)

    def test_numpy_array_with_nan(self):
        """np.ndarray com NaN deve ter NaN convertido para None."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(np.array([1.0, np.nan, 3.0]))
        assert result == [1.0, None, 3.0]

    def test_numpy_2d_array(self):
        """np.ndarray 2D deve virar lista de listas."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json
        arr = np.array([[1, 2], [3, 4]])
        result = sanitize_for_json(arr)
        assert result == [[1, 2], [3, 4]]

    def test_numpy_types_in_dict(self):
        """Dicionário com tipos NumPy deve ser completamente sanitizado."""
        import numpy as np
        from utils.json_sanitizer import sanitize_for_json

        data = {
            "int64": np.int64(100),
            "float64": np.float64(3.14),
            "array": np.array([1, 2, 3]),
            "nan": np.nan,
            "bool": np.bool_(True)
        }
        result = sanitize_for_json(data)

        # Tudo deve ser tipo Python nativo
        assert isinstance(result["int64"], int)
        assert isinstance(result["float64"], float)
        assert isinstance(result["array"], list)
        assert result["nan"] is None
        assert isinstance(result["bool"], bool)

        # Deve ser serializável
        json.dumps(result)


# ==================== Testes Pandas (se disponível) ====================

@pytest.mark.skipif(not _has_pandas(), reason="Pandas não disponível")
class TestSanitizePandas:
    """Testes específicos para tipos Pandas."""

    def test_pandas_na_becomes_none(self):
        """pd.NA deve virar None."""
        import pandas as pd
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(pd.NA) is None

    def test_pandas_nat_becomes_none(self):
        """pd.NaT deve virar None."""
        import pandas as pd
        from utils.json_sanitizer import sanitize_for_json
        assert sanitize_for_json(pd.NaT) is None

    def test_pandas_timestamp_becomes_iso_string(self):
        """pd.Timestamp deve virar string ISO."""
        import pandas as pd
        from utils.json_sanitizer import sanitize_for_json
        ts = pd.Timestamp("2024-01-15 10:30:00")
        result = sanitize_for_json(ts)
        assert isinstance(result, str)
        assert "2024-01-15" in result
        assert "10:30" in result

    def test_pandas_timestamp_with_timezone(self):
        """pd.Timestamp com timezone deve incluir info de timezone."""
        import pandas as pd
        from utils.json_sanitizer import sanitize_for_json
        ts = pd.Timestamp("2024-01-15 10:30:00", tz="UTC")
        result = sanitize_for_json(ts)
        assert isinstance(result, str)
        assert "2024-01-15" in result


@pytest.mark.skipif(not _has_pandas(), reason="Pandas não disponível")
class TestSanitizeDataframeDict:
    """Testes da função sanitize_dataframe_dict."""

    def test_dataframe_to_dict_records(self):
        """Testa sanitização de df.to_dict(orient='records')."""
        import pandas as pd
        import numpy as np
        from utils.json_sanitizer import sanitize_dataframe_dict

        df = pd.DataFrame({
            "a": [1, np.nan, 3],
            "b": [np.inf, 2.5, -np.inf]
        })

        result = sanitize_dataframe_dict(df.to_dict(orient='records'))

        assert result == [
            {"a": 1.0, "b": None},
            {"a": None, "b": 2.5},
            {"a": 3.0, "b": None}
        ]

        # Deve ser serializável
        json.dumps(result)

    def test_dataframe_to_dict_default(self):
        """Testa sanitização de df.to_dict() (orient='dict')."""
        import pandas as pd
        import numpy as np
        from utils.json_sanitizer import sanitize_dataframe_dict

        df = pd.DataFrame({
            "col1": [1, np.nan],
            "col2": [np.inf, 2]
        })

        result = sanitize_dataframe_dict(df.to_dict())

        # to_dict() com orient='dict' retorna {col: {index: value}}
        # Os índices são inteiros que viram strings após sanitização
        assert result["col1"]["1"] is None or result["col1"][1] is None  # NaN -> None
        assert result["col2"]["0"] is None or result["col2"][0] is None  # Inf -> None

        # Deve ser serializável
        json.dumps(result)

    def test_value_counts_dict(self):
        """Testa sanitização de Series.value_counts().to_dict()."""
        import pandas as pd
        from utils.json_sanitizer import sanitize_for_json

        s = pd.Series(["A", "B", "A", "A", "B"])
        result = sanitize_for_json(s.value_counts().to_dict())

        # Valores devem ser int Python (não np.int64)
        assert result == {"A": 3, "B": 2}
        for v in result.values():
            assert isinstance(v, int)
            assert type(v).__name__ == 'int'

        # Deve ser serializável
        json.dumps(result)

    def test_dataframe_with_mixed_types(self):
        """Testa DataFrame com colunas de tipos mistos."""
        import pandas as pd
        import numpy as np
        from utils.json_sanitizer import sanitize_dataframe_dict

        df = pd.DataFrame({
            "int_col": [1, 2, 3],
            "float_col": [1.1, np.nan, 3.3],
            "str_col": ["a", "b", "c"],
            "bool_col": [True, False, True],
            "date_col": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"])
        })

        result = sanitize_dataframe_dict(df.to_dict(orient='records'))

        # Verifica tipos
        assert result[1]["float_col"] is None  # Era NaN
        assert isinstance(result[0]["date_col"], str)  # Timestamp virou string

        # Deve ser serializável
        json_str = json.dumps(result)
        assert "NaN" not in json_str


# ==================== Testes de Edge Cases ====================

class TestSanitizeEdgeCases:
    """Testes de casos extremos e edge cases."""

    def test_very_large_int(self):
        """Inteiros muito grandes devem ser preservados."""
        from utils.json_sanitizer import sanitize_for_json
        large_int = 10**100
        result = sanitize_for_json(large_int)
        assert result == large_int

    def test_very_small_float(self):
        """Floats muito pequenos (mas não zero) devem ser preservados."""
        from utils.json_sanitizer import sanitize_for_json
        small_float = 1e-300
        result = sanitize_for_json(small_float)
        assert result == small_float

    def test_negative_zero(self):
        """Zero negativo deve ser preservado como 0.0."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(-0.0)
        assert result == 0.0

    def test_custom_object_becomes_string(self):
        """Objetos personalizados devem virar string."""
        from utils.json_sanitizer import sanitize_for_json

        class CustomClass:
            def __str__(self):
                return "custom_value"

        result = sanitize_for_json(CustomClass())
        assert result == "custom_value"

    def test_bytes_becomes_string(self):
        """Bytes devem virar string."""
        from utils.json_sanitizer import sanitize_for_json
        result = sanitize_for_json(b"hello")
        assert isinstance(result, str)
