#!/usr/bin/env python3
"""
Restauração de prompts do grupo PS (Procuradoria de Saúde, group_id=1).

Estratégia de restauração (em ordem de prioridade):

  A) Restaurar do histórico (prompt_modulos_historico):
     - Busca entradas com group_id=1 para módulos que atualmente estão
       em outro group_id ou inativos. Restaura conteúdo da versão mais recente.

  B) Restaurar de outro banco (--source-db):
     - Se informado, conecta ao banco local e extrai prompts PS de lá.

  C) Criar módulos base/peca ausentes:
     - Se PS não possui módulos tipo=base ou tipo=peca, tenta duplicar
       a partir de módulos com mesmo nome em outro group_id (exceto DETRAN).

Uso:
    # Apenas diagnóstico (dry-run é o padrão):
    python scripts/data-fix/restaurar_prompts_ps.py --db-url "postgresql://..."

    # Aplicar alterações:
    python scripts/data-fix/restaurar_prompts_ps.py --db-url "postgresql://..." --execute

    # Restaurar a partir de um banco local:
    python scripts/data-fix/restaurar_prompts_ps.py --db-url "postgresql://..." --source-db "postgresql://..." --execute
"""

import sys
import io
import argparse
import logging
from datetime import datetime

# Encoding UTF-8 para Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Grupo PS = 1 (Procuradoria de Saúde)
PS_GROUP_ID = 1

# Slug do grupo DETRAN — conteúdo incompatível com PS
DETRAN_GROUP_SLUG = "detran"

# Nomes esperados dos módulos base/peca do PS
NOMES_MODULOS_PS = [
    "system_prompt",
    "contestacao",
    "recurso_apelacao",
    "agravo_instrumento",
    "contrarrazoes_apelacao",
    "alegacoes_finais",
    "contrarrazoes_recurso",
]


# ============================================================
# CLI
# ============================================================

def parse_args() -> argparse.Namespace:
    """Configura e retorna argumentos CLI."""
    parser = argparse.ArgumentParser(
        description="Restauração de prompts PS (group_id=1)"
    )
    parser.add_argument(
        "--db-url", type=str, required=True,
        help="URL do banco de dados alvo (obrigatório)"
    )
    parser.add_argument(
        "--source-db", type=str, default=None,
        help="URL do banco de dados fonte para Opção B (restaurar de outro banco)"
    )
    parser.add_argument(
        "--execute", action="store_true", default=False,
        help="Aplicar alterações (padrão: dry-run, apenas mostra o que seria feito)"
    )
    return parser.parse_args()


# ============================================================
# DIAGNÓSTICO — estado atual
# ============================================================

