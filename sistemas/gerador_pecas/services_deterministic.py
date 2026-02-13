"""
Servicos de regras deterministicas — orquestracao e funcoes de ativacao.

Classes foram extraidas para sub-arquivos (Fase 5b):
- services_rule_evaluator.py  — DeterministicRuleEvaluator
- services_rule_generator.py  — DeterministicRuleGenerator
- services_mode_resolution.py — Resolucao de modo de ativacao
- services_rule_integrity.py  — RuleIntegrityValidator
"""

import json
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from .models_extraction import ExtractionVariable, PromptVariableUsage

logger = logging.getLogger(__name__)


# Re-exports das classes extraidas (manter compatibilidade de imports)
from .services_mode_resolution import (  # noqa: F401
    tem_regras_deterministicas,
    resolve_activation_mode,
    resolve_activation_mode_from_db,
    corrigir_modos_ativacao_inconsistentes,
    _get_config_sistemas_acessorios,
)

from .services_rule_generator import (  # noqa: F401
    DeterministicRuleGenerator,
    GEMINI_MODEL_DEFAULT,
)

from .services_rule_evaluator import DeterministicRuleEvaluator  # noqa: F401

from .services_rule_integrity import (  # noqa: F401
    RuleIntegrityValidator,
    validar_integridade_regras_modulo,
    validar_integridade_todas_regras,
)


class PromptVariableUsageSync:
    """
    Sincronizador de uso de variáveis em prompts.

    Atualiza automaticamente a tabela de uso quando regras são modificadas.
    """

    def __init__(self, db: Session):
        self.db = db

    def atualizar_uso(
        self,
        prompt_id: int,
        regra: Optional[Dict],
        regra_secundaria: Optional[Dict] = None
    ) -> List[str]:
        """
        Atualiza o registro de variáveis usadas por um prompt.

        Args:
            prompt_id: ID do prompt
            regra: AST JSON da regra PRIMÁRIA (ou None se modo LLM)
            regra_secundaria: AST JSON da regra SECUNDÁRIA/fallback (opcional)

        Returns:
            Lista de slugs de variáveis usadas (primária + secundária)
        """
        # Remove registros anteriores
        self.db.query(PromptVariableUsage).filter(
            PromptVariableUsage.prompt_id == prompt_id
        ).delete()

        variaveis = set()

        # Extrai variáveis da regra primária
        if regra:
            variaveis.update(self._extrair_variaveis(regra))

        # Extrai variáveis da regra secundária
        if regra_secundaria:
            variaveis.update(self._extrair_variaveis(regra_secundaria))

        if not variaveis:
            self.db.commit()
            return []

        # Cria novos registros
        for slug in variaveis:
            uso = PromptVariableUsage(
                prompt_id=prompt_id,
                variable_slug=slug
            )
            self.db.add(uso)

        self.db.commit()
        return list(variaveis)

    def _extrair_variaveis(self, no: Dict, variaveis: Set[str] = None) -> Set[str]:
        """Extrai todas as variáveis usadas em uma regra."""
        if variaveis is None:
            variaveis = set()

        tipo = no.get("type")

        if tipo == "condition":
            var = no.get("variable")
            if var:
                variaveis.add(var)

        elif tipo in ("and", "or", "not"):
            for cond in no.get("conditions", []):
                self._extrair_variaveis(cond, variaveis)

        return variaveis

    def obter_prompts_por_variavel(self, variable_slug: str) -> List[Dict]:
        """
        Retorna todos os prompts que usam uma variável específica.
        """
        from admin.models_prompts import PromptModulo

        usos = self.db.query(PromptVariableUsage).filter(
            PromptVariableUsage.variable_slug == variable_slug
        ).all()

        prompt_ids = [u.prompt_id for u in usos]

        if not prompt_ids:
            return []

        prompts = self.db.query(PromptModulo).filter(
            PromptModulo.id.in_(prompt_ids)
        ).all()

        return [
            {
                "id": p.id,
                "nome": p.nome,
                "titulo": p.titulo,
                "tipo": p.tipo,
                "modo_ativacao": p.modo_ativacao,
                "ativo": p.ativo
            }
            for p in prompts
        ]


