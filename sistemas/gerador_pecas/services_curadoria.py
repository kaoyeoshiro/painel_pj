# sistemas/gerador_pecas/services_curadoria.py
"""
Servico de Curadoria de Argumentos para o Modo Semi-Automatico.

Este servico permite que usuarios:
1. Visualizem os argumentos detectados automaticamente pelo Agente 2
2. Adicionem/removam argumentos da lista final
3. Reorganizem argumentos entre secoes (Preliminar, Merito, etc.)
4. Busquem argumentos adicionais via texto ou semantica
5. Gerem a peca com os argumentos curados

O Agente 3 permanece INALTERADO - apenas recebe o prompt curado.
"""

import json
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from sqlalchemy.orm import Session

from admin.models_prompts import PromptModulo
from sistemas.gerador_pecas.services_busca_argumentos import buscar_argumentos_relevantes
from sistemas.gerador_pecas.services_busca_vetorial import (
    buscar_argumentos_vetorial,
    buscar_argumentos_hibrido
)


class OrigemAtivacao(str, Enum):
    """Origem da ativacao do modulo."""
    DETERMINISTIC = "deterministic"
    LLM = "llm"
    MANUAL = "manual"  # Adicionado pelo usuario no modo semi-automatico


class CategoriaSecao(str, Enum):
    """Categorias/secoes da peca juridica."""
    PRELIMINAR = "Preliminar"
    MERITO = "Mérito"
    EVENTUALIDADE = "Eventualidade"
    HONORARIOS = "Honorários"
    PEDIDOS = "Pedidos"
    OUTROS = "Outros"


# Ordem padrao das secoes
ORDEM_SECOES = {
    CategoriaSecao.PRELIMINAR: 0,
    CategoriaSecao.MERITO: 1,
    CategoriaSecao.EVENTUALIDADE: 2,
    CategoriaSecao.HONORARIOS: 3,
    CategoriaSecao.PEDIDOS: 4,
    CategoriaSecao.OUTROS: 99,
}


@dataclass
class ModuloCurado:
    """Representa um modulo de argumento na curadoria."""
    id: int
    nome: str
    titulo: str
    categoria: str  # Secao onde esta o argumento
    subcategoria: Optional[str] = None
    condicao_ativacao: Optional[str] = None
    conteudo: str = ""
    ordem: int = 0

    # Metadados de curadoria
    origem_ativacao: str = OrigemAtivacao.LLM.value
    validado: bool = False  # True se foi selecionado/validado pelo usuario
    selecionado: bool = True  # True se esta incluido na geracao

    # Para argumentos adicionados manualmente via busca
    score_busca: Optional[float] = None
    metodo_busca: Optional[str] = None

    def to_dict(self) -> Dict:
        """Converte para dicionario."""
        return asdict(self)

    @classmethod
    def from_prompt_modulo(
        cls,
        modulo: PromptModulo,
        origem: OrigemAtivacao = OrigemAtivacao.LLM,
        validado: bool = False
    ) -> "ModuloCurado":
        """Cria ModuloCurado a partir de um PromptModulo."""
        # Normaliza categoria: usa a do módulo se existir e não for vazia, senão usa "Outros"
        categoria_raw = modulo.categoria.strip() if modulo.categoria else ""
        categoria = categoria_raw if categoria_raw else CategoriaSecao.OUTROS.value

        return cls(
            id=modulo.id,
            nome=modulo.nome,
            titulo=modulo.titulo,
            categoria=categoria,
            subcategoria=modulo.subcategoria,
            condicao_ativacao=modulo.condicao_ativacao,
            conteudo=modulo.conteudo,
            ordem=modulo.ordem or 0,
            origem_ativacao=origem.value,
            validado=validado,
            selecionado=True
        )