def diagnosticar_estado_atual(conn) -> dict:
    """
    Exibe e retorna o estado atual dos módulos PS no banco alvo.

    Retorna dicionário com listas de módulos encontrados por categoria.
    """
    logger.info("=" * 60)
    logger.info("DIAGNÓSTICO — Estado atual dos módulos PS (group_id=%d)", PS_GROUP_ID)
    logger.info("=" * 60)

    # Verifica se o grupo PS existe
    grupo = conn.execute(
        text("SELECT id, nome, slug FROM prompt_groups WHERE id = :gid"),
        {"gid": PS_GROUP_ID}
    ).fetchone()

    if not grupo:
        logger.warning("Grupo PS (id=%d) NÃO encontrado na tabela prompt_groups!", PS_GROUP_ID)
        return {"grupo_existe": False, "modulos_ps": [], "modulos_historico": [], "modulos_outros": []}

    logger.info("Grupo encontrado: id=%d, nome='%s', slug='%s'", grupo[0], grupo[1], grupo[2])

    # Módulos PS atuais (base/peca)
    modulos_ps = conn.execute(
        text("""
            SELECT id, tipo, nome, titulo, group_id, ativo, versao
            FROM prompt_modulos
            WHERE group_id = :gid AND tipo IN ('base', 'peca')
            ORDER BY tipo, nome
        """),
        {"gid": PS_GROUP_ID}
    ).fetchall()

    logger.info("\nMódulos PS atuais (base/peca): %d", len(modulos_ps))
    for m in modulos_ps:
        status = "ATIVO" if m[5] else "INATIVO"
        logger.info("  id=%d | tipo=%s | nome=%s | titulo=%s | v%d | %s",
                     m[0], m[1], m[2], m[3], m[6], status)

    # Histórico de PS
    historico = conn.execute(
        text("""
            SELECT DISTINCT ON (h.modulo_id)
                h.modulo_id, h.versao, h.group_id,
                pm.nome, pm.tipo, pm.group_id AS group_id_atual, pm.ativo
            FROM prompt_modulos_historico h
            JOIN prompt_modulos pm ON h.modulo_id = pm.id
            WHERE h.group_id = :gid AND pm.tipo IN ('base', 'peca')
            ORDER BY h.modulo_id, h.versao DESC
        """),
        {"gid": PS_GROUP_ID}
    ).fetchall()

    logger.info("\nHistórico PS (versão mais recente por módulo): %d entradas", len(historico))
    for h in historico:
        migrou = " ** MIGROU p/ group_id=%d **" % h[5] if h[5] != PS_GROUP_ID else ""
        inativo = " [INATIVO]" if not h[6] else ""
        logger.info("  modulo_id=%d | nome=%s | tipo=%s | hist_v%d | atual_group=%d%s%s",
                     h[0], h[3], h[4], h[1], h[5], migrou, inativo)

    # Módulos com nomes PS em outros grupos
    modulos_outros = conn.execute(
        text("""
            SELECT pm.id, pm.nome, pm.tipo, pm.group_id, pg.slug, pm.ativo
            FROM prompt_modulos pm
            LEFT JOIN prompt_groups pg ON pm.group_id = pg.id
            WHERE pm.nome IN :nomes
              AND pm.tipo IN ('base', 'peca')
            ORDER BY pm.nome, pm.group_id
        """),
        {"nomes": tuple(NOMES_MODULOS_PS)}
    ).fetchall()

    logger.info("\nMódulos com nomes PS em todos os grupos: %d", len(modulos_outros))
    for m in modulos_outros:
        marcador = " <-- PS" if m[3] == PS_GROUP_ID else ""
        status = "ATIVO" if m[5] else "INATIVO"
        logger.info("  id=%d | nome=%s | tipo=%s | group_id=%d (%s) | %s%s",
                     m[0], m[1], m[2], m[3], m[4] or "?", status, marcador)

    return {
        "grupo_existe": True,
        "modulos_ps": modulos_ps,
        "modulos_historico": historico,
        "modulos_outros": modulos_outros,
    }


# ============================================================
# OPÇÃO A — restaurar do histórico
# ============================================================

