#!/usr/bin/env python3
"""
Auditoria do Modo Semi-Automatico - Gerador de Pecas

Analisa geracoes semi-automaticas dos ultimos N dias no banco de producao
e gera relatorio detalhado sobre decisoes de curadoria.

Uso:
    python scripts/auditoria_curadoria.py --db-url "postgresql://..." --dias 7 --output relatorio.md
    python scripts/auditoria_curadoria.py --dias 7 --verbose
"""

import sys
import os
import json
import argparse
from typing import Dict, Any, List, Optional, Set, Tuple
from datetime import datetime, timedelta
from collections import Counter, defaultdict

# Encoding UTF-8 para Windows
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Adiciona diretorio raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, and_, text
from sqlalchemy.orm import sessionmaker, undefer

# Import order para evitar erros de relacionamento circular
from auth.models import User
from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON
from sistemas.gerador_pecas.models_extraction import (
    ExtractionVariable, PromptVariableUsage, PromptActivationLog
)
from admin.models_prompt_groups import PromptGroup, PromptSubgroup, PromptSubcategoria
from admin.models_prompts import PromptModulo, RegraDeterministicaTipoPeca
from sistemas.gerador_pecas.models import GeracaoPeca, FeedbackPeca
from sistemas.gerador_pecas.services_deterministic import (
    DeterministicRuleEvaluator,
    _extrair_variaveis_regra,
    avaliar_ativacao_prompt,
)


# ============================================================
# CLI
# ============================================================

def parse_args():
    parser = argparse.ArgumentParser(description="Auditoria do modo semi-automatico do Gerador de Pecas")
    parser.add_argument("--db-url", type=str, default=None,
                        help="URL do banco de dados (override de DATABASE_URL)")
    parser.add_argument("--dias", type=int, default=7,
                        help="Quantidade de dias para analisar (default: 7)")
    parser.add_argument("--output", type=str, default="relatorio_auditoria_semi_automatico.md",
                        help="Caminho do arquivo de relatorio (default: relatorio_auditoria_semi_automatico.md)")
    parser.add_argument("--verbose", action="store_true",
                        help="Exibir informacoes detalhadas no console")
    parser.add_argument("--tipo-peca", type=str, default=None,
                        help="Filtrar por tipo de peca (ex: contestacao)")
    return parser.parse_args()


# ============================================================
# CONEXAO DB
# ============================================================

