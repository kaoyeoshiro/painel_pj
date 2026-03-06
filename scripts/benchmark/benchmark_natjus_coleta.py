#!/usr/bin/env python3
# scripts/benchmark/benchmark_natjus_coleta.py
"""
Benchmark NATJus — Passo 1: Coleta de Casos.

Busca casos com ground truth NATJus no banco de produção, baixa o documento
do TJ-MS para cada processo e salva um cache JSON para uso offline no Passo 2.

Uso:
    python scripts/benchmark/benchmark_natjus_coleta.py
    python scripts/benchmark/benchmark_natjus_coleta.py --limit 30 --output data/casos_natjus.json

Saída:
    scripts/benchmark/data/casos_natjus.json

Autor: LAB/PGE-MS
"""

import os
import sys
import json
import asyncio
import argparse
import base64
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

# Adiciona raiz do projeto ao path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

# Workaround: evita executar services/__init__.py que tem dependência incompatível
# com Python 3.13 (wrapt via slowapi/limits). O __init__ importa text_normalizer
# que usa slowapi. Injetamos um stub vazio mas com __path__ para os subpacotes
# (tjms, gemini_service) serem importáveis normalmente.
import types as _types
if "services" not in sys.modules:
    _stub = _types.ModuleType("services")
    _stub.__path__ = [str(PROJECT_ROOT / "services")]
    _stub.__package__ = "services"
    sys.modules["services"] = _stub

from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Constante: categoria NATJus
NOME_CATEGORIA_NATJUS = "pareceres"


def conectar_banco():
    """Cria engine e sessão com o banco de dados."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL não definida no .env")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    return engine, Session()


def buscar_codigos_natjus(db) -> list[int]:
    """Busca códigos de documento da categoria NATJus no banco."""
    from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON

    categoria = db.query(CategoriaResumoJSON).filter(
        CategoriaResumoJSON.nome == NOME_CATEGORIA_NATJUS
    ).first()

    if not categoria or not categoria.codigos_documento:
        raise RuntimeError(
            f"Categoria '{NOME_CATEGORIA_NATJUS}' não encontrada ou sem códigos configurados"
        )

    logger.info(f"Códigos NATJus: {categoria.codigos_documento}")
    return categoria.codigos_documento


def buscar_casos_banco(engine, limit: int) -> list[dict]:
    """
    Busca casos com ground truth NATJus no banco.

    Retorna lista de dicts com: geracao_id, numero_processo, ground_truth.
    """
    sql = text("""
        SELECT id, numero_cnj, dados_processo
        FROM geracoes_pecas
        WHERE dados_processo IS NOT NULL
          AND dados_processo::text LIKE '%"parecer_%'
        ORDER BY RANDOM()
        LIMIT :limit
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, {"limit": limit}).fetchall()

    casos = []
    for row in rows:
        geracao_id, numero_processo, dados_processo = row
        if isinstance(dados_processo, str):
            dados_processo = json.loads(dados_processo)

        # Extrai apenas campos parecer_* como ground truth
        ground_truth = {
            k: v for k, v in dados_processo.items()
            if k.startswith("parecer_") or k.startswith("pareceres_")
        }

        if ground_truth:
            casos.append({
                "geracao_id": geracao_id,
                "numero_processo": numero_processo,
                "ground_truth": ground_truth,
            })

    logger.info(f"Casos encontrados no banco: {len(casos)}")
    return casos


