#!/usr/bin/env python
"""
Script para migrar configuracao de parecer NATJus do modelo legado
(configuracoes_ia) para o novo modelo (obrigatoriedade em categorias_resumo_json).

Idempotente: pode ser executado multiplas vezes sem efeito colateral.

Uso:
    python scripts/data-fix/migrar_natjus_para_obrigatoriedade.py          # Dry-run
    python scripts/data-fix/migrar_natjus_para_obrigatoriedade.py --apply  # Aplica
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def migrar(aplicar: bool = False):
    """Migra config de parecer NATJus para campo obrigatoriedade."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # 1. Ler config legada de configuracoes_ia
        print("\n=== Lendo configuracao legada (configuracoes_ia) ===")

        tipos_peca_raw = conn.execute(
            text(
                "SELECT valor FROM configuracoes_ia "
                "WHERE sistema = 'gerador_pecas' AND chave = 'parecer_required_for_piece_types'"
            )
        ).scalar()

        codigos_doc_raw = conn.execute(
            text(
                "SELECT valor FROM configuracoes_ia "
                "WHERE sistema = 'gerador_pecas' AND chave = 'parecer_document_codes'"
            )
        ).scalar()

        group_slugs_raw = conn.execute(
            text(
                "SELECT valor FROM configuracoes_ia "
                "WHERE sistema = 'gerador_pecas' AND chave = 'parecer_required_group_slugs'"
            )
        ).scalar()

        if not tipos_peca_raw and not codigos_doc_raw:
            print("AVISO: Nenhuma configuracao de parecer encontrada em configuracoes_ia.")
            print("Nada para migrar.")
            return

        # Parse valores
        tipos_peca = json.loads(tipos_peca_raw) if tipos_peca_raw else []
        codigos_doc = json.loads(codigos_doc_raw) if codigos_doc_raw else []
        group_slugs = json.loads(group_slugs_raw) if group_slugs_raw else ["ps"]

        print(f"  tipos_peca: {tipos_peca}")
        print(f"  codigos_documento: {codigos_doc}")
        print(f"  group_slugs: {group_slugs}")

        if not tipos_peca:
            print("AVISO: Nenhum tipo de peca configurado. Nada para migrar.")
            return

        # 2. Para cada grupo, buscar categoria correspondente
        for slug in group_slugs:
            print(f"\n=== Processando grupo: {slug} ===")

            # Buscar group_id
            group_row = conn.execute(
                text("SELECT id FROM prompt_groups WHERE slug = :slug AND ativo = true"),
                {"slug": slug},
            ).first()

            if not group_row:
                print(f"  AVISO: Grupo '{slug}' nao encontrado ou inativo. Pulando.")
                continue

            group_id = group_row[0]
            print(f"  group_id: {group_id}")

            # Buscar categoria que contenha os codigos de parecer
            categorias = conn.execute(
                text(
                    "SELECT id, nome, titulo, codigos_documento, obrigatoriedade "
                    "FROM categorias_resumo_json "
                    "WHERE group_id = :gid AND ativo = true"
                ),
                {"gid": group_id},
            ).fetchall()

            categoria_alvo = None
            for cat in categorias:
                cat_codigos = cat[3] or []
                # Verifica se a categoria contem pelo menos um codigo de parecer
                if any(c in cat_codigos for c in codigos_doc):
                    categoria_alvo = cat
                    break

            # Se nao encontrou por codigos, tenta por nome
            if not categoria_alvo:
                for cat in categorias:
                    nome = (cat[1] or "").lower()
                    if "parecer" in nome or "natjus" in nome:
                        categoria_alvo = cat
                        break

            if not categoria_alvo:
                print(f"  AVISO: Nenhuma categoria com codigos de parecer encontrada no grupo '{slug}'.")
                print(f"  Codigos procurados: {codigos_doc}")
                print(f"  Categorias disponiveis:")
                for cat in categorias:
                    print(f"    - {cat[1]} (codigos: {cat[3]})")
                continue

            cat_id = categoria_alvo[0]
            cat_nome = categoria_alvo[1]
            cat_titulo = categoria_alvo[2]
            obrigatoriedade_atual = categoria_alvo[4]

            print(f"  Categoria alvo: {cat_nome} (id={cat_id}, titulo='{cat_titulo}')")

            # 3. Verificar se ja tem obrigatoriedade configurada
            if obrigatoriedade_atual and isinstance(obrigatoriedade_atual, dict):
                if obrigatoriedade_atual.get("ativo"):
                    print(f"  JA MIGRADO: Categoria '{cat_nome}' ja tem obrigatoriedade ativa.")
                    print(f"  Config atual: {json.dumps(obrigatoriedade_atual, ensure_ascii=False)}")
                    continue

            # 4. Montar nova obrigatoriedade
            nova_obrigatoriedade = {
                "ativo": True,
                "tipos_peca": tipos_peca,
                "mensagem_quando_ausente": (
                    "Parecer NATJus nao encontrado nos autos do processo. "
                    "Este documento e essencial para a geracao adequada desta peca."
                ),
            }

            print(f"  Nova obrigatoriedade: {json.dumps(nova_obrigatoriedade, ensure_ascii=False)}")

            if aplicar:
                conn.execute(
                    text(
                        "UPDATE categorias_resumo_json "
                        "SET obrigatoriedade = :obrig "
                        "WHERE id = :cat_id"
                    ),
                    {
                        "obrig": json.dumps(nova_obrigatoriedade),
                        "cat_id": cat_id,
                    },
                )
                conn.commit()
                print(f"  APLICADO: Obrigatoriedade atualizada para categoria '{cat_nome}'.")
            else:
                print(f"  DRY-RUN: Nenhuma alteracao aplicada. Use --apply para efetivar.")

    print("\n=== Migracao concluida ===")


if __name__ == "__main__":
    aplicar = "--apply" in sys.argv
    if not aplicar:
        print("Modo DRY-RUN. Use --apply para aplicar as alteracoes.\n")
    migrar(aplicar=aplicar)
