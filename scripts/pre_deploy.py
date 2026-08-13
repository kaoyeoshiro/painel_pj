"""
Pre-deploy script: garante que Alembic reconhece o estado atual do banco.

Problema: O banco de produção foi criado por Base.metadata.create_all() (init_db.py),
mas o Alembic não sabe disso. Sem o stamp, ele tenta rodar TODAS as migrations do zero,
falhando ao criar tabelas/colunas que já existem.

Solução: Se o banco já tem tabelas (ex: 'users') mas não tem alembic_version,
stampa na última migration "antiga" (0fc5d5f02232). Assim, alembic upgrade head
só roda as migrations NOVAS (baseline, alter types, constraints, feedback stars, etc).

Uso: python scripts/pre_deploy.py && alembic upgrade head
"""
import os
import sys

from sqlalchemy import create_engine, text, inspect


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    # Alguns provedores entregam postgres:// mas SQLAlchemy 2.x exige postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(url)

    # Última migration "antiga" — tudo antes disso já existia via create_all()
    LAST_OLD_MIGRATION = "0fc5d5f02232"

    with engine.connect() as conn:
        insp = inspect(conn)
        tables = set(insp.get_table_names())

        has_alembic = "alembic_version" in tables
        has_app_tables = "users" in tables  # Se 'users' existe, o banco não é virgem

        if has_alembic:
            row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
            if row:
                print(f"OK: Alembic já está em {row[0]} — nada a fazer.")
                return
            else:
                # Tabela existe mas vazia (deploy anterior falhou)
                if has_app_tables:
                    conn.execute(
                        text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                        {"v": LAST_OLD_MIGRATION},
                    )
                    conn.commit()
                    print(f"STAMP: alembic_version vazia → stampado em {LAST_OLD_MIGRATION}")
                else:
                    print("OK: Banco virgem com alembic_version vazia — migrations criarão tudo.")
        elif has_app_tables:
            # Banco criado por create_all(), sem alembic_version
            conn.execute(
                text(
                    "CREATE TABLE alembic_version ("
                    "version_num VARCHAR(32) NOT NULL, "
                    "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
                )
            )
            conn.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                {"v": LAST_OLD_MIGRATION},
            )
            conn.commit()
            print(f"STAMP: Banco existente sem alembic_version → stampado em {LAST_OLD_MIGRATION}")
        else:
            print("OK: Banco virgem — migrations criarão tudo do zero.")


if __name__ == "__main__":
    main()
