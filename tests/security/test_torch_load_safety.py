# -*- coding: utf-8 -*-
"""
Testes de seguranca para safe_torch_load — prevencao de RCE via pickle deserialization.

Verifica:
- Rejeicao de path traversal
- Rejeicao de caminhos fora do diretorio permitido
- Rejeicao de magic bytes invalidos
- Aceitacao de caminhos validos
- Ausencia de torch.load() raw no codebase
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

pytestmark = pytest.mark.security

from utils.safe_torch import (
    safe_torch_load,
    _validate_path,
    _validate_magic_bytes,
    UnsafeModelPathError,
    InvalidModelFileError,
    ALLOWED_MODEL_DIRS,
)


class TestPathValidation:
    """Testes de validacao de caminho."""

    def test_rejects_path_traversal(self):
        """Caminho com '..' deve ser rejeitado."""
        with pytest.raises(UnsafeModelPathError, match="path traversal"):
            _validate_path(Path("bert_models/../../etc/passwd"))

    def test_rejects_path_traversal_windows(self):
        """Caminho com '..' em formato Windows deve ser rejeitado."""
        with pytest.raises(UnsafeModelPathError, match="path traversal"):
            _validate_path(Path("bert_models\\..\\..\\Windows\\System32\\config"))

    def test_rejects_outside_allowed_dir(self, tmp_path):
        """Caminho fora de bert_models/ deve ser rejeitado."""
        fake_model = tmp_path / "evil_model.pt"
        fake_model.write_bytes(b"\x50\x4b\x03\x04")

        with pytest.raises(UnsafeModelPathError, match="fora dos diretorios permitidos"):
            _validate_path(fake_model)

    def test_accepts_valid_model_path(self):
        """Caminho dentro de bert_models/ deve ser aceito."""
        bert_models_dir = Path("bert_models").resolve()
        bert_models_dir.mkdir(exist_ok=True)

        model_dir = bert_models_dir / "test_model"
        model_dir.mkdir(exist_ok=True)
        model_file = model_dir / "model.pt"
        model_file.write_bytes(b"\x50\x4b\x03\x04dummy")

        try:
            result = _validate_path(model_file)
            assert result == model_file.resolve()
        finally:
            model_file.unlink(missing_ok=True)
            model_dir.rmdir()


class TestMagicBytesValidation:
    """Testes de validacao de magic bytes."""

    def test_rejects_invalid_magic_bytes(self, tmp_path):
        """Arquivo com magic bytes invalidos deve ser rejeitado."""
        fake_file = tmp_path / "fake.pt"
        fake_file.write_bytes(b"\x00\x00\x00\x00fake content")

        with pytest.raises(InvalidModelFileError, match="formato invalido"):
            _validate_magic_bytes(fake_file)

    def test_rejects_text_file(self, tmp_path):
        """Arquivo de texto (.txt) renomeado para .pt deve ser rejeitado."""
        fake_file = tmp_path / "text_as_model.pt"
        fake_file.write_text("este e um arquivo de texto, nao um modelo")

        with pytest.raises(InvalidModelFileError, match="formato invalido"):
            _validate_magic_bytes(fake_file)

    def test_rejects_empty_file(self, tmp_path):
        """Arquivo vazio deve ser rejeitado."""
        empty_file = tmp_path / "empty.pt"
        empty_file.write_bytes(b"")

        with pytest.raises(InvalidModelFileError, match="vazio ou corrompido"):
            _validate_magic_bytes(empty_file)

    def test_accepts_zip_magic_bytes(self, tmp_path):
        """Arquivo com magic bytes PK (ZIP) deve ser aceito."""
        valid_file = tmp_path / "valid.pt"
        valid_file.write_bytes(b"\x50\x4b\x03\x04" + b"\x00" * 100)
        _validate_magic_bytes(valid_file)  # Nao deve levantar excecao

    def test_accepts_pickle_magic_bytes(self, tmp_path):
        """Arquivo com magic bytes pickle deve ser aceito."""
        for magic in [b"\x80\x02", b"\x80\x03", b"\x80\x04", b"\x80\x05"]:
            valid_file = tmp_path / "valid_pickle.pt"
            valid_file.write_bytes(magic + b"\x00" * 100)
            _validate_magic_bytes(valid_file)

    def test_file_not_found(self, tmp_path):
        """Arquivo inexistente deve levantar FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            _validate_magic_bytes(tmp_path / "nonexistent.pt")


class TestCodebaseAudit:
    """Verificacao estatica do codebase."""

    def test_no_raw_torch_load_in_codebase(self):
        """
        Nenhum arquivo Python do codebase deve usar torch.load() diretamente,
        exceto safe_torch.py e arquivos de teste.

        Todos devem usar safe_torch_load().
        """
        project_root = Path(__file__).parent.parent.parent
        violations = []

        # Diretorios Python a verificar
        search_dirs = [
            project_root / "sistemas",
        ]

        # Arquivos permitidos (o proprio wrapper e testes)
        allowed_files = {
            "safe_torch.py",
        }

        import re
        # Padroes perigosos: torch.load( mas NAO em comentarios ou strings
        pattern = re.compile(r"^\s*[^#]*torch\.load\s*\(", re.MULTILINE)

        for search_dir in search_dirs:
            if not search_dir.exists():
                continue
            for py_file in search_dir.rglob("*.py"):
                if py_file.name in allowed_files:
                    continue
                content = py_file.read_text(encoding="utf-8", errors="ignore")
                matches = pattern.findall(content)
                if matches:
                    violations.append(f"{py_file.relative_to(project_root)}: {len(matches)} uso(s)")

        assert not violations, (
            f"torch.load() usado diretamente em {len(violations)} arquivo(s). "
            f"Use safe_torch_load() de utils/safe_torch.py:\n"
            + "\n".join(f"  - {v}" for v in violations)
        )
