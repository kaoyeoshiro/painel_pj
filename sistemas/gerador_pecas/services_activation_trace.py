"""
Serviço de construção e persistência do Activation Trace.

Converte os decision_traces do DetectorModulosIA em um payload JSONB
padronizado para armazenamento na coluna activation_trace de GeracaoPeca.
"""

import logging
from typing import Dict, List, Any, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def build_activation_trace(
    decision_traces: Dict[int, Dict],
    variaveis_snapshot: Dict[str, Any],
    modo_ativacao: str,
    db: Session,
    modulos_avaliados_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """
    Constrói o payload de activation trace padronizado para persistência.

    Args:
        decision_traces: Dict {module_id: trace_dict} do DetectorModulosIA
        variaveis_snapshot: Snapshot de todas as variáveis usadas na detecção
        modo_ativacao: 'fast_path', 'misto', 'llm', 'semi_automatico'
        db: Sessão do banco para carregar dados dos módulos
        modulos_avaliados_ids: Lista de todos os IDs de módulos que foram carregados
                               (inclui os que não foram avaliados por filtro)

    Returns:
        Dict pronto para persistência como JSONB
    """
    from admin.models_prompts import PromptModulo

    # Carrega dados dos módulos para enriquecer o trace
    trace_module_ids = set(int(k) for k in decision_traces.keys())
    all_ids = trace_module_ids | set(modulos_avaliados_ids or [])

    modulos_map = {}
    if all_ids:
        modulos = db.query(PromptModulo).filter(
            PromptModulo.id.in_(all_ids)
        ).all()
        modulos_map = {m.id: m for m in modulos}

    # Constrói lista de módulos com trace
    modulos_trace = []
    total_ativados = 0
    total_det = 0
    total_llm = 0

    for module_id_raw, trace in decision_traces.items():
        module_id = int(module_id_raw)
        modulo = modulos_map.get(module_id)

        activated = trace.get("ativar") is True
        mode = trace.get("modo_avaliacao", "unknown")

        if activated:
            total_ativados += 1
            if mode == "deterministic":
                total_det += 1
            elif mode == "llm":
                total_llm += 1

        # Extrai condições dos regras_avaliadas
        conditions = _extract_conditions(trace)

        # Extrai evaluation_mode e short_circuit
        regras = trace.get("regras_avaliadas", [])
        evaluation_mode = None
        short_circuit = None
        rule_expression = None

        if regras:
            last_regra = regras[-1] if regras else {}
            evaluation_mode = last_regra.get("evaluation_mode")
            short_circuit = last_regra.get("short_circuit")

        # Tenta obter a regra do módulo
        if modulo and mode == "deterministic":
            rule_expression = _get_rule_expression(modulo, trace)

        modulo_trace = {
            "module_id": module_id,
            "slug": modulo.nome if modulo else trace.get("module_nome", ""),
            "titulo": modulo.titulo if modulo else trace.get("module_titulo", ""),
            "categoria": modulo.categoria if modulo else None,
            "activated": activated,
            "mode": mode,
            "rule_used": trace.get("regra_usada"),
            "rule_expression": rule_expression,
            "conditions": conditions,
            "evaluation_mode": evaluation_mode,
            "short_circuit": short_circuit,
            "llm_justification": trace.get("detalhes") if mode == "llm" else None,
            "llm_evidence_variables": None,
            "details": trace.get("detalhes"),
        }
        modulos_trace.append(modulo_trace)

    # Adiciona módulos que foram carregados mas não avaliados (se fornecido)
    if modulos_avaliados_ids:
        for mid in modulos_avaliados_ids:
            if mid not in trace_module_ids:
                modulo = modulos_map.get(mid)
                modulos_trace.append({
                    "module_id": mid,
                    "slug": modulo.nome if modulo else "",
                    "titulo": modulo.titulo if modulo else "",
                    "categoria": modulo.categoria if modulo else None,
                    "activated": False,
                    "mode": "not_evaluated",
                    "rule_used": None,
                    "rule_expression": None,
                    "conditions": [],
                    "evaluation_mode": None,
                    "short_circuit": None,
                    "llm_justification": None,
                    "llm_evidence_variables": None,
                    "details": "Módulo não avaliado (filtrado por tipo de peça ou subcategoria)",
                })

    # Ordena: ativados primeiro, depois por categoria
    modulos_trace.sort(key=lambda m: (
        not m["activated"],  # Ativados primeiro
        m["categoria"] or "zzz",  # Por categoria
        m["titulo"] or "",
    ))

    total_avaliados = len(decision_traces)

    # Sanitiza variáveis sensíveis (LGPD)
    variaveis_safe = _sanitize_variables(variaveis_snapshot) if variaveis_snapshot else {}

    return {
        "modo_ativacao": modo_ativacao,
        "total_avaliados": total_avaliados,
        "total_ativados": total_ativados,
        "total_det": total_det,
        "total_llm": total_llm,
        "variaveis_snapshot": variaveis_safe,
        "modulos": modulos_trace,
    }


def build_activation_trace_for_curadoria(
    decision_traces: Dict,
    variaveis_snapshot: Dict,
    modulos_curados_ids: List[int],
    modulos_preview_ids: List[int],
    modulos_manuais_ids: List[int],
    db: Session,
) -> Dict[str, Any]:
    """
    Constrói activation trace para o modo semi-automático (curadoria).

    Neste modo, o trace combina:
    - Resultado do Agente 2 (preview/detecção automática)
    - Decisões do usuário (quais módulos foram confirmados/removidos/adicionados)
    """
    from admin.models_prompts import PromptModulo

    # Serializa decision_traces com chaves string
    traces_normalized = {}
    if decision_traces:
        for k, v in decision_traces.items():
            traces_normalized[int(k)] = v

    # Base: constrói trace normal do Agente 2
    base_trace = build_activation_trace(
        decision_traces=traces_normalized,
        variaveis_snapshot=variaveis_snapshot,
        modo_ativacao="semi_automatico",
        db=db,
    )

    # Enriquece com info de curadoria
    manuais_set = set(modulos_manuais_ids or [])
    preview_set = set(modulos_preview_ids or [])
    curados_set = set(modulos_curados_ids or [])

    for modulo_trace in base_trace["modulos"]:
        mid = modulo_trace["module_id"]
        if mid in manuais_set:
            modulo_trace["curadoria_origin"] = "manual"
            modulo_trace["activated"] = True
        elif mid in curados_set and mid in preview_set:
            modulo_trace["curadoria_origin"] = "preview_confirmed"
            modulo_trace["activated"] = True
        elif mid in preview_set and mid not in curados_set:
            modulo_trace["curadoria_origin"] = "preview_removed"
            modulo_trace["activated"] = False
        else:
            modulo_trace["curadoria_origin"] = None

    # Adiciona módulos manuais que não estavam no trace original
    existing_ids = {m["module_id"] for m in base_trace["modulos"]}
    manual_missing = manuais_set - existing_ids
    if manual_missing:
        modulos_manual = db.query(PromptModulo).filter(
            PromptModulo.id.in_(manual_missing)
        ).all()
        for m in modulos_manual:
            base_trace["modulos"].append({
                "module_id": m.id,
                "slug": m.nome,
                "titulo": m.titulo,
                "categoria": m.categoria,
                "activated": True,
                "mode": "manual",
                "rule_used": None,
                "rule_expression": None,
                "conditions": [],
                "evaluation_mode": None,
                "short_circuit": None,
                "llm_justification": None,
                "llm_evidence_variables": None,
                "details": "Adicionado manualmente pelo usuário",
                "curadoria_origin": "manual",
            })

    # Recalcula totais
    total_ativados = sum(1 for m in base_trace["modulos"] if m["activated"])
    base_trace["total_ativados"] = total_ativados

    return base_trace


def _extract_conditions(trace: Dict) -> List[Dict]:
    """Extrai condições individuais das regras_avaliadas."""
    conditions = []
    regras = trace.get("regras_avaliadas", [])

    for regra in regras:
        checks = regra.get("checks", [])
        for check in checks:
            conditions.append({
                "check_id": check.get("check_id", ""),
                "label": check.get("label", ""),
                "variable": (check.get("input_keys") or [""])[0],
                "operator": _extract_operator(check.get("expression", "")),
                "expected": _extract_expected(check.get("expression", "")),
                "actual": _extract_actual_value(check),
                "result": check.get("result"),
                "notes": check.get("notes"),
            })

    return conditions


def _extract_operator(expression: str) -> str:
    """Extrai operador de uma expressão como 'var equals true'."""
    parts = expression.split()
    if len(parts) >= 2:
        return parts[1]
    return ""


def _extract_expected(expression: str) -> Any:
    """Extrai valor esperado de uma expressão como 'var equals true'."""
    parts = expression.split(maxsplit=2)
    if len(parts) >= 3:
        val = parts[2]
        if val.lower() == "true":
            return True
        if val.lower() == "false":
            return False
        try:
            return int(val)
        except (ValueError, TypeError):
            pass
        try:
            return float(val)
        except (ValueError, TypeError):
            pass
        return val
    return None


def _extract_actual_value(check: Dict) -> Any:
    """Extrai o valor real da variável de um check."""
    input_values = check.get("input_values", {})
    if input_values:
        # Retorna o primeiro valor
        for val in input_values.values():
            return val
    return None


def _get_rule_expression(modulo, trace: Dict) -> Optional[Dict]:
    """Obtém a expressão da regra usada."""
    regra_usada = trace.get("regra_usada", "")

    if "especifica" in str(regra_usada):
        # Regra específica — busca do trace
        regras = trace.get("regras_avaliadas", [])
        for r in regras:
            if "especifica" in r.get("tipo", ""):
                # A regra está nas checks, não temos o AST direto
                # Retornamos info de que foi regra específica
                return {"source": "tipo_peca_specific", "tipo": r.get("tipo")}

    # Regra global
    if hasattr(modulo, 'regra_deterministica') and modulo.regra_deterministica:
        return modulo.regra_deterministica

    return None


def _sanitize_variables(variables: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitiza variáveis para LGPD — mascara dados potencialmente sensíveis.

    Mantém a existência e tipo da variável, mas mascara valores que parecem
    ser dados pessoais (CPF, CNPJ, nomes completos, emails).
    """
    import re

    sanitized = {}
    # Padrões de dados sensíveis
    cpf_pattern = re.compile(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}')
    cnpj_pattern = re.compile(r'\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}')

    for key, value in variables.items():
        if value is None or isinstance(value, bool):
            sanitized[key] = value
            continue

        str_val = str(value)

        # Mascara CPF
        if cpf_pattern.search(str_val):
            sanitized[key] = "***CPF***"
            continue

        # Mascara CNPJ
        if cnpj_pattern.search(str_val):
            sanitized[key] = "***CNPJ***"
            continue

        # Valores booleanos, numéricos e listas curtas são seguros
        if isinstance(value, (int, float, bool)):
            sanitized[key] = value
        elif isinstance(value, list):
            # Sanitiza cada item da lista
            sanitized[key] = [
                _sanitize_single_value(v) for v in value
            ]
        elif isinstance(value, dict):
            # Dicts internos — não incluir por segurança (podem ter dados volumosos)
            sanitized[key] = f"<dict com {len(value)} campos>"
        else:
            sanitized[key] = _sanitize_single_value(value)

    return sanitized


def _sanitize_single_value(value: Any) -> Any:
    """Sanitiza um valor individual."""
    import re

    if value is None or isinstance(value, (bool, int, float)):
        return value

    str_val = str(value)

    # CPF/CNPJ
    if re.search(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}', str_val):
        return "***CPF***"
    if re.search(r'\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}', str_val):
        return "***CNPJ***"

    # Strings muito longas (possível conteúdo de documento) — trunca
    if len(str_val) > 500:
        return str_val[:100] + f"... ({len(str_val)} chars)"

    return value


def save_activation_trace(
    geracao: 'GeracaoPeca',
    trace_data: Dict[str, Any],
) -> bool:
    """
    Salva o activation trace no objeto GeracaoPeca de forma resiliente.

    Returns:
        True se salvou com sucesso, False se falhou (campo inexistente)
    """
    try:
        geracao.activation_trace = trace_data
        return True
    except AttributeError:
        logger.warning("[ACTIVATION-TRACE] Coluna activation_trace não disponível no modelo")
        return False
