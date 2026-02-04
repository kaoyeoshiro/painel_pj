# -*- coding: utf-8 -*-
"""
Testes E2E para o sistema BERT Training.

Markers:
- @pytest.mark.integration: Testes CI-friendly com dados sinteticos
- @pytest.mark.local_integration: Testes locais com Excel real

USO:
    pytest tests/e2e/test_bert_e2e.py -v -m integration
    pytest tests/e2e/test_bert_e2e.py -v -m local_integration
"""

import pytest
import json
from pathlib import Path


@pytest.mark.integration
class TestBertE2ECIFriendly:
    """Testes E2E CI-friendly usando planilha sintetica."""

    def test_synthetic_dataframe_creation(self, synthetic_dataframe):
        assert len(synthetic_dataframe) == 100
        assert 'tokens_extraidos' in synthetic_dataframe.columns
        assert 'categoria' in synthetic_dataframe.columns
        assert synthetic_dataframe['categoria'].nunique() == 5

    def test_synthetic_excel_creation(self, synthetic_excel_path):
        assert synthetic_excel_path.exists()
        assert synthetic_excel_path.suffix == '.xlsx'

    def test_extract_metadata_from_synthetic(self, synthetic_excel_path):
        from sistemas.bert_training.services import extract_dataset_metadata
        from sistemas.bert_training.schemas import TaskTypeEnum

        metadata = extract_dataset_metadata(
            file_path=synthetic_excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='tokens_extraidos',
            label_column='categoria'
        )

        assert metadata['total_rows'] == 100
        assert metadata['total_labels'] == 5
        assert 'label_distribution' in metadata
        json.dumps(metadata)

    def test_validate_synthetic_excel(self, synthetic_excel_path):
        from sistemas.bert_training.services import validate_excel_file
        from sistemas.bert_training.schemas import TaskTypeEnum

        result = validate_excel_file(
            file_path=synthetic_excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='tokens_extraidos',
            label_column='categoria'
        )

        assert result.is_valid is True
        assert len(result.errors) == 0
        assert result.total_rows == 100

    def test_analyze_quality_synthetic(self, synthetic_dataframe):
        from sistemas.bert_training.services import analyze_dataset_quality

        result = analyze_dataset_quality(
            synthetic_dataframe,
            'tokens_extraidos',
            'categoria'
        )

        assert result['quality_score'] > 0
        assert result['num_classes'] == 5
        json.dumps(result)


@pytest.mark.local_integration
class TestBertE2ELocal:
    """Testes E2E com Excel real (ambiente local)."""

    def test_real_excel_exists(self, real_excel_path):
        assert real_excel_path.exists()

    def test_reduced_dataframe_creation(self, reduced_real_dataframe):
        assert len(reduced_real_dataframe) >= 20
        assert 'tokens_extraidos' in reduced_real_dataframe.columns
        assert 'categoria' in reduced_real_dataframe.columns

    def test_extract_metadata_from_real(self, reduced_real_excel_path):
        from sistemas.bert_training.services import extract_dataset_metadata
        from sistemas.bert_training.schemas import TaskTypeEnum

        metadata = extract_dataset_metadata(
            file_path=reduced_real_excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='tokens_extraidos',
            label_column='categoria'
        )

        assert metadata['total_rows'] >= 20
        assert metadata['total_labels'] >= 2
        json_str = json.dumps(metadata)
        assert 'NaN' not in json_str

    def test_validate_real_excel(self, reduced_real_excel_path):
        from sistemas.bert_training.services import validate_excel_file
        from sistemas.bert_training.schemas import TaskTypeEnum

        result = validate_excel_file(
            file_path=reduced_real_excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='tokens_extraidos',
            label_column='categoria'
        )

        assert result.is_valid is True
        assert result.total_rows >= 20

    def test_analyze_quality_real(self, reduced_real_dataframe):
        from sistemas.bert_training.services import analyze_dataset_quality

        result = analyze_dataset_quality(
            reduced_real_dataframe,
            'tokens_extraidos',
            'categoria'
        )

        assert result['quality_score'] >= 0
        json_str = json.dumps(result)
        assert 'Infinity' not in json_str


@pytest.mark.integration
class TestBertE2EEdgeCases:
    """Testes de casos extremos."""

    def test_dataset_with_nan_values(self, tmp_path):
        import pandas as pd
        import numpy as np
        from sistemas.bert_training.services import extract_dataset_metadata
        from sistemas.bert_training.schemas import TaskTypeEnum

        df = pd.DataFrame({
            'texto': ['texto1', np.nan, 'texto3', 'texto4', None] * 20,
            'label': ['A', 'B', 'A', np.nan, 'B'] * 20
        })

        excel_path = tmp_path / 'nan_dataset.xlsx'
        df.to_excel(excel_path, index=False)

        metadata = extract_dataset_metadata(
            file_path=excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='texto',
            label_column='label'
        )

        json_str = json.dumps(metadata)
        assert 'NaN' not in json_str

    def test_dataset_with_numeric_labels(self, tmp_path):
        import pandas as pd
        from sistemas.bert_training.services import extract_dataset_metadata
        from sistemas.bert_training.schemas import TaskTypeEnum

        df = pd.DataFrame({
            'texto': ['texto'] * 100,
            'label': [0, 1, 2, 0, 1] * 20
        })

        excel_path = tmp_path / 'numeric_labels.xlsx'
        df.to_excel(excel_path, index=False)

        metadata = extract_dataset_metadata(
            file_path=excel_path,
            task_type=TaskTypeEnum.TEXT_CLASSIFICATION,
            text_column='texto',
            label_column='label'
        )

        for key in metadata['label_distribution'].keys():
            assert isinstance(key, str)

        for value in metadata['label_distribution'].values():
            assert isinstance(value, int)

        json.dumps(metadata)

    def test_imbalanced_dataset(self, tmp_path):
        import pandas as pd
        from sistemas.bert_training.services import analyze_dataset_quality

        df = pd.DataFrame({
            'texto': ['texto'] * 100,
            'label': ['A'] * 99 + ['B']
        })

        result = analyze_dataset_quality(df, 'texto', 'label')

        assert any(w['type'] == 'severe_imbalance' for w in result['warnings'])

        json_str = json.dumps(result)
        assert 'Infinity' not in json_str
