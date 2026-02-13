"""Avaliador de regras deterministicas (AST JSON) sem LLM."""

import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class DeterministicRuleEvaluator:
    """
    Avaliador de regras determinísticas no runtime.

    Executa regras AST JSON sem chamar LLM.
    Suporta variáveis condicionais que podem estar ausentes.
    """

    # Marcador para variáveis não aplicáveis
    NOT_APPLICABLE = "__NOT_APPLICABLE__"

    def __init__(self):
        pass

    def preprocessar_dados_condicionais(
        self,
        dados: Dict[str, Any],
        variaveis_condicionais: List[Dict]
    ) -> Dict[str, Any]:
        """
        Pré-processa dados marcando variáveis condicionais como não aplicáveis
        quando suas condições não são satisfeitas.

        Args:
            dados: Dicionário com valores extraídos
            variaveis_condicionais: Lista de dicts com {slug, depends_on, operator, value}

        Returns:
            Dados processados com variáveis não aplicáveis marcadas
        """
        dados_processados = dados.copy()

        for var in variaveis_condicionais:
            slug = var.get("slug")
            depends_on = var.get("depends_on")
            operator = var.get("operator", "equals")
            value = var.get("value")

            if not slug or not depends_on:
                continue

            # Avalia se a condição da variável é satisfeita
            condicao_satisfeita = self._avaliar_condicao_dependencia(
                depends_on, operator, value, dados_processados
            )

            if not condicao_satisfeita:
                # Marca variável como não aplicável
                dados_processados[slug] = self.NOT_APPLICABLE

        return dados_processados

    def _avaliar_condicao_dependencia(
        self,
        depends_on: str,
        operator: str,
        value: Any,
        dados: Dict[str, Any]
    ) -> bool:
        """Avalia se uma condição de dependência é satisfeita."""
        valor_pai = dados.get(depends_on)

        # Se pai não existe, condição não é satisfeita
        if valor_pai is None:
            return False

        # Se pai é não aplicável, condição não é satisfeita
        if valor_pai == self.NOT_APPLICABLE:
            return False

        # Avalia operador
        if operator == "exists":
            return True  # Já verificamos que pai existe

        if operator == "not_exists":
            return False  # Já verificamos que pai existe

        if operator == "equals":
            return self._comparar_igual(valor_pai, value)

        if operator == "not_equals":
            return not self._comparar_igual(valor_pai, value)

        if operator == "in_list":
            if not isinstance(value, list):
                value = [value]
            return valor_pai in value

        if operator == "not_in_list":
            if not isinstance(value, list):
                value = [value]
            return valor_pai not in value

        if operator == "greater_than":
            return self._comparar_numerico(valor_pai, value, ">")

        if operator == "less_than":
            return self._comparar_numerico(valor_pai, value, "<")

        # Operador desconhecido = assume verdadeiro
        return True

    def avaliar(self, regra: Dict, dados: Dict[str, Any]) -> bool:
        """
        Avalia uma regra determinística com os dados fornecidos.

        Args:
            regra: AST JSON da regra
            dados: Dicionário com valores das variáveis

        Returns:
            True se a regra é satisfeita, False caso contrário
        """
        try:
            return self._avaliar_no(regra, dados)
        except Exception as e:
            logger.error(f"Erro ao avaliar regra: {e}")
            return False

    def _avaliar_no(self, no: Dict, dados: Dict[str, Any]) -> bool:
        """Avalia um nó da árvore de regras."""
        tipo = no.get("type")

        if tipo == "condition":
            return self._avaliar_condicao(no, dados)

        elif tipo == "and":
            conditions = no.get("conditions", [])
            return all(self._avaliar_no(c, dados) for c in conditions)

        elif tipo == "or":
            conditions = no.get("conditions", [])
            return any(self._avaliar_no(c, dados) for c in conditions)

        elif tipo == "not":
            # Aceita tanto 'condition' (singular) quanto 'conditions' (plural)
            condition = no.get("condition")
            if condition:
                return not self._avaliar_no(condition, dados)
            conditions = no.get("conditions", [])
            # NOT é verdadeiro se NENHUMA condição for verdadeira
            return not any(self._avaliar_no(c, dados) for c in conditions)

        else:
            logger.warning(f"Tipo de nó desconhecido: {tipo}")
            return False

    def _avaliar_condicao(self, condicao: Dict, dados: Dict[str, Any]) -> bool:
        """
        Avalia uma condição simples.

        Suporta variáveis condicionais que podem estar ausentes quando
        sua condição pai não é satisfeita.

        Regras especiais:
        1. Se variável não existe ou é None → considera como False (para booleanos)
        2. Se variável é uma lista → usa lógica OR (pelo menos um True = True)
        """
        variavel = condicao.get("variable")
        operador = condicao.get("operator")
        valor_esperado = condicao.get("value")

        # Obtém valor atual da variável
        valor_atual = dados.get(variavel)

        # Tratamento especial para variáveis condicionais ausentes
        # Se a variável não existe e o operador não é exists/not_exists,
        # tratamos como condição não satisfeita (exceto para is_empty)
        if valor_atual is None and operador not in ("exists", "not_exists", "is_empty", "is_not_empty"):
            # Verifica se é uma variável marcada como não aplicável
            if variavel in dados and dados[variavel] == "__NOT_APPLICABLE__":
                # Variável é condicional e sua condição pai não foi satisfeita
                # Para operadores de comparação, retorna False
                return False

            # REGRA 1: Se variável não existe ou é None, considera como False para booleanos
            # Isso permite que condições como "variavel = false" sejam TRUE quando a variável não existe
            if valor_esperado in (True, False, "true", "false"):
                valor_atual = False
                logger.debug(
                    f"[REGRA-DETERMINISTICO] Variável '{variavel}' não existe/null, "
                    f"considerando como False para comparação booleana"
                )

        # REGRA 2: Se valor_atual é uma lista, aplica lógica OR
        # Se pelo menos um valor TRUE na lista → variável = TRUE
        # Depois compara normalmente com valor_esperado
        if isinstance(valor_atual, list):
            # Para booleanos: consolida a lista usando lógica OR
            # [false, false, true] → true (pelo menos 1 true)
            # [false, false, false] → false (nenhum true)
            if valor_esperado in (True, False, "true", "false"):
                valor_atual = any(self._normalizar_booleano(v) for v in valor_atual)
            else:
                # Para outros tipos: verifica se algum valor na lista satisfaz
                for v in valor_atual:
                    if self._aplicar_operador(operador, v, valor_esperado):
                        return True
                return False

            logger.debug(
                f"[REGRA-DETERMINISTICO] Variável '{variavel}' é lista, "
                f"aplicando lógica OR: valor consolidado = {valor_atual}"
            )

        # Avalia operador
        return self._aplicar_operador(operador, valor_atual, valor_esperado)

    def _normalizar_booleano(self, valor: Any) -> bool:
        """Normaliza um valor para booleano."""
        if valor is None:
            return False
        if isinstance(valor, bool):
            return valor
        if isinstance(valor, str):
            return valor.lower() in ("true", "1", "yes", "sim")
        return bool(valor)

    def _aplicar_operador(
        self,
        operador: str,
        valor_atual: Any,
        valor_esperado: Any
    ) -> bool:
        """Aplica um operador de comparação."""
        if operador == "equals":
            return self._comparar_igual(valor_atual, valor_esperado)

        elif operador == "not_equals":
            return not self._comparar_igual(valor_atual, valor_esperado)

        elif operador == "contains":
            if valor_atual is None:
                return False
            return str(valor_esperado).lower() in str(valor_atual).lower()

        elif operador == "not_contains":
            if valor_atual is None:
                return True
            return str(valor_esperado).lower() not in str(valor_atual).lower()

        elif operador == "starts_with":
            if valor_atual is None:
                return False
            return str(valor_atual).lower().startswith(str(valor_esperado).lower())

        elif operador == "ends_with":
            if valor_atual is None:
                return False
            return str(valor_atual).lower().endswith(str(valor_esperado).lower())

        elif operador == "greater_than":
            return self._comparar_numerico(valor_atual, valor_esperado, ">")

        elif operador == "less_than":
            return self._comparar_numerico(valor_atual, valor_esperado, "<")

        elif operador == "greater_or_equal":
            return self._comparar_numerico(valor_atual, valor_esperado, ">=")

        elif operador == "less_or_equal":
            return self._comparar_numerico(valor_atual, valor_esperado, "<=")

        elif operador == "is_empty":
            return valor_atual is None or valor_atual == "" or valor_atual == []

        elif operador == "is_not_empty":
            return valor_atual is not None and valor_atual != "" and valor_atual != []

        elif operador == "in_list":
            if not isinstance(valor_esperado, list):
                valor_esperado = [valor_esperado]
            return valor_atual in valor_esperado

        elif operador == "not_in_list":
            if not isinstance(valor_esperado, list):
                valor_esperado = [valor_esperado]
            return valor_atual not in valor_esperado

        elif operador == "matches_regex":
            if valor_atual is None:
                return False
            try:
                return bool(re.match(valor_esperado, str(valor_atual), re.IGNORECASE))
            except re.error:
                return False

        elif operador == "exists":
            # Variável existe e foi extraída (não é None nem marcada como não aplicável)
            return valor_atual is not None and valor_atual != "__NOT_APPLICABLE__"

        elif operador == "not_exists":
            # Variável não existe, não foi extraída, ou é não aplicável
            return valor_atual is None or valor_atual == "__NOT_APPLICABLE__"

        else:
            logger.warning(f"Operador desconhecido: {operador}")
            return False

    def _comparar_igual(self, a: Any, b: Any) -> bool:
        """Compara igualdade com normalização."""
        if a is None and b is None:
            return True
        if a is None or b is None:
            return False

        # Normaliza strings
        if isinstance(a, str) and isinstance(b, str):
            return a.lower().strip() == b.lower().strip()

        # Normaliza 1/0 para booleanos (compatibilidade com regras antigas)
        # Isso garante que value:1 seja tratado como value:true
        if isinstance(b, int) and b in (0, 1):
            b = bool(b)
        if isinstance(a, int) and a in (0, 1) and isinstance(b, bool):
            a = bool(a)

        # Normaliza booleanos
        if isinstance(b, bool):
            if isinstance(a, str):
                return a.lower() in ("true", "sim", "yes", "1") if b else a.lower() in ("false", "não", "nao", "no", "0")
            if isinstance(a, bool):
                return a == b

        return a == b

    def _parse_numero(self, valor: str) -> float:
        """
        Converte string para número, suportando formato brasileiro.

        Exemplos suportados:
        - "250000" -> 250000.0
        - "250.000,00" -> 250000.0
        - "R$ 250.000,00" -> 250000.0
        - "250,50" -> 250.5
        """
        # Remove símbolos de moeda e espaços
        valor = valor.replace("R$", "").replace("$", "").strip()

        # Detecta formato brasileiro (ponto como separador de milhar, vírgula como decimal)
        # Se tem ponto E vírgula, assume formato brasileiro
        if "." in valor and "," in valor:
            # Remove pontos (milhares) e substitui vírgula por ponto (decimal)
            valor = valor.replace(".", "").replace(",", ".")
        elif "," in valor and "." not in valor:
            # Apenas vírgula: pode ser decimal brasileiro
            # Se tem mais de 2 dígitos após a vírgula, provavelmente é milhar
            partes = valor.split(",")
            if len(partes) == 2 and len(partes[1]) <= 2:
                # Vírgula como decimal
                valor = valor.replace(",", ".")
            else:
                # Vírgula como milhar
                valor = valor.replace(",", "")

        return float(valor)

    def _comparar_numerico(self, a: Any, b: Any, op: str) -> bool:
        """Compara valores numéricos."""
        try:
            # Converte para float (suporta formato brasileiro: R$ 250.000,00)
            if isinstance(a, str):
                a = self._parse_numero(a)
            if isinstance(b, str):
                b = self._parse_numero(b)

            a = float(a) if a is not None else 0
            b = float(b) if b is not None else 0

            if op == ">":
                return a > b
            elif op == "<":
                return a < b
            elif op == ">=":
                return a >= b
            elif op == "<=":
                return a <= b

        except (ValueError, TypeError):
            return False

        return False

    # ==================================================================
    # TRACED EVALUATION - Métodos paralelos que produzem decision traces
    # ==================================================================

    def avaliar_com_trace(self, regra: Dict, dados: Dict[str, Any]) -> tuple:
        """
        Avalia uma regra determinística com trace granular de cada condição.

        Args:
            regra: AST JSON da regra
            dados: Dicionário com valores das variáveis

        Returns:
            Tupla (bool, dict) onde dict contém:
            - checks: lista de checks individuais avaliados
            - evaluation_mode: ALL/ANY/SINGLE/NOT
            - short_circuit: info de short-circuit se houve
            - final_result: resultado final booleano
        """
        try:
            resultado, trace = self._avaliar_no_trace(regra, dados)
            trace["final_result"] = resultado
            return resultado, trace
        except Exception as e:
            logger.error(f"Erro ao avaliar regra com trace: {e}")
            return False, {
                "checks": [],
                "evaluation_mode": "ERROR",
                "short_circuit": None,
                "final_result": False,
                "error": str(e),
            }

    def _avaliar_no_trace(self, no: Dict, dados: Dict[str, Any]) -> tuple:
        """Avalia um nó da árvore com trace. Retorna (bool, trace_dict)."""
        tipo = no.get("type")

        if tipo == "condition":
            resultado, check = self._avaliar_condicao_trace(no, dados)
            return resultado, {
                "checks": [check],
                "evaluation_mode": "SINGLE",
                "short_circuit": None,
            }

        elif tipo == "and":
            conditions = no.get("conditions", [])
            all_checks = []
            short_circuit_info = None

            for i, c in enumerate(conditions):
                sub_resultado, sub_trace = self._avaliar_no_trace(c, dados)
                all_checks.extend(sub_trace.get("checks", []))

                if not sub_resultado:
                    # AND short-circuit: parou na primeira condição falsa
                    failed_check = sub_trace["checks"][-1] if sub_trace.get("checks") else None
                    short_circuit_info = {
                        "at_index": i,
                        "at_check": failed_check["check_id"] if failed_check else f"node_{i}",
                        "reason": f"AND short-circuit: condicao {i+1}/{len(conditions)} retornou False",
                    }
                    # Marca condições restantes como não avaliadas
                    for j in range(i + 1, len(conditions)):
                        remaining_checks = self._extrair_checks_nao_avaliados(conditions[j])
                        all_checks.extend(remaining_checks)
                    return False, {
                        "checks": all_checks,
                        "evaluation_mode": "ALL",
                        "short_circuit": short_circuit_info,
                    }

            return True, {
                "checks": all_checks,
                "evaluation_mode": "ALL",
                "short_circuit": None,
            }

        elif tipo == "or":
            conditions = no.get("conditions", [])
            all_checks = []
            short_circuit_info = None

            for i, c in enumerate(conditions):
                sub_resultado, sub_trace = self._avaliar_no_trace(c, dados)
                all_checks.extend(sub_trace.get("checks", []))

                if sub_resultado:
                    # OR short-circuit: parou na primeira condição verdadeira
                    passed_check = sub_trace["checks"][-1] if sub_trace.get("checks") else None
                    short_circuit_info = {
                        "at_index": i,
                        "at_check": passed_check["check_id"] if passed_check else f"node_{i}",
                        "reason": f"OR short-circuit: condicao {i+1}/{len(conditions)} retornou True",
                    }
                    # Marca condições restantes como não avaliadas
                    for j in range(i + 1, len(conditions)):
                        remaining_checks = self._extrair_checks_nao_avaliados(conditions[j])
                        all_checks.extend(remaining_checks)
                    return True, {
                        "checks": all_checks,
                        "evaluation_mode": "ANY",
                        "short_circuit": short_circuit_info,
                    }

            return False, {
                "checks": all_checks,
                "evaluation_mode": "ANY",
                "short_circuit": None,
            }

        elif tipo == "not":
            condition = no.get("condition")
            if condition:
                sub_resultado, sub_trace = self._avaliar_no_trace(condition, dados)
                return not sub_resultado, {
                    "checks": sub_trace.get("checks", []),
                    "evaluation_mode": "NOT",
                    "short_circuit": None,
                }
            conditions = no.get("conditions", [])
            all_checks = []
            any_true = False
            for c in conditions:
                sub_resultado, sub_trace = self._avaliar_no_trace(c, dados)
                all_checks.extend(sub_trace.get("checks", []))
                if sub_resultado:
                    any_true = True
            return not any_true, {
                "checks": all_checks,
                "evaluation_mode": "NOT",
                "short_circuit": None,
            }

        else:
            logger.warning(f"Tipo de nó desconhecido no trace: {tipo}")
            return False, {
                "checks": [],
                "evaluation_mode": "UNKNOWN",
                "short_circuit": None,
            }

    def _avaliar_condicao_trace(self, condicao: Dict, dados: Dict[str, Any]) -> tuple:
        """
        Avalia uma condição simples com trace detalhado.

        Returns:
            Tupla (bool, check_dict) com resultado e detalhes da avaliação.
        """
        variavel = condicao.get("variable")
        operador = condicao.get("operator")
        valor_esperado = condicao.get("value")

        # Monta check_id estável
        check_id = f"{variavel}__{operador}__{valor_esperado}"
        valor_atual_original = dados.get(variavel)
        valor_atual = valor_atual_original
        notes = []

        # --- Lógica idêntica a _avaliar_condicao, mas com captura de notas ---

        # Tratamento de None
        if valor_atual is None and operador not in ("exists", "not_exists", "is_empty", "is_not_empty"):
            if variavel in dados and dados[variavel] == "__NOT_APPLICABLE__":
                notes.append("Variavel condicional nao aplicavel (dependencia nao satisfeita)")
                resultado = False
                return resultado, self._build_check(
                    check_id, variavel, operador, valor_esperado,
                    valor_atual_original, resultado, notes
                )

            if valor_esperado in (True, False, "true", "false"):
                valor_atual = False
                notes.append("Variavel None/ausente, tratada como False para comparacao booleana")

        # Tratamento de listas
        if isinstance(valor_atual, list):
            if valor_esperado in (True, False, "true", "false"):
                consolidado = any(self._normalizar_booleano(v) for v in valor_atual)
                notes.append(f"Lista consolidada via OR: {valor_atual} -> {consolidado}")
                valor_atual = consolidado
            else:
                for v in valor_atual:
                    if self._aplicar_operador(operador, v, valor_esperado):
                        notes.append(f"Lista: item '{v}' satisfez a condicao")
                        resultado = True
                        return resultado, self._build_check(
                            check_id, variavel, operador, valor_esperado,
                            valor_atual_original, resultado, notes
                        )
                notes.append(f"Lista: nenhum item satisfez a condicao")
                resultado = False
                return resultado, self._build_check(
                    check_id, variavel, operador, valor_esperado,
                    valor_atual_original, resultado, notes
                )

        resultado = self._aplicar_operador(operador, valor_atual, valor_esperado)

        return resultado, self._build_check(
            check_id, variavel, operador, valor_esperado,
            valor_atual_original, resultado, notes
        )

    def _build_check(
        self,
        check_id: str,
        variavel: str,
        operador: str,
        valor_esperado: Any,
        valor_atual: Any,
        resultado: bool,
        notes: list,
    ) -> Dict:
        """Constrói um check dict padronizado."""
        # Label legível
        if operador in ("is_empty", "is_not_empty", "exists", "not_exists"):
            label = f"{variavel} {operador}"
            expression = f"{variavel} {operador}"
        else:
            label = f"{variavel} {operador} {valor_esperado}"
            expression = f"{variavel} {operador} {valor_esperado}"

        return {
            "check_id": check_id,
            "label": label,
            "expression": expression,
            "input_keys": [variavel],
            "input_values": {variavel: valor_atual},
            "result": resultado,
            "notes": "; ".join(notes) if notes else None,
        }

    def _extrair_checks_nao_avaliados(self, no: Dict) -> list:
        """Extrai checks de um nó marcando-os como não avaliados (para short-circuit)."""
        checks = []
        tipo = no.get("type")

        if tipo == "condition":
            variavel = no.get("variable")
            operador = no.get("operator")
            valor_esperado = no.get("value")
            checks.append({
                "check_id": f"{variavel}__{operador}__{valor_esperado}",
                "label": f"{variavel} {operador} {valor_esperado}" if operador not in ("is_empty", "is_not_empty", "exists", "not_exists") else f"{variavel} {operador}",
                "expression": f"{variavel} {operador} {valor_esperado}" if operador not in ("is_empty", "is_not_empty", "exists", "not_exists") else f"{variavel} {operador}",
                "input_keys": [variavel],
                "input_values": {},
                "result": None,
                "notes": "Nao avaliado (short-circuit)",
            })
        elif tipo in ("and", "or"):
            for c in no.get("conditions", []):
                checks.extend(self._extrair_checks_nao_avaliados(c))
        elif tipo == "not":
            condition = no.get("condition")
            if condition:
                checks.extend(self._extrair_checks_nao_avaliados(condition))
            for c in no.get("conditions", []):
                checks.extend(self._extrair_checks_nao_avaliados(c))

        return checks
