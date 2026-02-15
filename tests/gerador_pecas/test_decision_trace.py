# tests/test_decision_trace.py
"""
Testes para o sistema de Decision Traces (auditoria causal).

Cobre:
1. Geração de traces - reason_codes corretos para cada cenário
2. Override manual - explicações para inclusão/exclusão manual
3. Persistência - traces no curadoria_metadata
4. Cenário real - processo 0803030 com módulos 49 e 57
"""

import pytest
from typing import Dict, Any
from sistemas.gerador_pecas.services_curadoria import (
    gerar_explicacao_modulo,
    _extrair_vars_e_valores,
    REASON_CODES,
)


# ============================================================================
# FIXTURES: Traces simulados para testes
# ============================================================================

def make_det_trace(module_id: int, ativar: bool, regra_usada: str = "global",
                   detalhes: str = "", variaveis: list = None,
                   variaveis_faltantes: list = None, nome: str = "", titulo: str = ""):
    """Cria um trace determinístico simulado."""
    return {
        "module_id": module_id,
        "module_nome": nome or f"mod_{module_id}",
        "module_titulo": titulo or f"Modulo {module_id}",
        "modo_avaliacao": "deterministic",
        "ativar": ativar,
        "regra_usada": regra_usada,
        "detalhes": detalhes,
        "regras_avaliadas": [
            {"tipo": "global", "resultado": ativar, "variaveis": variaveis or []}
        ],
        "variaveis_faltantes": variaveis_faltantes or [],
    }


def make_llm_trace(module_id: int, ativar: bool, condicao: str = "N/A",
                    nome: str = "", titulo: str = ""):
    """Cria um trace LLM simulado."""
    return {
        "module_id": module_id,
        "module_nome": nome or f"mod_{module_id}",
        "module_titulo": titulo or f"Modulo {module_id}",
        "modo_avaliacao": "llm",
        "ativar": ativar,
        "regra_usada": None,
        "detalhes": f"Avaliado por LLM. Condicao: {condicao}",
        "regras_avaliadas": [],
        "variaveis_faltantes": [],
    }


# ============================================================================
# Grupo 1: Geração de traces - reason_codes corretos
# ============================================================================

class TestTraceReasonCodes:
    """Testa que cada cenário gera o reason_code esperado."""

    def test_trace_condition_false(self):
        """Módulo determinístico que retornou False -> CONDITION_FALSE."""
        traces = {
            "10": make_det_trace(
                10, ativar=False, regra_usada="global",
                detalhes="municipio_polo_passivo=False, esperado=True",
                variaveis=["municipio_polo_passivo"]
            )
        }
        snapshot = {"municipio_polo_passivo": False}

        result = gerar_explicacao_modulo(
            module_id=10,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot=snapshot,
        )

        assert result["reason_code"] == "CONDITION_FALSE"
        assert "inputs_used" in result
        assert result["inputs_used"]["municipio_polo_passivo"] == False
        assert result["evaluation_result"] == False

    def test_trace_condition_true(self):
        """Módulo ativado e confirmado pelo usuário -> EXPECTED_MATCH."""
        traces = {
            "20": make_det_trace(
                20, ativar=True, regra_usada="global",
                detalhes="Ativado por regra global",
                variaveis=["valor_causa_inferior_60sm"]
            )
        }
        snapshot = {"valor_causa_inferior_60sm": True}

        result = gerar_explicacao_modulo(
            module_id=20,
            origem="preview",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot=snapshot,
        )

        assert result["reason_code"] == "EXPECTED_MATCH"
        assert result["evaluation_result"] == True

    def test_trace_missing_input(self):
        """Variáveis faltando -> MISSING_INPUT."""
        traces = {
            "30": make_det_trace(
                30, ativar=None, regra_usada="global_pendente",
                detalhes="Variaveis necessarias nao fornecidas",
                variaveis=["var_inexistente"],
                variaveis_faltantes=["var_inexistente"]
            )
        }
        snapshot = {}

        result = gerar_explicacao_modulo(
            module_id=30,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot=snapshot,
        )

        assert result["reason_code"] == "MISSING_INPUT"
        assert "var_inexistente" in result["reason_human"]

    def test_trace_llm_not_selected(self):
        """Módulo LLM não selecionado -> LLM_NOT_SELECTED."""
        traces = {
            "40": make_llm_trace(40, ativar=False, condicao="analise de documentos")
        }

        result = gerar_explicacao_modulo(
            module_id=40,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot={},
        )

        assert result["reason_code"] == "LLM_NOT_SELECTED"
        assert result["evaluation_result"] == False

    def test_trace_not_evaluated(self):
        """Módulo sem trace algum -> NOT_EVALUATED."""
        result = gerar_explicacao_modulo(
            module_id=99,
            origem="manual",
            status_final="incluido",
            decision_traces={},
            variaveis_snapshot={},
        )

        assert result["reason_code"] == "NOT_EVALUATED"
        assert result["evaluation_result"] is None


