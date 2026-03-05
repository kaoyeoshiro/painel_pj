"""
Cria a categoria de extração JSON para DETRAN e vincula as 37 variáveis.
Usa codigos_documento=[500, 9500] com source_type='code' para evitar conflito
com a categoria peticao_inicial do PS (que usa source_special_type).
"""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from sqlalchemy import create_engine, text

DOCKER_DB = "postgresql://postgres:postgres@localhost:5433/portal_pge"
engine = create_engine(DOCKER_DB)

# ── Formato JSON: um campo booleano por variável ──────────────────────────────
VARIAVEIS_BOOL = [
    ("detran_acao_fabricante_placas",       "A ação é contra o fabricante de placas?"),
    ("detran_alega_bis_in_idem",            "O autor alega bis in idem na penalização?"),
    ("detran_alega_comunicou_venda",        "O autor alega que comunicou a venda do veículo ao DETRAN?"),
    ("detran_alega_equipamento_invalido",   "O autor alega que o equipamento de medição é inválido ou não homologado pelo INMETRO?"),
    ("detran_alega_ilegitimidade",          "O autor alega ilegitimidade passiva do Estado/DETRAN?"),
    ("detran_alega_incompetencia",          "O autor alega incompetência do juízo?"),
    ("detran_alega_inepcia_inicial",        "O autor alega inépcia da petição inicial?"),
    ("detran_alega_inercia_orgao",          "O autor alega inércia do órgão no processamento do recurso administrativo?"),
    ("detran_alega_irregularidade_recurso_adm", "O autor alega irregularidade no processamento do recurso administrativo?"),
    ("detran_alega_nao_era_condutor",       "O autor alega que não era o condutor do veículo na data da infração?"),
    ("detran_alega_nao_notificado_autuacao","O autor alega não ter sido notificado da autuação ou da penalidade?"),
    ("detran_alega_nulidade_processo_adm",  "O autor alega nulidade do processo administrativo de trânsito?"),
    ("detran_alega_prescricao_decadencia",  "O autor alega prescrição ou decadência da pretensão?"),
    ("detran_alienacao_fiduciaria",         "O veículo está em alienação fiduciária?"),
    ("detran_autor_inerte",                 "O autor deixou de praticar atos processuais necessários (inércia)?"),
    ("detran_coisa_julgada",                "Há coisa julgada sobre a mesma questão?"),
    ("detran_contesta_validade_notificacao","O autor contesta a validade da notificação de autuação ou penalidade?"),
    ("detran_dano_material",                "A ação inclui pedido de indenização por dano material?"),
    ("detran_dano_moral",                   "A ação inclui pedido de indenização por dano moral?"),
    ("detran_documentos_duvidosos",         "Os documentos apresentados pelo autor são duvidosos ou insuficientes?"),
    ("detran_falta_interesse_agir",         "Há falta de interesse de agir (via administrativa não esgotada)?"),
    ("detran_ilegitimidade_ativa",          "O autor não tem legitimidade ativa para propor a ação?"),
    ("detran_impugna_remocao",              "O autor impugna a remoção ou apreensão do veículo?"),
    ("detran_invoca_cdc",                   "O autor invoca o CDC para fundamentar o pedido?"),
    ("detran_invoca_proporcionalidade",     "O autor invoca o princípio da proporcionalidade contra a penalidade?"),
    ("detran_ipva_pendente",                "O veículo possui débitos de IPVA pendentes discutidos na ação?"),
    ("detran_litisconsorcio_necessario",    "Há litisconsórcio necessário que não foi formado?"),
    ("detran_litispendencia_conexao",       "Há litispendência ou conexão com outra ação em curso?"),
    ("detran_pagou_voluntariamente",        "O autor pagou a multa administrativamente antes de recorrer ao Judiciário?"),
    ("detran_pede_transferencia_pontos",    "O autor pede transferência dos pontos da infração para outro condutor?"),
    ("detran_recusa_etilometro",            "O autor se recusou a realizar o teste de alcoolemia (etilômetro)?"),
    ("detran_tutela_urgencia",              "A ação inclui pedido de tutela de urgência (liminar/antecipação)?"),
    ("detran_valor_causa_incompativel",     "O valor da causa é incompatível com o pedido formulado?"),
    ("detran_veiculo_clonado",              "O veículo é clonado (adulteração de placa ou chassi)?"),
    ("detran_veiculo_furtado_roubado",      "O veículo foi furtado ou roubado?"),
    ("detran_vicio_citacao",                "Há vício na citação do réu?"),
]

