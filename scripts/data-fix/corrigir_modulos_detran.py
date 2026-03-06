"""
Script para corrigir módulos DETRAN: categorias erradas, bugs em regras e fusões.

Alterações:
1. CATEGORIAS ERRADAS (7 módulos reclassificados)
2. BUGS EM REGRAS DETERMINÍSTICAS (11 correções)
3. FUSÕES (7 operações, -7 módulos)

Resultado: 97 → 90 módulos
"""

import json
import copy
from pathlib import Path

# Caminhos
BASE = Path(r"E:\Projetos\PGE\portal-pge")
INPUT = BASE / "docs" / "schemas" / "detran_modulos_import.json"
OUTPUT = BASE / "docs" / "schemas" / "detran_modulos_import.json"
BACKUP = BASE / "docs" / "schemas" / "detran_modulos_import_backup_v3.1.json"


def carregar_json() -> dict:
    with open(INPUT, "r", encoding="utf-8") as f:
        return json.load(f)


def salvar_json(data: dict, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Salvo em: {path}")


def encontrar_modulo(modulos: list, nome: str) -> dict | None:
    """Encontra módulo pelo campo 'nome'."""
    for m in modulos:
        if m["nome"] == nome:
            return m
    return None


def remover_modulo(modulos: list, nome: str) -> dict | None:
    """Remove e retorna módulo pelo campo 'nome'."""
    for i, m in enumerate(modulos):
        if m["nome"] == nome:
            return modulos.pop(i)
    return None


# =============================================================================
# 1. CORREÇÃO DE CATEGORIAS
# =============================================================================

def corrigir_categorias(modulos: list):
    """Corrige 7 módulos com categoria errada."""
    correcoes = 0

    # 1.1 adm_015_047: Mérito → Preliminar (ilegitimidade passiva)
    m = encontrar_modulo(modulos, "detran_adm_015_047")
    if m:
        m["categoria"] = "Preliminar"
        m["subcategoria"] = "Preliminar"
        m["tags"] = ["detran", "preliminar", "adm_015"]
        m["palavras_chave"] = ["preliminar", "ilegitimidade", "pontuação", "município"]
        correcoes += 1
        print(f"  [CAT] adm_015_047: Mérito Administrativo → Preliminar")

    # 1.2 adm_008_039: Mérito → Preliminar (decadência)
    m = encontrar_modulo(modulos, "detran_adm_008_039")
    if m:
        m["categoria"] = "Preliminar"
        m["subcategoria"] = "Preliminar"
        m["tags"] = ["detran", "preliminar", "adm_008"]
        m["palavras_chave"] = ["preliminar", "decadência", "suspensão", "cassação", "prazo"]
        correcoes += 1
        print(f"  [CAT] adm_008_039: Mérito Administrativo → Preliminar")

    # 1.3 jur_026_086: Mérito Jurídico → Preliminar (CDC/inversão ônus)
    m = encontrar_modulo(modulos, "detran_jur_026_086")
    if m:
        m["categoria"] = "Preliminar"
        m["subcategoria"] = "Preliminar"
        # Tags já continham "preliminar" e "prel_030"
        if "preliminar" not in m.get("tags", []):
            m["tags"].append("preliminar")
        correcoes += 1
        print(f"  [CAT] jur_026_086: Mérito Jurídico → Preliminar")

    # 1.4 prel_027_022: Preliminar → Mérito (honorários/causalidade)
    m = encontrar_modulo(modulos, "detran_prel_027_022")
    if m:
        m["categoria"] = "Mérito"
        m["subcategoria"] = "Mérito Jurídico"
        m["tags"] = ["detran", "merito_juridico", "honorarios", "prel_027"]
        correcoes += 1
        print(f"  [CAT] prel_027_022: Preliminar → Mérito Jurídico")

    # 1.5 prel_031_025: Preliminar → Mérito (impugnação documentos)
    m = encontrar_modulo(modulos, "detran_prel_031_025")
    if m:
        m["categoria"] = "Mérito"
        m["subcategoria"] = "Mérito Fático-Probatório"
        m["tags"] = ["detran", "merito_fatico", "impugnacao_documentos", "prel_031"]
        correcoes += 1
        print(f"  [CAT] prel_031_025: Preliminar → Mérito Fático-Probatório")

    # 1.6 fat_012_059: subcategoria Indenização → Mérito Fático-Probatório
    m = encontrar_modulo(modulos, "detran_fat_012_059")
    if m:
        m["subcategoria"] = "Mérito Fático-Probatório"
        correcoes += 1
        print(f"  [CAT] fat_012_059: subcat Indenização → Mérito Fático-Probatório")

    # 1.7 dmat_005_099: Eventualidade → Mérito/Indenização
    m = encontrar_modulo(modulos, "detran_dmat_005_099")
    if m:
        m["categoria"] = "Mérito"
        m["subcategoria"] = "Indenização"
        correcoes += 1
        print(f"  [CAT] dmat_005_099: Eventualidade → Mérito/Indenização")

    print(f"  Total categorias corrigidas: {correcoes}")
    return correcoes


# =============================================================================
# 2. CORREÇÃO DE BUGS EM REGRAS DETERMINÍSTICAS
# =============================================================================

def corrigir_regras(modulos: list):
    """Corrige 11 bugs em regras determinísticas."""
    correcoes = 0

    # 2.1 prel_005_007: AND impossível (pontuacao_cnh AND ear_cnh) → OR
    m = encontrar_modulo(modulos, "detran_prel_005_007")
    if m and m.get("regra_deterministica"):
        # Juntar os dois in_list de tipo_acao num só
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["pontuacao_cnh", "ear_cnh"]
                },
                {
                    "type": "condition",
                    "variable": "detran_alega_ilegitimidade",
                    "operator": "equals",
                    "value": True
                },
                {
                    "type": "condition",
                    "variable": "detran_pede_transferencia_pontos",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] prel_005_007: AND impossível → tipo_acao in [pontuacao_cnh, ear_cnh]")

    # 2.2 prel_008_027: AND impossível (3 in_list incompatíveis) → lista unificada
    m = encontrar_modulo(modulos, "detran_prel_008_027")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["suspensao_cnh", "cassacao_cnh", "pontuacao_cnh", "ear_cnh"]
                },
                {
                    "type": "condition",
                    "variable": "detran_alega_ilegitimidade",
                    "operator": "equals",
                    "value": True
                },
                {
                    "type": "condition",
                    "variable": "detran_pede_transferencia_pontos",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] prel_008_027: AND impossível → tipo_acao in [suspensao_cnh, cassacao_cnh, pontuacao_cnh, ear_cnh]")

    # 2.3 jur_033_089: AND impossível (multa AND exame_toxicologico) → lista unificada
    m = encontrar_modulo(modulos, "detran_jur_033_089")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["multa", "exame_toxicologico"]
                },
                {
                    "type": "condition",
                    "variable": "detran_invoca_proporcionalidade",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] jur_033_089: AND impossível → tipo_acao in [multa, exame_toxicologico]")

    # 2.4 fat_007_058: variável errada (alega_equipamento_invalido) → remover
    m = encontrar_modulo(modulos, "detran_fat_007_058")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["multa"]
                },
                {
                    "type": "condition",
                    "variable": "detran_alega_nao_era_condutor",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] fat_007_058: removida variável alega_equipamento_invalido (sem relação)")

    # 2.5 fat_009_055: AND → OR entre equipamento_invalido e recusa_etilometro
    m = encontrar_modulo(modulos, "detran_fat_009_055")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["multa"]
                },
                {
                    "type": "or",
                    "conditions": [
                        {
                            "type": "condition",
                            "variable": "detran_alega_equipamento_invalido",
                            "operator": "equals",
                            "value": True
                        },
                        {
                            "type": "condition",
                            "variable": "detran_alega_recusa_etilometro",
                            "operator": "equals",
                            "value": True
                        }
                    ]
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] fat_009_055: AND → OR entre equipamento_invalido e recusa_etilometro")

    # 2.6 dmat_003_097: tipo_acao ear_cnh → multa, apreensao_veiculo (remoção/estadia)
    m = encontrar_modulo(modulos, "detran_dmat_003_097")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["multa", "apreensao_veiculo"]
                },
                {
                    "type": "condition",
                    "variable": "detran_impugna_remocao",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] dmat_003_097: tipo_acao ear_cnh → [multa, apreensao_veiculo]")

    # 2.7 tut_003_102: pagou_voluntariamente → tutela_urgencia (variável sem relação)
    m = encontrar_modulo(modulos, "detran_tut_003_102")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "condition",
            "variable": "detran_tutela_urgencia",
            "operator": "equals",
            "value": True
        }
        correcoes += 1
        print(f"  [REGRA] tut_003_102: pagou_voluntariamente → tutela_urgencia")

    # 2.8 adm_008_039: AND restritivo (multa AND suspensao_cnh) → lista unificada
    m = encontrar_modulo(modulos, "detran_adm_008_039")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["suspensao_cnh", "cassacao_cnh"]
                },
                {
                    "type": "condition",
                    "variable": "detran_alega_prescricao_decadencia",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] adm_008_039: AND restritivo → tipo_acao in [suspensao_cnh, cassacao_cnh]")

    # 2.9 adm_006_044: AND restritivo (multa AND suspensao/cassacao) → lista unificada
    m = encontrar_modulo(modulos, "detran_adm_006_044")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["multa", "suspensao_cnh", "cassacao_cnh"]
                },
                {
                    "type": "condition",
                    "variable": "detran_alega_nulidade_processo_adm",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] adm_006_044: AND restritivo → tipo_acao in [multa, suspensao_cnh, cassacao_cnh]")

    # 2.10 tut_001_100: regra muito restrita (só suspensao/cassacao) → incluir mais tipos
    m = encontrar_modulo(modulos, "detran_tut_001_100")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "condition",
            "variable": "detran_tutela_urgencia",
            "operator": "equals",
            "value": True
        }
        correcoes += 1
        print(f"  [REGRA] tut_001_100: restrita a suspensao/cassacao → qualquer tutela_urgencia")

    # 2.11 fat_010_053: regra ampla demais (toda multa) → exigir pedido indenizatório
    m = encontrar_modulo(modulos, "detran_fat_010_053")
    if m and m.get("regra_deterministica"):
        m["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["multa"]
                },
                {
                    "type": "or",
                    "conditions": [
                        {
                            "type": "condition",
                            "variable": "detran_dano_moral",
                            "operator": "equals",
                            "value": True
                        },
                        {
                            "type": "condition",
                            "variable": "detran_dano_material",
                            "operator": "equals",
                            "value": True
                        }
                    ]
                }
            ]
        }
        correcoes += 1
        print(f"  [REGRA] fat_010_053: toda multa → exige dano_moral OR dano_material")

    print(f"  Total regras corrigidas: {correcoes}")
    return correcoes


