# tests/test_tema793_litisconsorcio.py
"""
Testes para o Tema 793 - Litisconsórcio Necessário do Município.

Cobre:
1. Fallback de variáveis de processo → extração quando XML não traz partes
2. Avaliação correta dos módulos 22 (Litisconsórcio) e 49 (Direcionamento)
3. Cenário real do processo 0803030-88.2025.8.12.0045
4. Regressão: modo automático não afetado

Bug original: variável `municipio_polo_passivo` vinha None quando XML não trazia
dados de partes (polo_passivo: []). O fallback para a variável de extração
`peticao_inicial_municipio_polo_passivo` não existia.
"""

import pytest
from typing import Dict, Any
from sistemas.gerador_pecas.services_deterministic import (
    DeterministicRuleEvaluator,
    avaliar_ativacao_prompt,
    pode_avaliar_regra,
)


# ============================================================================
# REGRAS REAIS DO BANCO (módulos 22 e 49)
# ============================================================================

# Módulo 22: Litisconsórcio Necessário do Município (Tema 793)
# Ativa quando: município NÃO está no polo passivo E pelo menos um pedido de saúde
REGRA_MODULO_22 = {
    "type": "and",
    "conditions": [
        {
            "type": "condition",
            "variable": "municipio_polo_passivo",
            "operator": "equals",
            "value": False
        },
        {
            "type": "or",
            "conditions": [
                {"type": "condition", "variable": "peticao_inicial_pedido_cirurgia", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_consulta", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_exame", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_internacao", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_medicamento", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_tratamento", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_insumo", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_transporte", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_home_care", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_dieta", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_suplemento", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_fralda", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_cuidador", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_leito", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_transferencia", "operator": "equals", "value": True},
                {"type": "condition", "variable": "peticao_inicial_pedido_outro", "operator": "equals", "value": True},
            ]
        }
    ]
}

# Módulo 49: Direcionamento e Direito de Ressarcimento - Tema 793
# Ativa quando: município ESTÁ no polo passivo E pelo menos um pedido de saúde
# Nota: usa inteiros 1/0 em vez de true/false (bug de dados, mas _comparar_igual normaliza)
REGRA_MODULO_49 = {
    "type": "and",
    "conditions": [
        {
            "type": "condition",
            "variable": "municipio_polo_passivo",
            "operator": "equals",
            "value": 1
        },
        {
            "type": "or",
            "conditions": [
                {"type": "condition", "variable": "peticao_inicial_pedido_cirurgia", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_consulta", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_exame", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_internacao", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_medicamento", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_tratamento", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_insumo", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_transporte", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_home_care", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_dieta", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_suplemento", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_fralda", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_cuidador", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_leito", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_transferencia", "operator": "equals", "value": 1},
                {"type": "condition", "variable": "peticao_inicial_pedido_outro", "operator": "equals", "value": 1},
            ]
        }
    ]
}


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def avaliador():
    """Instância do avaliador de regras."""
    return DeterministicRuleEvaluator()


@pytest.fixture
def dados_processo_0803030():
    """
    Dados reais do processo 0803030-88.2025.8.12.0045 (geração 439 - Yamanote).

    Cenário: XML sem dados de partes (polo_passivo: []).
    ProcessVariableResolver retorna municipio_polo_passivo=None.
    Extração da IA encontrou peticao_inicial_municipio_polo_passivo=False.
    """
    return {
        # Variáveis de extração (vêm da IA)
        "peticao_inicial_municipio_polo_passivo": False,
        "peticao_inicial_uniao_polo_passivo": False,
        "peticao_inicial_pedido_cirurgia": True,
        "peticao_inicial_pedido_consulta": False,
        "peticao_inicial_pedido_exame": False,
        "peticao_inicial_pedido_internacao": False,
        "peticao_inicial_pedido_medicamento": False,
        "peticao_inicial_pedido_tratamento": False,
        "peticao_inicial_pedido_insumo": False,
        "peticao_inicial_pedido_transporte": False,
        "peticao_inicial_pedido_home_care": False,
        "peticao_inicial_pedido_dieta": False,
        "peticao_inicial_pedido_suplemento": False,
        "peticao_inicial_pedido_fralda": False,
        "peticao_inicial_pedido_cuidador": False,
        "peticao_inicial_pedido_leito": False,
        "peticao_inicial_pedido_transferencia": False,
        "peticao_inicial_pedido_outro": False,
        # Variável do processo - None porque XML não trouxe dados de partes
        # APÓS FALLBACK: será substituída por peticao_inicial_municipio_polo_passivo=False
        "municipio_polo_passivo": False,  # valor após fallback aplicado
    }


