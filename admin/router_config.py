# admin/router_config.py
"""
Sub-router de administração - CRUD de Prompts e Configurações de IA.

Endpoints:
- GET/POST/PUT/DELETE /api/prompts — CRUD de prompts
- POST /api/prompts/criar-sistema/{sistema} — Seed de prompts por sistema
- GET/PUT/POST /config-ia — Configurações de IA
- GET /config-ia/per-agent/{sistema} — Config por agente
- GET /config-ia/sistemas — Listar sistemas e agentes
- GET/PUT /modelos-ia — Gerenciamento de modelos de IA
- GET /api/prompts/get/{sistema}/{tipo} — Obter prompt por tipo (uso interno)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from database.connection import get_db
from auth.dependencies import get_current_active_user, require_admin
from auth.models import User

from admin.models import PromptConfig, ConfiguracaoIA
from admin.schemas import (
    PromptCreate, PromptUpdate, PromptResponse, PromptListResponse,
    ConfiguracaoIACreate, ConfiguracaoIAUpdate, ConfiguracaoIAResponse,
    ConfigUpsertRequest,
)
from admin.repositories import (
    get_prompt_config_repo,
    get_config_repo,
    PromptConfigRepository,
    ConfiguracaoIARepository,
)
from admin.seed_prompts import seed_default_prompts


router = APIRouter()


# ============================================
# CRUD de Prompts
# ============================================

@router.get("/api/prompts", response_model=PromptListResponse)
async def list_prompts(
    sistema: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo)
):
    """Lista todos os prompts configurados (apenas admin)"""
    prompts = repo.list_with_filters(sistema=sistema, tipo=tipo)
    return PromptListResponse(prompts=prompts, total=len(prompts))


@router.get("/api/prompts/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: int,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo)
):
    """Obtém um prompt específico"""
    prompt = repo.get_by_id(prompt_id)

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt não encontrado")

    return prompt


@router.post("/api/prompts", response_model=PromptResponse, status_code=201)
async def create_prompt(
    prompt_data: PromptCreate,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo),
):
    """Cria um novo prompt"""
    if repo.check_exists(prompt_data.sistema, prompt_data.tipo):
        raise HTTPException(
            status_code=400,
            detail=f"Já existe um prompt para sistema='{prompt_data.sistema}' e tipo='{prompt_data.tipo}'"
        )

    prompt = PromptConfig(
        sistema=prompt_data.sistema,
        tipo=prompt_data.tipo,
        nome=prompt_data.nome,
        descricao=prompt_data.descricao,
        conteudo=prompt_data.conteudo,
        updated_by=current_user.username
    )

    repo.add(prompt)
    repo.commit()
    repo.db.refresh(prompt)

    return prompt


@router.put("/api/prompts/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: int,
    prompt_data: PromptUpdate,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo),
):
    """Atualiza um prompt existente"""
    prompt = repo.get_by_id(prompt_id)

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt não encontrado")

    if prompt_data.nome is not None:
        prompt.nome = prompt_data.nome
    if prompt_data.descricao is not None:
        prompt.descricao = prompt_data.descricao
    if prompt_data.conteudo is not None:
        prompt.conteudo = prompt_data.conteudo
    if prompt_data.is_active is not None:
        prompt.is_active = prompt_data.is_active

    prompt.updated_by = current_user.username

    repo.commit()
    repo.db.refresh(prompt)

    return prompt


@router.delete("/api/prompts/{prompt_id}")
async def delete_prompt(
    prompt_id: int,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo),
):
    """Exclui um prompt"""
    prompt = repo.get_by_id(prompt_id)

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt não encontrado")

    repo.delete(prompt)
    repo.commit()

    return {"success": True, "message": "Prompt excluído com sucesso"}


@router.post("/api/prompts/criar-sistema/{sistema}")
async def criar_prompts_sistema(
    sistema: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    prompt_repo: PromptConfigRepository = Depends(get_prompt_config_repo),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """
    Cria prompts e configurações para um sistema específico.
    Não deleta prompts existentes, apenas adiciona os que não existem.
    """
    sistemas_validos = [
        "pedido_calculo", "prestacao_contas", "matriculas",
        "assistencia_judiciaria", "gerador_pecas", "relatorio_cumprimento",
    ]

    if sistema not in sistemas_validos:
        raise HTTPException(
            status_code=400,
            detail=f"Sistema inválido. Sistemas válidos: {', '.join(sistemas_validos)}"
        )

    prompts_criados = 0
    configs_criadas = 0

    if sistema == "pedido_calculo":
        from sistemas.pedido_calculo.seed_config import seed_prompts, seed_configuracoes
        prompts_antes = prompt_repo.count_by_sistema(sistema)
        configs_antes = config_repo.count_by_sistema(sistema)
        seed_prompts(db)
        seed_configuracoes(db)
        prompts_criados = prompt_repo.count_by_sistema(sistema) - prompts_antes
        configs_criadas = config_repo.count_by_sistema(sistema) - configs_antes

    elif sistema == "prestacao_contas":
        from sistemas.prestacao_contas.seed_config import seed_configuracoes as seed_prestacao
        prompts_antes = prompt_repo.count_by_sistema(sistema)
        configs_antes = config_repo.count_by_sistema(sistema)
        seed_prestacao(db)
        prompts_criados = prompt_repo.count_by_sistema(sistema) - prompts_antes
        configs_criadas = config_repo.count_by_sistema(sistema) - configs_antes

    elif sistema in ["matriculas", "assistencia_judiciaria"]:
        from admin.seed_prompts import seed_default_prompts, seed_default_config_ia
        prompts_antes = prompt_repo.count_by_sistema(sistema)
        configs_antes = config_repo.count_by_sistema(sistema)
        seed_default_prompts(db, sistema)
        seed_default_config_ia(db, sistema)
        prompts_criados = prompt_repo.count_by_sistema(sistema) - prompts_antes
        configs_criadas = config_repo.count_by_sistema(sistema) - configs_antes

    elif sistema == "gerador_pecas":
        from admin.seed_prompts import seed_default_config_ia
        configs_antes = config_repo.count_by_sistema(sistema)
        seed_default_config_ia(db, sistema)
        configs_criadas = config_repo.count_by_sistema(sistema) - configs_antes

    elif sistema == "relatorio_cumprimento":
        from sistemas.relatorio_cumprimento.seed_config import seed_prompts, seed_configuracoes
        prompts_antes = prompt_repo.count_by_sistema(sistema)
        configs_antes = config_repo.count_by_sistema(sistema)
        seed_prompts(db)
        seed_configuracoes(db)
        prompts_criados = prompt_repo.count_by_sistema(sistema) - prompts_antes
        configs_criadas = config_repo.count_by_sistema(sistema) - configs_antes

    if prompts_criados == 0 and configs_criadas == 0:
        return {
            "success": True,
            "message": f"Prompts e configurações do sistema '{sistema}' já existem."
        }

    return {
        "success": True,
        "message": f"Criados {prompts_criados} prompt(s) e {configs_criadas} configuração(ões) para '{sistema}'."
    }


# ============================================
# CRUD de Configurações de IA
# ============================================

@router.get("/config-ia", response_model=List[ConfiguracaoIAResponse])
async def list_config_ia(
    sistema: Optional[str] = None,
    current_user: User = Depends(require_admin),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """Lista configurações de IA"""
    return config_repo.list_with_filters(sistema=sistema)


@router.put("/config-ia/{config_id}", response_model=ConfiguracaoIAResponse)
async def update_config_ia(
    config_id: int,
    config_data: ConfiguracaoIAUpdate,
    current_user: User = Depends(require_admin),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """Atualiza uma configuração de IA"""
    config = config_repo.get_by_id(config_id)

    if not config:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")

    if config_data.valor is not None:
        config.valor = config_data.valor
    if config_data.descricao is not None:
        config.descricao = config_data.descricao

    config_repo.commit()
    config_repo.db.refresh(config)

    return config


@router.post("/config-ia/upsert")
async def upsert_config_ia(
    data: ConfigUpsertRequest,
    current_user: User = Depends(require_admin),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """Cria ou atualiza uma configuração de IA"""
    config_repo.upsert_config(data.sistema, data.chave, data.valor)
    config_repo.commit()

    return {"success": True, "sistema": data.sistema, "chave": data.chave}


# ============================================
# Configuração de IA por Agente
# ============================================

@router.get("/config-ia/per-agent/{sistema}")
async def get_config_ia_per_agent(
    sistema: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Retorna configurações de IA por agente para um sistema.

    Mostra a hierarquia de resolução de parâmetros com indicação de herança:
    - fonte: "agent" = configurado especificamente para o agente
    - fonte: "system" = herdado do sistema
    - fonte: "global" = herdado da configuração global
    - fonte: "default" = usando valor padrão
    """
    from services.ia_params_resolver import (
        get_config_per_agent as resolver_get_config_per_agent,
        listar_agentes,
        AGENTES_POR_SISTEMA
    )

    if sistema not in AGENTES_POR_SISTEMA:
        raise HTTPException(
            status_code=404,
            detail=f"Sistema '{sistema}' não encontrado. Sistemas disponíveis: {list(AGENTES_POR_SISTEMA.keys())}"
        )

    # Obtém configurações de todos os agentes do sistema
    configs = resolver_get_config_per_agent(db, sistema)
    agentes_info = listar_agentes(sistema)

    # Formata resposta
    resultado = {
        "sistema": sistema,
        "agentes": {}
    }

    for agente_slug, params in configs.items():
        resultado["agentes"][agente_slug] = {
            "descricao": agentes_info.get(agente_slug, ""),
            "modelo": params.modelo,
            "modelo_fonte": params.modelo_source,
            "temperatura": params.temperatura,
            "temperatura_fonte": params.temperatura_source,
            "max_tokens": params.max_tokens,
            "max_tokens_fonte": params.max_tokens_source,
            "thinking_level": params.thinking_level,
            "thinking_level_fonte": params.thinking_level_source,
        }

    return resultado


