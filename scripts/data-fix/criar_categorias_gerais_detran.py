"""
Cria as 5 categorias gerais de extração JSON para DETRAN/MS:
despacho, sentença, petições, decisões, recursos.
Mesmos códigos do PS, schemas adaptados para contexto de trânsito/DETRAN.
"""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from sqlalchemy import create_engine, text

DOCKER_DB = "postgresql://postgres:postgres@localhost:5433/portal_pge"
engine = create_engine(DOCKER_DB)

# ── Definições das categorias ─────────────────────────────────────────────────

CATEGORIAS = [
    {
        "nome": "despacho_detran",
        "titulo": "Despacho — DETRAN/MS",
        "descricao": "Extrai informações de despachos judiciais em processos DETRAN/MS",
        "codigos_documento": [6, 27, 141, 9807],
        "namespace_prefix": "detran",
        "instrucoes": (
            "Analise o despacho judicial em processo contra o DETRAN/MS. "
            "Extraia apenas o que estiver expressamente determinado no despacho."
        ),
        "formato_json": {
            "despacho_tipo": {
                "type": "text",
                "description": "Qual o tipo do despacho? (ex: intimação, citação, conclusão, requisição de informações, designação de audiência)"
            },
            "despacho_destinatarios": {
                "type": "text",
                "description": "A quem o despacho é dirigido? (ex: réu, autor, DETRAN, perito, ambas as partes)"
            },
            "despacho_determinacoes": {
                "type": "text",
                "description": "Quais as determinações ou providências ordenadas pelo juízo?"
            },
            "despacho_prazo_fixado": {
                "type": "boolean",
                "description": "O despacho fixa algum prazo para cumprimento?"
            },
            "despacho_detalhamento_prazo": {
                "type": "text",
                "description": "Se há prazo, qual é e para quem? (conditional: despacho_prazo_fixado=true)"
            },
            "despacho_necessita_providencia_estado": {
                "type": "boolean",
                "description": "O despacho exige alguma providência do Estado/DETRAN (ex: informações, documentos, cumprimento de decisão)?"
            },
            "despacho_resumo": {
                "type": "text",
                "description": "Resumo objetivo do despacho, em uma ou duas frases."
            },
        },
    },
    {
        "nome": "sentenca_detran",
        "titulo": "Sentença — DETRAN/MS",
        "descricao": "Extrai informações de sentenças em processos DETRAN/MS",
        "codigos_documento": [8, 54],
        "namespace_prefix": "detran",
        "instrucoes": (
            "Analise a sentença judicial em processo contra o DETRAN/MS. "
            "Identifique com precisão o resultado e os fundamentos da decisão."
        ),
        "formato_json": {
            "sentenca_resultado_global": {
                "type": "select",
                "description": "Qual o resultado global da sentença?",
                "options": ["procedente", "improcedente", "parcialmente_procedente", "extincao_sem_resolucao_merito"]
            },
            "sentenca_fundamento_extincao": {
                "type": "text",
                "description": "Se extinta sem resolução do mérito, qual o fundamento? (ex: ilegitimidade, falta de interesse, prescrição)"
            },
            "sentenca_analise_pedidos": {
                "type": "text",
                "description": "Como foram julgados os pedidos? Descreva o que foi deferido e o que foi indeferido."
            },
            "sentenca_questoes_preliminares": {
                "type": "boolean",
                "description": "A sentença analisou questões preliminares (ilegitimidade, prescrição, inépcia, incompetência)?"
            },
            "sentenca_preliminares_detalhamento": {
                "type": "text",
                "description": "Quais preliminares foram analisadas e como foram decididas?"
            },
            "sentenca_dano_moral_deferido": {
                "type": "boolean",
                "description": "Foi deferido pedido de indenização por dano moral?"
            },
            "sentenca_valor_dano_moral": {
                "type": "text",
                "description": "Qual o valor arbitrado para dano moral? (se deferido)"
            },
            "sentenca_dano_material_deferido": {
                "type": "boolean",
                "description": "Foi deferido pedido de indenização por dano material?"
            },
            "sentenca_valor_dano_material": {
                "type": "text",
                "description": "Qual o valor arbitrado para dano material? (se deferido)"
            },
            "sentenca_anulacao_multa_autuacao": {
                "type": "boolean",
                "description": "A sentença determinou anulação de multa, autuação, penalidade ou ato administrativo do DETRAN?"
            },
            "sentenca_condenacao_honorarios": {
                "type": "boolean",
                "description": "Houve condenação em honorários advocatícios?"
            },
            "sentenca_valor_honorarios": {
                "type": "text",
                "description": "Qual o valor ou percentual dos honorários fixados?"
            },
            "sentenca_uso_precedentes_qualificados": {
                "type": "boolean",
                "description": "A sentença aplicou precedentes qualificados (temas STF/STJ, súmulas vinculantes)?"
            },
            "sentenca_precedentes_aplicados": {
                "type": "text",
                "description": "Quais precedentes qualificados foram aplicados? (ex: Tema 793 STF, Súmula 568 STJ)"
            },
            "sentenca_fundamentos_juridicos_resumo": {
                "type": "text",
                "description": "Resuma os principais fundamentos jurídicos da sentença."
            },
            "sentenca_resumo_executivo": {
                "type": "text",
                "description": "Resumo executivo completo da sentença: resultado, fundamentos centrais e determinações."
            },
        },
    },
    {
        "nome": "peticoes_detran",
        "titulo": "Petições — DETRAN/MS",
        "descricao": "Extrai informações de petições intermediárias em processos DETRAN/MS",
        "codigos_documento": [500, 510, 9500, 8320, 8326],
        "namespace_prefix": "detran",
        "instrucoes": (
            "Analise a petição em processo contra o DETRAN/MS. "
            "Extraia os pedidos, fundamentos e pontos de atenção relevantes para a defesa do Estado."
        ),
        "formato_json": {
            "peticoes_tipo_documento": {
                "type": "text",
                "description": "Qual o tipo desta petição? (ex: manifestação, impugnação, pedido de reconsideração, petição simples, embargos de declaração)"
            },
            "peticoes_requerente": {
                "type": "select",
                "description": "Quem peticiona?",
                "options": ["autor", "reu_detran", "reu_estado", "ambos", "terceiro"]
            },
            "peticoes_pedidos": {
                "type": "text",
                "description": "Quais os pedidos formulados nesta petição?"
            },
            "peticoes_fundamentos": {
                "type": "text",
                "description": "Quais os fundamentos jurídicos invocados?"
            },
            "peticoes_nova_prova_documento": {
                "type": "boolean",
                "description": "A petição apresenta nova prova ou documento relevante?"
            },
            "peticoes_descricao_prova": {
                "type": "text",
                "description": "Se apresenta prova nova, descreva o documento e sua relevância."
            },
            "peticoes_pontos_de_atencao": {
                "type": "text",
                "description": "Quais os pontos de atenção para a defesa do Estado/DETRAN? Indique argumentos que precisam ser rebatidos."
            },
            "peticoes_tutela_urgencia": {
                "type": "boolean",
                "description": "A petição inclui ou renova pedido de tutela de urgência?"
            },
            "peticoes_resumo": {
                "type": "text",
                "description": "Resumo objetivo do conteúdo desta petição."
            },
        },
    },
    {
        "nome": "decisoes_detran",
        "titulo": "Decisões Interlocutórias — DETRAN/MS",
        "descricao": "Extrai informações de decisões interlocutórias em processos DETRAN/MS",
        "codigos_documento": [8506, 517, 137, 9653, 9654, 15, 45, 44, 9817],
        "namespace_prefix": "detran",
        "instrucoes": (
            "Analise a decisão interlocutória em processo contra o DETRAN/MS. "
            "Identifique tutelas deferidas, prazos e determinações relevantes para o Estado."
        ),
        "formato_json": {
            "decisoes_resumo_decisao": {
                "type": "text",
                "description": "Resumo objetivo da decisão, incluindo o que foi decidido e os principais fundamentos."
            },
            "decisoes_resultado_tutela_urgencia": {
                "type": "select",
                "description": "Qual o resultado do pedido de tutela de urgência (se apreciado)?",
                "options": ["deferida", "indeferida", "deferida_parcialmente", "nao_apreciada", "nao_havia_pedido"]
            },
            "decisoes_fundamentos_decisao": {
                "type": "text",
                "description": "Quais os principais fundamentos jurídicos da decisão?"
            },
            "decisoes_itens_deferidos_detalhamento": {
                "type": "text",
                "description": "O que foi deferido? Descreva detalhadamente."
            },
            "decisoes_itens_indeferidos_detalhamento": {
                "type": "text",
                "description": "O que foi indeferido? Descreva detalhadamente."
            },
            "decisoes_determinacao_estado_detran": {
                "type": "boolean",
                "description": "A decisão impõe obrigação ou prazo específico ao Estado/DETRAN?"
            },
            "decisoes_detalhamento_obrigacao": {
                "type": "text",
                "description": "Se impõe obrigação ao Estado/DETRAN, qual é e em que prazo?"
            },
            "decisoes_fixacao_multa_cominatoria": {
                "type": "boolean",
                "description": "A decisão fixa multa cominatória (astreintes) em caso de descumprimento?"
            },
            "decisoes_valor_multa": {
                "type": "text",
                "description": "Qual o valor e a periodicidade da multa cominatória? (se fixada)"
            },
            "decisoes_uso_precedentes_qualificados": {
                "type": "boolean",
                "description": "A decisão aplicou precedentes qualificados (temas STF/STJ, súmulas)?"
            },
            "decisoes_detalhamento_precedentes": {
                "type": "text",
                "description": "Quais precedentes qualificados foram aplicados?"
            },
        },
    },
    {
        "nome": "recursos_detran",
        "titulo": "Recursos — DETRAN/MS",
        "descricao": "Extrai informações de recursos em processos DETRAN/MS",
        "codigos_documento": [264, 272, 9629, 8335, 9630, 62],
        "namespace_prefix": "detran",
        "instrucoes": (
            "Analise o recurso interposto em processo contra o DETRAN/MS. "
            "Identifique as teses recursais e o que está sendo impugnado."
        ),
        "formato_json": {
            "recursos_tipo_documento": {
                "type": "text",
                "description": "Qual o tipo de recurso? (ex: apelação, agravo de instrumento, embargos de declaração, agravo interno)"
            },
            "recursos_recorrente": {
                "type": "select",
                "description": "Quem recorre?",
                "options": ["autor", "reu_detran", "reu_estado", "ambos"]
            },
            "recursos_decisao_recorrida": {
                "type": "text",
                "description": "Qual a decisão recorrida? (ex: sentença de procedência, decisão que deferiu tutela de urgência)"
            },
            "recursos_teses_recursais": {
                "type": "text",
                "description": "Quais as teses recursais apresentadas? Liste os argumentos do recorrente."
            },
            "recursos_pedido_recursal": {
                "type": "text",
                "description": "Qual o pedido formulado no recurso? (ex: reforma total da sentença, anulação da decisão)"
            },
            "recursos_efeito_suspensivo": {
                "type": "boolean",
                "description": "O recurso foi interposto com pedido de efeito suspensivo ou antecipação de tutela recursal?"
            },
            "recursos_pontos_de_atencao": {
                "type": "text",
                "description": "Quais os pontos de atenção para a defesa do Estado/DETRAN em contrarrazões ou resposta ao recurso?"
            },
            "recursos_resumo": {
                "type": "text",
                "description": "Resumo objetivo do recurso: quem recorre, do quê, e o que pede."
            },
        },
    },
]

