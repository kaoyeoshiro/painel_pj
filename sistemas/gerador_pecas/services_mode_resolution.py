"""Resolucao de modo de ativacao de modulos (Regra de Ouro)."""

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ==============================================================================
# REGRA DE OURO DO SISTEMA: RESOLUÇÃO AUTOMÁTICA DO MODO DE ATIVAÇÃO
# ==============================================================================
#
# INVARIANTE: Se existe QUALQUER regra determinística associada a um módulo,
# o módulo DEVE operar em modo 'deterministic', INDEPENDENTE do valor salvo
# no campo modo_ativacao.
#
# Esta garantia é implementada em TRÊS níveis:
# 1. RUNTIME: resolve_activation_mode() é chamada antes de toda avaliação
# 2. PERSISTÊNCIA: ao salvar/atualizar módulos, o modo é forçado corretamente
# 3. CORREÇÃO: corrigir_modos_ativacao_inconsistentes() corrige dados legados
#
# NUNCA confie no campo modo_ativacao do banco - sempre use resolve_activation_mode()
# ==============================================================================


def tem_regras_deterministicas(
    regra_primaria: Optional[Dict] = None,
    regra_secundaria: Optional[Dict] = None,
    fallback_habilitado: bool = False,
    regras_tipo_peca: Optional[List[Dict]] = None
) -> bool:
    """
    Verifica se existe pelo menos UMA regra determinística configurada.

    Esta função verifica TODAS as possíveis fontes de regras:
    - Regra global primária
    - Regra global secundária (fallback)
    - Regras específicas por tipo de peça

    Args:
        regra_primaria: Regra determinística primária (AST JSON)
        regra_secundaria: Regra determinística secundária/fallback
        fallback_habilitado: Se o fallback está habilitado
        regras_tipo_peca: Lista de regras específicas por tipo de peça

    Returns:
        True se existir pelo menos uma regra, False caso contrário
    """
    # Verifica regra primária
    if regra_primaria and isinstance(regra_primaria, dict) and regra_primaria.get("type"):
        return True

    # Verifica regra secundária (apenas se fallback habilitado)
    if fallback_habilitado and regra_secundaria and isinstance(regra_secundaria, dict) and regra_secundaria.get("type"):
        return True

    # Verifica regras por tipo de peça
    if regras_tipo_peca:
        for regra in regras_tipo_peca:
            if regra and isinstance(regra, dict):
                # Pode ser o objeto completo com 'regra_deterministica' ou a regra direta
                regra_det = regra.get("regra_deterministica", regra)
                if regra_det and isinstance(regra_det, dict) and regra_det.get("type"):
                    return True

    return False


def resolve_activation_mode(
    modo_ativacao_salvo: str,
    regra_primaria: Optional[Dict] = None,
    regra_secundaria: Optional[Dict] = None,
    fallback_habilitado: bool = False,
    regras_tipo_peca: Optional[List[Dict]] = None,
    log_correcao: bool = True
) -> str:
    """
    FONTE ÚNICA DE VERDADE para o modo de ativação de um módulo.

    REGRA DE OURO: Se existe qualquer regra determinística, o modo DEVE ser 'deterministic'.

    Esta função IGNORA o valor salvo no banco quando há regras configuradas,
    garantindo que o sistema SEMPRE opere corretamente independente de:
    - Edições manuais no banco
    - Seeds ou imports incorretos
    - Bugs em versões anteriores
    - Configurações inconsistentes

    Args:
        modo_ativacao_salvo: Valor do campo modo_ativacao no banco
        regra_primaria: Regra determinística primária (AST JSON)
        regra_secundaria: Regra determinística secundária/fallback
        fallback_habilitado: Se o fallback está habilitado
        regras_tipo_peca: Lista de regras específicas por tipo de peça
        log_correcao: Se deve logar quando corrigir o modo

    Returns:
        Modo de ativação CORRETO: 'deterministic' se há regras, senão o valor salvo
    """
    # Verifica se existem regras
    existe_regra = tem_regras_deterministicas(
        regra_primaria=regra_primaria,
        regra_secundaria=regra_secundaria,
        fallback_habilitado=fallback_habilitado,
        regras_tipo_peca=regras_tipo_peca
    )

    # REGRA DE OURO: se há regra, modo DEVE ser 'deterministic'
    if existe_regra:
        if modo_ativacao_salvo != "deterministic" and log_correcao:
            logger.warning(
                f"[REGRA-DE-OURO] Modo de ativação corrigido: '{modo_ativacao_salvo}' -> 'deterministic' "
                f"(regras determinísticas detectadas)"
            )
        return "deterministic"

    # Sem regras: respeita o valor salvo (default para 'llm')
    return modo_ativacao_salvo or "llm"