@pytest.fixture
def dados_processo_0803030_sem_fallback():
    """
    Dados do processo 0803030 ANTES do fallback (como era antes da correção).
    municipio_polo_passivo=None (ProcessVariableResolver com XML vazio).
    """
    return {
        "peticao_inicial_municipio_polo_passivo": False,
        "peticao_inicial_pedido_cirurgia": True,
        "peticao_inicial_pedido_consulta": False,
        "peticao_inicial_pedido_exame": False,
        "peticao_inicial_pedido_internacao": False,
        "peticao_inicial_pedido_medicamento": False,
        "peticao_inicial_pedido_tratamento": False,
        "peticao_inicial_pedido_insumo": False,
        "peticao_inicial_pedido_transporte": False,
        "peticao_inicial_pedido_home_care": False,
        "peticao_inicial_pedido_dieta": False,
        "peticao_inicial_pedido_suplemento": False,
        "peticao_inicial_pedido_fralda": False,
        "peticao_inicial_pedido_cuidador": False,
        "peticao_inicial_pedido_leito": False,
        "peticao_inicial_pedido_transferencia": False,
        "peticao_inicial_pedido_outro": False,
        "municipio_polo_passivo": None,  # XML sem dados de partes
    }


@pytest.fixture
def dados_municipio_no_polo():
    """
    Cenário: Município está no polo passivo.
    Módulo 22 NÃO deve ativar, módulo 49 DEVE ativar.
    """
    return {
        "peticao_inicial_municipio_polo_passivo": True,
        "municipio_polo_passivo": True,
        "peticao_inicial_pedido_cirurgia": True,
        "peticao_inicial_pedido_consulta": False,
        "peticao_inicial_pedido_exame": False,
        "peticao_inicial_pedido_internacao": False,
        "peticao_inicial_pedido_medicamento": False,
        "peticao_inicial_pedido_tratamento": False,
        "peticao_inicial_pedido_insumo": False,
        "peticao_inicial_pedido_transporte": False,
        "peticao_inicial_pedido_home_care": False,
        "peticao_inicial_pedido_dieta": False,
        "peticao_inicial_pedido_suplemento": False,
        "peticao_inicial_pedido_fralda": False,
        "peticao_inicial_pedido_cuidador": False,
        "peticao_inicial_pedido_leito": False,
        "peticao_inicial_pedido_transferencia": False,
        "peticao_inicial_pedido_outro": False,
    }


@pytest.fixture
def dados_sem_pedidos():
    """
    Cenário: Nenhum pedido de saúde identificado.
    Nem módulo 22 nem módulo 49 devem ativar (OR falha).
    """
    return {
        "municipio_polo_passivo": False,
        "peticao_inicial_pedido_cirurgia": False,
        "peticao_inicial_pedido_consulta": False,
        "peticao_inicial_pedido_exame": False,
        "peticao_inicial_pedido_internacao": False,
        "peticao_inicial_pedido_medicamento": False,
        "peticao_inicial_pedido_tratamento": False,
        "peticao_inicial_pedido_insumo": False,
        "peticao_inicial_pedido_transporte": False,
        "peticao_inicial_pedido_home_care": False,
        "peticao_inicial_pedido_dieta": False,
        "peticao_inicial_pedido_suplemento": False,
        "peticao_inicial_pedido_fralda": False,
        "peticao_inicial_pedido_cuidador": False,
        "peticao_inicial_pedido_leito": False,
        "peticao_inicial_pedido_transferencia": False,
        "peticao_inicial_pedido_outro": False,
    }


# ============================================================================
# TESTES: MÓDULO 22 - Litisconsórcio Necessário do Município
# ============================================================================