def criar_sessao(db_url: Optional[str] = None):
    """Cria sessao SQLAlchemy com engine proprio."""
    if not db_url:
        from config import DATABASE_URL
        db_url = DATABASE_URL
    engine = create_engine(db_url, echo=False, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()


# ============================================================
# QUERIES DE EXTRACAO
# ============================================================

def carregar_geracoes_semi_auto(db, dias: int, tipo_peca: Optional[str] = None) -> List[Tuple]:
    """Q1: Carrega todas as geracoes semi-automaticas no periodo."""
    cutoff = datetime.utcnow() - timedelta(days=dias)
    filtros = [
        GeracaoPeca.criado_em >= cutoff,
    ]
    if tipo_peca:
        filtros.append(GeracaoPeca.tipo_peca == tipo_peca)

    # Query com undefer para colunas deferred + join com User
    rows = (
        db.query(GeracaoPeca, User.username, User.full_name)
        .options(
            undefer(GeracaoPeca.modo_ativacao_agente2),
            undefer(GeracaoPeca.curadoria_metadata),
            undefer(GeracaoPeca.modulos_ativados_det),
            undefer(GeracaoPeca.modulos_ativados_llm),
        )
        .outerjoin(User, User.id == GeracaoPeca.usuario_id)
        .filter(and_(*filtros))
        .order_by(GeracaoPeca.criado_em.desc())
        .all()
    )

    # Filtra por modo semi_automatico no Python (para lidar com colunas deferred NULL)
    resultado = []
    for geracao, username, full_name in rows:
        modo = None
        try:
            modo = geracao.modo_ativacao_agente2
        except Exception:
            pass
        if modo == "semi_automatico":
            resultado.append((geracao, username, full_name))

    return resultado


def carregar_modulos(db) -> Dict[int, PromptModulo]:
    """Q2: Carrega todos os modulos de conteudo."""
    modulos = db.query(PromptModulo).filter(PromptModulo.tipo == "conteudo").all()
    return {m.id: m for m in modulos}


def carregar_regras_tipo_peca(db) -> Dict[int, Dict[str, Any]]:
    """Q3: Carrega regras especificas por tipo de peca."""
    regras = db.query(RegraDeterministicaTipoPeca).filter(
        RegraDeterministicaTipoPeca.ativo == True
    ).all()
    mapa = defaultdict(dict)
    for r in regras:
        mapa[r.modulo_id][r.tipo_peca] = r.regra_deterministica
    return dict(mapa)


def carregar_activation_logs(db, dias: int) -> Dict[str, List[PromptActivationLog]]:
    """Q4: Carrega logs de ativacao no periodo, indexados por numero_processo."""
    cutoff = datetime.utcnow() - timedelta(days=dias)
    logs = db.query(PromptActivationLog).filter(
        PromptActivationLog.timestamp >= cutoff
    ).all()

    mapa = defaultdict(list)
    for log in logs:
        if log.numero_processo:
            mapa[log.numero_processo].append(log)
        if log.geracao_id:
            mapa[f"geracao_{log.geracao_id}"].append(log)
    return dict(mapa)


# ============================================================
# RE-AVALIACAO DE REGRAS
# ============================================================

def reavaliar_modulo(
    modulo: PromptModulo,
    variaveis: Dict[str, Any],
    tipo_peca: Optional[str],
    regras_tipo_peca: Dict[int, Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Re-avalia regra deterministica de um modulo com variaveis fornecidas.
    Retorna detalhes sobre por que ativou ou nao.
    """
    resultado = {
        "modulo_id": modulo.id,
        "modulo_nome": modulo.nome,
        "modulo_titulo": modulo.titulo,
        "modo_ativacao": modulo.modo_ativacao,
        "tem_regra_global": modulo.regra_deterministica is not None,
        "tem_regra_especifica": False,
        "resultado_avaliacao": None,
        "regra_usada": None,
        "variaveis_necessarias": [],
        "variaveis_disponiveis": [],
        "variaveis_faltantes": [],
        "valores_variaveis": {},
        "detalhes": "",
    }

    # Verifica regra especifica para tipo_peca
    regra_especifica = None
    if tipo_peca and modulo.id in regras_tipo_peca:
        if tipo_peca in regras_tipo_peca[modulo.id]:
            regra_especifica = regras_tipo_peca[modulo.id][tipo_peca]
            resultado["tem_regra_especifica"] = True

    # Determina qual regra usar (especifica tem precedencia)
    regra = None
    if regra_especifica:
        regra = regra_especifica
        resultado["regra_usada"] = f"especifica_{tipo_peca}"
    elif modulo.regra_deterministica:
        regra = modulo.regra_deterministica
        resultado["regra_usada"] = "global"

    if not regra:
        resultado["detalhes"] = "Modulo sem regra deterministica (modo LLM)"
        return resultado

    # Extrai variaveis necessarias
    vars_necessarias = _extrair_variaveis_regra(regra)
    resultado["variaveis_necessarias"] = sorted(vars_necessarias)

    # Verifica quais estao disponiveis
    vars_disponiveis = set()
    vars_faltantes = set()
    for v in vars_necessarias:
        if v in variaveis and variaveis[v] is not None:
            vars_disponiveis.add(v)
            resultado["valores_variaveis"][v] = variaveis.get(v)
        else:
            vars_faltantes.add(v)

    resultado["variaveis_disponiveis"] = sorted(vars_disponiveis)
    resultado["variaveis_faltantes"] = sorted(vars_faltantes)

    # Tenta avaliar
    evaluator = DeterministicRuleEvaluator()
    try:
        ativou = evaluator.avaliar(regra, variaveis)
        resultado["resultado_avaliacao"] = ativou
        if ativou:
            resultado["detalhes"] = f"Regra {resultado['regra_usada']} avaliou TRUE"
        else:
            # Explica POR QUE nao ativou
            detalhes_partes = []
            if vars_faltantes:
                detalhes_partes.append(f"Variaveis faltantes: {', '.join(sorted(vars_faltantes))}")
            for v in sorted(vars_disponiveis):
                detalhes_partes.append(f"{v} = {variaveis.get(v)}")
            resultado["detalhes"] = f"Regra {resultado['regra_usada']} avaliou FALSE. " + "; ".join(detalhes_partes)
    except Exception as e:
        resultado["resultado_avaliacao"] = None
        resultado["detalhes"] = f"Erro ao avaliar regra: {e}"

    return resultado


# ============================================================
# ANALISE POR GERACAO
# ============================================================

def analisar_geracao(
    geracao: GeracaoPeca,
    username: str,
    full_name: str,
    modulos_map: Dict[int, PromptModulo],
    regras_tipo_peca: Dict[int, Dict[str, Any]],
    logs_map: Dict[str, List[PromptActivationLog]],
    verbose: bool = False,
) -> Dict[str, Any]:
    """Analisa uma geracao e retorna o diff auditavel."""

    metadata = geracao.curadoria_metadata
    if not metadata:
        return {
            "id": geracao.id,
            "cnj": geracao.numero_cnj,
            "tipo_peca": geracao.tipo_peca,
            "usuario": full_name or username or "N/A",
            "data": str(geracao.criado_em),
            "erro": "curadoria_metadata ausente",
            "confirmados": [],
            "manuais": [],
            "excluidos": [],
        }

    # Extrai conjuntos de IDs
    preview_ids = set(metadata.get("modulos_preview_ids", []))
    curados_ids = set(metadata.get("modulos_curados_ids", []))
    manuais_ids = set(metadata.get("modulos_manuais_ids", []))
    excluidos_ids = set(metadata.get("modulos_excluidos_ids", []))

    # Confirmados = no preview E nos curados, mas NAO manuais
    confirmados_ids = (preview_ids & curados_ids) - manuais_ids

    # Variaveis disponiveis (dados_processo armazena dados_extracao)
    variaveis = {}
    if geracao.dados_processo and isinstance(geracao.dados_processo, dict):
        variaveis = geracao.dados_processo

    # Logs de ativacao para este processo
    cnj_limpo = (geracao.numero_cnj or "").replace("-", "").replace(".", "")
    logs_processo = logs_map.get(cnj_limpo, [])
    logs_geracao = logs_map.get(f"geracao_{geracao.id}", [])
    todos_logs = logs_processo + logs_geracao

    # Indexa logs por prompt_id
    logs_por_prompt = defaultdict(list)
    for log in todos_logs:
        logs_por_prompt[log.prompt_id].append(log)

    # Analisa confirmados
    confirmados = []
    for mid in sorted(confirmados_ids):
        modulo = modulos_map.get(mid)
        info = {
            "id": mid,
            "titulo": modulo.titulo if modulo else f"(modulo #{mid} nao encontrado)",
            "nome": modulo.nome if modulo else "?",
            "categoria": modulo.categoria if modulo else "?",
            "modo_ativacao": modulo.modo_ativacao if modulo else "?",
        }
        # Verifica log de ativacao
        log_match = logs_por_prompt.get(mid, [])
        if log_match:
            ultimo_log = max(log_match, key=lambda l: l.timestamp)
            info["log_modo"] = ultimo_log.modo_ativacao
            info["log_resultado"] = ultimo_log.resultado
        confirmados.append(info)

    # Analisa manuais (POR QUE nao ativaram?)
    manuais = []
    for mid in sorted(manuais_ids):
        modulo = modulos_map.get(mid)
        info = {
            "id": mid,
            "titulo": modulo.titulo if modulo else f"(modulo #{mid} nao encontrado)",
            "nome": modulo.nome if modulo else "?",
            "categoria": modulo.categoria if modulo else "?",
            "modo_ativacao": modulo.modo_ativacao if modulo else "?",
            "causa": "desconhecida",
            "detalhes": "",
        }

        if not modulo:
            info["causa"] = "modulo_nao_encontrado"
            info["detalhes"] = f"Modulo #{mid} nao existe mais no banco"
            manuais.append(info)
            continue

        # Verifica log de ativacao (pode ter resultado=False)
        log_match = logs_por_prompt.get(mid, [])
        log_info = None
        if log_match:
            ultimo_log = max(log_match, key=lambda l: l.timestamp)
            log_info = {
                "modo": ultimo_log.modo_ativacao,
                "resultado": ultimo_log.resultado,
                "variaveis": ultimo_log.variaveis_usadas,
                "justificativa": ultimo_log.justificativa_ia,
            }
            info["log_ativacao"] = log_info

        # Determina causa
        if modulo.modo_ativacao == "deterministic" or modulo.regra_deterministica:
            # Tem regra deterministica - re-avaliar
            reavaliacao = reavaliar_modulo(modulo, variaveis, geracao.tipo_peca, regras_tipo_peca)
            info["reavaliacao"] = reavaliacao

            if reavaliacao["variaveis_faltantes"]:
                info["causa"] = "falha_extracao"
                info["detalhes"] = f"Variaveis faltantes: {', '.join(reavaliacao['variaveis_faltantes'])}"
            elif reavaliacao["resultado_avaliacao"] is False:
                # Regra avaliou False - verificar se e valor incompativel ou regra legitima
                valores_desc = []
                for v in reavaliacao["variaveis_necessarias"]:
                    val = variaveis.get(v)
                    valores_desc.append(f"{v}={val}")
                info["causa"] = "regra_legitima"
                info["detalhes"] = f"Regra {reavaliacao['regra_usada']} retornou FALSE com: {'; '.join(valores_desc)}"
            elif reavaliacao["resultado_avaliacao"] is True:
                # Regra DEVERIA ter ativado! Bug potencial
                info["causa"] = "bug_pipeline"
                info["detalhes"] = f"ANOMALIA: Regra {reavaliacao['regra_usada']} retorna TRUE com variaveis atuais, mas modulo nao foi ativado automaticamente"
            elif reavaliacao["resultado_avaliacao"] is None:
                info["causa"] = "erro_avaliacao"
                info["detalhes"] = reavaliacao["detalhes"]
        elif modulo.modo_ativacao == "llm":
            if log_info and log_info["resultado"] is False:
                info["causa"] = "llm_rejeitou"
                justificativa = log_info.get("justificativa", "")
                info["detalhes"] = f"LLM avaliou como nao relevante. Justificativa: {justificativa or 'N/A'}"
            elif log_info is None:
                # Sem log - pode ser que o modulo nao foi avaliado pelo Agente 2
                if mid not in preview_ids:
                    info["causa"] = "nao_avaliado"
                    info["detalhes"] = "Modulo nao estava no universo de avaliacao do Agente 2 (filtro por group_id, subcategoria ou tipo_peca)"
                else:
                    info["causa"] = "sem_log"
                    info["detalhes"] = "Sem log de ativacao encontrado para este processo"
            else:
                info["causa"] = "llm_sem_log"
                info["detalhes"] = "Modo LLM sem informacao de avaliacao"

        manuais.append(info)

    # Analisa excluidos (POR QUE foram sugeridos?)
    excluidos = []
    for mid in sorted(excluidos_ids):
        modulo = modulos_map.get(mid)
        info = {
            "id": mid,
            "titulo": modulo.titulo if modulo else f"(modulo #{mid} nao encontrado)",
            "nome": modulo.nome if modulo else "?",
            "categoria": modulo.categoria if modulo else "?",
            "modo_ativacao": modulo.modo_ativacao if modulo else "?",
            "motivo_sugestao": "desconhecido",
            "detalhes": "",
        }

        if not modulo:
            info["motivo_sugestao"] = "modulo_removido"
            info["detalhes"] = f"Modulo #{mid} nao existe mais no banco"
            excluidos.append(info)
            continue

        # Verifica log de ativacao
        log_match = logs_por_prompt.get(mid, [])
        if log_match:
            ultimo_log = max(log_match, key=lambda l: l.timestamp)
            info["log_modo"] = ultimo_log.modo_ativacao
            info["log_resultado"] = ultimo_log.resultado

        if modulo.modo_ativacao == "deterministic" or modulo.regra_deterministica:
            reavaliacao = reavaliar_modulo(modulo, variaveis, geracao.tipo_peca, regras_tipo_peca)
            info["reavaliacao"] = reavaliacao
            if reavaliacao["resultado_avaliacao"] is True:
                valores = []
                for v in reavaliacao["variaveis_necessarias"]:
                    valores.append(f"{v}={variaveis.get(v)}")
                info["motivo_sugestao"] = "regra_deterministica_true"
                info["detalhes"] = f"Regra {reavaliacao['regra_usada']} TRUE com: {'; '.join(valores)}"
            elif reavaliacao["resultado_avaliacao"] is False:
                info["motivo_sugestao"] = "regra_mudou"
                info["detalhes"] = "Regra ATUAL retorna FALSE, pode ter sido alterada desde a geracao"
            else:
                info["motivo_sugestao"] = "erro_reavaliacao"
                info["detalhes"] = reavaliacao["detalhes"]
        elif modulo.modo_ativacao == "llm":
            info["motivo_sugestao"] = "llm_sugeriu"
            if log_match:
                ultimo_log = max(log_match, key=lambda l: l.timestamp)
                info["detalhes"] = f"LLM ativou. Justificativa: {ultimo_log.justificativa_ia or 'N/A'}"
            else:
                info["detalhes"] = "Sugerido por analise de IA (sem log detalhado)"

        excluidos.append(info)

    return {
        "id": geracao.id,
        "cnj": geracao.numero_cnj or "",
        "cnj_formatado": geracao.numero_cnj_formatado or "",
        "tipo_peca": geracao.tipo_peca or "",
        "usuario": full_name or username or "N/A",
        "data": str(geracao.criado_em),
        "total_preview": metadata.get("total_preview", len(preview_ids)),
        "total_curados": metadata.get("total_curados", len(curados_ids)),
        "total_manuais": metadata.get("total_manuais", len(manuais_ids)),
        "total_excluidos": metadata.get("total_excluidos", len(excluidos_ids)),
        "categorias_ordem": metadata.get("categorias_ordem", []),
        "confirmados": confirmados,
        "manuais": manuais,
        "excluidos": excluidos,
        "variaveis_count": len(variaveis),
    }


# ============================================================
# DETECCAO DE PADROES
# ============================================================

def detectar_padroes(analises: List[Dict]) -> Dict[str, Any]:
    """Detecta padroes em todas as analises."""
    # Contadores
    manuais_counter = Counter()  # {(modulo_id, titulo): count}
    excluidos_counter = Counter()
    causas_counter = Counter()  # {causa: count}
    vars_faltantes_counter = Counter()  # {variavel: count}
    tipo_peca_stats = defaultdict(lambda: {
        "geracoes": 0, "total_preview": 0, "total_confirmados": 0,
        "total_manuais": 0, "total_excluidos": 0,
    })
    metodo_stats = {"deterministic": {"confirmados": 0, "excluidos": 0},
                    "llm": {"confirmados": 0, "excluidos": 0}}
    manuais_detalhes = defaultdict(list)  # {modulo_id: [detalhes por geracao]}
    excluidos_detalhes = defaultdict(list)

    for analise in analises:
        if "erro" in analise:
            continue

        tp = analise["tipo_peca"] or "desconhecido"
        stats = tipo_peca_stats[tp]
        stats["geracoes"] += 1
        stats["total_preview"] += analise["total_preview"]
        stats["total_confirmados"] += len(analise["confirmados"])
        stats["total_manuais"] += len(analise["manuais"])
        stats["total_excluidos"] += len(analise["excluidos"])

        # Confirmados por metodo
        for c in analise["confirmados"]:
            modo = c.get("modo_ativacao", "?")
            if modo in metodo_stats:
                metodo_stats[modo]["confirmados"] += 1

        # Manuais
        for m in analise["manuais"]:
            key = (m["id"], m["titulo"])
            manuais_counter[key] += 1
            causas_counter[m.get("causa", "desconhecida")] += 1
            manuais_detalhes[m["id"]].append({
                "geracao_id": analise["id"],
                "cnj": analise["cnj"],
                "causa": m.get("causa"),
                "detalhes": m.get("detalhes"),
            })

            # Variaveis faltantes
            reavaliacao = m.get("reavaliacao", {})
            for v in reavaliacao.get("variaveis_faltantes", []):
                vars_faltantes_counter[v] += 1

        # Excluidos
        for e in analise["excluidos"]:
            key = (e["id"], e["titulo"])
            excluidos_counter[key] += 1
            modo = e.get("modo_ativacao", "?")
            if modo in metodo_stats:
                metodo_stats[modo]["excluidos"] += 1
            excluidos_detalhes[e["id"]].append({
                "geracao_id": analise["id"],
                "cnj": analise["cnj"],
                "motivo": e.get("motivo_sugestao"),
                "detalhes": e.get("detalhes"),
            })

    total_geracoes = len([a for a in analises if "erro" not in a])

    return {
        "total_geracoes": total_geracoes,
        "manuais_top": manuais_counter.most_common(10),
        "excluidos_top": excluidos_counter.most_common(10),
        "causas": causas_counter.most_common(),
        "vars_faltantes": vars_faltantes_counter.most_common(10),
        "tipo_peca_stats": dict(tipo_peca_stats),
        "metodo_stats": metodo_stats,
        "manuais_detalhes": dict(manuais_detalhes),
        "excluidos_detalhes": dict(excluidos_detalhes),
    }


# ============================================================
# GERACAO DO RELATORIO MARKDOWN
# ============================================================

def gerar_relatorio(analises: List[Dict], padroes: Dict, args) -> str:
    """Gera o relatorio em Markdown."""
    linhas = []

    def w(line=""):
        linhas.append(line)

    # Estatisticas gerais
    total = len(analises)
    validos = [a for a in analises if "erro" not in a]
    com_manuais = [a for a in validos if a["manuais"]]
    com_excluidos = [a for a in validos if a["excluidos"]]
    total_preview = sum(a["total_preview"] for a in validos)
    total_confirmados = sum(len(a["confirmados"]) for a in validos)
    total_manuais = sum(len(a["manuais"]) for a in validos)
    total_excluidos = sum(len(a["excluidos"]) for a in validos)
    taxa_concordancia = (total_confirmados / total_preview * 100) if total_preview > 0 else 0

    # ===== CABECALHO =====
    w("# Relatorio de Auditoria - Modo Semi-Automatico do Gerador de Pecas")
    w()
    data_inicio = (datetime.utcnow() - timedelta(days=args.dias)).strftime("%Y-%m-%d")
    data_fim = datetime.utcnow().strftime("%Y-%m-%d")
    w(f"**Periodo**: {data_inicio} a {data_fim} ({args.dias} dias)")
    w(f"**Gerado em**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    w(f"**Banco**: Producao (Yamanote)")
    w()

    # ===== 1. RESUMO EXECUTIVO =====
    w("## 1. Resumo Executivo")
    w()
    w(f"- **Total de geracoes semi-automaticas**: {total}")
    if total != len(validos):
        w(f"  - Com metadados validos: {len(validos)}")
        w(f"  - Sem metadados (curadoria_metadata NULL): {total - len(validos)}")
    w(f"- **Total de modulos sugeridos (preview)**: {total_preview}")
    w(f"- **Modulos confirmados pelo usuario**: {total_confirmados} ({taxa_concordancia:.1f}%)")
    w(f"- **Modulos adicionados manualmente**: {total_manuais}")
    w(f"- **Modulos excluidos pelo usuario**: {total_excluidos}")
    w(f"- **Geracoes com inclusao manual**: {len(com_manuais)} de {len(validos)}")
    w(f"- **Geracoes com exclusao**: {len(com_excluidos)} de {len(validos)}")
    w(f"- **Taxa de concordancia com sistema**: {taxa_concordancia:.1f}%")
    w()

    if total_manuais > 0 or total_excluidos > 0:
        w("### Indicadores de Alerta")
        w()
        if total_preview > 0:
            taxa_manual = total_manuais / total_preview * 100
            taxa_exclusao = total_excluidos / total_preview * 100
            w(f"- Taxa de inclusao manual: {taxa_manual:.1f}% (modulos que o sistema falhou em detectar)")
            w(f"- Taxa de exclusao: {taxa_exclusao:.1f}% (falsos positivos do sistema)")
        w()

    # ===== 2. METODOLOGIA =====
    w("## 2. Metodologia")
    w()
    w("- **Fonte de dados**: Banco de producao PostgreSQL (RDS)")
    w(f"- **Periodo**: Ultimos {args.dias} dias (desde {data_inicio})")
    w(f"- **Filtro**: `modo_ativacao_agente2 = 'semi_automatico'`")
    if args.tipo_peca:
        w(f"- **Tipo de peca**: {args.tipo_peca}")
    w("- **Re-avaliacao**: Regras deterministicas re-avaliadas com variaveis armazenadas em `dados_processo`")
    w("- **Logs de ativacao**: Cruzados via `prompt_activation_logs` para obter decisoes historicas")
    w("- **Caveat**: Regras atuais podem diferir das regras vigentes no momento da geracao")
    w()

    # ===== 3. MAPEAMENTO DE TABELAS =====
    w("## 3. Mapeamento de Tabelas e Campos")
    w()
    w("| Tabela | Campos Utilizados | Finalidade |")
    w("|--------|-------------------|------------|")
    w("| `geracoes_pecas` | `curadoria_metadata`, `dados_processo`, `modo_ativacao_agente2`, `criado_em` | Geracoes e variaveis |")
    w("| `prompt_activation_logs` | `prompt_id`, `resultado`, `variaveis_usadas`, `justificativa_ia` | Decisoes historicas |")
    w("| `prompt_modulos` | `regra_deterministica`, `modo_ativacao`, `titulo`, `categoria` | Definicoes de modulos |")
    w("| `regra_deterministica_tipo_peca` | `regra_deterministica`, `tipo_peca` | Regras por tipo |")
    w("| `users` | `username`, `full_name` | Identificacao do usuario |")
    w()

    # ===== 4. ESTATISTICAS GERAIS =====
    w("## 4. Estatisticas Gerais")
    w()

    # Por tipo de peca
    w("### Por Tipo de Peca")
    w()
    w("| Tipo Peca | Geracoes | Sugeridos | Confirmados | Manuais | Excluidos | Concordancia |")
    w("|-----------|----------|-----------|-------------|---------|-----------|-------------|")
    for tp, stats in sorted(padroes["tipo_peca_stats"].items()):
        conc = (stats["total_confirmados"] / stats["total_preview"] * 100) if stats["total_preview"] > 0 else 0
        media_manuais = stats["total_manuais"] / stats["geracoes"] if stats["geracoes"] > 0 else 0
        media_excluidos = stats["total_excluidos"] / stats["geracoes"] if stats["geracoes"] > 0 else 0
        w(f"| {tp} | {stats['geracoes']} | {stats['total_preview']} | {stats['total_confirmados']} | {stats['total_manuais']} ({media_manuais:.1f}/ger) | {stats['total_excluidos']} ({media_excluidos:.1f}/ger) | {conc:.1f}% |")
    w()

    # Por metodo de ativacao
    w("### Por Metodo de Ativacao")
    w()
    w("| Metodo | Confirmados | Excluidos | Precisao |")
    w("|--------|-------------|-----------|----------|")
    for metodo, stats in padroes["metodo_stats"].items():
        total_m = stats["confirmados"] + stats["excluidos"]
        precisao = (stats["confirmados"] / total_m * 100) if total_m > 0 else 0
        w(f"| {metodo} | {stats['confirmados']} | {stats['excluidos']} | {precisao:.1f}% |")
    w()

    # Causas de inclusao manual
    if padroes["causas"]:
        w("### Causas de Inclusao Manual")
        w()
        w("| Causa | Ocorrencias | Descricao |")
        w("|-------|-------------|-----------|")
        causa_desc = {
            "regra_legitima": "Regra avaliou FALSE corretamente (condicoes nao presentes)",
            "falha_extracao": "Variavel necessaria ausente nos dados de extracao",
            "falha_normalizacao": "Valor existe mas formato incompativel",
            "llm_rejeitou": "LLM avaliou como nao relevante",
            "nao_avaliado": "Modulo nao estava no universo de avaliacao",
            "bug_pipeline": "ANOMALIA: regra deveria ter ativado mas nao ativou",
            "sem_log": "Sem log de ativacao para diagnostico",
            "modulo_nao_encontrado": "Modulo deletado do banco",
            "erro_avaliacao": "Erro ao tentar avaliar regra",
            "desconhecida": "Causa nao determinada",
        }
        for causa, count in padroes["causas"]:
            desc = causa_desc.get(causa, causa)
            w(f"| `{causa}` | {count} | {desc} |")
        w()

    # ===== 5. ANALISE POR GERACAO =====
    w("## 5. Analise Detalhada por Geracao")
    w()

    for analise in analises:
        gid = analise["id"]
        w(f"### Geracao #{gid} - {analise.get('cnj_formatado') or analise['cnj']} ({analise['tipo_peca']})")
        w()
        w(f"- **Usuario**: {analise['usuario']}")
        w(f"- **Data**: {analise['data']}")

        if "erro" in analise:
            w(f"- **ERRO**: {analise['erro']}")
            w()
            continue

        w(f"- **Preview**: {analise['total_preview']} modulos | **Final**: {analise['total_curados']} modulos")
        w(f"- **Confirmados**: {len(analise['confirmados'])} | **Manuais**: {len(analise['manuais'])} | **Excluidos**: {len(analise['excluidos'])}")
        w(f"- **Variaveis de extracao**: {analise['variaveis_count']}")
        if analise["categorias_ordem"]:
            w(f"- **Ordem categorias**: {' > '.join(analise['categorias_ordem'])}")
        w()

        # Tabela de confirmados
        if analise["confirmados"]:
            w("#### Modulos Confirmados")
            w()
            w("| # | ID | Modulo | Categoria | Metodo |")
            w("|---|-----|--------|-----------|--------|")
            for i, c in enumerate(analise["confirmados"], 1):
                modo = c.get("log_modo", c.get("modo_ativacao", "?"))
                w(f"| {i} | {c['id']} | {c['titulo']} | {c['categoria']} | {modo} |")
            w()

        # Tabela de manuais
        if analise["manuais"]:
            w("#### Modulos Adicionados Manualmente")
            w()
            w("| # | ID | Modulo | Categoria | Causa | Detalhes |")
            w("|---|-----|--------|-----------|-------|----------|")
            for i, m in enumerate(analise["manuais"], 1):
                causa = m.get("causa", "?")
                detalhes = m.get("detalhes", "")
                # Trunca detalhes longos
                if len(detalhes) > 120:
                    detalhes = detalhes[:117] + "..."
                w(f"| {i} | {m['id']} | {m['titulo']} | {m['categoria']} | `{causa}` | {detalhes} |")
            w()

            # Detalhamento expandido para manuais
            for m in analise["manuais"]:
                if m.get("reavaliacao") or m.get("log_ativacao"):
                    w(f"<details><summary>Detalhes: {m['titulo']} (#{m['id']})</summary>")
                    w()
                    if m.get("reavaliacao"):
                        reav = m["reavaliacao"]
                        w(f"- Regra usada: `{reav.get('regra_usada', 'N/A')}`")
                        w(f"- Resultado re-avaliacao: `{reav.get('resultado_avaliacao')}`")
                        if reav.get("variaveis_necessarias"):
                            w(f"- Variaveis necessarias: `{', '.join(reav['variaveis_necessarias'])}`")
                        if reav.get("variaveis_faltantes"):
                            w(f"- **Variaveis FALTANTES**: `{', '.join(reav['variaveis_faltantes'])}`")
                        if reav.get("valores_variaveis"):
                            w("- Valores:")
                            for k, v in reav["valores_variaveis"].items():
                                w(f"  - `{k}` = `{v}`")
                    if m.get("log_ativacao"):
                        la = m["log_ativacao"]
                        w(f"- Log modo: `{la.get('modo')}`")
                        w(f"- Log resultado: `{la.get('resultado')}`")
                        if la.get("justificativa"):
                            w(f"- Justificativa IA: {la['justificativa']}")
                    w()
                    w("</details>")
                    w()

        # Tabela de excluidos
        if analise["excluidos"]:
            w("#### Modulos Excluidos pelo Usuario")
            w()
            w("| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |")
            w("|---|-----|--------|-----------|-----------------|----------|")
            for i, e in enumerate(analise["excluidos"], 1):
                motivo = e.get("motivo_sugestao", "?")
                detalhes = e.get("detalhes", "")
                if len(detalhes) > 120:
                    detalhes = detalhes[:117] + "..."
                w(f"| {i} | {e['id']} | {e['titulo']} | {e['categoria']} | `{motivo}` | {detalhes} |")
            w()

        w("---")
        w()

    # ===== 6. PADROES ENCONTRADOS =====
    w("## 6. Padroes Encontrados")
    w()

    # Top manuais
    if padroes["manuais_top"]:
        w("### Top Modulos Adicionados Manualmente")
        w("*(Candidatos a criacao/ajuste de regra deterministica)*")
        w()
        w("| # | Modulo | Vezes Adicionado | % das Geracoes | Hipotese de Causa |")
        w("|---|--------|-----------------|----------------|-------------------|")
        for i, ((mid, titulo), count) in enumerate(padroes["manuais_top"], 1):
            pct = (count / padroes["total_geracoes"] * 100) if padroes["total_geracoes"] > 0 else 0
            # Analisa detalhes para hipotese
            detalhes_mod = padroes["manuais_detalhes"].get(mid, [])
            causas_mod = Counter(d.get("causa") for d in detalhes_mod)
            causa_principal = causas_mod.most_common(1)[0][0] if causas_mod else "?"
            w(f"| {i} | {titulo} (#{mid}) | {count} | {pct:.0f}% | {causa_principal} |")
        w()

    # Top excluidos
    if padroes["excluidos_top"]:
        w("### Top Modulos Excluidos (Possiveis Falsos Positivos)")
        w("*(Regras possivelmente agressivas demais)*")
        w()
        w("| # | Modulo | Vezes Excluido | % quando Sugerido | Hipotese |")
        w("|---|--------|---------------|-------------------|----------|")
        for i, ((mid, titulo), count) in enumerate(padroes["excluidos_top"], 1):
            detalhes_mod = padroes["excluidos_detalhes"].get(mid, [])
            motivos = Counter(d.get("motivo") for d in detalhes_mod)
            motivo_principal = motivos.most_common(1)[0][0] if motivos else "?"
            w(f"| {i} | {titulo} (#{mid}) | {count} | - | {motivo_principal} |")
        w()

    # Variaveis faltantes
    if padroes["vars_faltantes"]:
        w("### Variaveis Frequentemente Ausentes")
        w("*(Indicam problemas na pipeline de extracao)*")
        w()
        w("| # | Variavel | Vezes Faltante | Impacto |")
        w("|---|----------|---------------|---------|")
        for i, (var, count) in enumerate(padroes["vars_faltantes"], 1):
            w(f"| {i} | `{var}` | {count} | Modulos com regra dependente nao sao ativados |")
        w()

    # ===== 7. FALHAS E RECOMENDACOES =====
    w("## 7. Falhas Confirmadas e Recomendacoes")
    w()

    recomendacoes = []

    # Bugs de pipeline
    bugs = [a for analise in analises for a in analise.get("manuais", []) if a.get("causa") == "bug_pipeline"]
    if bugs:
        w("### CRITICO: Bugs de Pipeline Detectados")
        w()
        w("Os seguintes modulos deveriam ter sido ativados automaticamente (regra retorna TRUE), mas nao foram:")
        w()
        for b in bugs:
            w(f"- **{b['titulo']}** (#{b['id']}): {b.get('detalhes', '')}")
        w()
        recomendacoes.append(("[CRITICO] Investigar bugs de pipeline", "Modulos com regra TRUE nao foram ativados"))

    # Falhas de extracao
    falhas_extracao = [a for analise in analises for a in analise.get("manuais", []) if a.get("causa") == "falha_extracao"]
    if falhas_extracao:
        w("### ALTA: Falhas de Extracao")
        w()
        w("Modulos nao ativados porque variaveis necessarias nao foram extraidas:")
        w()
        vars_problematicas = Counter()
        for f in falhas_extracao:
            reav = f.get("reavaliacao", {})
            for v in reav.get("variaveis_faltantes", []):
                vars_problematicas[v] += 1
        for var, count in vars_problematicas.most_common(10):
            w(f"- `{var}`: faltante em {count} caso(s)")
        w()
        recomendacoes.append(("[ALTA] Melhorar extracao de variaveis", f"{len(vars_problematicas)} variaveis com falha"))

    # Regras muito amplas (top excluidos)
    if padroes["excluidos_top"]:
        top_excl = padroes["excluidos_top"][:3]
        if top_excl:
            w("### MEDIA: Regras Possivelmente Amplas Demais")
            w()
            for (mid, titulo), count in top_excl:
                w(f"- **{titulo}** (#{mid}): excluido {count} vez(es)")
            w()
            recomendacoes.append(("[MEDIA] Revisar regras com alta taxa de exclusao", f"Top {len(top_excl)} modulos"))

    # Resumo de recomendacoes
    if recomendacoes:
        w("### Resumo de Recomendacoes (priorizado)")
        w()
        w("| Prioridade | Recomendacao | Evidencia |")
        w("|------------|-------------|-----------|")
        for prio, evidencia in recomendacoes:
            w(f"| {prio} | Corrigir/investigar | {evidencia} |")
        w()
    else:
        w("*Nenhuma falha critica detectada no periodo analisado.*")
        w()

    # ===== 8. ANEXO: QUERIES =====
    w("## 8. Anexo: Queries Executadas")
    w()
    w("```sql")
    w("-- Q1: Geracoes semi-automaticas no periodo")
    w(f"SELECT gp.*, u.username, u.full_name")
    w(f"FROM geracoes_pecas gp")
    w(f"LEFT JOIN users u ON u.id = gp.usuario_id")
    w(f"WHERE gp.modo_ativacao_agente2 = 'semi_automatico'")
    w(f"  AND gp.criado_em >= NOW() - INTERVAL '{args.dias} days'")
    w(f"ORDER BY gp.criado_em DESC;")
    w()
    w("-- Q2: Modulos de conteudo")
    w("SELECT * FROM prompt_modulos WHERE tipo = 'conteudo';")
    w()
    w("-- Q3: Regras por tipo de peca")
    w("SELECT * FROM regra_deterministica_tipo_peca WHERE ativo = true;")
    w()
    w("-- Q4: Logs de ativacao")
    w(f"SELECT * FROM prompt_activation_logs")
    w(f"WHERE timestamp >= NOW() - INTERVAL '{args.dias} days'")
    w("ORDER BY timestamp;")
    w("```")
    w()

    return "\n".join(linhas)


# ============================================================
# MAIN
# ============================================================

def main():
    args = parse_args()

    print(f"=== Auditoria do Modo Semi-Automatico ===")
    print(f"Periodo: ultimos {args.dias} dias")
    print(f"Output: {args.output}")
    if args.tipo_peca:
        print(f"Filtro tipo_peca: {args.tipo_peca}")
    print()

    # Conecta ao banco
    print("[1/5] Conectando ao banco de dados...")
    db = criar_sessao(args.db_url)
    print("  Conectado!")

    try:
        # Q1: Carrega geracoes
        print("[2/5] Carregando dados...")
        geracoes = carregar_geracoes_semi_auto(db, args.dias, args.tipo_peca)
        print(f"  Geracoes semi-automaticas encontradas: {len(geracoes)}")

        if not geracoes:
            print("\n  AVISO: Nenhuma geracao semi-automatica encontrada no periodo.")
            print("  Verifique o periodo (--dias) ou se o modo semi-automatico foi usado.")
            # Gera relatorio vazio
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(f"# Relatorio de Auditoria - Modo Semi-Automatico\n\n")
                f.write(f"**Periodo**: ultimos {args.dias} dias\n\n")
                f.write(f"**Resultado**: Nenhuma geracao semi-automatica encontrada no periodo.\n")
            print(f"\n  Relatorio (vazio) salvo em: {args.output}")
            return

        # Q2-Q4: Carrega dados auxiliares
        modulos_map = carregar_modulos(db)
        print(f"  Modulos de conteudo: {len(modulos_map)}")

        regras_tipo_peca = carregar_regras_tipo_peca(db)
        print(f"  Modulos com regras por tipo_peca: {len(regras_tipo_peca)}")

        logs_map = carregar_activation_logs(db, args.dias)
        total_logs = sum(len(v) for v in logs_map.values())
        print(f"  Logs de ativacao: {total_logs}")

        # Analise por geracao
        print(f"\n[3/5] Analisando {len(geracoes)} geracoes...")
        analises = []
        for i, (geracao, username, full_name) in enumerate(geracoes, 1):
            if args.verbose:
                print(f"  [{i}/{len(geracoes)}] Geracao #{geracao.id} - {geracao.numero_cnj}")
            analise = analisar_geracao(
                geracao, username, full_name,
                modulos_map, regras_tipo_peca, logs_map,
                verbose=args.verbose,
            )
            analises.append(analise)

            if args.verbose and analise.get("manuais"):
                for m in analise["manuais"]:
                    print(f"    MANUAL: {m['titulo']} -> causa={m.get('causa')}")
            if args.verbose and analise.get("excluidos"):
                for e in analise["excluidos"]:
                    print(f"    EXCLUIDO: {e['titulo']} -> motivo={e.get('motivo_sugestao')}")

        # Deteccao de padroes
        print(f"\n[4/5] Detectando padroes...")
        padroes = detectar_padroes(analises)
        print(f"  Top modulo manual: {padroes['manuais_top'][0] if padroes['manuais_top'] else 'N/A'}")
        print(f"  Top modulo excluido: {padroes['excluidos_top'][0] if padroes['excluidos_top'] else 'N/A'}")
        print(f"  Causas de inclusao manual: {dict(padroes['causas'])}")

        # Gera relatorio
        print(f"\n[5/5] Gerando relatorio...")
        relatorio = gerar_relatorio(analises, padroes, args)

        with open(args.output, "w", encoding="utf-8") as f:
            f.write(relatorio)

        print(f"\n=== Relatorio salvo em: {args.output} ===")
        print(f"  Tamanho: {len(relatorio)} caracteres, {relatorio.count(chr(10))} linhas")

    finally:
        db.close()


if __name__ == "__main__":
    main()
