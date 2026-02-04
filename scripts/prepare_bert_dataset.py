# -*- coding: utf-8 -*-
"""
Script para preparar dataset BERT otimizado para 95%+ de acurácia.

Realiza:
1. Limpeza de textos vazios/curtos
2. Balanceamento de classes via oversampling
3. Validação de qualidade
"""

import pandas as pd
import numpy as np
from pathlib import Path
import hashlib
import shutil


def clean_dataset(df: pd.DataFrame, text_col: str, min_length: int = 50) -> pd.DataFrame:
    """Remove amostras com texto inválido."""
    df = df.copy()
    df['_text_str'] = df[text_col].astype(str)
    df['_text_len'] = df['_text_str'].apply(len)

    # Filtros de qualidade
    valid_mask = (
        (df['_text_str'] != 'nan') &
        (df['_text_len'] >= min_length) &
        (~df['_text_str'].str.match(r'^fls\.\s*\d+', na=False))
    )

    df_clean = df[valid_mask].copy()
    df_clean = df_clean.drop(columns=['_text_str', '_text_len'])

    removed = len(df) - len(df_clean)
    print(f"Limpeza: {removed} amostras removidas ({removed/len(df)*100:.1f}%)")
    print(f"Restantes: {len(df_clean)} amostras")

    return df_clean


def balance_dataset(
    df: pd.DataFrame,
    label_col: str,
    strategy: str = 'oversample',
    target_ratio: float = 0.5,
    min_samples: int = 500,
    max_samples: int = 3000
) -> pd.DataFrame:
    """
    Balanceia o dataset via oversampling/undersampling.

    Args:
        strategy: 'oversample' (duplica minoritárias) ou 'undersample' (reduz majoritária)
        target_ratio: Ratio mínimo entre menor e maior classe (0.5 = minoritária tem pelo menos 50% da majoritária)
        min_samples: Mínimo de amostras por classe após balanceamento
        max_samples: Máximo de amostras por classe (para evitar dominância excessiva)
    """
    df = df.copy()
    label_counts = df[label_col].value_counts()

    print(f"\nDistribuição original:")
    for label, count in label_counts.items():
        print(f"  {label[:40]}: {count}")

    # Calcular targets
    max_count = min(label_counts.max(), max_samples)
    min_target = max(int(max_count * target_ratio), min_samples)

    balanced_dfs = []

    for label in label_counts.index:
        df_label = df[df[label_col] == label]
        current_count = len(df_label)

        if strategy == 'oversample' and current_count < min_target:
            # Oversample: duplicar amostras até atingir target
            n_needed = min_target - current_count
            oversampled = df_label.sample(n=n_needed, replace=True, random_state=42)
            df_label = pd.concat([df_label, oversampled], ignore_index=True)
            print(f"  Oversampled {label[:30]}: {current_count} -> {len(df_label)}")

        elif strategy == 'undersample' and current_count > max_samples:
            # Undersample: reduzir para max_samples
            df_label = df_label.sample(n=max_samples, random_state=42)
            print(f"  Undersampled {label[:30]}: {current_count} -> {len(df_label)}")

        balanced_dfs.append(df_label)

    df_balanced = pd.concat(balanced_dfs, ignore_index=True)
    df_balanced = df_balanced.sample(frac=1, random_state=42).reset_index(drop=True)  # Shuffle

    print(f"\nDistribuição após balanceamento:")
    new_counts = df_balanced[label_col].value_counts()
    for label, count in new_counts.items():
        print(f"  {label[:40]}: {count}")

    print(f"\nTotal: {len(df_balanced)} amostras")

    return df_balanced


def compute_sha256(filepath: str) -> str:
    """Calcula hash SHA256 do arquivo."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def main():
    # Configurações
    INPUT_FILE = Path(r"E:\Projetos\PGE\portal-pge\data\bert_datasets\ca2af7a041671e5f9d62bc62682deaa13d55db8db2e48cf6bc742017b1c8e22b.xlsx")
    OUTPUT_DIR = Path(r"E:\Projetos\PGE\portal-pge\data\bert_datasets")

    TEXT_COL = "tokens_extraidos"
    LABEL_COL = "categoria"

    print("="*60)
    print("PREPARAÇÃO DO DATASET BERT PARA 95%+")
    print("="*60)

    # 1. Carregar
    print(f"\n1. Carregando {INPUT_FILE.name}...")
    df = pd.read_excel(INPUT_FILE)
    print(f"   {len(df)} amostras, {df[LABEL_COL].nunique()} classes")

    # 2. Limpar
    print(f"\n2. Limpando dados inválidos...")
    df_clean = clean_dataset(df, TEXT_COL, min_length=50)

    # 3. Balancear
    print(f"\n3. Balanceando classes...")
    df_balanced = balance_dataset(
        df_clean,
        LABEL_COL,
        strategy='oversample',
        target_ratio=0.3,  # Minoritárias terão pelo menos 30% da majoritária
        min_samples=400,
        max_samples=3000
    )

    # 4. Manter apenas colunas necessárias
    df_final = df_balanced[[TEXT_COL, LABEL_COL]].copy()

    # 5. Salvar
    output_file = OUTPUT_DIR / "dataset_otimizado_95.xlsx"
    print(f"\n4. Salvando em {output_file.name}...")
    df_final.to_excel(output_file, index=False)

    # 6. Calcular hash
    file_hash = compute_sha256(output_file)
    print(f"   SHA256: {file_hash}")

    # 7. Resumo final
    print("\n" + "="*60)
    print("RESUMO")
    print("="*60)
    print(f"Dataset original: {len(df)} amostras")
    print(f"Após limpeza: {len(df_clean)} amostras")
    print(f"Após balanceamento: {len(df_final)} amostras")
    print(f"Classes: {df_final[LABEL_COL].nunique()}")
    print(f"\nArquivo salvo: {output_file}")
    print(f"SHA256: {file_hash}")

    # 8. Copiar para diretório com nome de hash (formato esperado pelo sistema)
    hash_filename = OUTPUT_DIR / f"{file_hash}.xlsx"
    shutil.copy(output_file, hash_filename)
    print(f"Cópia com hash: {hash_filename.name}")

    print("\n>>> PRÓXIMO PASSO: Faça upload deste arquivo no BERT Training")
    print(f"    Arquivo: {output_file}")


if __name__ == "__main__":
    main()