def restaurar_do_historico(conn, dry_run: bool) -> list[dict]:
    """
    Busca módulos que tinham group_id=1 no histórico mas atualmente
    estão em outro group_id ou inativos. Restaura conteúdo e group_id.

    Retorna lista de ações executadas (ou planejadas em dry-run).
    """
    logger.info("\n" + "=" * 60)
    logger.info("OPÇÃO A — Restaurar do histórico")
    logger.info("=" * 60)

    # Busca a versão mais recente do histórico com group_id=1
    # para módulos que atualmente NÃO estão no PS ou estão inativos
    candidatos = conn.execute(
        text("""
            SELECT DISTINCT ON (h.modulo_id)
                h.modulo_id,
                h.versao AS hist_versao,
                h.conteudo AS hist_conteudo,
                h.condicao_ativacao AS hist_condicao,
                h.palavras_chave AS hist_palavras_chave,
                h.tags AS hist_tags,
                h.modo_ativacao AS hist_modo_ativacao,
                h.regra_deterministica AS hist_regra,
                pm.nome,
                pm.tipo,
                pm.titulo,
                pm.group_id AS group_id_atual,
                pm.ativo AS ativo_atual,
                pm.versao AS versao_atual
            FROM prompt_modulos_historico h
            JOIN prompt_modulos pm ON h.modulo_id = pm.id
            WHERE h.group_id = :gid
              AND pm.tipo IN ('base', 'peca')
              AND (pm.group_id != :gid OR pm.ativo = false)
            ORDER BY h.modulo_id, h.versao DESC
        """),
        {"gid": PS_GROUP_ID}
    ).fetchall()

    if not candidatos:
        logger.info("Nenhum módulo para restaurar do histórico.")
        return []

    acoes = []
    for c in candidatos:
        acao = {
            "tipo": "restaurar_historico",
            "modulo_id": c[0],
            "nome": c[8],
            "tipo_modulo": c[9],
            "titulo": c[10],
            "de_group_id": c[11],
            "para_group_id": PS_GROUP_ID,
            "ativo_atual": c[12],
            "hist_versao": c[1],
        }

        descricao_partes = []
        if c[11] != PS_GROUP_ID:
            descricao_partes.append(f"group_id {c[11]} -> {PS_GROUP_ID}")
        if not c[12]:
            descricao_partes.append("ativo false -> true")
        descricao_partes.append(f"conteúdo da v{c[1]} do histórico")

        acao["descricao"] = " | ".join(descricao_partes)
        logger.info("  [RESTAURAR] id=%d nome=%s: %s", c[0], c[8], acao["descricao"])

        if not dry_run:
            conn.execute(
                text("""
                    UPDATE prompt_modulos SET
                        group_id = :gid,
                        ativo = true,
                        conteudo = :conteudo,
                        condicao_ativacao = :condicao,
                        palavras_chave = CAST(:palavras_chave AS jsonb),
                        tags = CAST(:tags AS jsonb),
                        modo_ativacao = COALESCE(:modo_ativacao, modo_ativacao),
                        versao = versao + 1,
                        atualizado_em = NOW()
                    WHERE id = :mid
                """),
                {
                    "gid": PS_GROUP_ID,
                    "conteudo": c[2],
                    "condicao": c[3],
                    "palavras_chave": str(c[4]) if c[4] else None,
                    "tags": str(c[5]) if c[5] else None,
                    "modo_ativacao": c[6],
                    "mid": c[0],
                }
            )

        acoes.append(acao)

    logger.info("Total Opção A: %d módulos %s",
                len(acoes), "restaurados" if not dry_run else "(dry-run)")
    return acoes


# ============================================================
# OPÇÃO B — restaurar de outro banco
# ============================================================

