"""
Aplica refatoração dos módulos DETRAN diretamente no BD local Docker.
- Deleta historico dos módulos absorvidos (FK constraint)
- Deleta módulos absorvidos
- Atualiza via SQL UPDATE os 94 módulos restantes (evita UniqueViolation do import API)
"""
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from sqlalchemy import create_engine, text

SRC = "E:/Projetos/PGE/portal-pge/docs/schemas/detran_modulos_import.json"
DOCKER_DB = "postgresql://postgres:postgres@localhost:5433/portal_pge"

ABSORVIDOS = {
    "detran_adm_003_041",
    "detran_adm_004_042",
    "detran_adm_010_038",
    "detran_dm_003_094",
    "detran_dmat_004_098",
    "detran_jur_025_075",
    "detran_jur_029_090",
    "detran_prel_030_030",
}

with open(SRC, encoding="utf-8") as f:
    data = json.load(f)

modulos_finais = data["modulos"]
print(f"[JSON] Carregados {len(modulos_finais)} modulos do JSON")

engine = create_engine(DOCKER_DB)

with engine.begin() as conn:
    # 1. Obtém IDs dos módulos absorvidos
    nomes_list = list(ABSORVIDOS)
    placeholders = ", ".join(f":n{i}" for i in range(len(nomes_list)))
    params = {f"n{i}": nome for i, nome in enumerate(nomes_list)}

    r = conn.execute(
        text(f"SELECT id, nome FROM prompt_modulos WHERE nome IN ({placeholders})"),
        params,
    )
    absorvidos_ids = {row[1]: row[0] for row in r.fetchall()}
    print(f"[DB] Modulos absorvidos encontrados: {len(absorvidos_ids)}")
    for nome, mid in absorvidos_ids.items():
        print(f"  id={mid}  {nome}")

    # 2. Deleta historico dos absorvidos
    if absorvidos_ids:
        ids_list = list(absorvidos_ids.values())
        id_placeholders = ", ".join(f":id{i}" for i in range(len(ids_list)))
        id_params = {f"id{i}": mid for i, mid in enumerate(ids_list)}

        r = conn.execute(
            text(f"DELETE FROM prompt_modulos_historico WHERE modulo_id IN ({id_placeholders})"),
            id_params,
        )
        print(f"[DB] Historico deletado: {r.rowcount} registros")

        # 3. Deleta os módulos absorvidos
        r = conn.execute(
            text(f"DELETE FROM prompt_modulos WHERE nome IN ({placeholders})"),
            params,
        )
        print(f"[DB] Modulos absorvidos deletados: {r.rowcount}")

    # 4. Busca group_id do grupo DETRAN
    r = conn.execute(text("SELECT id FROM prompt_groups WHERE slug = 'detran'"))
    row = r.fetchone()
    if not row:
        print("[ERRO] Grupo 'detran' nao encontrado no BD!")
        sys.exit(1)
    group_id = row[0]
    print(f"[DB] group_id DETRAN = {group_id}")

    # 5. Atualiza/insere os 94 módulos via UPSERT SQL
    atualizados = 0
    inseridos = 0
    erros = []

    for m in modulos_finais:
        nome = m["nome"]
        titulo = m.get("titulo", "")
        conteudo = m.get("conteudo", "")
        categoria = m.get("categoria", "")
        subcategoria = m.get("subcategoria", "")
        tags = json.dumps(m.get("tags", []), ensure_ascii=False)
        palavras_chave = json.dumps(m.get("palavras_chave", []), ensure_ascii=False)
        regra = m.get("regra_deterministica")
        regra_json = json.dumps(regra, ensure_ascii=False) if regra else None
        regra_texto = m.get("regra_texto_original", "")
        modo_ativacao = m.get("modo_ativacao", "deterministic")

        try:
            # Tenta UPDATE primeiro
            r = conn.execute(
                text("""
                    UPDATE prompt_modulos SET
                        titulo = :titulo,
                        conteudo = :conteudo,
                        categoria = :categoria,
                        subcategoria = :subcategoria,
                        tags = CAST(:tags AS jsonb),
                        palavras_chave = CAST(:palavras_chave AS jsonb),
                        regra_deterministica = CAST(:regra AS jsonb),
                        regra_texto_original = :regra_texto,
                        modo_ativacao = :modo_ativacao,
                        atualizado_em = NOW()
                    WHERE nome = :nome AND group_id = :group_id
                """),
                {
                    "titulo": titulo,
                    "conteudo": conteudo,
                    "categoria": categoria,
                    "subcategoria": subcategoria,
                    "tags": tags,
                    "palavras_chave": palavras_chave,
                    "regra": regra_json,
                    "regra_texto": regra_texto,
                    "modo_ativacao": modo_ativacao,
                    "nome": nome,
                    "group_id": group_id,
                },
            )
            if r.rowcount > 0:
                atualizados += 1
            else:
                # Não existia: INSERT
                conn.execute(
                    text("""
                        INSERT INTO prompt_modulos (
                            group_id, nome, titulo, conteudo, categoria, subcategoria,
                            tags, palavras_chave, regra_deterministica, regra_texto_original,
                            modo_ativacao, ativo, criado_em, atualizado_em
                        ) VALUES (
                            :group_id, :nome, :titulo, :conteudo, :categoria, :subcategoria,
                            CAST(:tags AS jsonb), CAST(:palavras_chave AS jsonb),
                            CAST(:regra AS jsonb), :regra_texto,
                            :modo_ativacao, true, NOW(), NOW()
                        )
                    """),
                    {
                        "group_id": group_id,
                        "nome": nome,
                        "titulo": titulo,
                        "conteudo": conteudo,
                        "categoria": categoria,
                        "subcategoria": subcategoria,
                        "tags": tags,
                        "palavras_chave": palavras_chave,
                        "regra": regra_json,
                        "regra_texto": regra_texto,
                        "modo_ativacao": modo_ativacao,
                    },
                )
                inseridos += 1
        except Exception as e:
            erros.append(f"{nome}: {e}")
            print(f"  [ERRO] {nome}: {e}")

    print(f"\n[RESULTADO] Atualizados={atualizados} | Inseridos={inseridos} | Erros={len(erros)}")
    if erros:
        for e in erros[:10]:
            print(f"  {e}")

# 6. Verificação final
with engine.connect() as conn:
    r = conn.execute(
        text("""
            SELECT COUNT(*) as total,
                   COUNT(*) FILTER (WHERE modo_ativacao = 'deterministic') as det,
                   COUNT(*) FILTER (WHERE categoria = 'Eventualidade') as evt,
                   COUNT(*) FILTER (WHERE categoria = 'Merito' OR categoria = 'Merito') as merito
            FROM prompt_modulos pm
            JOIN prompt_groups pg ON pm.group_id = pg.id
            WHERE pg.slug = 'detran'
        """)
    ).fetchone()
    print(f"\n[VERIFICACAO] DETRAN no BD:")
    print(f"  Total={r[0]} | deterministic={r[1]} | Eventualidade={r[2]} | Merito={r[3]}")

    # Detalha categorias
    r2 = conn.execute(
        text("""
            SELECT categoria, COUNT(*)
            FROM prompt_modulos pm
            JOIN prompt_groups pg ON pm.group_id = pg.id
            WHERE pg.slug = 'detran'
            GROUP BY categoria ORDER BY categoria
        """)
    ).fetchall()
    print("\n[CATEGORIAS]")
    for row in r2:
        print(f"  {row[0]}: {row[1]}")

print("\n[OK] Refatoracao aplicada no BD local.")