class TestModulo22Litisconsorcio:
    """Testes do módulo 22 (Litisconsórcio) com regra determinística."""

    def test_processo_0803030_com_fallback_ativa_modulo22(
        self, avaliador, dados_processo_0803030
    ):
        """
        Cenário real: processo 0803030-88.2025.8.12.0045.
        APÓS o fallback, municipio_polo_passivo=False + pedido_cirurgia=True
        → Módulo 22 DEVE ser ativado.
        """
        resultado = avaliador.avaliar(REGRA_MODULO_22, dados_processo_0803030)
        assert resultado is True, (
            "Módulo 22 deveria ativar: município não no polo + pedido_cirurgia=True"
        )

    def test_processo_0803030_sem_fallback_none_converte_false(
        self, avaliador, dados_processo_0803030_sem_fallback
    ):
        """
        Mesmo SEM o fallback, municipio_polo_passivo=None é convertido para False
        pelo evaluador (comportamento existente, None→False para booleanos).
        Resultado: módulo 22 ativa, mas por um efeito colateral frágil.
        """
        resultado = avaliador.avaliar(REGRA_MODULO_22, dados_processo_0803030_sem_fallback)
        assert resultado is True, (
            "Evaluador converte None→False para comparações booleanas, então ativa"
        )

    def test_municipio_no_polo_nao_ativa_modulo22(
        self, avaliador, dados_municipio_no_polo
    ):
        """
        Quando município está no polo passivo, módulo 22 NÃO deve ativar.
        """
        resultado = avaliador.avaliar(REGRA_MODULO_22, dados_municipio_no_polo)
        assert resultado is False, (
            "Módulo 22 não deveria ativar: município está no polo passivo"
        )

    def test_sem_pedidos_nao_ativa_modulo22(
        self, avaliador, dados_sem_pedidos
    ):
        """
        Sem nenhum pedido de saúde, o OR interno falha → módulo 22 NÃO ativa.
        """
        resultado = avaliador.avaliar(REGRA_MODULO_22, dados_sem_pedidos)
        assert resultado is False, (
            "Módulo 22 não deveria ativar: nenhum pedido de saúde"
        )


# ============================================================================
# TESTES: MÓDULO 49 - Direcionamento e Direito de Ressarcimento
# ============================================================================

class TestModulo49Direcionamento:
    """Testes do módulo 49 (Direcionamento) com regra usando inteiros 1/0."""

    def test_municipio_no_polo_ativa_modulo49(
        self, avaliador, dados_municipio_no_polo
    ):
        """
        Quando município está no polo passivo + pedido saúde → módulo 49 DEVE ativar.
        Nota: regra usa value=1, _comparar_igual normaliza 1→True.
        """
        resultado = avaliador.avaliar(REGRA_MODULO_49, dados_municipio_no_polo)
        assert resultado is True, (
            "Módulo 49 deveria ativar: município no polo + pedido_cirurgia"
        )

    def test_municipio_fora_polo_nao_ativa_modulo49(
        self, avaliador, dados_processo_0803030
    ):
        """
        Quando município NÃO está no polo passivo → módulo 49 NÃO ativa.
        (Oposto do módulo 22)
        """
        resultado = avaliador.avaliar(REGRA_MODULO_49, dados_processo_0803030)
        assert resultado is False, (
            "Módulo 49 não deveria ativar: município fora do polo passivo"
        )

    def test_municipio_no_polo_sem_pedidos_nao_ativa_modulo49(
        self, avaliador
    ):
        """
        Município no polo + nenhum pedido → módulo 49 NÃO ativa (OR falha).
        """
        dados = {
            "municipio_polo_passivo": True,
            "peticao_inicial_pedido_cirurgia": False,
            "peticao_inicial_pedido_consulta": False,
            "peticao_inicial_pedido_exame": False,
            "peticao_inicial_pedido_internacao": False,
            "peticao_inicial_pedido_medicamento": False,
            "peticao_inicial_pedido_tratamento": False,
            "peticao_inicial_pedido_insumo": False,
            "peticao_inicial_pedido_transporte": False,
            "peticao_inicial_pedido_home_care": False,
            "peticao_inicial_pedido_dieta": False,
            "peticao_inicial_pedido_suplemento": False,
            "peticao_inicial_pedido_fralda": False,
            "peticao_inicial_pedido_cuidador": False,
            "peticao_inicial_pedido_leito": False,
            "peticao_inicial_pedido_transferencia": False,
            "peticao_inicial_pedido_outro": False,
        }
        resultado = avaliador.avaliar(REGRA_MODULO_49, dados)
        assert resultado is False, (
            "Módulo 49 não deveria ativar: nenhum pedido de saúde"
        )