def restaurar_do_source_db(conn, source_db_url: str, dry_run: bool) -> list[dict]:
    """
    Conecta ao banco fonte e copia módulos PS para o banco alvo.

    Retorna lista de ações executadas (ou planejadas em dry-run).
    """
    logger.info("\n" + "=" * 60)
    logger.info("OPÇÃO B — Restaurar do banco fonte")
    logger.info("=" * 60)

    source_engine = create_engine(source_db_url)

    with source_engine.connect() as source_conn:
        modulos_fonte = source_conn.execute(
            text("""
                SELECT id, tipo, nome, titulo, conteudo, condicao_ativacao,
                       palavras_chave, tags, modo_ativacao, regra_deterministica,
                       regra_texto_original, ativo, ordem, versao, categoria,
                       subcategoria
                FROM prompt_modulos
                WHERE group_id = :gid AND tipo IN ('base', 'peca')
                ORDER BY tipo, ordem
            """),
            {"gid": PS_GROUP_ID}
        ).fetchall()

    source_engine.dispose()

    if not modulos_fonte:
        logger.warning("Nenhum módulo PS (base/peca) encontrado no banco fonte.")
        return []

    logger.info("Módulos PS encontrados no banco fonte: %d", len(modulos_fonte))

    # Busca módulos PS já existentes no alvo
    existentes_alvo = conn.execute(
        text("""
            SELECT nome, id FROM prompt_modulos
            WHERE group_id = :gid AND tipo IN ('base', 'peca')
        """),
        {"gid": PS_GROUP_ID}
    ).fetchall()
    mapa_existentes = {row[0]: row[1] for row in existentes_alvo}

    acoes = []
    for m in modulos_fonte:
        # m: id, tipo, nome, titulo, conteudo, condicao_ativacao,
        #    palavras_chave, tags, modo_ativacao, regra_deterministica,
        #    regra_texto_original, ativo, ordem, versao, categoria, subcategoria
        nome = m[2]
        fonte_id = m[0]

        if nome in mapa_existentes:
            # Atualizar módulo existente
            acao = {
                "tipo": "atualizar_do_fonte",
                "modulo_id": mapa_existentes[nome],
                "nome": nome,
                "tipo_modulo": m[1],
                "titulo": m[3],
                "descricao": f"Atualizado com conteúdo do banco fonte (fonte_id={fonte_id})",
            }
            logger.info("  [ATUALIZAR] nome=%s (alvo_id=%d <- fonte_id=%d)",
                         nome, mapa_existentes[nome], fonte_id)

            if not dry_run:
                conn.execute(
                    text("""
                        UPDATE prompt_modulos SET
                            titulo = :titulo,
                            conteudo = :conteudo,
                            condicao_ativacao = :condicao,
                            palavras_chave = CAST(:palavras_chave AS jsonb),
                            tags = CAST(:tags AS jsonb),
                            modo_ativacao = :modo_ativacao,
                            ativo = true,
                            versao = versao + 1,
                            atualizado_em = NOW()
                        WHERE id = :mid
                    """),
                    {
                        "titulo": m[3],
                        "conteudo": m[4],
                        "condicao": m[5],
                        "palavras_chave": str(m[6]) if m[6] else None,
                        "tags": str(m[7]) if m[7] else None,
                        "modo_ativacao": m[8],
                        "mid": mapa_existentes[nome],
                    }
                )
        else:
            # Inserir novo módulo
            acao = {
                "tipo": "inserir_do_fonte",
                "nome": nome,
                "tipo_modulo": m[1],
                "titulo": m[3],
                "descricao": f"Novo módulo copiado do banco fonte (fonte_id={fonte_id})",
            }
            logger.info("  [INSERIR] nome=%s tipo=%s (fonte_id=%d)", nome, m[1], fonte_id)

            if not dry_run:
                conn.execute(
                    text("""
                        INSERT INTO prompt_modulos (
                            tipo, nome, titulo, conteudo, condicao_ativacao,
                            palavras_chave, tags, modo_ativacao, regra_deterministica,
                            regra_texto_original, ativo, ordem, versao,
                            group_id, categoria, subcategoria,
                            criado_em, atualizado_em
                        ) VALUES (
                            :tipo, :nome, :titulo, :conteudo, :condicao,
                            CAST(:palavras_chave AS jsonb), CAST(:tags AS jsonb),
                            :modo_ativacao, CAST(:regra AS jsonb),
                            :regra_texto, true, :ordem, 1,
                            :gid, :categoria, :subcategoria,
                            NOW(), NOW()
                        )
                    """),
                    {
                        "tipo": m[1],
                        "nome": nome,
                        "titulo": m[3],
                        "conteudo": m[4],
                        "condicao": m[5],
                        "palavras_chave": str(m[6]) if m[6] else None,
                        "tags": str(m[7]) if m[7] else None,
                        "modo_ativacao": m[8],
                        "regra": str(m[9]) if m[9] else None,
                        "regra_texto": m[10],
                        "ordem": m[12],
                        "gid": PS_GROUP_ID,
                        "categoria": m[14],
                        "subcategoria": m[15],
                    }
                )

        acoes.append(acao)

    logger.info("Total Opção B: %d módulos %s",
                len(acoes), "processados" if not dry_run else "(dry-run)")
    return acoes


# ============================================================
# OPÇÃO C — criar módulos base/peca ausentes
# ============================================================