def verificar_variaveis_existem(regra: Dict, dados: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Verifica se TODAS as variáveis usadas na regra EXISTEM nos dados.

    IMPORTANTE: Distingue entre:
    - Variável inexistente (chave não presente no dict) -> retorna False
    - Variável existente com valor False/None -> retorna True

    NOTA: Para regras OR, use pode_avaliar_regra() que é mais inteligente
    e permite avaliação quando pelo menos UMA variável existe.

    Args:
        regra: AST JSON da regra
        dados: Dicionário com dados extraídos

    Returns:
        Tupla (todas_existem, lista_variaveis_usadas)
    """
    variaveis = _extrair_variaveis_regra(regra)
    todas_existem = all(var in dados for var in variaveis)
    return todas_existem, list(variaveis)


def pode_avaliar_regra(regra: Dict, dados: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
    """
    Verifica INTELIGENTEMENTE se uma regra pode ser avaliada considerando
    a estrutura OR/AND da regra.

    LÓGICA:
    - OR: Pode avaliar se PELO MENOS UMA condição/ramo pode ser avaliado
    - AND: Pode avaliar se TODAS as condições/ramos podem ser avaliados
    - NOT: Pode avaliar se a condição interna pode ser avaliada
    - condition: Pode avaliar se a variável existe nos dados

    IMPORTANTE: Para regras OR, variáveis ausentes são tratadas como False
    pelo DeterministicRuleEvaluator, então basta que UMA variável exista
    e satisfaça a condição para ativar.

    Args:
        regra: AST JSON da regra
        dados: Dicionário com dados extraídos

    Returns:
        Tupla (pode_avaliar, variaveis_existentes, variaveis_faltantes)
    """
    if not regra:
        return False, [], []

    todas_variaveis = _extrair_variaveis_regra(regra)
    existentes = [v for v in todas_variaveis if v in dados]
    faltantes = [v for v in todas_variaveis if v not in dados]

    # Verifica recursivamente se a regra pode ser avaliada
    pode = _pode_avaliar_no(regra, dados)

    return pode, existentes, faltantes


def _pode_avaliar_no(no: Dict, dados: Dict[str, Any]) -> bool:
    """
    Verifica recursivamente se um nó da regra pode ser avaliado.

    Para nós OR: basta que UM filho possa ser avaliado
    Para nós AND: TODOS os filhos devem poder ser avaliados
    Para condições: a variável deve existir nos dados
    """
    if not no:
        return False

    tipo = no.get("type")

    if tipo == "condition":
        variavel = no.get("variable")
        # Condição pode ser avaliada se a variável existe
        return variavel in dados

    elif tipo == "or":
        conditions = no.get("conditions", [])
        if not conditions:
            return False
        # OR: pelo menos um filho deve poder ser avaliado
        return any(_pode_avaliar_no(c, dados) for c in conditions)

    elif tipo == "and":
        conditions = no.get("conditions", [])
        if not conditions:
            return False
        # AND: todos os filhos devem poder ser avaliados
        return all(_pode_avaliar_no(c, dados) for c in conditions)

    elif tipo == "not":
        # NOT pode ter "condition" ou "conditions"
        condition = no.get("condition")
        conditions = no.get("conditions", [])
        if condition:
            return _pode_avaliar_no(condition, dados)
        elif conditions:
            # Se é lista, trata como AND implícito
            return all(_pode_avaliar_no(c, dados) for c in conditions)
        return False

    return False


def avaliar_ativacao_prompt(
    prompt_id: int,
    modo_ativacao: str,
    regra_deterministica: Optional[Dict],
    dados_extracao: Dict[str, Any],
    db: Session,
    regra_secundaria: Optional[Dict] = None,
    fallback_habilitado: bool = False,
    tipo_peca: Optional[str] = None,
    numero_processo: Optional[str] = None
) -> Dict[str, Any]:
    """
    Avalia se um prompt deve ser ativado com suporte a regras por tipo de peça.

    IMPORTANTE: Esta função usa resolve_activation_mode_from_db() para determinar
    o modo de ativação REAL, IGNORANDO o parâmetro modo_ativacao quando há regras
    determinísticas configuradas. Isso garante a REGRA DE OURO do sistema.

    LÓGICA DE ATIVAÇÃO (v3 - regra global como FALLBACK):

    REGRA PRINCIPAL:
    - Se existe ALGUMA regra específica ATIVA para o tipo de peça:
      → Avalia APENAS as regras específicas (ignora regra global primária)
    - Se NÃO existe regra específica ativa para o tipo de peça:
      → Usa a regra global primária como FALLBACK

    Isso significa que regras específicas SOBREPÕEM a regra global primária.

    Args:
        prompt_id: ID do prompt
        modo_ativacao: 'llm' ou 'deterministic' (PODE SER IGNORADO se há regras)
        regra_deterministica: AST JSON da regra PRIMÁRIA GLOBAL (se modo deterministic)
        dados_extracao: Dados extraídos do processo
        db: Sessão do banco
        regra_secundaria: AST JSON da regra SECUNDÁRIA GLOBAL/fallback (opcional)
        fallback_habilitado: Se deve avaliar regra secundária quando primária não existe
        tipo_peca: Tipo de peça para buscar regras específicas (opcional, ex: 'contestacao')

    Returns:
        Dict com ativar, modo, detalhes, regra_usada, regras_avaliadas
    """
    # ==========================================================================
    # REGRA DE OURO: Resolve o modo de ativação REAL considerando todas as regras
    # O parâmetro modo_ativacao pode estar incorreto - não confiamos nele!
    # ==========================================================================
    modo_ativacao_real = resolve_activation_mode_from_db(
        db=db,
        modulo_id=prompt_id,
        modo_ativacao_salvo=modo_ativacao,
        regra_primaria=regra_deterministica,
        regra_secundaria=regra_secundaria,
        fallback_habilitado=fallback_habilitado
    )

    # Log se houve correção
    if modo_ativacao_real != modo_ativacao:
        logger.warning(
            f"[REGRA-DE-OURO] Prompt {prompt_id}: modo_ativacao corrigido de "
            f"'{modo_ativacao}' para '{modo_ativacao_real}' em runtime"
        )

    if modo_ativacao_real != "deterministic":
        # Modo LLM - retorna None para indicar que precisa chamar LLM
        return {
            "ativar": None,
            "modo": "llm",
            "regra_usada": None,
            "detalhes": "Requer avaliação por LLM"
        }

    avaliador = DeterministicRuleEvaluator()
    regras_avaliadas = []

    # ========================================
    # 1. VERIFICA SE EXISTEM REGRAS ESPECÍFICAS ATIVAS
    # ========================================
    tem_regra_especifica_ativa = False
    if tipo_peca:
        tem_regra_especifica_ativa = _existe_regra_especifica_ativa(db, prompt_id, tipo_peca)
        logger.info(
            f"[DETERMINISTIC] Prompt {prompt_id}: "
            f"tipo_peca={tipo_peca}, tem_regra_especifica_ativa={tem_regra_especifica_ativa}"
        )

    # ========================================
    # 2. SE TEM REGRA ESPECÍFICA → AVALIA APENAS ESPECÍFICA
    # ========================================
    if tem_regra_especifica_ativa:
        regra_especifica = _carregar_regra_tipo_peca(db, prompt_id, tipo_peca)

        if regra_especifica and regra_especifica.regra_deterministica:
            # Log detalhado da regra específica
            logger.info(
                f"[DETERMINISTIC] Prompt {prompt_id}: "
                f"Regra específica carregada: {regra_especifica.regra_deterministica}"
            )

            # Usa pode_avaliar_regra para verificação inteligente (considera OR/AND)
            pode_avaliar, vars_existentes, vars_faltantes = pode_avaliar_regra(
                regra_especifica.regra_deterministica, dados_extracao
            )
            vars_especifica = vars_existentes + vars_faltantes  # todas as variáveis

            # Log dos valores atuais das variáveis
            valores_vars = {v: dados_extracao.get(v, "<<NÃO ENCONTRADA>>") for v in vars_especifica}
            logger.info(
                f"[DETERMINISTIC] Prompt {prompt_id}: "
                f"ESPECÍFICA {tipo_peca} - pode_avaliar={pode_avaliar}, "
                f"vars_existentes={vars_existentes}, vars_faltantes={vars_faltantes}, "
                f"valores={valores_vars}"
            )

            if pode_avaliar:
                resultado_tipo_peca, trace_especifica = avaliador.avaliar_com_trace(
                    regra_especifica.regra_deterministica, dados_extracao
                )
                regras_avaliadas.append({
                    "tipo": f"especifica_{tipo_peca}",
                    "resultado": resultado_tipo_peca,
                    "variaveis": vars_especifica,
                    "checks": trace_especifica.get("checks", []),
                    "evaluation_mode": trace_especifica.get("evaluation_mode"),
                    "short_circuit": trace_especifica.get("short_circuit"),
                })

                logger.info(
                    f"[DETERMINISTIC] Prompt {prompt_id}: ESPECÍFICA {tipo_peca} = {resultado_tipo_peca}"
                )

                if resultado_tipo_peca is True:
                    _registrar_log_ativacao(
                        db=db,
                        prompt_id=prompt_id,
                        modo="deterministic_tipo_peca",
                        resultado=True,
                        variaveis_usadas=vars_especifica,
                        detalhe=tipo_peca,
                        numero_processo=numero_processo
                    )
                    return {
                        "ativar": True,
                        "modo": "deterministic",
                        "regra_usada": f"especifica_{tipo_peca}",
                        "detalhes": f"Ativado por regra ESPECÍFICA de {tipo_peca} (vars: {vars_especifica})",
                        "regras_avaliadas": regras_avaliadas
                    }

                # Regra específica retornou False - NÃO ativa (não usa global como fallback)
                if resultado_tipo_peca is False:
                    _registrar_log_ativacao(
                        db=db,
                        prompt_id=prompt_id,
                        modo="deterministic_tipo_peca",
                        resultado=False,
                        variaveis_usadas=vars_especifica,
                        detalhe=f"{tipo_peca}_false",
                        numero_processo=numero_processo
                    )
                    return {
                        "ativar": False,
                        "modo": "deterministic",
                        "regra_usada": f"especifica_{tipo_peca}",
                        "detalhes": f"Regra específica de {tipo_peca} retornou False (global ignorada)",
                        "regras_avaliadas": regras_avaliadas
                    }

            # Variáveis não existem - resultado indeterminado
            # Adiciona info ao regras_avaliadas para debug
            regras_avaliadas.append({
                "tipo": f"especifica_{tipo_peca}",
                "resultado": None,
                "variaveis": vars_especifica,
                "variaveis_faltantes": vars_faltantes,
                "erro": "Variáveis necessárias não fornecidas"
            })
            return {
                "ativar": None,
                "modo": "deterministic",
                "regra_usada": f"especifica_{tipo_peca}_pendente",
                "detalhes": f"Variáveis necessárias não fornecidas para regra específica de {tipo_peca}: {vars_faltantes}",
                "regras_avaliadas": regras_avaliadas,
                "variaveis_faltantes": vars_faltantes
            }

    # ========================================
    # 3. SEM REGRA ESPECÍFICA → USA GLOBAL COMO FALLBACK
    # ========================================
    resultado_global = None

    if regra_deterministica:
        # Usa pode_avaliar_regra para verificação inteligente (considera OR/AND)
        pode_avaliar_primaria, vars_existentes_primaria, vars_faltantes_primaria = pode_avaliar_regra(
            regra_deterministica, dados_extracao
        )
        vars_primaria = vars_existentes_primaria + vars_faltantes_primaria  # todas as variáveis

        logger.info(
            f"[DETERMINISTIC] Prompt {prompt_id}: "
            f"GLOBAL primária (fallback) - pode_avaliar={pode_avaliar_primaria}, "
            f"vars_existentes={vars_existentes_primaria}, vars_faltantes={vars_faltantes_primaria}"
        )

        if pode_avaliar_primaria:
            resultado_global, trace_primaria = avaliador.avaliar_com_trace(regra_deterministica, dados_extracao)
            regras_avaliadas.append({
                "tipo": "global_primaria",
                "resultado": resultado_global,
                "variaveis": vars_primaria,
                "checks": trace_primaria.get("checks", []),
                "evaluation_mode": trace_primaria.get("evaluation_mode"),
                "short_circuit": trace_primaria.get("short_circuit"),
            })

            logger.info(
                f"[DETERMINISTIC] Prompt {prompt_id}: GLOBAL primária = {resultado_global}"
            )

            if resultado_global is True:
                _registrar_log_ativacao(
                    db=db,
                    prompt_id=prompt_id,
                    modo="deterministic_global",
                    resultado=True,
                    variaveis_usadas=vars_primaria,
                    detalhe="primary",
                    numero_processo=numero_processo
                )
                return {
                    "ativar": True,
                    "modo": "deterministic",
                    "regra_usada": "global_primaria",
                    "detalhes": f"Ativado por regra GLOBAL primária (fallback, sem regra específica para {tipo_peca or 'N/A'})",
                    "regras_avaliadas": regras_avaliadas
                }

            if resultado_global is False:
                _registrar_log_ativacao(
                    db=db,
                    prompt_id=prompt_id,
                    modo="deterministic_global",
                    resultado=False,
                    variaveis_usadas=vars_primaria,
                    detalhe="primary_false",
                    numero_processo=numero_processo
                )
                return {
                    "ativar": False,
                    "modo": "deterministic",
                    "regra_usada": "global_primaria",
                    "detalhes": f"Regra GLOBAL primária retornou False (fallback)",
                    "regras_avaliadas": regras_avaliadas
                }

        else:
            # Regra global primária existe, mas não pode ser avaliada (variáveis faltando)
            # Adiciona info ao regras_avaliadas para debug
            regras_avaliadas.append({
                "tipo": "global_primaria",
                "resultado": None,
                "variaveis": vars_primaria,
                "variaveis_faltantes": vars_faltantes_primaria,
                "erro": "Variáveis necessárias não fornecidas"
            })

            # Tenta fallback se habilitado
            if fallback_habilitado and regra_secundaria:
                # Tenta regra global secundária
                pode_avaliar_secundaria, vars_existentes_sec, vars_faltantes_sec = pode_avaliar_regra(
                    regra_secundaria, dados_extracao
                )
                vars_secundaria = vars_existentes_sec + vars_faltantes_sec

                logger.info(
                    f"[DETERMINISTIC] Prompt {prompt_id}: "
                    f"GLOBAL secundária (fallback após primária sem vars) - pode_avaliar={pode_avaliar_secundaria}, "
                    f"vars_existentes={vars_existentes_sec}, vars_faltantes={vars_faltantes_sec}"
                )

                if pode_avaliar_secundaria:
                    resultado_global, trace_secundaria = avaliador.avaliar_com_trace(regra_secundaria, dados_extracao)
                    regras_avaliadas.append({
                        "tipo": "global_secundaria",
                        "resultado": resultado_global,
                        "variaveis": vars_secundaria,
                        "checks": trace_secundaria.get("checks", []),
                        "evaluation_mode": trace_secundaria.get("evaluation_mode"),
                        "short_circuit": trace_secundaria.get("short_circuit"),
                    })

                    if resultado_global is True:
                        _registrar_log_ativacao(
                            db=db,
                            prompt_id=prompt_id,
                            modo="deterministic_global",
                            resultado=True,
                            variaveis_usadas=vars_secundaria,
                            detalhe="secondary_fallback",
                            numero_processo=numero_processo
                        )
                        return {
                            "ativar": True,
                            "modo": "deterministic",
                            "regra_usada": "global_secundaria",
                            "detalhes": f"Ativado por regra GLOBAL secundária (fallback, variáveis primárias faltando: {vars_faltantes_primaria})",
                            "regras_avaliadas": regras_avaliadas
                        }

                    if resultado_global is False:
                        _registrar_log_ativacao(
                            db=db,
                            prompt_id=prompt_id,
                            modo="deterministic_global",
                            resultado=False,
                            variaveis_usadas=vars_secundaria,
                            detalhe="secondary_fallback_false",
                            numero_processo=numero_processo
                        )
                        return {
                            "ativar": False,
                            "modo": "deterministic",
                            "regra_usada": "global_secundaria",
                            "detalhes": f"Regra GLOBAL secundária retornou False (fallback)",
                            "regras_avaliadas": regras_avaliadas
                        }

            # Retorna com info sobre variáveis faltantes
            return {
                "ativar": None,
                "modo": "deterministic",
                "regra_usada": "global_primaria_pendente",
                "detalhes": f"Variáveis necessárias não fornecidas: {vars_faltantes_primaria}",
                "regras_avaliadas": regras_avaliadas,
                "variaveis_faltantes": vars_faltantes_primaria
            }

    # Nenhuma regra aplicável ou avaliável
    return {
        "ativar": None,
        "modo": "deterministic",
        "regra_usada": "nenhuma",
        "detalhes": f"Nenhuma regra aplicável (tipo_peca={tipo_peca})",
        "regras_avaliadas": regras_avaliadas
    }


def _carregar_regra_tipo_peca(
    db: Session,
    modulo_id: int,
    tipo_peca: str
) -> Optional['RegraDeterministicaTipoPeca']:
    """
    Carrega a regra determinística específica para um tipo de peça.

    Args:
        db: Sessão do banco
        modulo_id: ID do módulo
        tipo_peca: Tipo de peça (ex: 'contestacao', 'apelacao')

    Returns:
        RegraDeterministicaTipoPeca ou None se não existir
    """
    from admin.models_prompts import RegraDeterministicaTipoPeca

    return db.query(RegraDeterministicaTipoPeca).filter(
        RegraDeterministicaTipoPeca.modulo_id == modulo_id,
        RegraDeterministicaTipoPeca.tipo_peca == tipo_peca,
        RegraDeterministicaTipoPeca.ativo == True
    ).first()


def _existe_regra_especifica_ativa(
    db: Session,
    modulo_id: int,
    tipo_peca: str
) -> bool:
    """
    Verifica se existe ALGUMA regra específica ATIVA para o tipo de peça.

    Usado para determinar se a regra global principal deve ser usada como fallback.

    Args:
        db: Sessão do banco
        modulo_id: ID do módulo
        tipo_peca: Tipo de peça (ex: 'contestacao', 'apelacao')

    Returns:
        True se existe pelo menos uma regra específica ativa, False caso contrário
    """
    from admin.models_prompts import RegraDeterministicaTipoPeca

    count = db.query(RegraDeterministicaTipoPeca).filter(
        RegraDeterministicaTipoPeca.modulo_id == modulo_id,
        RegraDeterministicaTipoPeca.tipo_peca == tipo_peca,
        RegraDeterministicaTipoPeca.ativo == True
    ).count()

    return count > 0


def batch_verificar_regras_especificas(
    db: Session,
    modulo_ids: List[int],
    tipo_peca: str
) -> Dict[int, bool]:
    """
    Batch: Verifica quais módulos têm regra específica ativa para o tipo de peça.

    OTIMIZAÇÃO: Faz UMA única query para todos os módulos ao invés de N queries.

    Args:
        db: Sessão do banco
        modulo_ids: Lista de IDs dos módulos
        tipo_peca: Tipo de peça (ex: 'contestacao', 'apelacao')

    Returns:
        Dict {modulo_id: bool} - True se existe regra específica ativa
    """
    from admin.models_prompts import RegraDeterministicaTipoPeca

    if not modulo_ids:
        return {}

    # Query única para todos os módulos
    regras = db.query(RegraDeterministicaTipoPeca.modulo_id).filter(
        RegraDeterministicaTipoPeca.modulo_id.in_(modulo_ids),
        RegraDeterministicaTipoPeca.tipo_peca == tipo_peca,
        RegraDeterministicaTipoPeca.ativo == True
    ).distinct().all()

    # Set de módulos com regra específica
    modulos_com_regra = {r.modulo_id for r in regras}

    # Retorna dict com resultado para cada módulo
    return {mid: (mid in modulos_com_regra) for mid in modulo_ids}


def carregar_regras_tipo_peca_modulo(
    db: Session,
    modulo_id: int
) -> List['RegraDeterministicaTipoPeca']:
    """
    Carrega todas as regras específicas por tipo de peça de um módulo.

    Args:
        db: Sessão do banco
        modulo_id: ID do módulo

    Returns:
        Lista de RegraDeterministicaTipoPeca
    """
    from admin.models_prompts import RegraDeterministicaTipoPeca

    return db.query(RegraDeterministicaTipoPeca).filter(
        RegraDeterministicaTipoPeca.modulo_id == modulo_id
    ).order_by(RegraDeterministicaTipoPeca.tipo_peca).all()


def _extrair_variaveis_regra(no: Dict) -> Set[str]:
    """Helper para extrair variáveis de uma regra."""
    variaveis = set()
    tipo = no.get("type")

    if tipo == "condition":
        var = no.get("variable")
        if var:
            variaveis.add(var)
    elif tipo in ("and", "or", "not"):
        for cond in no.get("conditions", []):
            variaveis.update(_extrair_variaveis_regra(cond))

    return variaveis


def _registrar_log_ativacao(
    db: Session,
    prompt_id: int,
    modo: str,
    resultado: bool,
    variaveis_usadas: List[str],
    detalhe: Optional[str] = None,
    numero_processo: Optional[str] = None
):
    """
    Registra log de ativação de prompt.

    IMPORTANTE: O logging é resiliente - falhas não abortam o fluxo principal.

    Args:
        db: Sessão do banco
        prompt_id: ID do prompt
        modo: Modo padronizado (llm, deterministic, deterministic_global, deterministic_tipo_peca, mixed)
        resultado: True se ativado, False se não ativado
        variaveis_usadas: Lista de slugs das variáveis usadas na avaliação
        detalhe: Detalhe adicional (ex: tipo de peça, regra específica)
        numero_processo: Número CNJ do processo (opcional)
    """
    try:
        from .models_extraction import PromptActivationLog

        log = PromptActivationLog(
            prompt_id=prompt_id,
            modo_ativacao=modo,
            modo_ativacao_detalhe=detalhe,
            resultado=resultado,
            variaveis_usadas=variaveis_usadas,
            numero_processo=numero_processo
        )
        db.add(log)
        db.commit()
    except Exception as e:
        # Logging não deve abortar o fluxo principal
        logger.warning(f"[LOG-ATIVACAO] Falha ao registrar log de ativação: {e}")
        try:
            db.rollback()
        except Exception:
            pass