# =============================================================================
# 3. FUSÕES
# =============================================================================

def executar_fusoes(modulos: list):
    """Executa 7 fusões de módulos com regras idênticas ou quase idênticas."""
    fusoes = 0

    # 3.1 dm_001 + dm_002 → dm_001 absorve dm_002 (in re ipsa)
    m_base = encontrar_modulo(modulos, "detran_dm_001_092")
    m_abs = encontrar_modulo(modulos, "detran_dm_002_093")
    if m_base and m_abs:
        m_base["conteudo"] += "\n\n---\n\n" + m_abs["conteudo"]
        m_base["titulo"] = "Improcedência dos Danos Morais, Inaplicabilidade do Dano In Re Ipsa e Redução Subsidiária"
        m_base["condicao_ativacao"] = "Quando houver pedido de dano moral em qualquer tipo de ação de trânsito."
        # Mesclar tags e palavras-chave
        for tag in m_abs.get("tags", []):
            if tag not in m_base.get("tags", []):
                m_base["tags"].append(tag)
        for kw in m_abs.get("palavras_chave", []):
            if kw not in m_base.get("palavras_chave", []):
                m_base["palavras_chave"].append(kw)
        remover_modulo(modulos, "detran_dm_002_093")
        fusoes += 1
        print(f"  [FUSAO] dm_001 + dm_002 → dm_001 (danos morais + in re ipsa)")

    # 3.2 dmat_001 + dmat_002 → dmat_001 absorve dmat_002 (lucros cessantes)
    m_base = encontrar_modulo(modulos, "detran_dmat_001_095")
    m_abs = encontrar_modulo(modulos, "detran_dmat_002_096")
    if m_base and m_abs:
        m_base["conteudo"] += "\n\n---\n\n" + m_abs["conteudo"]
        m_base["titulo"] = "Improcedência dos Danos Materiais, Lucros Cessantes e Danos ao Veículo"
        m_base["condicao_ativacao"] = "Quando houver pedido de dano material em qualquer tipo de ação de trânsito."
        for tag in m_abs.get("tags", []):
            if tag not in m_base.get("tags", []):
                m_base["tags"].append(tag)
        for kw in m_abs.get("palavras_chave", []):
            if kw not in m_base.get("palavras_chave", []):
                m_base["palavras_chave"].append(kw)
        remover_modulo(modulos, "detran_dmat_002_096")
        fusoes += 1
        print(f"  [FUSAO] dmat_001 + dmat_002 → dmat_001 (danos materiais + lucros cessantes)")

    # 3.3 resp_001 + resp_002 → resp_001 absorve resp_002 (nexo causal)
    m_base = encontrar_modulo(modulos, "detran_resp_001_095")
    m_abs = encontrar_modulo(modulos, "detran_resp_002_096")
    if m_base and m_abs:
        m_base["conteudo"] += "\n\n---\n\n" + m_abs["conteudo"]
        m_base["titulo"] = "Excludentes de Responsabilidade Civil e Ausência de Nexo Causal"
        m_base["condicao_ativacao"] = "Quando o tipo de ação for responsabilidade civil contra o Estado/DETRAN."
        for tag in m_abs.get("tags", []):
            if tag not in m_base.get("tags", []):
                m_base["tags"].append(tag)
        for kw in m_abs.get("palavras_chave", []):
            if kw not in m_base.get("palavras_chave", []):
                m_base["palavras_chave"].append(kw)
        remover_modulo(modulos, "detran_resp_002_096")
        fusoes += 1
        print(f"  [FUSAO] resp_001 + resp_002 → resp_001 (culpa exclusiva + nexo causal)")

    # 3.4 jur_012 + jur_013 → jur_012 absorve jur_013 (baixa veículo)
    m_base = encontrar_modulo(modulos, "detran_jur_012_077")
    m_abs = encontrar_modulo(modulos, "detran_jur_013_080")
    if m_base and m_abs:
        m_base["conteudo"] += "\n\n---\n\n" + m_abs["conteudo"]
        m_base["titulo"] = "Inaplicabilidade da Renúncia de Propriedade e Impossibilidade de Baixa sem Requisitos Legais"
        m_base["condicao_ativacao"] = "Quando o tipo de ação for baixa de veículo."
        for tag in m_abs.get("tags", []):
            if tag not in m_base.get("tags", []):
                m_base["tags"].append(tag)
        for kw in m_abs.get("palavras_chave", []):
            if kw not in m_base.get("palavras_chave", []):
                m_base["palavras_chave"].append(kw)
        remover_modulo(modulos, "detran_jur_013_080")
        fusoes += 1
        print(f"  [FUSAO] jur_012 + jur_013 → jur_012 (renúncia + baixa sem requisitos)")

    # 3.5 jur_008 + jur_011 → jur_008 absorve jur_011 (comunicação venda + IPVA)
    m_base = encontrar_modulo(modulos, "detran_jur_008_061")
    m_abs = encontrar_modulo(modulos, "detran_jur_011_079")
    if m_base and m_abs:
        m_base["conteudo"] += "\n\n---\n\n" + m_abs["conteudo"]
        m_base["titulo"] = "Responsabilidade Solidária do Alienante sem Comunicação de Venda (Débitos e IPVA)"
        m_base["condicao_ativacao"] = "Quando o autor alegar ter comunicado a venda e houver IPVA/débitos pendentes, em ação de transferência de registro ou isenção de IPVA."
        # Expandir regra para incluir isencao_ipva
        m_base["regra_deterministica"] = {
            "type": "and",
            "conditions": [
                {
                    "type": "condition",
                    "variable": "detran_tipo_acao",
                    "operator": "in_list",
                    "value": ["transferencia_registro", "isencao_ipva"]
                },
                {
                    "type": "condition",
                    "variable": "detran_alega_comunicou_venda",
                    "operator": "equals",
                    "value": True
                },
                {
                    "type": "condition",
                    "variable": "detran_ipva_pendente",
                    "operator": "equals",
                    "value": True
                }
            ]
        }
        for tag in m_abs.get("tags", []):
            if tag not in m_base.get("tags", []):
                m_base["tags"].append(tag)
        for kw in m_abs.get("palavras_chave", []):
            if kw not in m_base.get("palavras_chave", []):
                m_base["palavras_chave"].append(kw)
        remover_modulo(modulos, "detran_jur_011_079")
        fusoes += 1
        print(f"  [FUSAO] jur_008 + jur_011 → jur_008 (resp. solidária + IPVA)")

    # 3.6 prel_011 + prel_013 → prel_011 absorve prel_013 (incompetência + JEFP)
    m_base = encontrar_modulo(modulos, "detran_prel_011_002")
    m_abs = encontrar_modulo(modulos, "detran_prel_013_021")
    if m_base and m_abs:
        m_base["conteudo"] += "\n\n---\n\n" + m_abs["conteudo"]
        m_base["titulo"] = "Incompetência do Juízo em Razão da Matéria, Território, Valor ou Remessa ao JEFP"
        m_base["condicao_ativacao"] = "Quando houver alegação de incompetência do juízo, incluindo remessa ao Juizado Especial da Fazenda Pública."
        for tag in m_abs.get("tags", []):
            if tag not in m_base.get("tags", []):
                m_base["tags"].append(tag)
        for kw in m_abs.get("palavras_chave", []):
            if kw not in m_base.get("palavras_chave", []):
                m_base["palavras_chave"].append(kw)
        remover_modulo(modulos, "detran_prel_013_021")
        fusoes += 1
        print(f"  [FUSAO] prel_011 + prel_013 → prel_011 (incompetência + JEFP)")

    # 3.7 fat_001 + fat_010 → fat_001 absorve fat_010 (provas + nexo causal)
    m_base = encontrar_modulo(modulos, "detran_fat_001_048")
    m_abs = encontrar_modulo(modulos, "detran_fat_010_053")
    if m_base and m_abs:
        m_base["conteudo"] += "\n\n---\n\n" + m_abs["conteudo"]
        m_base["titulo"] = "Ausência ou Insuficiência de Provas do Autor e de Nexo Causal"
        m_base["condicao_ativacao"] = "Quando o tipo de ação for multa de trânsito."
        for tag in m_abs.get("tags", []):
            if tag not in m_base.get("tags", []):
                m_base["tags"].append(tag)
        for kw in m_abs.get("palavras_chave", []):
            if kw not in m_base.get("palavras_chave", []):
                m_base["palavras_chave"].append(kw)
        remover_modulo(modulos, "detran_fat_010_053")
        fusoes += 1
        print(f"  [FUSAO] fat_001 + fat_010 → fat_001 (provas + nexo causal)")

    print(f"  Total fusões executadas: {fusoes}")
    return fusoes


