"""Seed categoria de extração JSON para DETRAN/MS

Cria a categoria 'peticao_detran' em categorias_resumo_json com:
- codigos_documento [500, 9500] (petição inicial/contestação)
- 37 campos booleanos + detran_tipo_acao (select)
- group_id = grupo DETRAN
- Vincula extraction_variables DETRAN à nova categoria

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-05 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import json

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None

_VARIAVEIS_BOOL = [
    ("detran_acao_fabricante_placas",           "A ação é contra o fabricante de placas?"),
    ("detran_alega_bis_in_idem",                "O autor alega bis in idem na penalização?"),
    ("detran_alega_comunicou_venda",            "O autor alega que comunicou a venda do veículo ao DETRAN?"),
    ("detran_alega_equipamento_invalido",       "O autor alega que o equipamento de medição é inválido ou não homologado pelo INMETRO?"),
    ("detran_alega_ilegitimidade",              "O autor alega ilegitimidade passiva do Estado/DETRAN?"),
    ("detran_alega_incompetencia",              "O autor alega incompetência do juízo?"),
    ("detran_alega_inepcia_inicial",            "O autor alega inépcia da petição inicial?"),
    ("detran_alega_inercia_orgao",              "O autor alega inércia do órgão no processamento do recurso administrativo?"),
    ("detran_alega_irregularidade_recurso_adm", "O autor alega irregularidade no processamento do recurso administrativo?"),
    ("detran_alega_nao_era_condutor",           "O autor alega que não era o condutor do veículo na data da infração?"),
    ("detran_alega_nao_notificado_autuacao",    "O autor alega não ter sido notificado da autuação ou da penalidade?"),
    ("detran_alega_nulidade_processo_adm",      "O autor alega nulidade do processo administrativo de trânsito?"),
    ("detran_alega_prescricao_decadencia",      "O autor alega prescrição ou decadência da pretensão?"),
    ("detran_alienacao_fiduciaria",             "O veículo está em alienação fiduciária?"),
    ("detran_autor_inerte",                     "O autor deixou de praticar atos processuais necessários (inércia)?"),
    ("detran_coisa_julgada",                    "Há coisa julgada sobre a mesma questão?"),
    ("detran_contesta_validade_notificacao",    "O autor contesta a validade da notificação de autuação ou penalidade?"),
    ("detran_dano_material",                    "A ação inclui pedido de indenização por dano material?"),
    ("detran_dano_moral",                       "A ação inclui pedido de indenização por dano moral?"),
    ("detran_documentos_duvidosos",             "Os documentos apresentados pelo autor são duvidosos ou insuficientes?"),
    ("detran_falta_interesse_agir",             "Há falta de interesse de agir (via administrativa não esgotada)?"),
    ("detran_ilegitimidade_ativa",              "O autor não tem legitimidade ativa para propor a ação?"),
    ("detran_impugna_remocao",                  "O autor impugna a remoção ou apreensão do veículo?"),
    ("detran_invoca_cdc",                       "O autor invoca o CDC para fundamentar o pedido?"),
    ("detran_invoca_proporcionalidade",         "O autor invoca o princípio da proporcionalidade contra a penalidade?"),
    ("detran_ipva_pendente",                    "O veículo possui débitos de IPVA pendentes discutidos na ação?"),
    ("detran_litisconsorcio_necessario",        "Há litisconsórcio necessário que não foi formado?"),
    ("detran_litispendencia_conexao",           "Há litispendência ou conexão com outra ação em curso?"),
    ("detran_pagou_voluntariamente",            "O autor pagou a multa administrativamente antes de recorrer ao Judiciário?"),
    ("detran_pede_transferencia_pontos",        "O autor pede transferência dos pontos da infração para outro condutor?"),
    ("detran_recusa_etilometro",                "O autor se recusou a realizar o teste de alcoolemia (etilômetro)?"),
    ("detran_tutela_urgencia",                  "A ação inclui pedido de tutela de urgência (liminar/antecipação)?"),
    ("detran_valor_causa_incompativel",         "O valor da causa é incompatível com o pedido formulado?"),
    ("detran_veiculo_clonado",                  "O veículo é clonado (adulteração de placa ou chassi)?"),
    ("detran_veiculo_furtado_roubado",          "O veículo foi furtado ou roubado?"),
    ("detran_vicio_citacao",                    "Há vício na citação do réu?"),
]

_TIPO_ACAO_OPCOES = [
    "multa", "cassacao_cnh", "suspensao_cnh", "ear_cnh",
    "pontuacao_cnh", "transferencia_registro", "baixa_veiculo",
    "bloqueio_renajud", "exame_toxicologico",
]

_INSTRUCOES = (
    "Analise a petição inicial desta ação judicial contra o DETRAN/MS e responda objetivamente cada campo booleano.\n\n"
    "REGRAS:\n"
    "- Responda true apenas quando o autor EXPLICITAMENTE alega/pede aquele item.\n"
    "- Responda false quando o item não é mencionado ou não se aplica.\n"
    "- Para detran_tipo_acao: identifique qual penalidade/ação é o objeto principal do processo.\n"
    "- Os campos com prefixo 'detran_' descrevem características desta ação de trânsito."
)


def _montar_formato_json() -> str:
    formato = {
        "detran_resumo_peticao": {
            "type": "text",
            "description": (
                "Elabore um resumo completo e analítico da petição inicial, abrangendo: "
                "(1) FATOS — o que aconteceu, qual a infração ou penalidade aplicada, data, local; "
                "(2) FUNDAMENTOS JURÍDICOS — os argumentos legais invocados pelo autor; "
                "(3) PEDIDOS — o que o autor requer ao juízo. "
                "Seja objetivo e preciso, sem emitir juízo de valor."
            ),
        }
    }
    for slug, descricao in _VARIAVEIS_BOOL:
        formato[slug] = {"type": "boolean", "description": descricao}
    formato["detran_tipo_acao"] = {
        "type": "select",
        "description": "Qual é o tipo de ação/penalidade DETRAN discutida na ação?",
        "options": _TIPO_ACAO_OPCOES,
    }
    return json.dumps(formato, ensure_ascii=False, indent=2)


def upgrade() -> None:
    conn = op.get_bind()

    # Busca group_id do grupo DETRAN
    # No CI, prompt_groups pode estar vazio (seeds rodam via init_db, não via migrations)
    r = conn.execute(text("SELECT id FROM prompt_groups WHERE slug = 'detran'")).fetchone()
    if not r:
        print("[WARN] Grupo 'detran' não encontrado — pulando seed de categoria DETRAN (OK no CI).")
        return
    detran_group_id = r[0]

    formato_json = _montar_formato_json()
    codigos = json.dumps([500, 9500])

    # Insere categoria (idempotente)
    r = conn.execute(text("""
        INSERT INTO categorias_resumo_json (
            nome, titulo, descricao, codigos_documento, formato_json,
            instrucoes_extracao, namespace_prefix, source_type,
            is_residual, ativo, ordem, group_id, criado_em, atualizado_em
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
            0,
            :gid,
            NOW(),
            NOW()
        )
        ON CONFLICT (nome, group_id) DO UPDATE SET
            formato_json = EXCLUDED.formato_json,
            instrucoes_extracao = EXCLUDED.instrucoes_extracao,
            codigos_documento = EXCLUDED.codigos_documento,
            atualizado_em = NOW()
        RETURNING id
    """), {"codigos": codigos, "fj": formato_json, "inst": _INSTRUCOES, "gid": detran_group_id})
    cat_id = r.fetchone()[0]

    # Garante que detran_resumo_peticao existe na tabela de variáveis
    conn.execute(text("""
        INSERT INTO extraction_variables (slug, label, descricao, tipo, ativo, criado_em, atualizado_em)
        VALUES (
            'detran_resumo_peticao',
            'Resumo analítico da petição inicial DETRAN',
            'Resumo completo com fatos, fundamentos jurídicos e pedidos da petição inicial em ações contra o DETRAN/MS',
            'text',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (slug) DO NOTHING
    """))

    # Vincula variáveis DETRAN à categoria
    slugs = ["detran_resumo_peticao"] + [s for s, _ in _VARIAVEIS_BOOL] + ["detran_tipo_acao"]
    for slug in slugs:
        conn.execute(
            text("UPDATE extraction_variables SET categoria_id = :cid WHERE slug = :slug"),
            {"cid": cat_id, "slug": slug}
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Remove vínculo das variáveis
    slugs = ["detran_resumo_peticao"] + [s for s, _ in _VARIAVEIS_BOOL] + ["detran_tipo_acao"]
    for slug in slugs:
        conn.execute(
            text("UPDATE extraction_variables SET categoria_id = NULL WHERE slug = :slug"),
            {"slug": slug}
        )

    # Remove a categoria
    conn.execute(text("DELETE FROM categorias_resumo_json WHERE nome = 'peticao_detran'"))