@router.get("/config-ia/sistemas")
async def listar_sistemas_ia(
    current_user: User = Depends(require_admin),
):
    """Lista todos os sistemas disponíveis e seus agentes."""
    from services.ia_params_resolver import AGENTES_POR_SISTEMA

    resultado = {}
    for sistema, agentes in AGENTES_POR_SISTEMA.items():
        resultado[sistema] = {
            "agentes": [
                {"slug": slug, "descricao": desc}
                for slug, desc in agentes.items()
            ]
        }

    return resultado


# ============================================
# Gerenciamento de Modelos de IA por Sistema
# ============================================

@router.get("/modelos-ia")
async def listar_modelos_ia(
    current_user: User = Depends(require_admin),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """Lista os modelos de IA configurados por sistema"""
    configs_aj = config_repo.get_config("assistencia_judiciaria", "modelo_relatorio")
    configs_mat_analise = config_repo.get_config("matriculas", "modelo_analise")
    configs_mat_relatorio = config_repo.get_config("matriculas", "modelo_relatorio")
    configs_gp = config_repo.get_config("gerador_pecas", "modelo_agente_final")
    configs_pc = config_repo.get_config("pedido_calculo", "modelo_agente_final")

    default_model = "google/gemini-3-flash-preview"

    resultado = {
        "assistencia_judiciaria": {
            "id": configs_aj.id if configs_aj else None,
            "modelo": configs_aj.valor if configs_aj else default_model,
            "descricao": "Modelo para análise de processos judiciais"
        },
        "matriculas": {
            "id": configs_mat_analise.id if configs_mat_analise else None,
            "modelo": configs_mat_analise.valor if configs_mat_analise else default_model,
            "modelo_analise": configs_mat_analise.valor if configs_mat_analise else default_model,
            "modelo_relatorio": configs_mat_relatorio.valor if configs_mat_relatorio else default_model,
            "descricao": "Modelo para análise de matrículas imobiliárias"
        },
        "gerador_pecas": {
            "id": configs_gp.id if configs_gp else None,
            "modelo": configs_gp.valor if configs_gp else default_model,
            "descricao": "Modelo para geração de peças jurídicas"
        },
        "pedido_calculo": {
            "id": configs_pc.id if configs_pc else None,
            "modelo": configs_pc.valor if configs_pc else default_model,
            "descricao": "Modelo para geração de pedidos de cálculo"
        }
    }

    return resultado


@router.put("/modelos-ia/{sistema}")
async def atualizar_modelo_ia(
    sistema: str,
    modelo: str,
    current_user: User = Depends(require_admin),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """Atualiza o modelo de IA de um sistema específico"""
    if sistema not in ["assistencia_judiciaria", "matriculas"]:
        raise HTTPException(status_code=400, detail="Sistema inválido")

    config_repo.upsert_config(sistema, "modelo", modelo)
    config_repo.commit()

    return {"success": True, "sistema": sistema, "modelo": modelo}



# ============================================
# API pública para obter prompts (usada pelos sistemas)
# ============================================

@router.get("/api/prompts/get/{sistema}/{tipo}")
async def get_prompt_by_tipo(
    sistema: str,
    tipo: str,
    current_user: User = Depends(get_current_active_user),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo),
):
    """Obtém o conteúdo de um prompt específico (para uso interno dos sistemas)"""
    prompt = repo.get_active(sistema, tipo)

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt não encontrado ou inativo")

    return {"conteudo": prompt.conteudo}
