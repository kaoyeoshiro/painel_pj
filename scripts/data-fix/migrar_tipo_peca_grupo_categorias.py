"""
Migra dados de tipo_peca_categorias (antigo, sem grupo) para
tipo_peca_grupo_categorias (novo, com grupo).

Apenas replica para grupos que ja possuem categorias_resumo_json
configuradas, evitando criar associacoes orfas. Grupos sem
categorias_resumo_json usam o fallback global automaticamente.

Uso:
    python scripts/data-fix/migrar_tipo_peca_grupo_categorias.py
"""
import sys
from pathlib import Path

# Adiciona raiz do projeto ao sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import text
from database.connection import SessionLocal


def main():
    db = SessionLocal()
    try:
        # Busca apenas grupos que ja tem categorias_resumo_json configuradas
        grupos = db.execute(text("""
            SELECT DISTINCT pg.id, pg.name
            FROM prompt_groups pg
            JOIN categorias_resumo_json crj ON crj.group_id = pg.id AND crj.ativo = true
            WHERE pg.active = true
        """)).fetchall()
        print(f"Grupos com categorias_resumo_json: {len(grupos)}")

        if not grupos:
            print("Nenhum grupo com categorias configuradas. Nada a migrar.")
            print("(Grupos sem config usam fallback global automaticamente)")
            return

        # Busca associacoes antigas (tipo_peca_categorias)
        assocs_antigas = db.execute(text("""
            SELECT tp.nome as tipo_peca_nome, tpc.categoria_documento_id
            FROM tipo_peca_categorias tpc
            JOIN tipos_peca tp ON tp.id = tpc.tipo_peca_id
        """)).fetchall()
        print(f"Associacoes antigas: {len(assocs_antigas)}")

        if not assocs_antigas:
            print("Nenhuma associacao para migrar.")
            return

        # Para cada grupo elegivel, replica as associacoes
        total = 0
        for grupo_id, grupo_nome in grupos:
            grupo_total = 0
            for tipo_peca_nome, cat_id in assocs_antigas:
                existe = db.execute(text("""
                    SELECT 1 FROM tipo_peca_grupo_categorias
                    WHERE tipo_peca_nome = :nome AND group_id = :gid AND categoria_documento_id = :cid
                """), {"nome": tipo_peca_nome, "gid": grupo_id, "cid": cat_id}).fetchone()

                if not existe:
                    db.execute(text("""
                        INSERT INTO tipo_peca_grupo_categorias (tipo_peca_nome, group_id, categoria_documento_id)
                        VALUES (:nome, :gid, :cid)
                    """), {"nome": tipo_peca_nome, "gid": grupo_id, "cid": cat_id})
                    grupo_total += 1
                    total += 1

            print(f"  Grupo '{grupo_nome}' (id={grupo_id}): {grupo_total} novas associacoes")

        db.commit()
        print(f"\nMigracao concluida: {total} novas associacoes criadas.")

    except Exception as e:
        db.rollback()
        print(f"ERRO: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