# ============================================================================
# Grupo 2: Override manual - explicações para inclusão/exclusão
# ============================================================================

class TestManualOverrideExplicacao:
    """Testa explicações para módulos adicionados/removidos manualmente."""

    def test_manual_incluido_explicacao(self):
        """Módulo adicionado manualmente -> explica por que o sistema não ativou."""
        traces = {
            "49": make_det_trace(
                49, ativar=False, regra_usada="global",
                detalhes="municipio_polo_passivo=False, esperado=1",
                variaveis=["municipio_polo_passivo", "peticao_inicial_pedido_medicamento"]
            )
        }
        snapshot = {
            "municipio_polo_passivo": False,
            "peticao_inicial_pedido_medicamento": True
        }

        result = gerar_explicacao_modulo(
            module_id=49,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot=snapshot,
        )

        assert result["reason_code"] == "CONDITION_FALSE"
        assert result["inputs_used"]["municipio_polo_passivo"] == False
        assert result["rule_name"] == "global"

    def test_manual_excluido_explicacao(self):
        """Módulo excluído manualmente -> explica por que o sistema ativou."""
        traces = {
            "22": make_det_trace(
                22, ativar=True, regra_usada="global",
                detalhes="Ativado: municipio_polo_passivo=False AND pedido_saude",
                variaveis=["municipio_polo_passivo"]
            )
        }
        snapshot = {"municipio_polo_passivo": False}

        result = gerar_explicacao_modulo(
            module_id=22,
            origem="preview",
            status_final="excluido",
            decision_traces=traces,
            variaveis_snapshot=snapshot,
        )

        assert result["reason_code"] == "EXPECTED_MATCH"
        assert result["evaluation_result"] == True
        assert "global" in result["reason_human"]

    def test_manual_incluido_sem_trace(self):
        """Módulo adicionado sem trace -> NOT_EVALUATED."""
        result = gerar_explicacao_modulo(
            module_id=999,
            origem="manual",
            status_final="incluido",
            decision_traces={},
            variaveis_snapshot={},
        )

        assert result["reason_code"] == "NOT_EVALUATED"
        assert result["inputs_used"] == {}

    def test_manual_excluido_llm(self):
        """Módulo LLM excluído -> LLM_SELECTED."""
        traces = {
            "50": make_llm_trace(50, ativar=True, condicao="condicao IA")
        }

        result = gerar_explicacao_modulo(
            module_id=50,
            origem="preview",
            status_final="excluido",
            decision_traces=traces,
            variaveis_snapshot={},
        )

        assert result["reason_code"] == "LLM_SELECTED"


# ============================================================================
# Grupo 3: Persistência e compatibilidade
# ============================================================================