@dataclass
class ResultadoCuradoria:
    """Resultado da fase de curadoria (pre-Agente 3)."""
    numero_processo: str
    tipo_peca: str

    # Modulos organizados por secao
    modulos_por_secao: Dict[str, List[ModuloCurado]] = field(default_factory=dict)

    # Dados do processo (do Agente 1)
    resumo_consolidado: str = ""
    dados_processo: Optional[Dict] = None
    dados_extracao: Optional[Dict] = None

    # Estatisticas
    total_modulos: int = 0
    modulos_det: int = 0  # Ativados deterministicamente
    modulos_llm: int = 0  # Ativados por LLM
    modulos_manual: int = 0  # Adicionados manualmente

    def to_dict(self) -> Dict:
        """Converte para dicionario serializavel."""
        modulos_dict = {}
        for secao, modulos in self.modulos_por_secao.items():
            modulos_dict[secao] = [m.to_dict() for m in modulos]

        return {
            "numero_processo": self.numero_processo,
            "tipo_peca": self.tipo_peca,
            "modulos_por_secao": modulos_dict,
            "resumo_consolidado": self.resumo_consolidado,
            "dados_processo": self.dados_processo,
            "dados_extracao": self.dados_extracao,
            "estatisticas": {
                "total_modulos": self.total_modulos,
                "modulos_det": self.modulos_det,
                "modulos_llm": self.modulos_llm,
                "modulos_manual": self.modulos_manual,
            }
        }

    def get_todos_modulos(self) -> List[ModuloCurado]:
        """Retorna todos os modulos de todas as secoes."""
        todos = []
        for modulos in self.modulos_por_secao.values():
            todos.extend(modulos)
        return todos

    def get_modulos_selecionados(self) -> List[ModuloCurado]:
        """Retorna apenas modulos selecionados para geracao."""
        return [m for m in self.get_todos_modulos() if m.selecionado]

    def get_ids_selecionados(self) -> List[int]:
        """Retorna IDs dos modulos selecionados."""
        return [m.id for m in self.get_modulos_selecionados()]