async def baixar_documento_natjus(
    numero_processo: str,
    codigos_natjus: list[int],
) -> Optional[dict]:
    """
    Consulta o processo no TJ-MS e baixa o primeiro documento NATJus encontrado.

    Retorna dict com id, tipo_documento, texto_extraido (e conteudo_base64 como fallback).
    """
    from services.tjms.client import TJMSClient
    from services.tjms.config import TJMSConfig
    from services.tjms.models import ConsultaOptions, DownloadOptions

    config = TJMSConfig()
    async with TJMSClient(config=config) as client:
        try:
            processo = await client.consultar_processo(
                numero_processo,
                options=ConsultaOptions(incluir_documentos=True, incluir_movimentos=False),
            )
        except Exception as e:
            logger.warning(f"  Erro ao consultar {numero_processo}: {e}")
            return None

        # Filtra documentos pelo código NATJus
        docs_natjus = [
            doc for doc in processo.documentos
            if doc.tipo_codigo in codigos_natjus
        ]

        if not docs_natjus:
            logger.warning(f"  Nenhum doc NATJus em {numero_processo} "
                           f"(codigos buscados: {codigos_natjus})")
            return None

        # Baixa apenas o primeiro (mais recente é o padrão por ordem de inserção)
        doc_meta = docs_natjus[0]
        logger.info(f"  Baixando doc {doc_meta.id} (tipo={doc_meta.tipo_codigo})")

        try:
            doc_baixado = await client.baixar_documento(
                numero_processo,
                doc_meta.id,
                options=DownloadOptions(),
            )
        except Exception as e:
            logger.warning(f"  Erro ao baixar doc {doc_meta.id}: {e}")
            return None

        resultado = {
            "id": doc_meta.id,
            "tipo_documento": str(doc_meta.tipo_codigo),
        }

        if doc_baixado.texto_extraido:
            resultado["texto_extraido"] = doc_baixado.texto_extraido
        elif doc_baixado.conteudo_bytes:
            # Fallback: base64 para uso com visão
            resultado["texto_extraido"] = None
            resultado["conteudo_base64"] = [
                base64.b64encode(doc_baixado.conteudo_bytes).decode()
            ]
        else:
            logger.warning(f"  Doc {doc_meta.id} sem conteúdo extraído e sem bytes")
            return None

        return resultado


def reconstruir_texto_natjus(dados_processo: dict) -> Optional[str]:
    """
    Reconstrói o texto bruto do documento NATJus a partir dos campos extraídos.

    Usa campos de texto verbatim (conclusão, fundamentos, etc.) que são cópias
    diretas do documento original. Serve como substituto quando o acesso ao
    TJ-MS não está disponível localmente.

    Args:
        dados_processo: Dicionário com campos pareceres_* extraídos

    Returns:
        Texto reconstruído ou None se dados insuficientes
    """
    numero = dados_processo.get("pareceres_numero", "")
    patologias = dados_processo.get("pareceres_patologias_parte_autora", [])
    fundamentos = dados_processo.get("pareceres_fundamentos_parecer", "")
    conclusao = dados_processo.get("pareceres_conclusao_parecer_nat", "")
    rec_conitec = dados_processo.get("pareceres_recomendacao_negativa_conitec", "")

    if not conclusao and not fundamentos:
        return None

    partes = [f"NOTA TÉCNICA NATJus — PARECER Nº {numero}" if numero else "NOTA TÉCNICA NATJus"]

    if isinstance(patologias, list) and patologias:
        partes.append("\nDIAGNÓSTICO E PATOLOGIAS:")
        for p in patologias:
            partes.append(f"  - {p}")

    if rec_conitec:
        partes.append(f"\nRECOMENDAÇÃO CONITEC:\n{rec_conitec}")

    if fundamentos:
        partes.append(f"\nANÁLISE TÉCNICA:\n{fundamentos}")

    if conclusao:
        partes.append(f"\nCONCLUSÃO DO NÚCLEO DE APOIO TÉCNICO:\n{conclusao}")

    return "\n".join(partes)