TIPO_ACAO_OPCOES = [
    "multa", "cassacao_cnh", "suspensao_cnh", "ear_cnh",
    "pontuacao_cnh", "transferencia_registro", "baixa_veiculo",
    "bloqueio_renajud", "exame_toxicologico",
]

# Monta formato_json
formato = {}
for slug, descricao in VARIAVEIS_BOOL:
    campo = slug  # slug já tem prefixo detran_
    formato[campo] = {
        "type": "boolean",
        "description": descricao,
    }
formato["detran_tipo_acao"] = {
    "type": "select",
    "description": "Qual é o tipo de ação/penalidade DETRAN discutida na ação?",
    "options": TIPO_ACAO_OPCOES,
}

formato_json_str = json.dumps(formato, ensure_ascii=False, indent=2)

instrucoes = """Analise a petição inicial desta ação judicial contra o DETRAN/MS e responda objetivamente cada campo booleano.

REGRAS:
- Responda TRUE apenas quando o autor EXPLICITAMENTE alega/pede aquele item.
- Responda FALSE quando o item não é mencionado ou não se aplica.
- Para detran_tipo_acao: identifique qual penalidade/ação é o objeto principal do processo.
- Os campos com prefixo "detran_" descrevem características desta ação de trânsito."""

with engine.begin() as conn:
    # Verifica se já existe
    existente = conn.execute(
        text("SELECT id FROM categorias_resumo_json WHERE nome = :nome AND group_id = :gid"),
        {"nome": "peticao_detran", "gid": 3}
    ).fetchone()

    if existente:
        # Atualiza
        conn.execute(
            text("""
                UPDATE categorias_resumo_json SET
                    formato_json = :fj,
                    instrucoes_extracao = :inst,
                    codigos_documento = CAST(:codigos AS jsonb),
                    namespace_prefix = 'detran',
                    source_type = 'code',
                    atualizado_em = NOW()
                WHERE id = :id
            """),
            {"fj": formato_json_str, "inst": instrucoes,
             "codigos": json.dumps([500, 9500]), "id": existente[0]}
        )
        cat_id = existente[0]
        print(f"[DB] Categoria atualizada id={cat_id}")
    else:
        # Insere
        r = conn.execute(
            text("""
                INSERT INTO categorias_resumo_json (
                    nome, titulo, descricao, codigos_documento, formato_json,
                    instrucoes_extracao, namespace_prefix, source_type,
                    is_residual, ativo, group_id, criado_em, atualizado_em
                ) VALUES (
                    'peticao_detran',
                    'Petição Inicial — DETRAN/MS',
                    'Extrai variáveis booleanas da petição inicial em ações contra o DETRAN/MS',
                    CAST(:codigos AS jsonb),
                    :fj,
                    :inst,
                    'detran',
                    'code',
                    false,
                    true,
                    3,
                    NOW(),
                    NOW()
                ) RETURNING id
            """),
            {"codigos": json.dumps([500, 9500]), "fj": formato_json_str, "inst": instrucoes}
        )
        cat_id = r.fetchone()[0]
        print(f"[DB] Categoria criada id={cat_id}")

    # Vincula extraction_variables à categoria DETRAN
    slugs_todos = [s for s, _ in VARIAVEIS_BOOL] + ["detran_tipo_acao"]
    atualizadas = 0
    for slug in slugs_todos:
        r = conn.execute(
            text("UPDATE extraction_variables SET categoria_id = :cid WHERE slug = :slug"),
            {"cid": cat_id, "slug": slug}
        )
        atualizadas += r.rowcount

    print(f"[DB] {atualizadas}/{len(slugs_todos)} variáveis vinculadas à categoria {cat_id}")

# Verificação
with engine.connect() as conn:
    r = conn.execute(
        text("SELECT COUNT(*) FROM extraction_variables WHERE categoria_id = :cid"),
        {"cid": cat_id}
    ).fetchone()
    print(f"[OK] {r[0]} variáveis na categoria peticao_detran")