class TestPersistencia:
    """Testa serialização e backward compat."""

    def test_traces_com_chave_string(self):
        """Traces com chaves string (como vêm do JSON) devem funcionar."""
        traces = {
            "10": make_det_trace(10, ativar=False, variaveis=["x"]),
        }

        result = gerar_explicacao_modulo(
            module_id=10,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot={"x": 42},
        )

        assert result["reason_code"] == "CONDITION_FALSE"

    def test_traces_com_chave_int(self):
        """Traces com chaves int (como vêm do Python) devem funcionar."""
        traces = {
            10: make_det_trace(10, ativar=False, variaveis=["x"]),
        }

        result = gerar_explicacao_modulo(
            module_id=10,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot={"x": 42},
        )

        assert result["reason_code"] == "CONDITION_FALSE"

    def test_auditoria_antiga_sem_traces(self):
        """Geração antiga (sem traces) -> fallback seguro."""
        # Sem traces -> fallback
        result = gerar_explicacao_modulo(
            module_id=10,
            origem="manual",
            status_final="incluido",
            decision_traces={},
            variaveis_snapshot={},
        )

        assert result["reason_code"] == "NOT_EVALUATED"
        assert result["inputs_used"] == {}

    def test_extrair_vars_e_valores(self):
        """Helper extrai variáveis corretamente do snapshot."""
        trace = {
            "regras_avaliadas": [
                {"tipo": "global", "resultado": False, "variaveis": ["a", "b"]},
                {"tipo": "especifica", "resultado": True, "variaveis": ["c"]},
            ]
        }
        snapshot = {"a": 1, "b": "dois", "c": True, "d": "nao_usado"}

        result = _extrair_vars_e_valores(trace, snapshot)

        assert result == {"a": 1, "b": "dois", "c": True}
        assert "d" not in result

    def test_extrair_vars_ausentes(self):
        """Helper marca variáveis ausentes como <<AUSENTE>>."""
        trace = {
            "regras_avaliadas": [
                {"tipo": "global", "resultado": None, "variaveis": ["existe", "nao_existe"]}
            ]
        }
        snapshot = {"existe": True}

        result = _extrair_vars_e_valores(trace, snapshot)

        assert result["existe"] == True
        assert result["nao_existe"] == "<<AUSENTE>>"


# ============================================================================
# Grupo 4: Cenário real (processo 0803030)
# ============================================================================

class TestCenarioReal:
    """Testa com dados reais dos módulos 49 e 57."""

    def test_modulo49_manual_reason(self):
        """
        Módulo 49 (Direcionamento Tema 793) adicionado manualmente.
        Não ativou porque municipio_polo_passivo=False (município não é réu).
        """
        traces = {
            "49": {
                "module_id": 49,
                "module_nome": "direcionamento_ressarcimento_tema793",
                "module_titulo": "DIRECIONAMENTO E DIREITO DE RESSARCIMENTO EM FACE DO ENTE RESPONSAVEL",
                "modo_avaliacao": "deterministic",
                "ativar": False,
                "regra_usada": "global",
                "detalhes": "Regra global retornou False (vars: ['municipio_polo_passivo', 'peticao_inicial_pedido_medicamento'])",
                "regras_avaliadas": [
                    {
                        "tipo": "global",
                        "resultado": False,
                        "variaveis": ["municipio_polo_passivo", "peticao_inicial_pedido_medicamento"]
                    }
                ],
                "variaveis_faltantes": [],
            }
        }
        snapshot = {
            "municipio_polo_passivo": False,
            "peticao_inicial_pedido_medicamento": True,
        }

        result = gerar_explicacao_modulo(
            module_id=49,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot=snapshot,
        )

        assert result["reason_code"] == "CONDITION_FALSE"
        assert result["inputs_used"]["municipio_polo_passivo"] == False
        assert result["inputs_used"]["peticao_inicial_pedido_medicamento"] == True

    def test_modulo57_manual_reason(self):
        """
        Módulo 57 (Não Condenação em Honorários) adicionado manualmente.
        Não ativou porque nem uniao_polo_passivo nem municipio_polo_passivo são True.
        """
        traces = {
            "57": {
                "module_id": 57,
                "module_nome": "nao_condenacao_honorarios",
                "module_titulo": "NAO CONDENACAO EM HONORARIOS DE SUCUMBENCIA",
                "modo_avaliacao": "deterministic",
                "ativar": False,
                "regra_usada": "global",
                "detalhes": "Regra global retornou False (vars: ['juizado_justica_comum', 'uniao_polo_passivo', 'municipio_polo_passivo'])",
                "regras_avaliadas": [
                    {
                        "tipo": "global",
                        "resultado": False,
                        "variaveis": [
                            "juizado_justica_comum",
                            "uniao_polo_passivo",
                            "municipio_polo_passivo",
                            "peticao_inicial_pedido_medicamento"
                        ]
                    }
                ],
                "variaveis_faltantes": [],
            }
        }
        snapshot = {
            "juizado_justica_comum": "Justica Comum",
            "uniao_polo_passivo": False,
            "municipio_polo_passivo": False,
            "peticao_inicial_pedido_medicamento": True,
        }

        result = gerar_explicacao_modulo(
            module_id=57,
            origem="manual",
            status_final="incluido",
            decision_traces=traces,
            variaveis_snapshot=snapshot,
        )

        assert result["reason_code"] == "CONDITION_FALSE"
        assert result["inputs_used"]["uniao_polo_passivo"] == False
        assert result["inputs_used"]["municipio_polo_passivo"] == False
        assert result["inputs_used"]["juizado_justica_comum"] == "Justica Comum"


