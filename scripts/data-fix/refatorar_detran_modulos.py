"""
Refatora os módulos DETRAN segundo análise crítica:
1. Corrige categoria Eventualidade → Mérito onde incorreto
2. Funde módulos complementares com mesma variável
3. Corrige variável errada do FAT_012
4. Atualiza o BD local Docker e gera JSON final
"""
import json
import copy
import urllib.request
import urllib.parse
from sqlalchemy import create_engine, text

SRC = "E:/Projetos/PGE/portal-pge/docs/schemas/detran_modulos_import.json"
DST = "E:/Projetos/PGE/portal-pge/docs/schemas/detran_modulos_import.json"
DOCKER_DB = "postgresql://postgres:postgres@localhost:5433/portal_pge"
API_BASE = "http://localhost:8000"
TOKEN_FILE = "/tmp/token.txt"

# ── carrega JSON ──────────────────────────────────────────────────────────────
with open(SRC, encoding="utf-8") as f:
    data = json.load(f)

modulos = {m["nome"]: m for m in data["modulos"]}

# ── helpers ───────────────────────────────────────────────────────────────────
def juntar_conteudos(*nomes, separador="\n\n---\n\n"):
    return separador.join(modulos[n]["conteudo"] for n in nomes if n in modulos)

def juntar_palavras_chave(*nomes):
    seen, result = set(), []
    for n in nomes:
        for p in modulos[n].get("palavras_chave", []):
            if p not in seen:
                seen.add(p); result.append(p)
    return result

def juntar_tags(*nomes):
    seen, result = set(), []
    for n in nomes:
        for t in modulos[n].get("tags", []):
            if t not in seen:
                seen.add(t); result.append(t)
    return result

# ── 1. CORRIGE CATEGORIA: Eventualidade → Mérito ─────────────────────────────
# Apenas DM_003 e DMAT_005 são genuinamente subsidiários
para_merito = [
    "detran_dm_002_093",    # dano moral in re ipsa — argumento de mérito
    "detran_dmat_002_096",  # lucros cessantes — argumento de mérito
    "detran_dmat_003_097",  # valores de remoção — argumento de mérito
]
# DM_001 e DMAT_001 serão fundidos (ver adiante), categoria já será Mérito
# DMAT_004 será absorvido
for nome in para_merito:
    if nome in modulos:
        modulos[nome]["categoria"] = "Mérito"
        modulos[nome]["subcategoria"] = "Indenização"
        print(f"[CAT] {nome} → Mérito")

# ── 2. FUSÕES ─────────────────────────────────────────────────────────────────

# 2.1 ADM_002 + ADM_003 + ADM_004 → validade das notificações
m = modulos["detran_adm_002_032"]
m["titulo"] = "ADM_002/003/004 — Alegue a validade das notificações de autuação e penalidade (carta simples, edital e SINET)"
m["conteudo"] = juntar_conteudos("detran_adm_002_032", "detran_adm_003_041", "detran_adm_004_042")
m["palavras_chave"] = juntar_palavras_chave("detran_adm_002_032", "detran_adm_003_041", "detran_adm_004_042")
m["tags"] = juntar_tags("detran_adm_002_032", "detran_adm_003_041", "detran_adm_004_042")
ABSORVIDOS = {"detran_adm_003_041", "detran_adm_004_042"}
print("[FUSÃO] ADM_002 absorve ADM_003 + ADM_004")

# 2.2 DM_001 + DM_003 → danos morais mérito + subsidiário
m = modulos["detran_dm_001_092"]
m["titulo"] = "DM_001/003 — Refute o pedido de danos morais e, subsidiariamente, requeira redução do quantum"
m["conteudo"] = juntar_conteudos("detran_dm_001_092", "detran_dm_003_094")
m["palavras_chave"] = juntar_palavras_chave("detran_dm_001_092", "detran_dm_003_094")
m["tags"] = juntar_tags("detran_dm_001_092", "detran_dm_003_094")
m["categoria"] = "Mérito"
m["subcategoria"] = "Indenização"
ABSORVIDOS.add("detran_dm_003_094")
print("[FUSÃO] DM_001 absorve DM_003 + move para Mérito")

