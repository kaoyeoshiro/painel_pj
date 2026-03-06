#!/usr/bin/env python3
"""
Diagnóstico de prompts em produção.

Executa queries de análise sobre prompt_modulos e prompt_groups para
detectar duplicatas, módulos sobrescritos e distribuição por grupo/tipo.

Uso:
    python scripts/data-fix/diagnostico_prompts_producao.py --db-url "postgresql://user:pass@host:5432/db"
"""

import io
import sys
import argparse
from datetime import datetime

# Encoding UTF-8 para Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from sqlalchemy import create_engine, text


# ============================================================
# CLI
# ============================================================

def parse_args() -> argparse.Namespace:
    """Processa argumentos de linha de comando."""
    parser = argparse.ArgumentParser(
        description="Diagnóstico de prompts em produção"
    )
    parser.add_argument(
        "--db-url",
        type=str,
        required=True,
        help="URL do banco de dados PostgreSQL (obrigatório)",
    )
    return parser.parse_args()


# ============================================================
# QUERIES
# ============================================================

SQL_MODULOS_BASE_PECA = text("""
    SELECT pm.id, pm.tipo, pm.nome, pm.titulo, pm.group_id, pg.slug as grupo,
           pm.ativo, pm.versao, pm.atualizado_em
    FROM prompt_modulos pm
    LEFT JOIN prompt_groups pg ON pm.group_id = pg.id
    WHERE pm.tipo IN ('base', 'peca')
    ORDER BY pm.tipo, pm.group_id, pm.nome
""")

SQL_DUPLICATAS_PECA = text("""
    SELECT tipo, nome, group_id, COUNT(*) as qty
    FROM prompt_modulos
    WHERE tipo = 'peca' AND ativo = true
    GROUP BY tipo, nome, group_id
    HAVING COUNT(*) > 1
""")

SQL_HISTORICO_PS = text("""
    SELECT h.id, h.modulo_id, h.versao, h.group_id, h.motivo, h.alterado_em,
           pm.nome, pm.group_id as group_id_atual
    FROM prompt_modulos_historico h
    JOIN prompt_modulos pm ON h.modulo_id = pm.id
    WHERE h.group_id = 1
    ORDER BY h.alterado_em DESC
    LIMIT 20
""")

SQL_MODULOS_DETRAN = text("""
    SELECT pm.id, pm.nome, pm.tipo, pm.group_id, pg.slug,
           pm.atualizado_em, pm.versao
    FROM prompt_modulos pm
    LEFT JOIN prompt_groups pg ON pm.group_id = pg.id
    WHERE pm.group_id = 3
      AND pm.tipo IN ('base', 'peca')
    ORDER BY pm.tipo
""")

SQL_CONTAGEM_POR_GRUPO = text("""
    SELECT pg.slug as grupo, pm.tipo, COUNT(*) as total
    FROM prompt_modulos pm
    LEFT JOIN prompt_groups pg ON pm.group_id = pg.id
    WHERE pm.ativo = true
    GROUP BY pg.slug, pm.tipo
    ORDER BY pg.slug, pm.tipo
""")


# ============================================================
# FORMATAÇÃO
# ============================================================

def print_header(titulo: str) -> None:
    """Imprime cabeçalho de seção."""
    print()
    print("=" * 80)
    print(f"  {titulo}")
    print("=" * 80)


def print_subheader(titulo: str) -> None:
    """Imprime subcabeçalho de seção."""
    print()
    print(f"--- {titulo} ---")
    print()


def truncar(valor: str | None, tamanho: int) -> str:
    """Trunca string para caber na coluna."""
    if valor is None:
        return "NULL".ljust(tamanho)
    s = str(valor)
    if len(s) > tamanho:
        return s[: tamanho - 3] + "..."
    return s.ljust(tamanho)


# ============================================================
# EXECUÇÃO DAS QUERIES
# ============================================================

def executar_query1(conn) -> int:
    """Query 1 — Listar TODOS os módulos base/peca por grupo."""
    print_header("QUERY 1 — Módulos base/peca por grupo")

    result = conn.execute(SQL_MODULOS_BASE_PECA)
    rows = [dict(r._mapping) for r in result]

    if not rows:
        print("  Nenhum registro encontrado.")
        return 0

    # Cabeçalho da tabela
    print(
        f"{'ID':>5}  {'TIPO':<8}  {'NOME':<40}  {'TITULO':<30}  "
        f"{'GRP':>3}  {'GRUPO':<10}  {'ATIVO':<5}  {'VER':>3}  {'ATUALIZADO':<20}"
    )
    print("-" * 140)

    for r in rows:
        ativo_str = "Sim" if r["ativo"] else "Nao"
        atualizado = r["atualizado_em"].strftime("%Y-%m-%d %H:%M") if r["atualizado_em"] else "N/A"
        print(
            f"{r['id']:>5}  {truncar(r['tipo'], 8)}  {truncar(r['nome'], 40)}  "
            f"{truncar(r['titulo'], 30)}  {r['group_id'] or 0:>3}  "
            f"{truncar(r['grupo'], 10)}  {ativo_str:<5}  {r['versao'] or 0:>3}  {atualizado:<20}"
        )

    print(f"\n  Total: {len(rows)} módulos base/peca")
    return len(rows)