def resolve_activation_mode_from_db(
    db: Session,
    modulo_id: int,
    modo_ativacao_salvo: Optional[str] = None,
    regra_primaria: Optional[Dict] = None,
    regra_secundaria: Optional[Dict] = None,
    fallback_habilitado: bool = False
) -> str:
    """
    Resolve o modo de ativação buscando também regras por tipo de peça no banco.

    Esta versão consulta o banco para verificar regras específicas por tipo de peça,
    garantindo que módulos com regras apenas em tipos específicos também sejam
    detectados como determinísticos.

    Args:
        db: Sessão do banco de dados
        modulo_id: ID do módulo
        modo_ativacao_salvo: Valor salvo (opcional, busca do banco se não fornecido)
        regra_primaria: Regra primária (opcional, busca do banco se não fornecido)
        regra_secundaria: Regra secundária (opcional)
        fallback_habilitado: Se fallback está habilitado

    Returns:
        Modo de ativação CORRETO
    """
    try:
        from admin.models_prompts import RegraDeterministicaTipoPeca

        # Busca regras específicas por tipo de peça ativas
        regras_tipo_peca = db.query(RegraDeterministicaTipoPeca).filter(
            RegraDeterministicaTipoPeca.modulo_id == modulo_id,
            RegraDeterministicaTipoPeca.ativo == True
        ).all()

        # Converte para lista de dicts
        regras_tipo_peca_dicts = [
            {"regra_deterministica": r.regra_deterministica, "tipo_peca": r.tipo_peca}
            for r in regras_tipo_peca
            if r.regra_deterministica
        ]

        return resolve_activation_mode(
            modo_ativacao_salvo=modo_ativacao_salvo or "llm",
            regra_primaria=regra_primaria,
            regra_secundaria=regra_secundaria,
            fallback_habilitado=fallback_habilitado,
            regras_tipo_peca=regras_tipo_peca_dicts if regras_tipo_peca_dicts else None
        )

    except Exception as e:
        logger.error(f"Erro ao resolver modo de ativação do módulo {modulo_id}: {e}")
        # Em caso de erro, usa resolução básica
        return resolve_activation_mode(
            modo_ativacao_salvo=modo_ativacao_salvo or "llm",
            regra_primaria=regra_primaria,
            regra_secundaria=regra_secundaria,
            fallback_habilitado=fallback_habilitado
        )


def corrigir_modos_ativacao_inconsistentes(db: Session, commit: bool = True) -> Dict[str, Any]:
    """
    Corrige TODOS os módulos com modo de ativação inconsistente.

    Esta função deve ser chamada:
    - No startup da aplicação
    - Após migrações
    - Manualmente via endpoint de administração

    Garante que dados legados ou corrompidos sejam corrigidos automaticamente.

    Args:
        db: Sessão do banco de dados
        commit: Se deve fazer commit das alterações

    Returns:
        Dict com estatísticas da correção
    """
    try:
        from admin.models_prompts import PromptModulo, RegraDeterministicaTipoPeca

        corrigidos = []
        verificados = 0

        # Busca todos os módulos
        modulos = db.query(PromptModulo).all()

        for modulo in modulos:
            verificados += 1

            # Busca regras por tipo de peça
            regras_tipo_peca = db.query(RegraDeterministicaTipoPeca).filter(
                RegraDeterministicaTipoPeca.modulo_id == modulo.id,
                RegraDeterministicaTipoPeca.ativo == True
            ).all()

            regras_tipo_peca_dicts = [
                {"regra_deterministica": r.regra_deterministica}
                for r in regras_tipo_peca
                if r.regra_deterministica
            ]

            # Resolve o modo correto
            modo_correto = resolve_activation_mode(
                modo_ativacao_salvo=modulo.modo_ativacao,
                regra_primaria=modulo.regra_deterministica,
                regra_secundaria=modulo.regra_deterministica_secundaria,
                fallback_habilitado=modulo.fallback_habilitado or False,
                regras_tipo_peca=regras_tipo_peca_dicts if regras_tipo_peca_dicts else None,
                log_correcao=False  # Vamos logar abaixo de forma consolidada
            )

            # Se há inconsistência, corrige
            if modulo.modo_ativacao != modo_correto:
                corrigidos.append({
                    "id": modulo.id,
                    "nome": modulo.nome,
                    "modo_anterior": modulo.modo_ativacao,
                    "modo_novo": modo_correto,
                    "tem_regra_primaria": bool(modulo.regra_deterministica),
                    "tem_regra_secundaria": bool(modulo.regra_deterministica_secundaria and modulo.fallback_habilitado),
                    "tem_regras_tipo_peca": len(regras_tipo_peca_dicts) > 0
                })

                modulo.modo_ativacao = modo_correto

        if commit and corrigidos:
            db.commit()

        # Log consolidado
        if corrigidos:
            logger.warning(
                f"[REGRA-DE-OURO] Corrigidos {len(corrigidos)} módulos com modo de ativação inconsistente: "
                f"{[c['nome'] for c in corrigidos]}"
            )
        else:
            logger.info(f"[REGRA-DE-OURO] Verificados {verificados} módulos - nenhuma inconsistência encontrada")

        return {
            "verificados": verificados,
            "corrigidos": len(corrigidos),
            "detalhes": corrigidos
        }

    except Exception as e:
        logger.error(f"Erro ao corrigir modos de ativação: {e}")
        return {
            "verificados": 0,
            "corrigidos": 0,
            "erro": str(e)
        }


def _get_config_sistemas_acessorios(db: Session, chave: str, default: Any = None) -> Any:
    """
    Busca configuração do sistema 'sistemas_acessorios' no banco.

    Args:
        db: Sessão do banco
        chave: Nome da configuração (ex: 'gerador_regras_modelo')
        default: Valor padrão se não encontrado

    Returns:
        Valor da configuração ou default
    """
    try:
        from admin.models import ConfiguracaoIA
        config = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == "sistemas_acessorios",
            ConfiguracaoIA.chave == chave
        ).first()

        if config and config.valor:
            return config.valor
        return default
    except Exception as e:
        logger.warning(f"Erro ao buscar config '{chave}': {e}")
        return default