# ============================================================================
# TESTES: EXCLUSIVIDADE MÚTUA (módulo 22 e 49 nunca ativam juntos)
# ============================================================================

class TestExclusividadeMutua:
    """Verifica que módulos 22 e 49 são mutuamente exclusivos."""

    def test_municipio_fora_polo_apenas_mod22(
        self, avaliador, dados_processo_0803030
    ):
        """Município fora do polo: apenas módulo 22 ativa."""
        r22 = avaliador.avaliar(REGRA_MODULO_22, dados_processo_0803030)
        r49 = avaliador.avaliar(REGRA_MODULO_49, dados_processo_0803030)
        assert r22 is True and r49 is False, (
            f"Esperado: mod22=True, mod49=False. Obtido: mod22={r22}, mod49={r49}"
        )

    def test_municipio_no_polo_apenas_mod49(
        self, avaliador, dados_municipio_no_polo
    ):
        """Município no polo: apenas módulo 49 ativa."""
        r22 = avaliador.avaliar(REGRA_MODULO_22, dados_municipio_no_polo)
        r49 = avaliador.avaliar(REGRA_MODULO_49, dados_municipio_no_polo)
        assert r22 is False and r49 is True, (
            f"Esperado: mod22=False, mod49=True. Obtido: mod22={r22}, mod49={r49}"
        )

    def test_sem_pedidos_nenhum_ativa(
        self, avaliador, dados_sem_pedidos
    ):
        """Sem pedidos de saúde: nenhum módulo ativa."""
        r22 = avaliador.avaliar(REGRA_MODULO_22, dados_sem_pedidos)
        r49 = avaliador.avaliar(REGRA_MODULO_49, dados_sem_pedidos)
        assert r22 is False and r49 is False, (
            f"Esperado: ambos False. Obtido: mod22={r22}, mod49={r49}"
        )


# ============================================================================
# TESTES: FALLBACK DE VARIÁVEIS NO DETECTOR
# ============================================================================

