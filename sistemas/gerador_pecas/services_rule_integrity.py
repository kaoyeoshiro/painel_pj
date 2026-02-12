"""Validacao de integridade de regras deterministicas."""

import logging
from typing import Optional, Set, List, Dict, Any
from sqlalchemy.orm import Session

from .models_extraction import ExtractionVariable

logger = logging.getLogger(__name__)


def _extrair_variaveis_regra(no: Dict) -> Set[str]:
    """Helper para extrair variaveis de uma regra (recursivo)."""
    variaveis: Set[str] = set()
    tipo = no.get("type")
    if tipo == "condition":
        var = no.get("variable")
        if var:
            variaveis.add(var)
    elif tipo in ("and", "or", "not"):
        for cond in no.get("conditions", []):
            variaveis.update(_extrair_variaveis_regra(cond))
    return variaveis


class RuleIntegrityValidator:
    """
    Validador de integridade entre regras determinísticas e variáveis disponíveis.

    Verifica se todas as variáveis usadas em regras:
    - Existem em algum JSON de extração (ExtractionVariable)
    - OU são variáveis de sistema (ProcessVariableDefinition)

    Uso:
        validator = RuleIntegrityValidator(db)
        resultado = validator.validar_modulo(modulo_id)
        # resultado = {
        #     "valido": False,
        #     "variaveis_invalidas": [
        #         {"variavel": "xyz", "regra": "global_primaria", "tipo_peca": None},
        #         ...
        #     ],
        #     "resumo": {...}
        # }
    """

    def __init__(self, db: Session):
        self.db = db
        self._variaveis_disponiveis: Optional[Set[str]] = None
        self._variaveis_sistema: Optional[Set[str]] = None
        self._variaveis_extracao: Optional[Set[str]] = None

    def _carregar_variaveis_disponiveis(self) -> None:
        """Carrega todas as variáveis disponíveis no sistema."""
        if self._variaveis_disponiveis is not None:
            return

        self._variaveis_extracao = set()
        self._variaveis_sistema = set()

        # 1. Variáveis de extração (PDFs) do banco de dados
        from .models_extraction import ExtractionVariable
        extraction_vars = self.db.query(ExtractionVariable).filter(
            ExtractionVariable.ativo == True
        ).all()

        for v in extraction_vars:
            self._variaveis_extracao.add(v.slug)

        # 2. Variáveis de processo (XML) - variáveis de sistema
        try:
            from .services_process_variables import ProcessVariableResolver
            definitions = ProcessVariableResolver.get_all_definitions()
            for definition in definitions:
                self._variaveis_sistema.add(definition.slug)
        except Exception as e:
            logger.error(f"[VALIDADOR-INTEGRIDADE] Erro ao carregar variáveis de sistema: {e}")

        self._variaveis_disponiveis = self._variaveis_extracao | self._variaveis_sistema

        logger.info(
            f"[VALIDADOR-INTEGRIDADE] Variáveis carregadas: "
            f"extração={len(self._variaveis_extracao)}, "
            f"sistema={len(self._variaveis_sistema)}, "
            f"total={len(self._variaveis_disponiveis)}"
        )

    def _extrair_variaveis_regra(self, regra: Optional[Dict]) -> Set[str]:
        """Extrai todas as variáveis usadas em uma regra (recursivo)."""
        if not regra:
            return set()
        return _extrair_variaveis_regra(regra)

    def validar_regra(
        self,
        regra: Optional[Dict],
        nome_regra: str,
        tipo_peca: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Valida uma única regra e retorna lista de variáveis inválidas.

        Args:
            regra: AST JSON da regra
            nome_regra: Nome identificador da regra (ex: "global_primaria")
            tipo_peca: Tipo de peça se for regra específica

        Returns:
            Lista de dicts com {variavel, regra, tipo_peca, is_sistema}
        """
        self._carregar_variaveis_disponiveis()

        if not regra:
            return []

        variaveis_usadas = self._extrair_variaveis_regra(regra)
        variaveis_invalidas = []

        for var in variaveis_usadas:
            if var not in self._variaveis_disponiveis:
                variaveis_invalidas.append({
                    "variavel": var,
                    "regra": nome_regra,
                    "tipo_peca": tipo_peca,
                    "sugestao_tipo": self._inferir_tipo_variavel(var)
                })

        return variaveis_invalidas

    def _inferir_tipo_variavel(self, slug: str) -> str:
        """Infere o tipo de uma variável baseado no nome."""
        slug_lower = slug.lower()

        if any(p in slug_lower for p in ["valor", "custo", "preco", "montante", "total"]):
            return "currency"
        elif any(p in slug_lower for p in ["data", "date", "dia", "nascimento", "vencimento"]):
            return "date"
        elif any(p in slug_lower for p in ["idoso", "ativo", "possui", "tem_", "eh_", "sim_nao", "aprovado", "habilitado"]):
            return "boolean"
        elif any(p in slug_lower for p in ["quantidade", "numero", "qtd", "age", "prazo", "dias"]):
            return "number"
        return "text"

    def validar_modulo(self, modulo_id: int) -> Dict[str, Any]:
        """
        Valida todas as regras de um módulo de prompt.

        Args:
            modulo_id: ID do módulo a validar

        Returns:
            Dict com:
            - valido: bool
            - variaveis_invalidas: lista de variáveis que não existem
            - resumo: estatísticas
        """
        from admin.models_prompts import PromptModulo, RegraDeterministicaTipoPeca

        self._carregar_variaveis_disponiveis()

        # Busca módulo
        modulo = self.db.query(PromptModulo).filter(PromptModulo.id == modulo_id).first()
        if not modulo:
            return {
                "valido": False,
                "erro": "Módulo não encontrado",
                "variaveis_invalidas": [],
                "resumo": {}
            }

        todas_invalidas = []

        # 1. Valida regra global primária
        invalidas_primaria = self.validar_regra(
            modulo.regra_deterministica,
            "global_primaria"
        )
        todas_invalidas.extend(invalidas_primaria)

        # 2. Valida regra global secundária (fallback)
        invalidas_secundaria = self.validar_regra(
            modulo.regra_deterministica_secundaria,
            "global_secundaria"
        )
        todas_invalidas.extend(invalidas_secundaria)

        # 3. Valida regras por tipo de peça
        regras_tipo_peca = self.db.query(RegraDeterministicaTipoPeca).filter(
            RegraDeterministicaTipoPeca.modulo_id == modulo_id
        ).all()

        for regra_tp in regras_tipo_peca:
            invalidas_tp = self.validar_regra(
                regra_tp.regra_deterministica,
                f"tipo_peca_{regra_tp.tipo_peca}",
                regra_tp.tipo_peca
            )
            todas_invalidas.extend(invalidas_tp)

        # Monta resumo
        variaveis_unicas = list(set(v["variavel"] for v in todas_invalidas))
        regras_afetadas = list(set(v["regra"] for v in todas_invalidas))

        return {
            "valido": len(todas_invalidas) == 0,
            "modulo_id": modulo_id,
            "modulo_nome": modulo.nome,
            "variaveis_invalidas": todas_invalidas,
            "resumo": {
                "total_variaveis_invalidas": len(variaveis_unicas),
                "variaveis_unicas": variaveis_unicas,
                "total_regras_afetadas": len(regras_afetadas),
                "regras_afetadas": regras_afetadas,
                "total_variaveis_disponiveis": len(self._variaveis_disponiveis),
                "total_variaveis_extracao": len(self._variaveis_extracao),
                "total_variaveis_sistema": len(self._variaveis_sistema)
            }
        }

    def validar_todos_modulos(self) -> Dict[str, Any]:
        """
        Valida todos os módulos com regras determinísticas.

        Returns:
            Dict com resumo geral e lista de módulos com problemas
        """
        from admin.models_prompts import PromptModulo

        self._carregar_variaveis_disponiveis()

        # Busca módulos com modo determinístico
        modulos = self.db.query(PromptModulo).filter(
            PromptModulo.modo_ativacao == 'deterministic',
            PromptModulo.ativo == True
        ).all()

        modulos_invalidos = []
        total_problemas = 0

        for modulo in modulos:
            resultado = self.validar_modulo(modulo.id)
            if not resultado["valido"]:
                modulos_invalidos.append({
                    "modulo_id": modulo.id,
                    "modulo_nome": modulo.nome,
                    "modulo_titulo": modulo.titulo,
                    "variaveis_invalidas": resultado["variaveis_invalidas"],
                    "resumo": resultado["resumo"]
                })
                total_problemas += len(resultado["variaveis_invalidas"])

        return {
            "valido": len(modulos_invalidos) == 0,
            "total_modulos_verificados": len(modulos),
            "total_modulos_invalidos": len(modulos_invalidos),
            "total_problemas": total_problemas,
            "modulos_invalidos": modulos_invalidos,
            "variaveis_disponiveis": {
                "total": len(self._variaveis_disponiveis),
                "extracao": len(self._variaveis_extracao),
                "sistema": len(self._variaveis_sistema),
                "lista_sistema": sorted(list(self._variaveis_sistema))
            }
        }

    def obter_variaveis_disponiveis(self) -> Dict[str, Any]:
        """
        Retorna todas as variáveis disponíveis organizadas por fonte.

        Útil para debug e para o frontend mostrar variáveis válidas.
        """
        self._carregar_variaveis_disponiveis()

        # Detalhes das variáveis de extração
        from .models_extraction import ExtractionVariable
        extraction_vars = self.db.query(ExtractionVariable).filter(
            ExtractionVariable.ativo == True
        ).order_by(ExtractionVariable.slug).all()

        vars_extracao_detalhes = [
            {
                "slug": v.slug,
                "label": v.label,
                "tipo": v.tipo,
                "categoria_id": v.categoria_id,
                "is_conditional": v.is_conditional
            }
            for v in extraction_vars
        ]

        # Detalhes das variáveis de sistema
        vars_sistema_detalhes = []
        try:
            from .services_process_variables import ProcessVariableResolver
            for definition in ProcessVariableResolver.get_all_definitions():
                vars_sistema_detalhes.append({
                    "slug": definition.slug,
                    "label": definition.label,
                    "tipo": definition.tipo,
                    "descricao": definition.descricao,
                    "is_system": True
                })
        except Exception:
            pass

        return {
            "total": len(self._variaveis_disponiveis),
            "extracao": {
                "total": len(vars_extracao_detalhes),
                "variaveis": vars_extracao_detalhes
            },
            "sistema": {
                "total": len(vars_sistema_detalhes),
                "variaveis": vars_sistema_detalhes
            }
        }


def validar_integridade_regras_modulo(db: Session, modulo_id: int) -> Dict[str, Any]:
    """
    Função de conveniência para validar integridade de regras de um módulo.

    Args:
        db: Sessão do banco
        modulo_id: ID do módulo

    Returns:
        Resultado da validação
    """
    validator = RuleIntegrityValidator(db)
    return validator.validar_modulo(modulo_id)


def validar_integridade_todas_regras(db: Session) -> Dict[str, Any]:
    """
    Função de conveniência para validar todas as regras do sistema.

    Args:
        db: Sessão do banco

    Returns:
        Resultado da validação geral
    """
    validator = RuleIntegrityValidator(db)
    return validator.validar_todos_modulos()