def criar_modulos_ausentes(conn, dry_run: bool) -> list[dict]:
    """
    Verifica se PS possui módulos base e peca esperados.
    Se não existirem, tenta duplicar de outro grupo (exceto DETRAN).

    Retorna lista de ações executadas (ou planejadas em dry-run).
    """
    logger.info("\n" + "=" * 60)
    logger.info("OPÇÃO C — Criar módulos base/peca ausentes para PS")
    logger.info("=" * 60)

    # Descobre group_id do DETRAN para excluí-lo
    detran_row = conn.execute(
        text("SELECT id FROM prompt_groups WHERE slug = :slug"),
        {"slug": DETRAN_GROUP_SLUG}
    ).fetchone()
    detran_group_id = detran_row[0] if detran_row else None

    if detran_group_id:
        logger.info("Grupo DETRAN detectado: group_id=%d (será excluído como fonte)", detran_group_id)

    # Módulos PS existentes
    existentes = conn.execute(
        text("""
            SELECT nome, tipo FROM prompt_modulos
            WHERE group_id = :gid AND tipo IN ('base', 'peca')
        """),
        {"gid": PS_GROUP_ID}
    ).fetchall()
    nomes_existentes = {(row[0], row[1]) for row in existentes}

    logger.info("Módulos PS existentes: %d", len(nomes_existentes))
    for nome, tipo in sorted(nomes_existentes):
        logger.info("  [OK] tipo=%s nome=%s", tipo, nome)

    # Identifica ausentes
    ausentes = []
    for nome in NOMES_MODULOS_PS:
        tipo_esperado = "base" if nome == "system_prompt" else "peca"
        if (nome, tipo_esperado) not in nomes_existentes:
            ausentes.append((nome, tipo_esperado))

    if not ausentes:
        logger.info("Todos os módulos esperados já existem no PS.")
        return []

    logger.info("\nMódulos ausentes no PS: %d", len(ausentes))
    for nome, tipo in ausentes:
        logger.info("  [FALTA] tipo=%s nome=%s", tipo, nome)

    # Tenta encontrar em outros grupos (exceto DETRAN)
    acoes = []
    for nome, tipo_esperado in ausentes:
        filtro_detran = ""
        params = {"nome": nome, "tipo": tipo_esperado, "gid": PS_GROUP_ID}

        if detran_group_id:
            filtro_detran = "AND pm.group_id != :detran_gid"
            params["detran_gid"] = detran_group_id

        candidato = conn.execute(
            text(f"""
                SELECT pm.id, pm.tipo, pm.nome, pm.titulo, pm.conteudo,
                       pm.condicao_ativacao, pm.palavras_chave, pm.tags,
                       pm.modo_ativacao, pm.ordem, pm.group_id,
                       pg.slug AS group_slug, pm.categoria, pm.subcategoria
                FROM prompt_modulos pm
                LEFT JOIN prompt_groups pg ON pm.group_id = pg.id
                WHERE pm.nome = :nome
                  AND pm.tipo = :tipo
                  AND pm.group_id != :gid
                  {filtro_detran}
                ORDER BY pm.ativo DESC, pm.versao DESC
                LIMIT 1
            """),
            params
        ).fetchone()

        if not candidato:
            logger.warning("  [PULAR] tipo=%s nome=%s — não encontrado em nenhum grupo compatível", tipo_esperado, nome)
            acoes.append({
                "tipo": "ausente_sem_fonte",
                "nome": nome,
                "tipo_modulo": tipo_esperado,
                "descricao": "Módulo não encontrado em nenhum grupo compatível (exceto DETRAN)",
            })
            continue

        fonte_group = candidato[11] or f"group_id={candidato[10]}"
        acao = {
            "tipo": "duplicar_de_outro_grupo",
            "nome": nome,
            "tipo_modulo": tipo_esperado,
            "titulo": candidato[3],
            "fonte_id": candidato[0],
            "fonte_group": fonte_group,
            "descricao": f"Duplicar de grupo '{fonte_group}' (id={candidato[0]})",
        }
        logger.info("  [DUPLICAR] tipo=%s nome=%s <- grupo '%s' (id=%d)",
                     tipo_esperado, nome, fonte_group, candidato[0])

        if not dry_run:
            conn.execute(
                text("""
                    INSERT INTO prompt_modulos (
                        tipo, nome, titulo, conteudo, condicao_ativacao,
                        palavras_chave, tags, modo_ativacao,
                        ativo, ordem, versao,
                        group_id, categoria, subcategoria,
                        criado_em, atualizado_em
                    ) VALUES (
                        :tipo, :nome, :titulo, :conteudo, :condicao,
                        CAST(:palavras_chave AS jsonb), CAST(:tags AS jsonb),
                        :modo_ativacao,
                        true, :ordem, 1,
                        :gid, :categoria, :subcategoria,
                        NOW(), NOW()
                    )
                """),
                {
                    "tipo": tipo_esperado,
                    "nome": nome,
                    "titulo": candidato[3],
                    "conteudo": candidato[4],
                    "condicao": candidato[5],
                    "palavras_chave": str(candidato[6]) if candidato[6] else None,
                    "tags": str(candidato[7]) if candidato[7] else None,
                    "modo_ativacao": candidato[8],
                    "ordem": candidato[9],
                    "gid": PS_GROUP_ID,
                    "categoria": candidato[12],
                    "subcategoria": candidato[13],
                }
            )

        acoes.append(acao)

    logger.info("Total Opção C: %d ações %s",
                len(acoes), "executadas" if not dry_run else "(dry-run)")
    return acoes