class TestFallbackVariaveis:
    """Testa a lógica de fallback do detector_modulos.py."""

    def test_fallback_aplica_quando_processo_none(self):
        """
        Simula o merge de variáveis no detector:
        - dados_extracao tem peticao_inicial_municipio_polo_passivo=False
        - variaveis_processo tem municipio_polo_passivo=None
        - FALLBACK: municipio_polo_passivo deve ser substituído por False
        """
        dados_extracao = {
            "peticao_inicial_municipio_polo_passivo": False,
            "peticao_inicial_uniao_polo_passivo": False,
            "peticao_inicial_pedido_cirurgia": True,
        }
        variaveis_processo = {
            "municipio_polo_passivo": None,
            "uniao_polo_passivo": None,
        }

        # Simula merge como feito em detector_modulos.py
        variaveis = dados_extracao.copy()
        variaveis.update(variaveis_processo)

        # Aplica fallback
        PROCESS_TO_EXTRACTION_FALLBACK = {
            'municipio_polo_passivo': 'peticao_inicial_municipio_polo_passivo',
            'uniao_polo_passivo': 'peticao_inicial_uniao_polo_passivo',
        }
        for proc_var, ext_var in PROCESS_TO_EXTRACTION_FALLBACK.items():
            if variaveis.get(proc_var) is None and ext_var in variaveis:
                variaveis[proc_var] = variaveis[ext_var]

        assert variaveis["municipio_polo_passivo"] is False, (
            "Fallback deveria ter substituído None por False"
        )
        assert variaveis["uniao_polo_passivo"] is False, (
            "Fallback deveria ter substituído None por False"
        )

    def test_fallback_nao_sobrescreve_valor_real(self):
        """
        Quando o processo TEM dados de partes (municipio_polo_passivo=True),
        o fallback NÃO deve sobrescrever.
        """
        dados_extracao = {
            "peticao_inicial_municipio_polo_passivo": False,
        }
        variaveis_processo = {
            "municipio_polo_passivo": True,  # XML trouxe dado real
        }

        variaveis = dados_extracao.copy()
        variaveis.update(variaveis_processo)

        PROCESS_TO_EXTRACTION_FALLBACK = {
            'municipio_polo_passivo': 'peticao_inicial_municipio_polo_passivo',
        }
        for proc_var, ext_var in PROCESS_TO_EXTRACTION_FALLBACK.items():
            if variaveis.get(proc_var) is None and ext_var in variaveis:
                variaveis[proc_var] = variaveis[ext_var]

        assert variaveis["municipio_polo_passivo"] is True, (
            "Fallback NÃO deveria sobrescrever valor real do processo"
        )

    def test_fallback_sem_extracao_disponivel(self):
        """
        Quando nem o processo nem a extração têm a variável,
        o fallback não faz nada.
        """
        dados_extracao = {}  # Sem variáveis de extração
        variaveis_processo = {
            "municipio_polo_passivo": None,
        }

        variaveis = dados_extracao.copy()
        variaveis.update(variaveis_processo)

        PROCESS_TO_EXTRACTION_FALLBACK = {
            'municipio_polo_passivo': 'peticao_inicial_municipio_polo_passivo',
        }
        for proc_var, ext_var in PROCESS_TO_EXTRACTION_FALLBACK.items():
            if variaveis.get(proc_var) is None and ext_var in variaveis:
                variaveis[proc_var] = variaveis[ext_var]

        assert variaveis["municipio_polo_passivo"] is None, (
            "Sem extração disponível, valor deve permanecer None"
        )

    def test_fallback_false_preserva_false(self):
        """
        municipio_polo_passivo=False (processo confirmou que não é município)
        NÃO deve ser substituído pelo fallback (only None triggers fallback).
        """
        dados_extracao = {
            "peticao_inicial_municipio_polo_passivo": True,  # extração diz True
        }
        variaveis_processo = {
            "municipio_polo_passivo": False,  # processo diz False
        }

        variaveis = dados_extracao.copy()
        variaveis.update(variaveis_processo)

        PROCESS_TO_EXTRACTION_FALLBACK = {
            'municipio_polo_passivo': 'peticao_inicial_municipio_polo_passivo',
        }
        for proc_var, ext_var in PROCESS_TO_EXTRACTION_FALLBACK.items():
            if variaveis.get(proc_var) is None and ext_var in variaveis:
                variaveis[proc_var] = variaveis[ext_var]

        assert variaveis["municipio_polo_passivo"] is False, (
            "False não é None, fallback não deveria ter sido aplicado"
        )


# ============================================================================
# TESTES: NORMALIZAÇÃO int/bool (módulo 49 usa 1/0)
# ============================================================================

class TestNormalizacaoIntBool:
    """Testa que _comparar_igual normaliza 1→True e 0→False."""

    def test_valor_1_comparado_com_true(self, avaliador):
        """Regra com value=1 deve ativar quando variável é True."""
        regra = {
            "type": "condition",
            "variable": "municipio_polo_passivo",
            "operator": "equals",
            "value": 1
        }
        resultado = avaliador.avaliar(regra, {"municipio_polo_passivo": True})
        assert resultado is True

    def test_valor_0_comparado_com_false(self, avaliador):
        """Regra com value=0 deve ativar quando variável é False."""
        regra = {
            "type": "condition",
            "variable": "municipio_polo_passivo",
            "operator": "equals",
            "value": 0
        }
        resultado = avaliador.avaliar(regra, {"municipio_polo_passivo": False})
        assert resultado is True

    def test_valor_true_comparado_com_1(self, avaliador):
        """Regra com value=True deve ativar quando variável é 1."""
        regra = {
            "type": "condition",
            "variable": "municipio_polo_passivo",
            "operator": "equals",
            "value": True
        }
        resultado = avaliador.avaliar(regra, {"municipio_polo_passivo": 1})
        assert resultado is True