# ── Insere no BD ──────────────────────────────────────────────────────────────
with engine.begin() as conn:
    r = conn.execute(text("SELECT id FROM prompt_groups WHERE slug = 'detran'")).fetchone()
    group_id = r[0]
    print(f"group_id DETRAN = {group_id}")

    for cat in CATEGORIAS:
        fmt_json = json.dumps(cat["formato_json"], ensure_ascii=False, indent=2)
        codigos = json.dumps(cat["codigos_documento"])

        r = conn.execute(text("""
            INSERT INTO categorias_resumo_json (
                nome, titulo, descricao, codigos_documento, formato_json,
                instrucoes_extracao, namespace_prefix, source_type,
                is_residual, ativo, ordem, group_id, criado_em, atualizado_em
            ) VALUES (
                :nome, :titulo, :descricao, CAST(:codigos AS jsonb), :fj,
                :inst, :ns, 'code', false, true, 0, :gid, NOW(), NOW()
            )
            ON CONFLICT (nome, group_id) DO UPDATE SET
                formato_json = EXCLUDED.formato_json,
                instrucoes_extracao = EXCLUDED.instrucoes_extracao,
                codigos_documento = EXCLUDED.codigos_documento,
                atualizado_em = NOW()
            RETURNING id
        """), {
            "nome": cat["nome"],
            "titulo": cat["titulo"],
            "descricao": cat["descricao"],
            "codigos": codigos,
            "fj": fmt_json,
            "inst": cat["instrucoes"],
            "ns": cat["namespace_prefix"],
            "gid": group_id,
        })
        cat_id = r.fetchone()[0]
        print(f"[OK] {cat['nome']} id={cat_id} | {len(cat['formato_json'])} campos | codigos={cat['codigos_documento']}")

print("\n[OK] 5 categorias gerais DETRAN criadas.")
