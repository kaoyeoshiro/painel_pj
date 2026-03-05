#!/usr/bin/env python3
"""
Importação completa da refatoração DETRAN v3.1.

Importa em um banco de dados:
1. Schema de extração (65 variáveis, v3.0)
2. Módulos de defesa (98 módulos, v3.1)
3. Prompt de sistema (repertório argumentativo)

Uso:
    # Local (usa DATABASE_URL do .env):
    python scripts/data-fix/importar_detran_completo.py --dry-run
    python scripts/data-fix/importar_detran_completo.py

    # Produção (URL explícita):
    python scripts/data-fix/importar_detran_completo.py --db-url "postgresql://..."

    # Apenas um item:
    python scripts/data-fix/importar_detran_completo.py --apenas schema
    python scripts/data-fix/importar_detran_completo.py --apenas modulos
    python scripts/data-fix/importar_detran_completo.py --apenas prompt
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path

# Raiz do projeto
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Caminhos dos arquivos
SCHEMA_FILE = ROOT / "docs" / "schemas" / "detran_extraction_schema.json"
MODULOS_FILE = ROOT / "docs" / "schemas" / "detran_modulos_import.json"
PROMPT_FILE = ROOT / "docs" / "prompts" / "detran" / "sistema.md"

DETRAN_GROUP_SLUG = "detran"


def get_session(db_url: str):
    """Cria engine e sessão para a URL fornecida."""
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    return engine, Session()


def obter_group_id(session, slug: str = DETRAN_GROUP_SLUG) -> int | None:
    """Retorna o ID do grupo DETRAN."""
    row = session.execute(
        text("SELECT id FROM prompt_groups WHERE slug = :slug"),
        {"slug": slug}
    ).fetchone()
    return row[0] if row else None


def obter_primeiro_user_id(session) -> int:
    """Retorna o ID do primeiro usuário."""
    row = session.execute(text("SELECT id FROM users ORDER BY id LIMIT 1")).fetchone()
    if not row:
        raise ValueError("Nenhum usuário encontrado.")
    return row[0]


def detectar_categoria_detran(session) -> int | None:
    """Detecta automaticamente a categoria de extração DETRAN."""
    resultado = session.execute(
        text("""
            SELECT cr.id, cr.nome
            FROM categorias_resumo_json cr
            JOIN prompt_groups pg ON cr.group_id = pg.id
            WHERE pg.slug = :slug
            ORDER BY cr.id
        """),
        {"slug": DETRAN_GROUP_SLUG}
    ).fetchall()

    if not resultado:
        return None

    for row in resultado:
        nome = (row[1] or "").lower()
        if "peticao" in nome or "detran" in nome:
            return row[0]

    return resultado[0][0] if len(resultado) == 1 else None


# ─── 1. SCHEMA DE EXTRAÇÃO ───

def importar_schema(session, dry_run: bool) -> bool:
    """Importa schema de extração DETRAN via JsonSyncService."""
    logger.info("=" * 60)
    logger.info("1. SCHEMA DE EXTRAÇÃO")
    logger.info("=" * 60)

    if not SCHEMA_FILE.exists():
        logger.error(f"Arquivo não encontrado: {SCHEMA_FILE}")
        return False

    with open(SCHEMA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    data.pop("_meta", None)
    logger.info(f"Schema carregado: {len(data)} variáveis")

    categoria_id = detectar_categoria_detran(session)
    if not categoria_id:
        logger.error("Categoria DETRAN não encontrada no banco.")
        return False

    logger.info(f"Categoria detectada: ID={categoria_id}")

    if dry_run:
        logger.info("[DRY-RUN] Variáveis que seriam aplicadas:")
        for slug, info in data.items():
            logger.info(f"  {slug} ({info.get('type', '?')})")
        return True

    # Importar models na ordem correta
    from auth.models import User  # noqa: F401
    from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON  # noqa: F401
    from sistemas.gerador_pecas.models_extraction import (  # noqa: F401
        ExtractionQuestion, ExtractionModel, ExtractionVariable,
        PromptVariableUsage, PromptActivationLog,
    )
    from admin.models_prompt_groups import PromptGroup, PromptSubgroup, PromptSubcategoria  # noqa: F401
    from admin.models_prompts import PromptModulo  # noqa: F401
    from sistemas.gerador_pecas.services_json_sync import JsonSyncService

    user_id = obter_primeiro_user_id(session)
    json_str = json.dumps(data, ensure_ascii=False)

    service = JsonSyncService(db=session)
    resultado = service.reconciliar_json(
        categoria_id=categoria_id,
        json_content=json_str,
        confirmar_remocao_variaveis_em_uso=False,
        user_id=user_id,
    )

    if not resultado.get("success"):
        logger.error(f"Erro: {resultado.get('erro')}")
        for err in resultado.get("erros_validacao", []):
            logger.error(f"  {err}")
        return False

    logger.info("Schema aplicado com sucesso!")
    logger.info(f"  Criadas: {resultado.get('perguntas_criadas', 0)} perguntas, {resultado.get('variaveis_criadas', 0)} variáveis")
    logger.info(f"  Atualizadas: {resultado.get('perguntas_atualizadas', 0)} perguntas, {resultado.get('variaveis_atualizadas', 0)} variáveis")
    return True


# ─── 2. MÓDULOS DE DEFESA ───

def importar_modulos(session, dry_run: bool) -> bool:
    """Importa módulos DETRAN via lógica direta no banco."""
    logger.info("=" * 60)
    logger.info("2. MÓDULOS DE DEFESA")
    logger.info("=" * 60)

    if not MODULOS_FILE.exists():
        logger.error(f"Arquivo não encontrado: {MODULOS_FILE}")
        return False

    with open(MODULOS_FILE, encoding="utf-8") as f:
        data = json.load(f)

    modulos = data.get("modulos", [])
    logger.info(f"Módulos carregados: {len(modulos)} (v{data.get('versao', '?')})")

    group_id = obter_group_id(session)
    if not group_id:
        logger.error("Grupo DETRAN não encontrado no banco.")
        return False

    logger.info(f"Grupo DETRAN: ID={group_id}")

    if dry_run:
        logger.info(f"[DRY-RUN] {len(modulos)} módulos seriam importados")
        return True

    from auth.models import User  # noqa: F401
    from admin.models_prompt_groups import PromptGroup, PromptSubgroup, PromptSubcategoria  # noqa: F401
    from admin.models_prompts import PromptModulo

    user_id = obter_primeiro_user_id(session)
    criados = 0
    atualizados = 0

    # Buscar subcategorias existentes
    subcategorias_map: dict[str, int] = {}
    rows = session.execute(
        text("SELECT id, slug FROM prompt_subcategorias WHERE group_id = :gid"),
        {"gid": group_id}
    ).fetchall()
    for r in rows:
        subcategorias_map[r[1]] = r[0]

    for mod in modulos:
        if mod.get("tipo") != "conteudo":
            continue

        nome = mod["nome"]
        existing = session.query(PromptModulo).filter(
            PromptModulo.nome == nome,
            PromptModulo.group_id == group_id
        ).first()

        regra_det = mod.get("regra_deterministica")
        regra_det_json = json.dumps(regra_det, ensure_ascii=False) if regra_det else None
        regra_sec = mod.get("regra_deterministica_secundaria")
        regra_sec_json = json.dumps(regra_sec, ensure_ascii=False) if regra_sec else None

        campos = {
            "titulo": mod.get("titulo", ""),
            "conteudo": mod.get("conteudo", ""),
            "condicao_ativacao": mod.get("condicao_ativacao", ""),
            "categoria": mod.get("categoria", "Mérito"),
            "subcategoria": mod.get("subcategoria", "Mérito"),
            "ordem": mod.get("ordem", 0),
            "palavras_chave": mod.get("palavras_chave", []),
            "tags": mod.get("tags", []),
            "modo_ativacao": mod.get("modo_ativacao", "llm"),
            "regra_deterministica": regra_det_json,
            "regra_texto_original": mod.get("regra_texto_original"),
            "fallback_habilitado": mod.get("fallback_habilitado", False),
            "regra_deterministica_secundaria": regra_sec_json,
            "regra_secundaria_texto_original": mod.get("regra_secundaria_texto_original"),
        }

        if existing:
            for k, v in campos.items():
                setattr(existing, k, v)
            atualizados += 1
        else:
            novo = PromptModulo(
                nome=nome,
                tipo="conteudo",
                group_id=group_id,
                ativo=True,
                **campos
            )
            session.add(novo)
            criados += 1

    logger.info(f"Módulos: {criados} criados, {atualizados} atualizados")
    return True


# ─── 3. PROMPT DE SISTEMA ───

def importar_prompt_sistema(session, dry_run: bool) -> bool:
    """Atualiza o prompt de sistema DETRAN (tipo='base')."""
    logger.info("=" * 60)
    logger.info("3. PROMPT DE SISTEMA")
    logger.info("=" * 60)

    if not PROMPT_FILE.exists():
        logger.error(f"Arquivo não encontrado: {PROMPT_FILE}")
        return False

    conteudo = PROMPT_FILE.read_text(encoding="utf-8")
    logger.info(f"Prompt carregado: {len(conteudo)} caracteres")

    group_id = obter_group_id(session)
    if not group_id:
        logger.error("Grupo DETRAN não encontrado.")
        return False

    if dry_run:
        logger.info(f"[DRY-RUN] Prompt seria atualizado para grupo {group_id}")
        return True

    from auth.models import User  # noqa: F401
    from admin.models_prompt_groups import PromptGroup, PromptSubgroup, PromptSubcategoria  # noqa: F401
    from admin.models_prompts import PromptModulo

    user_id = obter_primeiro_user_id(session)

    # Buscar módulo base existente do DETRAN
    base = session.query(PromptModulo).filter(
        PromptModulo.tipo == "base",
        PromptModulo.group_id == group_id
    ).first()

    if base:
        base.conteudo = conteudo
        base.titulo = "Prompt de Sistema — DETRAN/MS (Repertório Argumentativo)"
        logger.info(f"Prompt base atualizado (ID={base.id})")
    else:
        novo = PromptModulo(
            nome="detran_sistema_base",
            tipo="base",
            titulo="Prompt de Sistema — DETRAN/MS (Repertório Argumentativo)",
            conteudo=conteudo,
            group_id=group_id,
            ordem=1,
            ativo=True,
        )
        session.add(novo)
        logger.info("Prompt base criado (novo registro)")

    return True


# ─── MAIN ───

def main():
    parser = argparse.ArgumentParser(description="Importação completa DETRAN v3.1")
    parser.add_argument("--db-url", type=str, help="URL do banco (default: DATABASE_URL do .env)")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem alterar o banco")
    parser.add_argument(
        "--apenas", choices=["schema", "modulos", "prompt"],
        help="Importar apenas um item"
    )
    args = parser.parse_args()

    db_url = args.db_url or os.getenv("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL não definida.")
        sys.exit(1)

    # Log seguro (oculta senha)
    url_safe = db_url.split("@")[-1] if "@" in db_url else db_url
    logger.info(f"Conectando em: ...@{url_safe}")

    engine, session = get_session(db_url)

    try:
        # Verificar conexão
        session.execute(text("SELECT 1"))
        logger.info("Conexão OK\n")

        sucesso = True
        itens = [args.apenas] if args.apenas else ["schema", "modulos", "prompt"]

        for item in itens:
            if item == "schema":
                ok = importar_schema(session, args.dry_run)
            elif item == "modulos":
                ok = importar_modulos(session, args.dry_run)
            elif item == "prompt":
                ok = importar_prompt_sistema(session, args.dry_run)
            else:
                continue

            if not ok:
                sucesso = False
                logger.error(f"FALHA em: {item}")
            print()

        if sucesso and not args.dry_run:
            session.commit()
            logger.info("COMMIT realizado com sucesso!")
        elif not sucesso:
            session.rollback()
            logger.error("ROLLBACK — houve erros.")
            sys.exit(1)

    except Exception as e:
        session.rollback()
        logger.error(f"Erro fatal: {e}")
        raise
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
