# -*- coding: utf-8 -*-
"""
Testes de integração para verificar que NaN não causa erros de JSON
no sistema BERT Training.

Estes testes validam que as funções de serviço do BERT Training
corretamente sanitizam valores NaN, Infinity e tipos NumPy antes
de retornar dados para serialização JSON.
"""

import json
import pytest
import pandas as pd
import numpy as np
import tempfile
from pathlib import Path


class TestBertTrainingNaNHandling:
    """Testes de integração para handling de NaN no BERT Training."""

    def test_extract_metadata_with_nan_in_text(self, tmp_path):
        """
        Testa que extract_dataset_metadata funciona com NaN nos dados de texto.

        O DataFrame tem NaN intencionais que devem ser removidos pelo dropna,
        e o resultado deve ser serializável em JSON.
        """
        from sistemas.bert_training.services import extract_dataset_metadata
        from sistemas.bert_training.schemas import TaskTypeEnum

        # Cria DataFrame com NaN intencionais
        df = pd.DataFrame({
            'texto': ['texto1', np.nan, 'texto3', 'texto4', None] * 20,
            'label': ['A', 'B', 'A', np.nan, 'B'] * 20
        })

        excel_path = tmp_path / "dataset_with_nan.xlsx"
        df.to_excel(excel_path, index=False)

        metadata = extract_dataset_metadata(
            file_path=excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='texto',
            label_column='label'
        )

        # Deve conseguir serializar sem erro
        json_str = json.dumps(metadata)

        # Não deve conter "NaN" como valor literal (pode aparecer em chaves, mas não como valor)
        parsed = json.loads(json_str)

        # Verifica que label_distribution tem valores válidos
        assert "label_distribution" in parsed
        for key, value in parsed["label_distribution"].items():
            assert value is None or isinstance(value, (int, float))
            if isinstance(value, float):
                assert not (value != value)  # NaN check (NaN != NaN é True)

    def test_extract_metadata_with_numeric_labels(self, tmp_path):
        """
        Testa que labels numéricas são corretamente convertidas para int Python.

        np.int64 deve virar int Python nativo para evitar problemas de serialização.
        """
        from sistemas.bert_training.services import extract_dataset_metadata
        from sistemas.bert_training.schemas import TaskTypeEnum

        df = pd.DataFrame({
            'texto': ['texto'] * 100,
            'label': [0, 1, 2, 0, 1] * 20  # Labels numéricas
        })

        excel_path = tmp_path / "numeric_labels.xlsx"
        df.to_excel(excel_path, index=False)

        metadata = extract_dataset_metadata(
            file_path=excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='texto',
            label_column='label'
        )

        # Verifica que os valores são int Python (não np.int64)
        for key, value in metadata['label_distribution'].items():
            assert isinstance(value, int), f"Value {value} should be int, got {type(value)}"
            # Verifica que é realmente int nativo, não np.int64
            assert type(value).__name__ == 'int', f"Expected native int, got {type(value).__name__}"

        # Deve serializar sem problemas
        json.dumps(metadata)

    def test_validate_excel_with_mixed_nan(self, tmp_path):
        """
        Testa validação de Excel com vários tipos de NaN/None.

        O sample_data retornado deve ser JSON-serializável.
        """
        from sistemas.bert_training.services import validate_excel_file
        from sistemas.bert_training.schemas import TaskTypeEnum

        df = pd.DataFrame({
            'texto': ['t1', 't2', np.nan, 't4', None, 't6'] * 20,
            'label': ['A', 'B', 'A', np.nan, 'B', 'A'] * 20
        })

        excel_path = tmp_path / "mixed_nan.xlsx"
        df.to_excel(excel_path, index=False)

        result = validate_excel_file(
            file_path=excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='texto',
            label_column='label'
        )

        # Converte para dict para verificar serialização
        result_dict = result.model_dump()

        # Deve conseguir serializar
        json_str = json.dumps(result_dict)

        # Verifica que não há literais NaN
        assert ": NaN" not in json_str  # NaN literal de JavaScript

    def test_analyze_quality_with_imbalanced_classes(self, tmp_path):
        """
        Testa analyze_dataset_quality com classes muito desbalanceadas.

        O imbalance_ratio não deve ser Infinity no JSON.
        """
        from sistemas.bert_training.services import analyze_dataset_quality

        # Cria DataFrame com classe muito rara (pode gerar inf no ratio)
        df = pd.DataFrame({
            'texto': ['texto'] * 100,
            'label': ['A'] * 99 + ['B'] * 1  # Ratio 99:1
        })

        result = analyze_dataset_quality(df, 'texto', 'label')

        # Deve conseguir serializar sem erro
        json_str = json.dumps(result)

        # Não deve conter "Infinity"
        assert "Infinity" not in json_str
        assert ": inf" not in json_str.lower()

    def test_analyze_quality_with_zero_count_class(self):
        """
        Testa analyze_dataset_quality quando min_count poderia ser zero.

        Isso poderia causar divisão por zero e gerar Infinity.
        """
        from sistemas.bert_training.services import analyze_dataset_quality

        # Cria DataFrame com classes
        df = pd.DataFrame({
            'texto': ['texto'] * 50,
            'label': ['A'] * 25 + ['B'] * 25
        })

        result = analyze_dataset_quality(df, 'texto', 'label')

        # Deve conseguir serializar
        json_str = json.dumps(result)

        # Verifica estrutura
        parsed = json.loads(json_str)
        assert "label_distribution" in parsed
        assert "warnings" in parsed

    def test_analyze_quality_label_distribution_types(self):
        """
        Verifica que label_distribution retorna tipos Python nativos.
        """
        from sistemas.bert_training.services import analyze_dataset_quality

        df = pd.DataFrame({
            'texto': ['texto'] * 100,
            'label': ['Cat_A', 'Cat_B', 'Cat_C'] * 33 + ['Cat_A']
        })

        result = analyze_dataset_quality(df, 'texto', 'label')

        # Verifica tipos em label_distribution
        for key, value in result['label_distribution'].items():
            assert isinstance(key, str), f"Key {key} should be str"
            assert isinstance(value, int), f"Value {value} should be int, got {type(value)}"

        # Deve serializar
        json.dumps(result)

    def test_sample_preview_with_special_values(self, tmp_path):
        """
        Testa que sample_preview trata corretamente valores especiais.
        """
        from sistemas.bert_training.services import extract_dataset_metadata
        from sistemas.bert_training.schemas import TaskTypeEnum

        # Cria DataFrame com valores especiais que não são NaN
        df = pd.DataFrame({
            'texto': ['texto normal', 'texto com "aspas"', "texto com 'aspas simples'",
                      'texto\ncom\nquebras', 'texto\ttabulado'] * 20,
            'label': ['A', 'B', 'A', 'B', 'A'] * 20
        })

        excel_path = tmp_path / "special_values.xlsx"
        df.to_excel(excel_path, index=False)

        metadata = extract_dataset_metadata(
            file_path=excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='texto',
            label_column='label'
        )

        # Deve conseguir serializar
        json_str = json.dumps(metadata, ensure_ascii=False)

        # Deve ter sample_preview
        parsed = json.loads(json_str)
        assert "sample_preview" in parsed
        assert len(parsed["sample_preview"]) > 0