def coletar_casos_from_db(engine, limit: int) -> list[dict]:
    """
    Coleta casos NATJus diretamente do banco, reconstruindo texto do documento
    a partir dos campos já extraídos (modo offline, sem acesso TJ-MS).

    Args:
        engine: SQLAlchemy engine
        limit: máximo de casos

    Returns:
        Lista de dicts no mesmo formato que buscar_casos_banco()
    """
    sql = text("""
        SELECT id, numero_cnj, dados_processo
        FROM geracoes_pecas
        WHERE dados_processo IS NOT NULL
          AND dados_processo::text LIKE '%"pareceres_%'
          AND dados_processo::text LIKE '%pareceres_conclusao_parecer_nat%'
        ORDER BY id DESC
        LIMIT :limit
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, {"limit": limit}).fetchall()

    casos = []
    for row in rows:
        geracao_id, numero_processo, dados_processo = row
        if isinstance(dados_processo, str):
            dados_processo = json.loads(dados_processo)

        ground_truth = {
            k: v for k, v in dados_processo.items()
            if k.startswith("pareceres_") and isinstance(v, bool)
        }

        if not ground_truth:
            continue

        texto = reconstruir_texto_natjus(dados_processo)
        if not texto:
            continue

        casos.append({
            "geracao_id": geracao_id,
            "numero_processo": numero_processo,
            "ground_truth": ground_truth,
            "documento": {
                "id": f"db-{geracao_id}",
                "tipo_documento": "8451",  # código NATJus padrão
                "texto_extraido": texto,
                "fonte": "reconstruido_db",
            },
        })

    logger.info(f"Casos coletados do banco (modo --from-db): {len(casos)}")
    return casos


async def coletar_casos(limit: int, output_path: Path, from_db: bool = False) -> None:
    """Pipeline principal de coleta."""
    engine, db = conectar_banco()

    try:
        if from_db:
            logger.info("Modo --from-db: reconstruindo texto do banco sem acessar TJ-MS")
            resultado = coletar_casos_from_db(engine, limit)
        else:
            codigos_natjus = buscar_codigos_natjus(db)
            casos = buscar_casos_banco(engine, limit)
            db.close()

            if not casos:
                logger.error("Nenhum caso encontrado no banco. Verifique a query.")
                return

            resultado = []
            total = len(casos)

            for i, caso in enumerate(casos, start=1):
                numero = caso["numero_processo"]
                logger.info(f"[{i}/{total}] Buscando processo {numero}")

                documento = await baixar_documento_natjus(numero, codigos_natjus)

                if documento:
                    resultado.append({
                        "geracao_id": caso["geracao_id"],
                        "numero_processo": numero,
                        "ground_truth": caso["ground_truth"],
                        "documento": documento,
                    })
                    logger.info(f"  OK — {len(caso['ground_truth'])} campos ground_truth | "
                                f"texto: {len(documento.get('texto_extraido') or '')} chars")
                else:
                    logger.warning(f"  PULADO — sem documento NATJus válido")
    finally:
        if db and not from_db:
            try:
                db.close()
            except Exception:
                pass

    # Salva cache
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "gerado_em": datetime.now().isoformat(),
                "total_casos": len(resultado),
                "fonte": "banco_local" if from_db else "tjms",
                "casos": resultado,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    logger.info(f"\nCache salvo: {output_path} ({len(resultado)} casos)")
    if not from_db:
        logger.info(f"Com texto extraído: "
                    f"{sum(1 for c in resultado if c['documento'].get('texto_extraido'))}")
        logger.info(f"Apenas base64 (PDF digitalizado): "
                    f"{sum(1 for c in resultado if not c['documento'].get('texto_extraido'))}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Coleta casos NATJus do banco para benchmark offline"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=80,
        help="Máximo de casos a buscar no banco (default: 80)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/casos_natjus.json",
        help="Caminho do arquivo de saída relativo a scripts/benchmark/",
    )
    parser.add_argument(
        "--from-db",
        action="store_true",
        help="Reconstrói texto do documento a partir do banco (sem acesso TJ-MS)",
    )
    args = parser.parse_args()

    output_path = SCRIPT_DIR / args.output
    asyncio.run(coletar_casos(args.limit, output_path, from_db=args.from_db))


if __name__ == "__main__":
    main()