# ============================================================================
# Grupo 5: avaliar_com_trace - checks granulares no avaliador
# ============================================================================

from sistemas.gerador_pecas.services_deterministic import DeterministicRuleEvaluator


class TestCheckTraceGeneration:
    """Testa que avaliar_com_trace() produz checks corretos."""

    def setup_method(self):
        self.evaluator = DeterministicRuleEvaluator()

    def test_condicao_simples_true(self):
        """Condição simples equals que retorna True."""
        regra = {"type": "condition", "variable": "municipio_polo_passivo", "operator": "equals", "value": True}
        dados = {"municipio_polo_passivo": True}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is True
        assert trace["evaluation_mode"] == "SINGLE"
        assert trace["final_result"] is True
        assert len(trace["checks"]) == 1

        check = trace["checks"][0]
        assert check["check_id"] == "municipio_polo_passivo__equals__True"
        assert check["result"] is True
        assert check["input_keys"] == ["municipio_polo_passivo"]
        assert check["input_values"]["municipio_polo_passivo"] is True

    def test_condicao_simples_false(self):
        """Condição simples equals que retorna False."""
        regra = {"type": "condition", "variable": "municipio_polo_passivo", "operator": "equals", "value": True}
        dados = {"municipio_polo_passivo": False}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is False
        assert len(trace["checks"]) == 1
        check = trace["checks"][0]
        assert check["result"] is False
        assert check["input_values"]["municipio_polo_passivo"] is False

    def test_variavel_none_tratada_como_false(self):
        """Variável None tratada como False para comparação booleana."""
        regra = {"type": "condition", "variable": "var_ausente", "operator": "equals", "value": False}
        dados = {}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is True  # None == False -> True
        check = trace["checks"][0]
        assert check["result"] is True
        assert "None" in (check["notes"] or "") or "ausente" in (check["notes"] or "")

    def test_and_todas_true(self):
        """AND com todas condições True."""
        regra = {
            "type": "and",
            "conditions": [
                {"type": "condition", "variable": "a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "b", "operator": "equals", "value": True},
            ]
        }
        dados = {"a": True, "b": True}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is True
        assert trace["evaluation_mode"] == "ALL"
        assert trace["short_circuit"] is None
        assert len(trace["checks"]) == 2
        assert all(c["result"] is True for c in trace["checks"])

    def test_and_short_circuit(self):
        """AND com short-circuit na primeira condição False."""
        regra = {
            "type": "and",
            "conditions": [
                {"type": "condition", "variable": "a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "b", "operator": "equals", "value": True},
                {"type": "condition", "variable": "c", "operator": "equals", "value": True},
            ]
        }
        dados = {"a": False, "b": True, "c": True}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is False
        assert trace["evaluation_mode"] == "ALL"
        assert trace["short_circuit"] is not None
        assert trace["short_circuit"]["at_index"] == 0

        # Primeira condição avaliada como False, restantes não avaliadas
        checks = trace["checks"]
        assert len(checks) == 3
        assert checks[0]["result"] is False
        assert checks[1]["result"] is None  # Não avaliado (short-circuit)
        assert checks[2]["result"] is None  # Não avaliado (short-circuit)
        assert "short-circuit" in (checks[1]["notes"] or "").lower()

    def test_or_short_circuit(self):
        """OR com short-circuit na primeira condição True."""
        regra = {
            "type": "or",
            "conditions": [
                {"type": "condition", "variable": "a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "b", "operator": "equals", "value": True},
            ]
        }
        dados = {"a": True, "b": False}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is True
        assert trace["evaluation_mode"] == "ANY"
        assert trace["short_circuit"] is not None

        checks = trace["checks"]
        assert checks[0]["result"] is True
        assert checks[1]["result"] is None  # Não avaliado

    def test_or_todas_false(self):
        """OR com todas condições False (sem short-circuit)."""
        regra = {
            "type": "or",
            "conditions": [
                {"type": "condition", "variable": "a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "b", "operator": "equals", "value": True},
            ]
        }
        dados = {"a": False, "b": False}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is False
        assert trace["evaluation_mode"] == "ANY"
        assert trace["short_circuit"] is None
        assert len(trace["checks"]) == 2
        assert all(c["result"] is False for c in trace["checks"])

    def test_not_inverte_resultado(self):
        """NOT inverte o resultado."""
        regra = {
            "type": "not",
            "condition": {"type": "condition", "variable": "a", "operator": "equals", "value": True}
        }
        dados = {"a": True}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is False  # NOT(True) = False
        assert trace["evaluation_mode"] == "NOT"
        assert trace["checks"][0]["result"] is True  # Check interno é True, NOT inverte

    def test_contains_operator(self):
        """Operador contains."""
        regra = {"type": "condition", "variable": "texto", "operator": "contains", "value": "medicamento"}
        dados = {"texto": "Ação sobre medicamento essencial"}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is True
        check = trace["checks"][0]
        assert check["result"] is True
        assert "contains" in check["expression"]

    def test_lista_or_consolidacao(self):
        """Lista com lógica OR para booleanos."""
        regra = {"type": "condition", "variable": "lista_var", "operator": "equals", "value": True}
        dados = {"lista_var": [False, False, True]}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is True
        check = trace["checks"][0]
        assert check["result"] is True
        assert check["notes"] is not None
        assert "lista" in check["notes"].lower() or "or" in check["notes"].lower()

    def test_regra_composta_real_modulo49(self):
        """Cenário real: módulo 49 (Tema 793) com AND composto."""
        regra = {
            "type": "and",
            "conditions": [
                {"type": "condition", "variable": "municipio_polo_passivo", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_medicamento", "operator": "equals", "value": True},
            ]
        }
        dados = {"municipio_polo_passivo": False, "peticao_inicial_pedido_medicamento": True}

        resultado, trace = self.evaluator.avaliar_com_trace(regra, dados)

        assert resultado is False
        assert trace["evaluation_mode"] == "ALL"
        # Short-circuit na primeira condição (municipio False)
        assert trace["short_circuit"] is not None

        checks = trace["checks"]
        # Primeira condição falha
        assert checks[0]["result"] is False
        assert "municipio_polo_passivo" in checks[0]["check_id"]
        # Segunda condição não avaliada
        assert checks[1]["result"] is None

    def test_consistency_with_avaliar(self):
        """avaliar_com_trace produz mesmo resultado booleano que avaliar."""
        regras = [
            {"type": "condition", "variable": "x", "operator": "equals", "value": True},
            {"type": "and", "conditions": [
                {"type": "condition", "variable": "a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "b", "operator": "equals", "value": False},
            ]},
            {"type": "or", "conditions": [
                {"type": "condition", "variable": "a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "b", "operator": "equals", "value": True},
            ]},
        ]
        dados = {"x": True, "a": True, "b": False}

        for regra in regras:
            resultado_original = self.evaluator.avaliar(regra, dados)
            resultado_trace, trace = self.evaluator.avaliar_com_trace(regra, dados)
            assert resultado_original == resultado_trace, f"Inconsistência para regra {regra}"


# ============================================================================
# Grupo 6: gerar_explicacao_modulo com checks granulares
# ============================================================================

from sistemas.gerador_pecas.services_curadoria import (
    _extrair_checks_de_trace,
    _resolve_final_decision,
)


class TestCheckTraceInExplicacao:
    """Testa que gerar_explicacao_modulo inclui checks granulares."""

    def _make_trace_com_checks(self, module_id, ativar, checks, eval_mode="ALL", short_circuit=None):
        """Helper: cria trace com checks granulares."""
        return {
            "module_id": module_id,
            "module_nome": f"mod_{module_id}",
            "module_titulo": f"Modulo {module_id}",
            "modo_avaliacao": "deterministic",
            "ativar": ativar,
            "regra_usada": "global_primaria",
            "detalhes": "Teste com checks",
            "regras_avaliadas": [{
                "tipo": "global_primaria",
                "resultado": ativar,
                "variaveis": [c["input_keys"][0] for c in checks if c.get("input_keys")],
                "checks": checks,
                "evaluation_mode": eval_mode,
                "short_circuit": short_circuit,
            }],
            "variaveis_faltantes": [],
        }

    def test_explicacao_inclui_checks_satisfied(self):
        """gerar_explicacao_modulo retorna checks_satisfied."""
        checks = [
            {"check_id": "a__equals__True", "label": "a equals True", "expression": "a equals True",
             "input_keys": ["a"], "input_values": {"a": True}, "result": True, "notes": None},
        ]
        trace = self._make_trace_com_checks(10, True, checks)
        traces = {"10": trace}
        snapshot = {"a": True}

        result = gerar_explicacao_modulo(10, "preview", "incluido", traces, snapshot)

        assert "checks_satisfied" in result
        assert len(result["checks_satisfied"]) == 1
        assert result["checks_satisfied"][0]["check_id"] == "a__equals__True"
        assert result["checks_not_satisfied"] == []

    def test_explicacao_inclui_checks_not_satisfied(self):
        """gerar_explicacao_modulo retorna checks_not_satisfied para módulo manual."""
        checks = [
            {"check_id": "x__equals__True", "label": "x equals True", "expression": "x equals True",
             "input_keys": ["x"], "input_values": {"x": False}, "result": False, "notes": None},
            {"check_id": "y__equals__True", "label": "y equals True", "expression": "y equals True",
             "input_keys": ["y"], "input_values": {}, "result": None, "notes": "Nao avaliado (short-circuit)"},
        ]
        sc = {"at_index": 0, "at_check": "x__equals__True", "reason": "AND short-circuit"}
        trace = self._make_trace_com_checks(20, False, checks, short_circuit=sc)
        traces = {"20": trace}

        result = gerar_explicacao_modulo(20, "manual", "incluido", traces, {})

        assert result["reason_code"] == "CONDITION_FALSE"
        assert len(result["checks_not_satisfied"]) == 2  # False + None
        assert result["checks_not_satisfied"][0]["result"] is False
        assert result["checks_not_satisfied"][1]["result"] is None

    def test_explicacao_inclui_evaluation_strategy(self):
        """gerar_explicacao_modulo retorna evaluation_strategy."""
        checks = [
            {"check_id": "a__equals__True", "label": "a equals True", "expression": "a equals True",
             "input_keys": ["a"], "input_values": {"a": True}, "result": True, "notes": None},
        ]
        trace = self._make_trace_com_checks(30, True, checks, eval_mode="ALL")
        traces = {"30": trace}

        result = gerar_explicacao_modulo(30, "preview", "incluido", traces, {"a": True})

        assert "evaluation_strategy" in result
        assert result["evaluation_strategy"]["mode"] == "ALL"
        assert result["evaluation_strategy"]["fallback_applied"] is False

    def test_final_decision_manual_include(self):
        """final_decision para módulo adicionado manualmente."""
        traces = {"10": make_det_trace(10, ativar=False, variaveis=["x"])}
        result = gerar_explicacao_modulo(10, "manual", "incluido", traces, {"x": False})
        assert result["final_decision"] == "MANUAL_OVERRIDE_INCLUDE"

    def test_final_decision_manual_exclude(self):
        """final_decision para módulo excluído manualmente."""
        traces = {"10": make_det_trace(10, ativar=True, variaveis=["x"])}
        result = gerar_explicacao_modulo(10, "preview", "excluido", traces, {"x": True})
        assert result["final_decision"] == "MANUAL_OVERRIDE_EXCLUDE"

    def test_final_decision_active(self):
        """final_decision para módulo confirmado (ativo)."""
        traces = {"10": make_det_trace(10, ativar=True, regra_usada="global_primaria", variaveis=["x"])}
        result = gerar_explicacao_modulo(10, "preview", "incluido", traces, {"x": True})
        assert result["final_decision"] == "ACTIVE"

    def test_backward_compat_sem_checks(self):
        """Traces antigos (sem checks) retornam arrays vazios."""
        traces = {"10": make_det_trace(10, ativar=False, variaveis=["x"])}
        result = gerar_explicacao_modulo(10, "manual", "incluido", traces, {"x": False})

        assert result["checks_satisfied"] == []
        assert result["checks_not_satisfied"] == []
        assert result["evaluation_strategy"]["mode"] is None

    def test_llm_trace_sem_checks(self):
        """Traces LLM não têm checks."""
        traces = {"10": make_llm_trace(10, ativar=False)}
        result = gerar_explicacao_modulo(10, "manual", "incluido", traces, {})

        assert result["checks_satisfied"] == []
        assert result["checks_not_satisfied"] == []
        assert result["final_decision"] == "MANUAL_OVERRIDE_INCLUDE"


class TestExtrairChecksHelper:
    """Testa a helper _extrair_checks_de_trace."""

    def test_extrai_satisfied_e_not_satisfied(self):
        """Separa checks por resultado."""
        trace = {
            "regras_avaliadas": [{
                "checks": [
                    {"check_id": "a", "result": True},
                    {"check_id": "b", "result": False},
                    {"check_id": "c", "result": None},
                ],
                "evaluation_mode": "ALL",
                "short_circuit": None,
            }]
        }

        satisfied, not_satisfied, strategy = _extrair_checks_de_trace(trace)

        assert len(satisfied) == 1
        assert satisfied[0]["check_id"] == "a"
        assert len(not_satisfied) == 2  # False + None
        assert strategy["mode"] == "ALL"

    def test_trace_sem_checks(self):
        """Trace sem campo checks retorna vazio."""
        trace = {"regras_avaliadas": [{"tipo": "global", "resultado": True, "variaveis": ["x"]}]}
        satisfied, not_satisfied, strategy = _extrair_checks_de_trace(trace)

        assert satisfied == []
        assert not_satisfied == []

    def test_resolve_final_decision_fallback(self):
        """Detecta ACTIVE_FALLBACK quando regra secundária é usada."""
        trace = {"ativar": True, "regra_usada": "global_secundaria"}
        assert _resolve_final_decision("preview", "incluido", trace) == "ACTIVE_FALLBACK"