class ServicoCuradoria:
    """Servico principal para curadoria de argumentos."""

    def __init__(self, db: Session):
        self.db = db

    def criar_resultado_curadoria(
        self,
        numero_processo: str,
        tipo_peca: str,
        modulos_ids: List[int],
        ids_det: List[int],
        ids_llm: List[int],
        resumo_consolidado: str,
        dados_processo: Optional[Dict] = None,
        dados_extracao: Optional[Dict] = None,
        group_id: Optional[int] = None
    ) -> ResultadoCuradoria:
        """
        Cria resultado de curadoria a partir da deteccao do Agente 2.

        Args:
            numero_processo: Numero CNJ do processo
            tipo_peca: Tipo de peca (contestacao, recurso, etc.)
            modulos_ids: IDs de todos os modulos detectados
            ids_det: IDs dos modulos ativados deterministicamente
            ids_llm: IDs dos modulos ativados por LLM
            resumo_consolidado: Resumo do Agente 1
            dados_processo: Dados estruturados do processo
            dados_extracao: Variaveis extraidas dos documentos
            group_id: ID do grupo de prompts (para filtrar)

        Returns:
            ResultadoCuradoria pronto para exibicao no frontend
        """
        # Carrega modulos do banco
        query = self.db.query(PromptModulo).filter(
            PromptModulo.id.in_(modulos_ids),
            PromptModulo.tipo == "conteudo",
            PromptModulo.ativo == True
        )

        if group_id:
            query = query.filter(PromptModulo.group_id == group_id)

        modulos_db = query.order_by(PromptModulo.categoria, PromptModulo.ordem).all()

        # Organiza por secao
        modulos_por_secao: Dict[str, List[ModuloCurado]] = {}

        for modulo in modulos_db:
            # Determina origem da ativacao
            if modulo.id in ids_det:
                origem = OrigemAtivacao.DETERMINISTIC
                validado = True  # Deterministico = validado automaticamente
            else:
                origem = OrigemAtivacao.LLM
                validado = False

            modulo_curado = ModuloCurado.from_prompt_modulo(modulo, origem, validado)

            secao = modulo_curado.categoria
            if secao not in modulos_por_secao:
                modulos_por_secao[secao] = []
            modulos_por_secao[secao].append(modulo_curado)

        # Ordena secoes
        secoes_ordenadas = sorted(
            modulos_por_secao.keys(),
            key=lambda s: ORDEM_SECOES.get(CategoriaSecao(s), 99) if s in [e.value for e in CategoriaSecao] else 99
        )
        modulos_ordenados = {s: modulos_por_secao[s] for s in secoes_ordenadas}

        return ResultadoCuradoria(
            numero_processo=numero_processo,
            tipo_peca=tipo_peca,
            modulos_por_secao=modulos_ordenados,
            resumo_consolidado=resumo_consolidado,
            dados_processo=dados_processo,
            dados_extracao=dados_extracao,
            total_modulos=len(modulos_db),
            modulos_det=len([m for m in modulos_db if m.id in ids_det]),
            modulos_llm=len([m for m in modulos_db if m.id in ids_llm]),
            modulos_manual=0
        )

    async def buscar_argumentos_adicionais(
        self,
        query: str,
        tipo_peca: Optional[str] = None,
        modulos_excluir: Optional[List[int]] = None,
        limit: int = 10,
        metodo: str = "hibrido"
    ) -> List[ModuloCurado]:
        """
        Busca argumentos adicionais para adicionar na curadoria.

        Args:
            query: Texto de busca do usuario
            tipo_peca: Tipo de peca para contexto
            modulos_excluir: IDs de modulos ja selecionados (para nao repetir)
            limit: Numero maximo de resultados
            metodo: "keyword", "vetorial" ou "hibrido"

        Returns:
            Lista de ModuloCurado encontrados na busca
        """
        modulos_excluir = modulos_excluir or []

        if metodo == "keyword":
            resultados = buscar_argumentos_relevantes(
                self.db, query, tipo_peca, limit=limit + len(modulos_excluir)
            )
        elif metodo == "vetorial":
            resultados = await buscar_argumentos_vetorial(
                self.db, query, tipo_peca, limit=limit + len(modulos_excluir)
            )
        else:  # hibrido
            resultados = await buscar_argumentos_hibrido(
                self.db, query, tipo_peca, limit=limit + len(modulos_excluir)
            )

        # Filtra modulos ja selecionados e converte para ModuloCurado
        modulos_curados = []
        for r in resultados:
            if r["id"] in modulos_excluir:
                continue

            modulo_curado = ModuloCurado(
                id=r["id"],
                nome=r.get("nome", ""),
                titulo=r["titulo"],
                categoria=r.get("categoria", CategoriaSecao.OUTROS.value),
                subcategoria=r.get("subcategoria"),
                condicao_ativacao=r.get("condicao_ativacao"),
                conteudo=r.get("conteudo", ""),
                ordem=0,
                origem_ativacao=OrigemAtivacao.MANUAL.value,
                validado=True,  # Adicionado manualmente = validado
                selecionado=False,  # Nao selecionado ate usuario clicar
                score_busca=r.get("score"),
                metodo_busca=r.get("metodo_busca") or r.get("fonte") or metodo
            )
            modulos_curados.append(modulo_curado)

            if len(modulos_curados) >= limit:
                break

        return modulos_curados

    def montar_prompt_curado(
        self,
        resultado_curadoria: ResultadoCuradoria,
        prompt_sistema: str,
        prompt_peca: str
    ) -> str:
        """
        Monta o prompt de conteudo curado para enviar ao Agente 3.

        MODO SEMI-AUTOMÁTICO: Todos os modulos selecionados recebem tag [HUMAN_VALIDATED]
        indicando que foram validados pelo usuário e DEVEM ser incluídos integralmente.

        Args:
            resultado_curadoria: Resultado da curadoria com modulos selecionados
            prompt_sistema: Prompt base do sistema
            prompt_peca: Prompt do tipo de peca

        Returns:
            Prompt de conteudo formatado para Agente 3
        """
        partes = ["## ARGUMENTOS E TESES APLICAVEIS (HUMAN_VALIDATED)\n"]
        partes.append("> **INSTRUÇÃO OBRIGATÓRIA**: Os argumentos marcados com [HUMAN_VALIDATED] foram\n")
        partes.append("> validados pelo usuário e DEVEM ser incluídos integralmente na peça final.\n")
        partes.append("> Não aplique juízo de valor ou modifique o conteúdo - apenas sanitização técnica se necessária.\n")

        for secao, modulos in resultado_curadoria.modulos_por_secao.items():
            modulos_selecionados = [m for m in modulos if m.selecionado]

            if not modulos_selecionados:
                continue

            partes.append(f"\n### === {secao.upper()} ===\n")

            for modulo in modulos_selecionados:
                subcategoria_info = f" ({modulo.subcategoria})" if modulo.subcategoria else ""

                # HUMAN_VALIDATED: Tag obrigatória para todos os módulos no modo semi-automático
                if modulo.origem_ativacao == OrigemAtivacao.MANUAL.value:
                    marcacao = " [HUMAN_VALIDATED:MANUAL]"
                else:
                    marcacao = " [HUMAN_VALIDATED]"

                partes.append(f"#### {modulo.titulo}{subcategoria_info}{marcacao}\n")
                partes.append(f"{modulo.conteudo}\n")

        return "\n".join(partes)

    def aplicar_alteracoes_curadoria(
        self,
        resultado: ResultadoCuradoria,
        alteracoes: Dict[str, Any]
    ) -> ResultadoCuradoria:
        """
        Aplica alteracoes do frontend na curadoria.

        Args:
            resultado: ResultadoCuradoria atual
            alteracoes: Dicionario com alteracoes do frontend
                {
                    "modulos_selecionados": [id1, id2, ...],
                    "modulos_removidos": [id3, ...],
                    "modulos_movidos": {id: "nova_secao", ...},
                    "ordem_secoes": {"Preliminar": [id1, id2], "Mérito": [id3], ...}
                }

        Returns:
            ResultadoCuradoria atualizado
        """
        modulos_selecionados = set(alteracoes.get("modulos_selecionados", []))
        modulos_removidos = set(alteracoes.get("modulos_removidos", []))
        modulos_movidos = alteracoes.get("modulos_movidos", {})
        ordem_secoes = alteracoes.get("ordem_secoes", {})

        # Aplica selecao/desselecao
        for secao, modulos in resultado.modulos_por_secao.items():
            for modulo in modulos:
                if modulo.id in modulos_removidos:
                    modulo.selecionado = False
                elif modulo.id in modulos_selecionados:
                    modulo.selecionado = True
                    modulo.validado = True

        # Aplica movimentacoes entre secoes
        if modulos_movidos:
            # Remove modulos das secoes atuais
            todos_modulos = {m.id: m for m in resultado.get_todos_modulos()}

            for modulo_id_str, nova_secao in modulos_movidos.items():
                modulo_id = int(modulo_id_str)
                if modulo_id in todos_modulos:
                    modulo = todos_modulos[modulo_id]

                    # Remove da secao atual
                    if modulo.categoria in resultado.modulos_por_secao:
                        resultado.modulos_por_secao[modulo.categoria] = [
                            m for m in resultado.modulos_por_secao[modulo.categoria]
                            if m.id != modulo_id
                        ]

                    # Adiciona na nova secao
                    modulo.categoria = nova_secao
                    if nova_secao not in resultado.modulos_por_secao:
                        resultado.modulos_por_secao[nova_secao] = []
                    resultado.modulos_por_secao[nova_secao].append(modulo)

        # Aplica reordenacao dentro das secoes
        if ordem_secoes:
            for secao, ids_ordenados in ordem_secoes.items():
                if secao in resultado.modulos_por_secao:
                    modulos_secao = {m.id: m for m in resultado.modulos_por_secao[secao]}
                    novos_modulos = []

                    for i, modulo_id in enumerate(ids_ordenados):
                        if modulo_id in modulos_secao:
                            modulo = modulos_secao[modulo_id]
                            modulo.ordem = i
                            novos_modulos.append(modulo)

                    # Adiciona modulos que nao estavam na ordem (mantendo ordem original)
                    for modulo in resultado.modulos_por_secao[secao]:
                        if modulo.id not in ids_ordenados:
                            novos_modulos.append(modulo)

                    resultado.modulos_por_secao[secao] = novos_modulos

        # Atualiza estatisticas
        resultado.modulos_manual = len([
            m for m in resultado.get_todos_modulos()
            if m.origem_ativacao == OrigemAtivacao.MANUAL.value and m.selecionado
        ])

        return resultado

    def adicionar_modulo_manual(
        self,
        resultado: ResultadoCuradoria,
        modulo_id: int,
        secao_destino: Optional[str] = None
    ) -> ResultadoCuradoria:
        """
        Adiciona um modulo manualmente (via busca) na curadoria.

        Args:
            resultado: ResultadoCuradoria atual
            modulo_id: ID do modulo a adicionar
            secao_destino: Secao onde adicionar (usa categoria do modulo se nao especificado)

        Returns:
            ResultadoCuradoria atualizado
        """
        # Verifica se ja existe
        ids_existentes = [m.id for m in resultado.get_todos_modulos()]
        if modulo_id in ids_existentes:
            # Apenas marca como selecionado
            for modulos in resultado.modulos_por_secao.values():
                for m in modulos:
                    if m.id == modulo_id:
                        m.selecionado = True
                        m.validado = True
                        return resultado
            return resultado

        # Carrega modulo do banco
        modulo_db = self.db.query(PromptModulo).filter(
            PromptModulo.id == modulo_id,
            PromptModulo.tipo == "conteudo",
            PromptModulo.ativo == True
        ).first()

        if not modulo_db:
            return resultado

        # Cria ModuloCurado
        modulo_curado = ModuloCurado.from_prompt_modulo(
            modulo_db,
            origem=OrigemAtivacao.MANUAL,
            validado=True
        )
        modulo_curado.selecionado = True

        # Determina secao
        secao = secao_destino or modulo_curado.categoria
        if secao not in resultado.modulos_por_secao:
            resultado.modulos_por_secao[secao] = []

        resultado.modulos_por_secao[secao].append(modulo_curado)
        resultado.total_modulos += 1
        resultado.modulos_manual += 1

        return resultado


