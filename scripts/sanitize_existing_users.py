# -*- coding: utf-8 -*-
"""
Script de limpeza retroativa de dados HTML em campos de usuario.

SECURITY: Remove tags HTML de full_name e setor no banco de dados,
prevenindo XSS persistente em dados historicos.

Uso:
    # Auditoria (nao altera dados):
    python scripts/sanitize_existing_users.py --dry-run

    # Limpeza efetiva:
    python scripts/sanitize_existing_users.py
"""

import argparse
import re
import sys
from pathlib import Path

# Adiciona raiz do projeto ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Regex para detectar tags HTML
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")


def strip_html_tags(value: str) -> str:
    """Remove todas as tags HTML de uma string."""
    if not value:
        return value
    return _HTML_TAG_PATTERN.sub("", value).strip()


def main():
    parser = argparse.ArgumentParser(
        description="Limpeza retroativa de HTML em campos de usuario"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Apenas audita, sem alterar dados",
    )
    args = parser.parse_args()

    # Conecta ao banco
    from dotenv import load_dotenv
    load_dotenv()

    import os
    from sqlalchemy import create_engine, text

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERRO: DATABASE_URL nao configurada no .env")
        sys.exit(1)

    engine = create_engine(database_url)

    print("=" * 60)
    print("  Sanitizacao de Dados de Usuarios")
    print(f"  Modo: {'AUDITORIA (dry-run)' if args.dry_run else 'LIMPEZA EFETIVA'}")
    print("=" * 60)

    with engine.connect() as conn:
        # Busca usuarios com HTML em full_name ou setor
        result = conn.execute(
            text("SELECT id, username, full_name, setor FROM users")
        )
        rows = result.fetchall()

        total = len(rows)
        affected = 0
        updates = []

        for row in rows:
            user_id, username, full_name, setor = row

            new_full_name = strip_html_tags(full_name) if full_name else full_name
            new_setor = strip_html_tags(setor) if setor else setor

            changed = False
            if new_full_name != full_name:
                changed = True
                print(f"  [full_name] user={username}: '{full_name}' -> '{new_full_name}'")
            if new_setor != setor:
                changed = True
                print(f"  [setor] user={username}: '{setor}' -> '{new_setor}'")

            if changed:
                affected += 1
                updates.append((user_id, new_full_name, new_setor))

        print(f"\nTotal de usuarios: {total}")
        print(f"Usuarios com HTML: {affected}")

        if affected == 0:
            print("\nNenhum usuario com HTML encontrado. Banco limpo.")
            return

        if args.dry_run:
            print("\n[DRY-RUN] Nenhuma alteracao feita. Rode sem --dry-run para limpar.")
            return

        # Aplica atualizacoes
        for user_id, new_full_name, new_setor in updates:
            conn.execute(
                text(
                    "UPDATE users SET full_name = :full_name, setor = :setor WHERE id = :id"
                ),
                {"full_name": new_full_name, "setor": new_setor, "id": user_id},
            )
        conn.commit()

        print(f"\n{affected} usuario(s) atualizado(s) com sucesso.")


if __name__ == "__main__":
    main()
