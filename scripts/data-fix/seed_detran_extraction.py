#!/usr/bin/env python3
"""
Seed do schema de extração DETRAN.

Aplica o schema de 41 variáveis de extração para o grupo DETRAN no banco
de dados, criando/atualizando ExtractionQuestion e ExtractionVariable para
a categoria de Petição Inicial do grupo DETRAN.

Pré-requisito: o grupo DETRAN e a categoria de Petição Inicial devem existir
na tabela 'categorias_resumo_json'. Se não existirem, o script lista as
categorias disponíveis e encerra com instrução de qual ID usar.

Uso:
    # Modo simulação (mostra o que seria feito sem alterar o banco):
    python scripts/data-fix/seed_detran_extraction.py --dry-run

    # Aplicar usando ID de categoria explícito:
    python scripts/data-fix/seed_detran_extraction.py --categoria-id 5

    # Detectar automaticamente (exige que exista exatamente 1 categoria DETRAN
    # com namespace "detran" ou nome contendo "peticao"):
    python scripts/data-fix/seed_detran_extraction.py --auto
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Optional

# Raiz do projeto
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL não definida. Configure no .env ou nas variáveis de ambiente.")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Caminho para o JSON de schema
SCHEMA_FILE = ROOT / "docs" / "schemas" / "detran_extraction_schema.json"


def carregar_schema() -> dict:
    """Carrega e valida o schema JSON do arquivo."""
    with open(SCHEMA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    # Remove a chave de metadados antes de retornar
    data.pop("_meta", None)
    return data


def listar_categorias_detran(session) -> list:
    """Lista categorias associadas ao grupo DETRAN."""
    resultado = session.execute(
        text("""
            SELECT cr.id, cr.nome, cr.titulo, cr.namespace_prefix, pg.slug as grupo_slug
            FROM categorias_resumo_json cr
            JOIN prompt_groups pg ON cr.group_id = pg.id
            WHERE pg.slug = 'detran'
            ORDER BY cr.id
        """)
    ).fetchall()
    return [dict(r._mapping) for r in resultado]


def detectar_categoria_automaticamente(session) -> Optional[int]:
    """
    Tenta detectar automaticamente a categoria de Petição Inicial DETRAN.

    Retorna o ID da categoria, ou None se não encontrar de forma unívoca.
    """
    categorias = listar_categorias_detran(session)
    if not categorias:
        return None

    # Preferência: categoria com namespace "detran" e nome contendo "peticao"
    for cat in categorias:
        nome = (cat["nome"] or "").lower()
        namespace = (cat["namespace_prefix"] or "").lower()
        if "peticao" in nome or "peticao" in namespace or namespace == "detran":
            return cat["id"]

    # Fallback: única categoria DETRAN disponível
    if len(categorias) == 1:
        return categorias[0]["id"]

    return None


def obter_primeiro_user_id(session) -> int:
    """Retorna o ID do primeiro usuário disponível no banco."""
    row = session.execute(text("SELECT id FROM users ORDER BY id LIMIT 1")).fetchone()
    if not row:
        raise ValueError("Nenhum usuário encontrado na tabela users.")
    return row[0]


def aplicar_schema(session, categoria_id: int, schema: dict, dry_run: bool) -> None:
    """
    Aplica o schema de extração na categoria especificada usando o
    serviço JsonSyncService (ou simulação em dry_run).
    """
    # Importa o serviço apenas quando necessário (evita importar ORM antes
    # de o path estar configurado)
    # Importar models na ordem correta para que o SQLAlchemy resolva todos
    # os relationships antes de usar JsonSyncService
    from auth.models import User  # noqa: F401
    from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON  # noqa: F401
    from sistemas.gerador_pecas.models_extraction import (  # noqa: F401
        ExtractionQuestion, ExtractionModel, ExtractionVariable,
        PromptVariableUsage, PromptActivationLog,
    )
    from admin.models_prompt_groups import PromptGroup, PromptSubgroup, PromptSubcategoria  # noqa: F401
    from admin.models_prompts import PromptModulo  # noqa: F401
    from sistemas.gerador_pecas.services_json_sync import JsonSyncService

    categoria_row = session.execute(
        text("SELECT id, nome, titulo FROM categorias_resumo_json WHERE id = :id"),
        {"id": categoria_id}
    ).fetchone()

    if not categoria_row:
        logger.error(f"Categoria com ID {categoria_id} não encontrada.")
        sys.exit(1)

    logger.info(f"Categoria alvo: [{categoria_id}] {categoria_row.titulo} ({categoria_row.nome})")
    logger.info(f"Total de variáveis no schema: {len(schema)}")

    if dry_run:
        logger.info("[DRY-RUN] Nenhuma alteração será feita no banco.")
        logger.info("Variáveis que seriam aplicadas:")
        for slug, info in schema.items():
            tipo = info.get("type", "?")
            dep = f" → depende de: {info['depends_on']}" if info.get("depends_on") else ""
            logger.info(f"  {slug} ({tipo}){dep}")
        return

    # Converte o schema para string JSON (formato esperado pelo serviço)
    json_str = json.dumps(schema, ensure_ascii=False)

    user_id = obter_primeiro_user_id(session)
    logger.info(f"Usando user_id={user_id} para auditoria.")

    service = JsonSyncService(db=session)
    resultado = service.reconciliar_json(
        categoria_id=categoria_id,
        json_content=json_str,
        confirmar_remocao_variaveis_em_uso=False,
        user_id=user_id,
    )

    if not resultado.get("success"):
        logger.error(f"Erro ao aplicar schema: {resultado.get('erro')}")
        erros = resultado.get("erros_validacao", [])
        for err in erros:
            logger.error(f"  Validação: {err}")
        sys.exit(1)

    logger.info("Schema aplicado com sucesso!")
    logger.info(f"  Perguntas criadas:   {resultado.get('perguntas_criadas', 0)}")
    logger.info(f"  Perguntas atualizadas: {resultado.get('perguntas_atualizadas', 0)}")
    logger.info(f"  Perguntas removidas: {resultado.get('perguntas_removidas', 0)}")
    logger.info(f"  Variáveis criadas:   {resultado.get('variaveis_criadas', 0)}")
    logger.info(f"  Variáveis atualizadas: {resultado.get('variaveis_atualizadas', 0)}")

    session.commit()


def main():
    parser = argparse.ArgumentParser(description="Seed do schema de extração DETRAN")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--categoria-id",
        type=int,
        metavar="ID",
        help="ID da categoria de Petição Inicial DETRAN no banco"
    )
    group.add_argument(
        "--auto",
        action="store_true",
        help="Detecta automaticamente a categoria DETRAN"
    )
    group.add_argument(
        "--listar",
        action="store_true",
        help="Lista categorias disponíveis do grupo DETRAN e encerra"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula sem alterar o banco"
    )
    args = parser.parse_args()

    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        if args.listar:
            categorias = listar_categorias_detran(session)
            if not categorias:
                logger.warning("Nenhuma categoria encontrada para o grupo DETRAN.")
                logger.info("Certifique-se de que o grupo DETRAN existe e tem categorias cadastradas.")
            else:
                print("\nCategorias disponíveis no grupo DETRAN:")
                print(f"{'ID':>4}  {'Nome':<30}  {'Namespace':<20}  Título")
                print("-" * 80)
                for cat in categorias:
                    print(
                        f"{cat['id']:>4}  "
                        f"{cat['nome']:<30}  "
                        f"{(cat['namespace_prefix'] or '-'):<20}  "
                        f"{cat['titulo']}"
                    )
            return

        schema = carregar_schema()
        logger.info(f"Schema carregado: {SCHEMA_FILE}")

        if args.auto:
            categoria_id = detectar_categoria_automaticamente(session)
            if not categoria_id:
                logger.error(
                    "Não foi possível detectar automaticamente a categoria DETRAN.\n"
                    "Use --listar para ver as categorias disponíveis e --categoria-id para especificar."
                )
                sys.exit(1)
            logger.info(f"Categoria detectada automaticamente: ID={categoria_id}")
        else:
            categoria_id = args.categoria_id

        aplicar_schema(session, categoria_id, schema, dry_run=args.dry_run)

    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