# ========================================
# AUDITORIA CAUSAL - Explicações de Decisão
# ========================================

REASON_CODES = {
    # Para MANUAL_INCLUIDO (por que não ativou):
    "CONDITION_FALSE": "Condicao deterministica nao atendida",
    "MISSING_INPUT": "Variaveis necessarias nao disponiveis",
    "NOT_EVALUATED": "Modulo nao avaliado pelo sistema (sem regra configurada)",
    "LLM_NOT_SELECTED": "IA nao selecionou este modulo na analise automatica",
    # Para MANUAL_EXCLUIDO (por que ativou):
    "EXPECTED_MATCH": "Ativacao legitima - condicao atendida pelos dados",
    "LLM_SELECTED": "IA selecionou com base na analise dos documentos",
}


def _extrair_vars_e_valores(trace: Dict, variaveis_snapshot: Dict) -> Dict:
    """Extrai variáveis usadas na regra e seus valores do snapshot."""
    inputs = {}
    for regra_avaliada in trace.get("regras_avaliadas", []):
        for var_name in regra_avaliada.get("variaveis", []):
            inputs[var_name] = variaveis_snapshot.get(var_name, "<<AUSENTE>>")
    return inputs


def _extrair_checks_de_trace(trace: Dict) -> tuple:
    """
    Extrai checks granulares (satisfied/not_satisfied) das regras avaliadas.

    Returns:
        Tupla (checks_satisfied, checks_not_satisfied, evaluation_strategy)
    """
    checks_satisfied = []
    checks_not_satisfied = []
    eval_mode = None
    short_circuit = None

    for regra in trace.get("regras_avaliadas", []):
        checks = regra.get("checks", [])
        if not checks:
            continue
        # Pega evaluation_mode e short_circuit da primeira regra que tiver
        if eval_mode is None:
            eval_mode = regra.get("evaluation_mode")
            short_circuit = regra.get("short_circuit")

        for check in checks:
            result = check.get("result")
            if result is True:
                checks_satisfied.append(check)
            elif result is False:
                checks_not_satisfied.append(check)
            # result=None = não avaliado (short-circuit) -> vai para not_satisfied com nota
            elif result is None:
                checks_not_satisfied.append(check)

    evaluation_strategy = {
        "mode": eval_mode,
        "short_circuit": short_circuit,
    }

    return checks_satisfied, checks_not_satisfied, evaluation_strategy


