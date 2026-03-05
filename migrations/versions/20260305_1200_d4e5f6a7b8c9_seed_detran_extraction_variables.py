"""Seed variáveis de extração do DETRAN

As variáveis são usadas nas regras determinísticas dos módulos DETRAN.
Sem elas, o builder visual de regras exibe 'Selecione...' em vez dos nomes corretos.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-05 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


# Variáveis booleanas do DETRAN
_BOOL_VARS = [
    ("detran_acao_fabricante_placas",       "Ação contra fabricante de placas",             "A ação é contra o fabricante de placas?"),
    ("detran_alega_bis_in_idem",            "Alega bis in idem",                            "O autor alega bis in idem na penalização?"),
    ("detran_alega_comunicou_venda",        "Alega que comunicou a venda do veículo",        "O autor alega que comunicou a venda do veículo ao DETRAN?"),
    ("detran_alega_equipamento_invalido",   "Alega equipamento de medição inválido",         "O autor alega que o equipamento de medição é inválido ou não homologado?"),
    ("detran_alega_ilegitimidade",          "Alega ilegitimidade passiva do Estado",         "O autor alega ilegitimidade passiva do Estado/DETRAN?"),
    ("detran_alega_incompetencia",          "Alega incompetência do juízo",                  "O autor alega incompetência do juízo?"),
    ("detran_alega_inepcia_inicial",        "Alega inépcia da inicial",                      "O autor alega inépcia da petição inicial?"),
    ("detran_alega_inercia_orgao",          "Alega inércia do órgão administrativo",         "O autor alega inércia do órgão no processamento do recurso administrativo?"),
    ("detran_alega_irregularidade_recurso_adm", "Alega irregularidade no recurso administrativo", "O autor alega irregularidade no processamento do recurso administrativo?"),
    ("detran_alega_nao_era_condutor",       "Alega que não era o condutor na infração",      "O autor alega que não era o condutor do veículo na data da infração?"),
    ("detran_alega_nao_notificado_autuacao","Alega não ter sido notificado da autuação",     "O autor alega não ter sido notificado da autuação ou da penalidade?"),
    ("detran_alega_nulidade_processo_adm",  "Alega nulidade do processo administrativo",     "O autor alega nulidade do processo administrativo de trânsito?"),
    ("detran_alega_prescricao_decadencia",  "Alega prescrição ou decadência",                "O autor alega prescrição ou decadência da pretensão?"),
    ("detran_alienacao_fiduciaria",         "Veículo em alienação fiduciária",               "O veículo está em alienação fiduciária?"),
    ("detran_autor_inerte",                 "Autor inerte no processo",                      "O autor deixou de praticar atos processuais necessários (inércia)?"),
    ("detran_coisa_julgada",                "Alega coisa julgada",                           "Há coisa julgada sobre a mesma questão?"),
    ("detran_contesta_validade_notificacao","Contesta validade da notificação",              "O autor contesta a validade da notificação de autuação ou penalidade?"),
    ("detran_dano_material",                "Pedido de dano material",                       "A ação inclui pedido de indenização por dano material?"),
    ("detran_dano_moral",                   "Pedido de dano moral",                          "A ação inclui pedido de indenização por dano moral?"),
    ("detran_documentos_duvidosos",         "Documentos apresentados são duvidosos",         "Os documentos apresentados pelo autor são duvidosos ou insuficientes?"),
    ("detran_falta_interesse_agir",         "Falta de interesse de agir",                    "Há falta de interesse de agir (via administrativa não esgotada)?"),
    ("detran_ilegitimidade_ativa",          "Ilegitimidade ativa do autor",                  "O autor não tem legitimidade ativa para propor a ação?"),
    ("detran_impugna_remocao",              "Impugna remoção ou apreensão do veículo",       "O autor impugna a remoção ou apreensão do veículo?"),
    ("detran_invoca_cdc",                   "Invoca o Código de Defesa do Consumidor",       "O autor invoca o CDC para fundamentar o pedido?"),
    ("detran_invoca_proporcionalidade",     "Invoca princípio da proporcionalidade",         "O autor invoca o princípio da proporcionalidade contra a penalidade?"),
    ("detran_ipva_pendente",                "IPVA com débitos pendentes",                    "O veículo possui débitos de IPVA pendentes?"),
    ("detran_litisconsorcio_necessario",    "Litisconsórcio necessário não formado",         "Há litisconsórcio necessário que não foi formado?"),
    ("detran_litispendencia_conexao",       "Litispendência ou conexão com outra ação",      "Há litispendência ou conexão com outra ação em curso?"),
    ("detran_pagou_voluntariamente",        "Pagou a multa voluntariamente",                 "O autor pagou a multa administrativamente antes de recorrer ao Judiciário?"),
    ("detran_pede_transferencia_pontos",    "Pede transferência de pontos da CNH",           "O autor pede transferência dos pontos da infração para outro condutor?"),
    ("detran_recusa_etilometro",            "Recusou-se a realizar teste do bafômetro",      "O autor se recusou a realizar o teste de alcoolemia (etilômetro)?"),
    ("detran_tutela_urgencia",              "Pedido de tutela de urgência",                  "A ação inclui pedido de tutela de urgência (liminar/antecipação)?"),
    ("detran_valor_causa_incompativel",     "Valor da causa incompatível com o pedido",      "O valor da causa é incompatível com o pedido formulado?"),
    ("detran_veiculo_clonado",              "Veículo clonado",                               "O veículo é clonado (adulteração de placa ou chassi)?"),
    ("detran_veiculo_furtado_roubado",      "Veículo furtado ou roubado",                    "O veículo foi furtado ou roubado?"),
    ("detran_vicio_citacao",                "Vício de citação",                              "Há vício na citação do réu?"),
]

# Variável tipo select — apenas os valores (opcoes é List[str] no schema)
_TIPO_ACAO_OPCOES = [
    "multa",
    "cassacao_cnh",
    "suspensao_cnh",
    "ear_cnh",
    "pontuacao_cnh",
    "transferencia_registro",
    "baixa_veiculo",
    "bloqueio_renajud",
    "exame_toxicologico",
]


def upgrade() -> None:
    conn = op.get_bind()

    # Insere variáveis booleanas (idempotente via ON CONFLICT DO NOTHING)
    for slug, label, descricao in _BOOL_VARS:
        conn.execute(text("""
            INSERT INTO extraction_variables (slug, label, descricao, tipo, ativo, criado_em, atualizado_em)
            VALUES (:slug, :label, :descricao, 'boolean', true, NOW(), NOW())
            ON CONFLICT (slug) DO NOTHING
        """), {"slug": slug, "label": label, "descricao": descricao})

    # Insere detran_tipo_acao como select com opcoes JSON
    import json
    conn.execute(text("""
        INSERT INTO extraction_variables (slug, label, descricao, tipo, opcoes, ativo, criado_em, atualizado_em)
        VALUES (
            'detran_tipo_acao',
            'Tipo de ação DETRAN',
            'Qual é o tipo de ação/penalidade DETRAN discutida na ação?',
            'select',
            CAST(:opcoes AS json),
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (slug) DO NOTHING
    """), {"opcoes": json.dumps(_TIPO_ACAO_OPCOES)})


def downgrade() -> None:
    conn = op.get_bind()
    slugs = [s for s, _, _ in _BOOL_VARS] + ["detran_tipo_acao"]
    for slug in slugs:
        conn.execute(text("DELETE FROM extraction_variables WHERE slug = :slug"), {"slug": slug})