# 2.3 DMAT_001 + DMAT_004 → danos materiais genérico + veículo apreensão
m = modulos["detran_dmat_001_095"]
m["titulo"] = "DMAT_001/004 — Conteste o pedido de indenização por danos materiais e refute ressarcimento de danos ao veículo durante apreensão"
m["conteudo"] = juntar_conteudos("detran_dmat_001_095", "detran_dmat_004_098")
m["palavras_chave"] = juntar_palavras_chave("detran_dmat_001_095", "detran_dmat_004_098")
m["tags"] = juntar_tags("detran_dmat_001_095", "detran_dmat_004_098")
m["categoria"] = "Mérito"
m["subcategoria"] = "Indenização"
ABSORVIDOS.add("detran_dmat_004_098")
print("[FUSÃO] DMAT_001 absorve DMAT_004 + move para Mérito")

# 2.4 JUR_024 + JUR_025 → IPVA e débitos
m = modulos["detran_jur_024_076"]
m["titulo"] = "JUR_024/025 — Alegue a impossibilidade de isenção e a exigibilidade de débitos de IPVA, multas e taxas"
m["conteudo"] = juntar_conteudos("detran_jur_024_076", "detran_jur_025_075")
m["palavras_chave"] = juntar_palavras_chave("detran_jur_024_076", "detran_jur_025_075")
m["tags"] = juntar_tags("detran_jur_024_076", "detran_jur_025_075")
ABSORVIDOS.add("detran_jur_025_075")
print("[FUSÃO] JUR_024 absorve JUR_025")

# 2.5 ADM_009 + ADM_010 → condutor identificado
m = modulos["detran_adm_009_036"]
m["titulo"] = "ADM_009/010 — Sustente a perda do prazo para indicação do condutor e a possibilidade de indicação judicial"
m["conteudo"] = juntar_conteudos("detran_adm_009_036", "detran_adm_010_038")
m["palavras_chave"] = juntar_palavras_chave("detran_adm_009_036", "detran_adm_010_038")
m["tags"] = juntar_tags("detran_adm_009_036", "detran_adm_010_038")
ABSORVIDOS.add("detran_adm_010_038")
print("[FUSÃO] ADM_009 absorve ADM_010")

# 2.6 JUR_026 + PREL_030 → CDC inaplicável
m = modulos["detran_jur_026_086"]
m["titulo"] = "JUR_026/030 — Alegue inexistência de relação de consumo e conteste a inversão do ônus da prova"
m["conteudo"] = juntar_conteudos("detran_jur_026_086", "detran_prel_030_030")
m["palavras_chave"] = juntar_palavras_chave("detran_jur_026_086", "detran_prel_030_030")
m["tags"] = juntar_tags("detran_jur_026_086", "detran_prel_030_030")
# PREL_030 estava em Preliminar mas o argumento é de mérito
m["categoria"] = "Mérito"
ABSORVIDOS.add("detran_prel_030_030")
print("[FUSÃO] JUR_026 absorve PREL_030 + move para Mérito")

# 2.7 FAT_008 + JUR_029 → pagou voluntariamente
m = modulos["detran_fat_008_057"]
m["titulo"] = "FAT_008/029 — Alegue preclusão por ausência de impugnação e litigância de má-fé pelo pagamento voluntário"
m["conteudo"] = juntar_conteudos("detran_fat_008_057", "detran_jur_029_090")
m["palavras_chave"] = juntar_palavras_chave("detran_fat_008_057", "detran_jur_029_090")
m["tags"] = juntar_tags("detran_fat_008_057", "detran_jur_029_090")
ABSORVIDOS.add("detran_jur_029_090")
print("[FUSÃO] FAT_008 absorve JUR_029")