def _resolve_final_decision(origem: str, status_final: str, trace: Dict) -> str:
    """Determina o final_decision enum."""
    ativar = trace.get("ativar") if trace else None
    regra_usada = trace.get("regra_usada", "") if trace else ""

    if origem == "manual" and status_final == "incluido":
        return "MANUAL_OVERRIDE_INCLUDE"
    if origem == "preview" and status_final == "excluido":
        return "MANUAL_OVERRIDE_EXCLUDE"

    if ativar is True:
        if regra_usada and "secundaria" in regra_usada:
            return "ACTIVE_FALLBACK"
        return "ACTIVE"
    if ativar is False:
        return "INACTIVE"

    return "ACTIVE"  # Fallback para confirmados


def _enrich_result(result: Dict, trace: Dict, origem: str, status_final: str) -> Dict:
    """Enriquece resultado com checks granulares e final_decision."""
    if trace and trace.get("modo_avaliacao") != "llm":
        satisfied, not_satisfied, strategy = _extrair_checks_de_trace(trace)
        regra_usada = trace.get("regra_usada", "")
        strategy["fallback_applied"] = bool(regra_usada and "secundaria" in regra_usada)
        result["checks_satisfied"] = satisfied
        result["checks_not_satisfied"] = not_satisfied
        result["evaluation_strategy"] = strategy
    else:
        result["checks_satisfied"] = []
        result["checks_not_satisfied"] = []
        result["evaluation_strategy"] = {"mode": None, "short_circuit": None, "fallback_applied": False}

    result["final_decision"] = _resolve_final_decision(origem, status_final, trace)
    return result