def executar_query2(conn) -> int:
    """Query 2 — Detectar duplicatas de peca por group_id."""
    print_header("QUERY 2 — Duplicatas de peca ativa por group_id")

    result = conn.execute(SQL_DUPLICATAS_PECA)
    rows = [dict(r._mapping) for r in result]

    if not rows:
        print("  Nenhuma duplicata encontrada. OK!")
        return 0

    print(f"  ATENCAO: {len(rows)} duplicata(s) detectada(s)!")
    print()
    print(f"{'TIPO':<8}  {'NOME':<50}  {'GROUP_ID':>8}  {'QTY':>4}")
    print("-" * 80)

    for r in rows:
        print(
            f"{truncar(r['tipo'], 8)}  {truncar(r['nome'], 50)}  "
            f"{r['group_id'] or 0:>8}  {r['qty']:>4}"
        )

    print(f"\n  Total de duplicatas: {len(rows)}")
    return len(rows)


def executar_query3(conn) -> int:
    """Query 3 — Histórico de módulos PS (group_id=1) sobrescritos."""
    print_header("QUERY 3 — Histórico de módulos PS sobrescritos (group_id=1)")

    result = conn.execute(SQL_HISTORICO_PS)
    rows = [dict(r._mapping) for r in result]

    if not rows:
        print("  Nenhum registro de histórico encontrado para group_id=1.")
        return 0

    print(
        f"{'H.ID':>5}  {'MOD_ID':>6}  {'VER':>3}  {'GRP_H':>5}  "
        f"{'GRP_ATUAL':>9}  {'NOME':<35}  {'MOTIVO':<25}  {'ALTERADO_EM':<20}"
    )
    print("-" * 140)

    for r in rows:
        alterado = r["alterado_em"].strftime("%Y-%m-%d %H:%M") if r["alterado_em"] else "N/A"
        print(
            f"{r['id']:>5}  {r['modulo_id']:>6}  {r['versao'] or 0:>3}  "
            f"{r['group_id'] or 0:>5}  {r['group_id_atual'] or 0:>9}  "
            f"{truncar(r['nome'], 35)}  {truncar(r['motivo'], 25)}  {alterado:<20}"
        )

    print(f"\n  Total de registros: {len(rows)}")
    return len(rows)


def executar_query4(conn) -> int:
    """Query 4 — Módulos com group_id DETRAN (3)."""
    print_header("QUERY 4 — Módulos base/peca com group_id DETRAN (3)")

    result = conn.execute(SQL_MODULOS_DETRAN)
    rows = [dict(r._mapping) for r in result]

    if not rows:
        print("  Nenhum módulo base/peca encontrado com group_id=3 (DETRAN).")
        return 0

    print(
        f"{'ID':>5}  {'NOME':<45}  {'TIPO':<8}  {'GRP':>3}  "
        f"{'SLUG':<10}  {'ATUALIZADO':<20}  {'VER':>3}"
    )
    print("-" * 110)

    for r in rows:
        atualizado = r["atualizado_em"].strftime("%Y-%m-%d %H:%M") if r["atualizado_em"] else "N/A"
        print(
            f"{r['id']:>5}  {truncar(r['nome'], 45)}  {truncar(r['tipo'], 8)}  "
            f"{r['group_id'] or 0:>3}  {truncar(r['slug'], 10)}  {atualizado:<20}  "
            f"{r['versao'] or 0:>3}"
        )

    print(f"\n  Total: {len(rows)} módulos DETRAN base/peca")
    return len(rows)


def executar_query5(conn) -> int:
    """Query 5 — Contagem de módulos ativos por grupo e tipo."""
    print_header("QUERY 5 — Contagem de módulos ativos por grupo e tipo")

    result = conn.execute(SQL_CONTAGEM_POR_GRUPO)
    rows = [dict(r._mapping) for r in result]

    if not rows:
        print("  Nenhum módulo ativo encontrado.")
        return 0

    print(f"{'GRUPO':<15}  {'TIPO':<15}  {'TOTAL':>6}")
    print("-" * 40)

    total_geral = 0
    for r in rows:
        grupo_label = r["grupo"] or "(sem grupo)"
        print(f"{truncar(grupo_label, 15)}  {truncar(r['tipo'], 15)}  {r['total']:>6}")
        total_geral += r["total"]

    print("-" * 40)
    print(f"{'TOTAL GERAL':<15}  {'':<15}  {total_geral:>6}")
    return len(rows)


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    """Ponto de entrada do diagnóstico."""
    args = parse_args()

    print_header("DIAGNOSTICO DE PROMPTS — PRODUCAO")
    print(f"  Data/hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Banco: {args.db_url[:30]}...")  # Não exibir URL completa por segurança

    engine = create_engine(args.db_url, echo=False, pool_pre_ping=True)

    # Contadores para o resumo
    totais: dict[str, int] = {}

    with engine.connect() as conn:
        totais["modulos_base_peca"] = executar_query1(conn)
        totais["duplicatas_peca"] = executar_query2(conn)
        totais["historico_ps"] = executar_query3(conn)
        totais["modulos_detran"] = executar_query4(conn)
        totais["linhas_contagem"] = executar_query5(conn)

    engine.dispose()

    # Resumo final
    print_header("RESUMO DO DIAGNOSTICO")
    print(f"  Módulos base/peca encontrados:  {totais['modulos_base_peca']}")
    print(f"  Duplicatas de peca detectadas:  {totais['duplicatas_peca']}")
    print(f"  Registros histórico PS:         {totais['historico_ps']}")
    print(f"  Módulos DETRAN (group_id=3):    {totais['modulos_detran']}")
    print(f"  Linhas na contagem grupo/tipo:  {totais['linhas_contagem']}")
    print()

    if totais["duplicatas_peca"] > 0:
        print("  ** ALERTA: Existem duplicatas de peca ativa. Verifique a Query 2. **")
    else:
        print("  Nenhum problema critico detectado.")

    print()
    print("  Diagnóstico concluído.")


if __name__ == "__main__":
    main()