# ── 3. CORRIGE VARIÁVEL ERRADA: FAT_012 ──────────────────────────────────────
# FAT_012 fala de prova pericial de deterioração de veículo — é dano material,
# não ipva_pendente
if "detran_fat_012_059" in modulos:
    modulos["detran_fat_012_059"]["regra_deterministica"] = {
        "type": "condition",
        "variable": "detran_dano_material",
        "operator": "equals",
        "value": True
    }
    modulos["detran_fat_012_059"]["regra_texto_original"] = (
        "Quando o autor pleitear indenização por deterioração ou perda total "
        "do veículo durante apreensão pelo DETRAN/MS."
    )
    modulos["detran_fat_012_059"]["categoria"] = "Mérito"
    modulos["detran_fat_012_059"]["subcategoria"] = "Indenização"
    print("[FIX] FAT_012: variável ipva_pendente → dano_material, categoria → Mérito")

# ── 4. REMOVE ABSORVIDOS E RECONSTRÓI LISTA ───────────────────────────────────
modulos_finais = [m for nome, m in modulos.items() if nome not in ABSORVIDOS]
print(f"\n[TOTAL] {len(data['modulos'])} → {len(modulos_finais)} módulos")
print(f"[ABSORVIDOS] {len(ABSORVIDOS)}: {sorted(ABSORVIDOS)}")

# ── 5. GRAVA JSON ─────────────────────────────────────────────────────────────
data["modulos"] = modulos_finais
data["total"] = len(modulos_finais)
data["exportado_em"] = "2026-03-05"
data["descricao"] = (
    f"{len(modulos_finais)} módulos de defesa do DETRAN/MS: todos determinísticos. "
    "v3.1 — fusão de módulos complementares, correção de categorias e variável FAT_012."
)
with open(DST, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"[JSON] Salvo em {DST}")

# ── 6. ATUALIZA BD LOCAL (Docker porta 5433) ──────────────────────────────────
print("\n[DB] Conectando ao banco Docker...")
engine = create_engine(DOCKER_DB)

# 6a. Login para pegar token
from dotenv import dotenv_values
env = dotenv_values("E:/Projetos/PGE/portal-pge/.env")
form_data = urllib.parse.urlencode({
    "username": env.get("ADMIN_USERNAME", ""),
    "password": env.get("ADMIN_PASSWORD", "")
}).encode()
req = urllib.request.Request(
    f"{API_BASE}/auth/login", data=form_data,
    headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST"
)
with urllib.request.urlopen(req, timeout=10) as resp:
    token = json.loads(resp.read())["access_token"]
print("[API] Login OK")

# 6b. Importa módulos atualizados (sobrescreve existentes)
payload = json.dumps({"modulos": modulos_finais, "sobrescrever_existentes": True}).encode()
req = urllib.request.Request(
    f"{API_BASE}/admin/api/prompts-modulos/importar", data=payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    method="POST"
)
with urllib.request.urlopen(req, timeout=120) as resp:
    result = json.loads(resp.read())
print(f"[API] Import: criados={result['criados']} atualizados={result['atualizados']} erros={len(result['erros'])}")
if result["erros"]:
    for e in result["erros"][:5]:
        print(f"  ERRO: {e}")

# 6c. Deleta módulos absorvidos do BD
with engine.begin() as conn:
    for nome in ABSORVIDOS:
        r = conn.execute(text("DELETE FROM prompt_modulos WHERE nome = :nome RETURNING id"), {"nome": nome})
        deleted = r.fetchone()
        print(f"[DB] DELETE {nome}: {'OK id=' + str(deleted[0]) if deleted else 'não encontrado'}")

# ── 7. VERIFICAÇÃO ────────────────────────────────────────────────────────────
with engine.connect() as conn:
    r = conn.execute(text("""
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE modo_ativacao = 'deterministic') as det,
               COUNT(*) FILTER (WHERE categoria = 'Eventualidade') as evt,
               COUNT(*) FILTER (WHERE categoria = 'Merito' OR categoria = 'Mérito') as merito
        FROM prompt_modulos pm
        JOIN prompt_groups pg ON pm.group_id = pg.id
        WHERE pg.slug = 'detran'
    """)).fetchone()
    print(f"\n[VERIFICAÇÃO] DETRAN no BD:")
    print(f"  Total: {r[0]} | deterministic: {r[1]} | Eventualidade: {r[2]} | Merito: {r[3]}")

print("\n[OK] Refatoração concluída.")