# ============================================================
# RESUMO
# ============================================================

def exibir_resumo(acoes_a: list, acoes_b: list, acoes_c: list, dry_run: bool):
    """Exibe resumo consolidado das ações."""
    total = len(acoes_a) + len(acoes_b) + len(acoes_c)

    logger.info("\n" + "=" * 60)
    logger.info("RESUMO %s", "(DRY-RUN — nada foi alterado)" if dry_run else "(EXECUTADO)")
    logger.info("=" * 60)

    logger.info("  Opção A (histórico):      %d ações", len(acoes_a))
    logger.info("  Opção B (banco fonte):     %d ações", len(acoes_b))
    logger.info("  Opção C (criar ausentes):  %d ações", len(acoes_c))
    logger.info("  Total:                     %d ações", total)

    if dry_run and total > 0:
        logger.info("")
        logger.info("Para aplicar as alterações, execute novamente com --execute")

    if not dry_run and total > 0:
        logger.info("")
        logger.info("Alterações aplicadas com sucesso em transação única.")


# ============================================================
# MAIN
# ============================================================

def main():
    args = parse_args()
    dry_run = not args.execute

    logger.info("=" * 60)
    logger.info("RESTAURAÇÃO DE PROMPTS PS (group_id=%d)", PS_GROUP_ID)
    logger.info("Modo: %s", "DRY-RUN (simulação)" if dry_run else "EXECUTE (aplicar alterações)")
    logger.info("Data: %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    logger.info("=" * 60)

    # Log seguro da URL (oculta senha)
    url_safe = args.db_url.split("@")[-1] if "@" in args.db_url else args.db_url
    logger.info("Banco alvo: ...@%s", url_safe)

    engine = create_engine(args.db_url, pool_pre_ping=True)

    try:
        # Verifica conexão
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Conexão OK\n")
    except Exception as e:
        logger.error("Falha ao conectar: %s", e)
        sys.exit(1)

    acoes_a: list[dict] = []
    acoes_b: list[dict] = []
    acoes_c: list[dict] = []

    if dry_run:
        # Em dry-run, abre conexão de leitura apenas
        with engine.connect() as conn:
            estado = diagnosticar_estado_atual(conn)

            if not estado["grupo_existe"]:
                logger.error("Grupo PS não existe. Abortando.")
                sys.exit(1)

            # Opção A — restaurar do histórico
            acoes_a = restaurar_do_historico(conn, dry_run=True)

            # Opção B — restaurar de outro banco (se informado)
            if args.source_db:
                acoes_b = restaurar_do_source_db(conn, args.source_db, dry_run=True)

            # Opção C — criar módulos ausentes
            acoes_c = criar_modulos_ausentes(conn, dry_run=True)
    else:
        # Em modo execute, usa transação atômica
        with engine.begin() as conn:
            estado = diagnosticar_estado_atual(conn)

            if not estado["grupo_existe"]:
                logger.error("Grupo PS não existe. Abortando (rollback automático).")
                sys.exit(1)

            # Opção A — restaurar do histórico
            acoes_a = restaurar_do_historico(conn, dry_run=False)

            # Opção B — restaurar de outro banco (se informado)
            if args.source_db:
                acoes_b = restaurar_do_source_db(conn, args.source_db, dry_run=False)

            # Opção C — criar módulos ausentes
            acoes_c = criar_modulos_ausentes(conn, dry_run=False)

            # Commit implícito pelo context manager engine.begin()

    exibir_resumo(acoes_a, acoes_b, acoes_c, dry_run)

    engine.dispose()


if __name__ == "__main__":
    main()
