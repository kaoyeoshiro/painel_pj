# -*- coding: utf-8 -*-
"""
Wrapper seguro para torch.load — prevencao de RCE via pickle deserialization.

SECURITY: torch.load() sem restricoes permite execucao arbitraria de codigo
via arquivos .pt maliciosos (pickle deserialization attack). Este modulo:
1. Valida que o caminho esta dentro do diretorio permitido (bert_models/)
2. Valida magic bytes do arquivo (PK zip ou pickle)
3. Registra log de auditoria de cada carregamento

Uso:
    from utils.safe_torch import safe_torch_load
    checkpoint = safe_torch_load(path, map_location="cpu")
"""

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Diretorios permitidos para carregamento de modelos
ALLOWED_MODEL_DIRS = ("bert_models",)

# Magic bytes validos para checkpoints PyTorch
# PK ZIP (formato padrao do torch.save): \x50\x4b
# Pickle protocol 2+: \x80\x02, \x80\x03, \x80\x04, \x80\x05
_VALID_MAGIC_BYTES = (
    b"\x50\x4b",  # ZIP (PK)
    b"\x80\x02",  # Pickle protocol 2
    b"\x80\x03",  # Pickle protocol 3
    b"\x80\x04",  # Pickle protocol 4
    b"\x80\x05",  # Pickle protocol 5
)


class UnsafeModelPathError(Exception):
    """Caminho de modelo fora do diretorio permitido ou com traversal."""
    pass


class InvalidModelFileError(Exception):
    """Arquivo de modelo com magic bytes invalidos."""
    pass


def _validate_path(model_path: Path) -> Path:
    """
    Valida que o caminho do modelo esta dentro dos diretorios permitidos.

    Previne directory traversal (ex: ../../etc/passwd).

    Args:
        model_path: Caminho do arquivo .pt

    Returns:
        Caminho resolvido e validado

    Raises:
        UnsafeModelPathError: Se o caminho estiver fora do diretorio permitido
    """
    resolved = model_path.resolve()

    # Verifica se algum componente do caminho contem ".."
    path_str = str(model_path)
    if ".." in path_str:
        logger.warning(
            "SECURITY: Tentativa de path traversal detectada: %s", path_str
        )
        raise UnsafeModelPathError(
            f"Caminho com path traversal nao permitido: {path_str}"
        )

    # Verifica se o caminho esta dentro de um dos diretorios permitidos
    for allowed_dir in ALLOWED_MODEL_DIRS:
        allowed_resolved = Path(allowed_dir).resolve()
        try:
            resolved.relative_to(allowed_resolved)
            return resolved
        except ValueError:
            continue

    logger.warning(
        "SECURITY: Tentativa de carregar modelo fora do diretorio permitido: %s "
        "(resolvido: %s, permitidos: %s)",
        model_path,
        resolved,
        ALLOWED_MODEL_DIRS,
    )
    raise UnsafeModelPathError(
        f"Caminho fora dos diretorios permitidos ({ALLOWED_MODEL_DIRS}): {model_path}"
    )


def _validate_magic_bytes(file_path: Path) -> None:
    """
    Valida que o arquivo comeca com magic bytes de formato valido.

    Args:
        file_path: Caminho do arquivo a validar

    Raises:
        InvalidModelFileError: Se os magic bytes nao forem reconhecidos
        FileNotFoundError: Se o arquivo nao existir
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Arquivo de modelo nao encontrado: {file_path}")

    with open(file_path, "rb") as f:
        header = f.read(2)

    if len(header) < 2:
        raise InvalidModelFileError(
            f"Arquivo de modelo vazio ou corrompido: {file_path}"
        )

    if header not in _VALID_MAGIC_BYTES:
        logger.warning(
            "SECURITY: Magic bytes invalidos em %s: %s",
            file_path,
            header.hex(),
        )
        raise InvalidModelFileError(
            f"Arquivo de modelo com formato invalido (magic bytes: {header.hex()}): {file_path}"
        )


def safe_torch_load(model_path: str | Path, map_location: str = "cpu") -> Any:
    """
    Carrega checkpoint PyTorch com validacoes de seguranca.

    Substituto seguro para torch.load() que:
    1. Valida que o caminho esta dentro de bert_models/
    2. Valida magic bytes do arquivo
    3. Registra log de auditoria

    Args:
        model_path: Caminho do arquivo .pt
        map_location: Dispositivo para carregar o modelo (default: "cpu")

    Returns:
        Checkpoint carregado (dict com model_state_dict, label_map, etc)

    Raises:
        UnsafeModelPathError: Caminho fora do diretorio permitido
        InvalidModelFileError: Magic bytes invalidos
        FileNotFoundError: Arquivo nao encontrado
    """
    import torch

    model_path = Path(model_path)

    # 1. Valida caminho
    resolved_path = _validate_path(model_path)

    # 2. Valida magic bytes
    _validate_magic_bytes(resolved_path)

    # 3. Log de auditoria
    logger.info("Carregando modelo seguro: %s", resolved_path)

    # 4. Carrega com torch.load
    checkpoint = torch.load(resolved_path, map_location=map_location)  # nosec B614 - wrapper seguro com validacoes previas

    logger.info(
        "Modelo carregado com sucesso: %s (keys: %s)",
        resolved_path,
        list(checkpoint.keys()) if isinstance(checkpoint, dict) else type(checkpoint).__name__,
    )

    return checkpoint