def gerar_explicacao_modulo(
    module_id: int,
    origem: str,
    status_final: str,
    decision_traces: Dict,
    variaveis_snapshot: Dict,
) -> Dict:
    """
    Gera explicação causal para um módulo com checks granulares.

    Args:
        module_id: ID do módulo
        origem: "manual" | "preview"
        status_final: "incluido" | "excluido"
        decision_traces: Traces capturados durante o preview
        variaveis_snapshot: Snapshot das variáveis no momento da avaliação

    Returns:
        Dict com reason_code, reason_human, inputs_used, evaluation_result,
        checks_satisfied, checks_not_satisfied, evaluation_strategy, final_decision
    """
    trace = decision_traces.get(str(module_id)) or decision_traces.get(module_id)

    if origem == "manual" and status_final == "incluido":
        # MANUAL_INCLUIDO: por que o sistema não ativou
        if not trace:
            return _enrich_result({
                "reason_code": "NOT_EVALUATED",
                "reason_human": "Este modulo nao foi avaliado pelo sistema durante o preview",
                "inputs_used": {},
                "evaluation_result": None,
            }, trace, origem, status_final)

        if trace.get("modo_avaliacao") == "llm":
            return _enrich_result({
                "reason_code": "LLM_NOT_SELECTED",
                "reason_human": f"A IA analisou os documentos mas nao selecionou este modulo. Condicao configurada: {trace.get('detalhes', 'N/A')}",
                "inputs_used": {},
                "evaluation_result": False,
            }, trace, origem, status_final)

        # Determinístico - analisar por que deu False/None
        vars_da_regra = _extrair_vars_e_valores(trace, variaveis_snapshot)

        if trace.get("variaveis_faltantes"):
            return _enrich_result({
                "reason_code": "MISSING_INPUT",
                "reason_human": f"Variaveis ausentes: {', '.join(trace['variaveis_faltantes'])}",
                "rule_name": trace.get("regra_usada"),
                "evaluation_result": trace.get("ativar"),
                "inputs_used": vars_da_regra,
                "regras_avaliadas": trace.get("regras_avaliadas", []),
            }, trace, origem, status_final)

        return _enrich_result({
            "reason_code": "CONDITION_FALSE",
            "reason_human": f"Regra: {trace.get('regra_usada', 'N/A')}. {trace.get('detalhes', '')}",
            "rule_name": trace.get("regra_usada"),
            "evaluation_result": trace.get("ativar"),
            "inputs_used": vars_da_regra,
            "regras_avaliadas": trace.get("regras_avaliadas", []),
        }, trace, origem, status_final)

    elif origem == "preview" and status_final == "excluido":
        # MANUAL_EXCLUIDO: por que o sistema sugeriu
        if trace and trace.get("modo_avaliacao") == "llm":
            return _enrich_result({
                "reason_code": "LLM_SELECTED",
                "reason_human": f"IA selecionou com base na analise. Condicao: {trace.get('detalhes', 'N/A')}",
                "inputs_used": {},
                "evaluation_result": True,
            }, trace, origem, status_final)

        if trace:
            vars_da_regra = _extrair_vars_e_valores(trace, variaveis_snapshot)
            return _enrich_result({
                "reason_code": "EXPECTED_MATCH",
                "reason_human": f"Regra '{trace.get('regra_usada')}' atendida. {trace.get('detalhes', '')}",
                "rule_name": trace.get("regra_usada"),
                "evaluation_result": True,
                "inputs_used": vars_da_regra,
                "regras_avaliadas": trace.get("regras_avaliadas", []),
            }, trace, origem, status_final)

        return _enrich_result({
            "reason_code": "NOT_EVALUATED",
            "reason_human": "Sem dados de avaliacao disponiveis",
            "inputs_used": {},
            "evaluation_result": None,
        }, trace, origem, status_final)

    # Fallback para módulos confirmados (preview + incluido)
    if trace:
        vars_da_regra = _extrair_vars_e_valores(trace, variaveis_snapshot)
        modo = trace.get("modo_avaliacao", "desconhecido")
        if modo == "llm":
            return _enrich_result({
                "reason_code": "LLM_SELECTED",
                "reason_human": f"IA selecionou e usuario confirmou. Condicao: {trace.get('detalhes', 'N/A')}",
                "inputs_used": {},
                "evaluation_result": True,
            }, trace, origem, status_final)
        return _enrich_result({
            "reason_code": "EXPECTED_MATCH",
            "reason_human": f"Regra '{trace.get('regra_usada')}' atendida e confirmada pelo usuario. {trace.get('detalhes', '')}",
            "rule_name": trace.get("regra_usada"),
            "evaluation_result": True,
            "inputs_used": vars_da_regra,
            "regras_avaliadas": trace.get("regras_avaliadas", []),
        }, trace, origem, status_final)

    return _enrich_result({
        "reason_code": "EXPECTED_MATCH",
        "reason_human": "Sugerido pelo sistema e confirmado pelo usuario",
        "inputs_used": {},
        "evaluation_result": None,
    }, trace, origem, status_final)