# =============================================================================
# 4. REORDENAR
# =============================================================================

ORDEM_CATEGORIAS = {
    "Preliminar": 0,
    "Mérito": 1,
    "Tutela de Urgência": 2,
    "Eventualidade": 3,
}

ORDEM_SUBCATEGORIAS = {
    "Preliminar": 0,
    "Mérito Administrativo": 1,
    "Mérito Fático-Probatório": 2,
    "Mérito Jurídico": 3,
    "Indenização": 4,
    "Mérito": 5,
    "Dano Material": 6,
    "Tutela de Urgência": 7,
}


def reordenar_modulos(modulos: list):
    """Reordena módulos por categoria/subcategoria e atribui novas ordens."""
    modulos.sort(key=lambda m: (
        ORDEM_CATEGORIAS.get(m.get("categoria", ""), 99),
        ORDEM_SUBCATEGORIAS.get(m.get("subcategoria", ""), 99),
        m.get("ordem", 999)
    ))
    for i, m in enumerate(modulos):
        m["ordem"] = i + 1


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 60)
    print("CORREÇÃO DE MÓDULOS DETRAN v3.1 → v3.2")
    print("=" * 60)

    data = carregar_json()
    modulos = data["modulos"]
    total_original = len(modulos)
    print(f"\nMódulos carregados: {total_original}")

    # Backup
    salvar_json(data, BACKUP)
    print(f"Backup salvo em: {BACKUP}\n")

    # 1. Categorias
    print("--- 1. CORRIGINDO CATEGORIAS ---")
    n_cat = corrigir_categorias(modulos)

    # 2. Regras
    print("\n--- 2. CORRIGINDO REGRAS ---")
    n_reg = corrigir_regras(modulos)

    # 3. Fusões
    print("\n--- 3. EXECUTANDO FUSÕES ---")
    n_fus = executar_fusoes(modulos)

    # 4. Reordenar
    print("\n--- 4. REORDENANDO ---")
    reordenar_modulos(modulos)
    print(f"  Módulos reordenados por categoria/subcategoria")

    # Atualizar metadados
    total_final = len(modulos)
    data["total"] = total_final
    data["versao"] = "3.2"
    data["descricao"] = (
        f"{total_final} módulos de defesa do DETRAN/MS: todos determinísticos. "
        f"v3.2 — corrige {n_cat} categorias erradas, {n_reg} bugs em regras, "
        f"{n_fus} fusões ({total_original}→{total_final} módulos)."
    )

    # Salvar
    salvar_json(data, OUTPUT)

    # Resumo
    print(f"\n{'=' * 60}")
    print(f"RESUMO")
    print(f"{'=' * 60}")
    print(f"  Módulos antes:     {total_original}")
    print(f"  Categorias fixadas: {n_cat}")
    print(f"  Regras fixadas:     {n_reg}")
    print(f"  Fusões executadas:  {n_fus}")
    print(f"  Módulos depois:    {total_final}")

    # Contagem por categoria
    cats = {}
    for m in modulos:
        cat = m.get("categoria", "?")
        cats[cat] = cats.get(cat, 0) + 1
    print(f"\n  Por categoria:")
    for cat, count in sorted(cats.items()):
        print(f"    {cat}: {count}")


if __name__ == "__main__":
    main()