class TestBertTrainingNaNInRouter:
    """Testes que verificam os endpoints do router não falham com NaN."""

    @pytest.fixture
    def excel_with_nan(self, tmp_path):
        """Cria arquivo Excel com NaN para testes."""
        df = pd.DataFrame({
            'conteudo': ['texto1', 'texto2', np.nan, 'texto4'] * 25,
            'categoria': ['A', 'B', np.nan, 'A'] * 25
        })
        path = tmp_path / "test_nan.xlsx"
        df.to_excel(path, index=False)
        return path

    def test_preview_endpoint_with_nan_data(self, excel_with_nan, tmp_path):
        """
        Testa que o preview de dataset funciona com dados contendo NaN.

        Este teste simula o que o endpoint preview_dataset faz internamente.
        """
        import pandas as pd
        from utils.json_sanitizer import sanitize_dataframe_dict

        df = pd.read_excel(excel_with_nan)

        # Simula o que o endpoint faz
        preview_rows = sanitize_dataframe_dict(df.head(5).to_dict(orient='records'))

        # Deve ser serializável
        json_str = json.dumps(preview_rows)

        # Verifica que NaN virou null
        parsed = json.loads(json_str)
        for row in parsed:
            for key, value in row.items():
                # Valores devem ser None, não NaN
                if value is not None and isinstance(value, float):
                    assert not (value != value), f"Found NaN in {key}"


# ==================== Fixtures ====================

@pytest.fixture
def tmp_path(tmp_path_factory):
    """Cria diretório temporário para testes."""
    return tmp_path_factory.mktemp("bert_nan_tests")
