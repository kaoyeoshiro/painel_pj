# sistemas/gerador_pecas/router_ext_models.py
"""
Router de modelos de extracao e sincronizacao JSON.

Extraido de router_extraction.py (Fase 5a do plano de refatoracao).

Endpoints para:
- Modelos de extracao (gerados por IA ou manuais)
- Sincronizacao JSON sem IA
- Verificacao de consistencia JSON vs perguntas
- Sincronizacao perguntas com JSON
- Aplicacao de JSON como fonte de verdade (reconciliacao bidirecional)
"""

import json
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from sqlalchemy import func
from database.connection import get_db
from auth.dependencies import get_current_active_user
from auth.models import User

from .models_extraction import (
    ExtractionQuestion, ExtractionModel, ExtractionVariable,
    PromptVariableUsage
)
from .models_resumo_json import CategoriaResumoJSON
from .services_extraction import ExtractionSchemaGenerator
from .extraction_helpers import ensure_variable_for_question
from .services_json_sync import JsonSyncService
from .schemas_extraction import (
    ExtractionModelCreate, ExtractionModelResponse,
    GenerateSchemaResponse, SyncJsonResponse,
    VariavelSemPergunta, ConsistenciaJsonResponse,
    SincronizarPerguntasJsonResponse,
    AplicarJsonRequest, AplicarJsonResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# ENDPOINTS - MODELOS DE EXTRACAO
# ============================================================================


@router.get("/categorias/{categoria_id}/modelo", response_model=Optional[ExtractionModelResponse])
async def obter_modelo_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém o modelo de extração ativo de uma categoria"""
    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Busca o modelo ativo mais recente
    modelo = session_query(db, ExtractionModel).filter(
        ExtractionModel.categoria_id == categoria_id,
        ExtractionModel.ativo == True
    ).order_by(ExtractionModel.versao.desc()).first()

    if not modelo:
        return None

    return ExtractionModelResponse(
        id=modelo.id,
        categoria_id=modelo.categoria_id,
        categoria_nome=categoria.nome,
        modo=modelo.modo,
        extraction_schema=modelo.schema_json,
        mapeamento_variaveis=modelo.mapeamento_variaveis,
        versao=modelo.versao,
        ativo=modelo.ativo,
        criado_por=modelo.criado_por,
        criado_em=modelo.criado_em
    )


@router.post("/categorias/{categoria_id}/gerar-schema", response_model=GenerateSchemaResponse)
async def gerar_schema_ia(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Gera um modelo de extração JSON usando IA a partir das perguntas da categoria.

    Este endpoint:
    1. Coleta todas as perguntas ativas da categoria
    2. Envia para o Gemini 3 Flash Preview para gerar o schema
    3. Cria variáveis normalizadas a partir do mapeamento
    4. Salva o modelo de extração
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para gerar schema")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Busca perguntas ativas da categoria
    perguntas = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.categoria_id == categoria_id,
        ExtractionQuestion.ativo == True
    ).order_by(ExtractionQuestion.ordem, ExtractionQuestion.id).all()

    if not perguntas:
        raise HTTPException(status_code=400, detail="Nenhuma pergunta ativa encontrada para esta categoria")

    # Gera o schema usando o serviço de IA
    generator = ExtractionSchemaGenerator(db)
    try:
        resultado = await generator.gerar_schema(
            categoria_id=categoria_id,
            categoria_nome=categoria.nome,
            perguntas=perguntas,
            user_id=current_user.id
        )

        if not resultado.get("success"):
            return GenerateSchemaResponse(
                success=False,
                erro=resultado.get("erro", "Erro desconhecido na geração do schema")
            )

        return GenerateSchemaResponse(
            success=True,
            extraction_schema=resultado.get("schema_json"),
            mapeamento_variaveis=resultado.get("mapeamento_variaveis"),
            variaveis_criadas=resultado.get("variaveis_criadas")
        )

    except Exception as e:
        # SALVAGUARDA: Rollback explícito em caso de erro
        db.rollback()
        logger.error(f"Erro ao gerar schema (rollback realizado): {e}", exc_info=True)
        return GenerateSchemaResponse(
            success=False,
            erro=f"Erro ao gerar schema: {str(e)}"
        )


@router.post("/categorias/{categoria_id}/sincronizar-json", response_model=SyncJsonResponse)
async def sincronizar_json_sem_ia(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Sincroniza o JSON da categoria com as perguntas cadastradas, SEM usar IA.

    Este endpoint:
    1. Carrega todas as perguntas ativas da categoria (ordenadas)
    2. Carrega o JSON atual da categoria
    3. Valida que perguntas tenham slug e tipo definidos
    4. Faz merge das perguntas no JSON (adiciona novas, preserva existentes)
    5. Ordena o JSON conforme a ordem das perguntas
    6. Retorna o JSON atualizado (não salva automaticamente)

    Regras:
    - Não remove campos existentes do JSON
    - Não sobrescreve valores já definidos
    - Só adiciona perguntas "prontas" (com slug e tipo)
    - Preserva a ordem das perguntas como fonte da verdade
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para sincronizar JSON")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Delega ao servico
    service = JsonSyncService(db)
    resultado = service.sincronizar_json(categoria_id)

    return SyncJsonResponse(**resultado)


# ============================================================================
# ENDPOINTS - VERIFICACAO E SINCRONIZACAO DE CONSISTENCIA JSON vs PERGUNTAS
# ============================================================================

@router.get("/categorias/{categoria_id}/verificar-consistencia", response_model=ConsistenciaJsonResponse)
async def verificar_consistencia_json_perguntas(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Verifica a consistência entre o JSON da categoria e as perguntas cadastradas.

    Detecta:
    - Campos no JSON que não têm perguntas ativas correspondentes
    - Perguntas ativas que não estão no JSON (apenas informativo)

    IMPORTANTE: O alerta de "inconsistência" só aparece quando há ação necessária
    na sincronização (campos do JSON sem pergunta). Perguntas extras são apenas
    um aviso informativo, pois a sincronização não as remove.

    Retorna informações para decidir se é necessário sincronizar.
    """
    logger.info(f"[CONSISTENCIA] Verificando categoria_id={categoria_id}")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Carrega JSON da categoria
    try:
        schema_json = json.loads(categoria.formato_json) if categoria.formato_json else {}
    except json.JSONDecodeError:
        schema_json = {}

    # Busca perguntas ativas da categoria
    perguntas_ativas = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.categoria_id == categoria_id,
        ExtractionQuestion.ativo == True
    ).all()

    # Cria mapeamento de perguntas por slug
    perguntas_por_slug = {}
    for p in perguntas_ativas:
        if p.nome_variavel_sugerido:
            perguntas_por_slug[p.nome_variavel_sugerido] = p

    # Busca perguntas INATIVAS da categoria (para saber se podemos reativar)
    perguntas_inativas = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.categoria_id == categoria_id,
        ExtractionQuestion.ativo == False
    ).all()
    perguntas_inativas_por_slug = {}
    for p in perguntas_inativas:
        if p.nome_variavel_sugerido:
            perguntas_inativas_por_slug[p.nome_variavel_sugerido] = p

    # Busca variáveis da categoria
    variaveis = session_query(db, ExtractionVariable).filter(
        ExtractionVariable.categoria_id == categoria_id
    ).all()
    variaveis_por_slug = {v.slug: v for v in variaveis}

    # Detecta campos no JSON sem perguntas ativas
    variaveis_sem_pergunta = []
    for slug, campo_info in schema_json.items():
        if isinstance(campo_info, dict) and slug not in perguntas_por_slug:
            variavel_bd = variaveis_por_slug.get(slug)
            pergunta_inativa = perguntas_inativas_por_slug.get(slug)

            variaveis_sem_pergunta.append(VariavelSemPergunta(
                slug=slug,
                tipo=campo_info.get("type"),
                descricao=campo_info.get("description"),
                tem_variavel_bd=variavel_bd is not None,
                variavel_ativa=variavel_bd.ativo if variavel_bd else False,
                tem_pergunta_inativa=pergunta_inativa is not None,
                pergunta_inativa_id=pergunta_inativa.id if pergunta_inativa else None
            ))

    # Detecta perguntas ativas que não estão no JSON
    slugs_no_json = set(schema_json.keys())
    perguntas_sem_variavel_json = []
    for p in perguntas_ativas:
        if p.nome_variavel_sugerido and p.nome_variavel_sugerido not in slugs_no_json:
            perguntas_sem_variavel_json.append({
                "id": p.id,
                "pergunta": p.pergunta[:100] + "..." if len(p.pergunta) > 100 else p.pergunta,
                "slug": p.nome_variavel_sugerido
            })

    # Determina consistência e mensagem
    consistente = len(variaveis_sem_pergunta) == 0

    if consistente:
        if perguntas_sem_variavel_json:
            mensagem = f"JSON sincronizado. Aviso: {len(perguntas_sem_variavel_json)} pergunta(s) com slug fora do JSON (pode ser intencional)"
        else:
            mensagem = "JSON e perguntas estão sincronizados"
    else:
        partes = []
        if variaveis_sem_pergunta:
            partes.append(f"{len(variaveis_sem_pergunta)} variável(is) no JSON sem pergunta")
        mensagem = "Inconsistência detectada: " + ", ".join(partes)

    # Log do resultado para depuração
    logger.info(
        f"[CONSISTENCIA] categoria_id={categoria_id}, consistente={consistente}, "
        f"variaveis_sem_pergunta={len(variaveis_sem_pergunta)}, "
        f"perguntas_fora_json={len(perguntas_sem_variavel_json)}, "
        f"mensagem='{mensagem}'"
    )
    if variaveis_sem_pergunta:
        slugs = [v.slug for v in variaveis_sem_pergunta]
        logger.info(f"[CONSISTENCIA] Slugs sem pergunta: {slugs}")
    if perguntas_sem_variavel_json:
        slugs = [p['slug'] for p in perguntas_sem_variavel_json]
        logger.info(f"[CONSISTENCIA] Perguntas com slug fora do JSON (info): {slugs}")

    return ConsistenciaJsonResponse(
        consistente=consistente,
        total_campos_json=len([k for k, v in schema_json.items() if isinstance(v, dict)]),
        total_perguntas_ativas=len(perguntas_ativas),
        variaveis_sem_pergunta=variaveis_sem_pergunta,
        perguntas_sem_variavel_json=perguntas_sem_variavel_json,
        mensagem=mensagem
    )


@router.post("/categorias/{categoria_id}/sincronizar-perguntas-json", response_model=SincronizarPerguntasJsonResponse)
async def sincronizar_perguntas_com_json(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Sincroniza perguntas com o JSON da categoria.

    Para cada campo no JSON que não tem pergunta ativa:
    1. Se existe pergunta inativa com mesmo slug → reativa
    2. Se não existe → cria nova pergunta baseada no campo do JSON

    Também cria/reativa variáveis correspondentes se necessário.
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para sincronizar perguntas")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Carrega JSON da categoria
    try:
        schema_json = json.loads(categoria.formato_json) if categoria.formato_json else {}
    except json.JSONDecodeError:
        return SincronizarPerguntasJsonResponse(
            success=False,
            erro="JSON da categoria é inválido"
        )

    if not schema_json:
        return SincronizarPerguntasJsonResponse(
            success=False,
            erro="JSON da categoria está vazio"
        )

    # Busca perguntas ativas da categoria
    perguntas_ativas = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.categoria_id == categoria_id,
        ExtractionQuestion.ativo == True
    ).all()
    perguntas_por_slug = {p.nome_variavel_sugerido: p for p in perguntas_ativas if p.nome_variavel_sugerido}

    # Busca perguntas INATIVAS da categoria
    perguntas_inativas = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.categoria_id == categoria_id,
        ExtractionQuestion.ativo == False
    ).all()
    perguntas_inativas_por_slug = {p.nome_variavel_sugerido: p for p in perguntas_inativas if p.nome_variavel_sugerido}

    # Busca variáveis da categoria
    variaveis = session_query(db, ExtractionVariable).filter(
        ExtractionVariable.categoria_id == categoria_id
    ).all()
    variaveis_por_slug = {v.slug: v for v in variaveis}

    # Contadores
    perguntas_criadas = 0
    perguntas_reativadas = 0
    variaveis_criadas = 0
    variaveis_reativadas = 0
    detalhes = []

    # Calcula próxima ordem
    max_ordem = session_query(db, func.max(ExtractionQuestion.ordem)).filter(
        ExtractionQuestion.categoria_id == categoria_id
    ).scalar() or 0
    ordem_atual = max_ordem + 1

    # Processa cada campo do JSON
    for slug, campo_info in schema_json.items():
        if not isinstance(campo_info, dict):
            continue

        # Se já tem pergunta ativa, pula
        if slug in perguntas_por_slug:
            continue

        tipo = campo_info.get("type", "text")
        descricao = campo_info.get("description", f"Pergunta para {slug}")
        opcoes = campo_info.get("options")

        # Tenta reativar pergunta inativa
        if slug in perguntas_inativas_por_slug:
            pergunta = perguntas_inativas_por_slug[slug]
            pergunta.ativo = True
            pergunta.atualizado_por = current_user.id
            pergunta.atualizado_em = datetime.utcnow()
            perguntas_reativadas += 1
            detalhes.append({
                "acao": "pergunta_reativada",
                "slug": slug,
                "pergunta_id": pergunta.id
            })
            logger.info(f"Pergunta reativada: id={pergunta.id}, slug={slug}")
        else:
            # Cria nova pergunta
            nova_pergunta = ExtractionQuestion(
                categoria_id=categoria_id,
                pergunta=descricao,
                nome_variavel_sugerido=slug,
                tipo_sugerido=tipo,
                opcoes_sugeridas=opcoes if opcoes else None,
                ativo=True,
                ordem=ordem_atual,
                criado_por=current_user.id,
                atualizado_por=current_user.id
            )
            db.add(nova_pergunta)
            db.flush()  # Para obter o ID
            perguntas_criadas += 1
            ordem_atual += 1
            detalhes.append({
                "acao": "pergunta_criada",
                "slug": slug,
                "pergunta_id": nova_pergunta.id
            })
            logger.info(f"Pergunta criada: id={nova_pergunta.id}, slug={slug}")

        # Trata variável correspondente
        if slug in variaveis_por_slug:
            variavel = variaveis_por_slug[slug]
            if not variavel.ativo:
                variavel.ativo = True
                variavel.atualizado_em = datetime.utcnow()
                variaveis_reativadas += 1
                detalhes.append({
                    "acao": "variavel_reativada",
                    "slug": slug,
                    "variavel_id": variavel.id
                })
                logger.info(f"Variável reativada: id={variavel.id}, slug={slug}")
        else:
            # Cria nova variável
            if slug in perguntas_inativas_por_slug:
                source_question_id = perguntas_inativas_por_slug[slug].id
            else:
                pergunta_nova = session_query(db, ExtractionQuestion).filter(
                    ExtractionQuestion.categoria_id == categoria_id,
                    ExtractionQuestion.nome_variavel_sugerido == slug,
                    ExtractionQuestion.ativo == True
                ).first()
                source_question_id = pergunta_nova.id if pergunta_nova else None

            nova_variavel = ExtractionVariable(
                slug=slug,
                label=descricao[:200] if len(descricao) > 200 else descricao,
                descricao=descricao,
                tipo=tipo,
                opcoes=opcoes if opcoes else None,
                categoria_id=categoria_id,
                source_question_id=source_question_id,
                ativo=True
            )
            db.add(nova_variavel)
            variaveis_criadas += 1
            detalhes.append({
                "acao": "variavel_criada",
                "slug": slug
            })
            logger.info(f"Variável criada: slug={slug}")

    db.commit()

    # Monta mensagem
    partes = []
    if perguntas_criadas:
        partes.append(f"{perguntas_criadas} pergunta(s) criada(s)")
    if perguntas_reativadas:
        partes.append(f"{perguntas_reativadas} pergunta(s) reativada(s)")
    if variaveis_criadas:
        partes.append(f"{variaveis_criadas} variável(is) criada(s)")
    if variaveis_reativadas:
        partes.append(f"{variaveis_reativadas} variável(is) reativada(s)")

    if partes:
        mensagem = "Sincronização concluída: " + ", ".join(partes)
    else:
        mensagem = "Nenhuma ação necessária - tudo já estava sincronizado"

    return SincronizarPerguntasJsonResponse(
        success=True,
        perguntas_criadas=perguntas_criadas,
        perguntas_reativadas=perguntas_reativadas,
        variaveis_criadas=variaveis_criadas,
        variaveis_reativadas=variaveis_reativadas,
        detalhes=detalhes,
        mensagem=mensagem
    )


@router.post("/categorias/{categoria_id}/aplicar-json", response_model=AplicarJsonResponse)
async def aplicar_json_nas_perguntas(
    categoria_id: int,
    request: AplicarJsonRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Aplica o JSON como fonte de verdade, reconciliando perguntas e variáveis.

    Este endpoint faz uma SINCRONIZAÇÃO BIDIRECIONAL onde o JSON é a fonte de verdade:

    1. PARSEIA o JSON e valida estrutura e dependências
    2. CRIA perguntas/variáveis para campos novos no JSON
    3. ATUALIZA perguntas/variáveis existentes (tipo, opções, dependências, descrição)
    4. REMOVE perguntas/variáveis que não estão mais no JSON:
       - Se usada por outra categoria: apenas desassocia
       - Se não usada por nada: hard delete
       - Se usada por prompts: soft delete (inativa)

    Retorna detalhes completos da reconciliação.
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para aplicar JSON")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Delega ao servico
    service = JsonSyncService(db)
    resultado = service.reconciliar_json(
        categoria_id=categoria_id,
        json_content=request.json_content,
        confirmar_remocao_variaveis_em_uso=request.confirmar_remocao_variaveis_em_uso,
        user_id=current_user.id
    )

    return AplicarJsonResponse(**resultado)


@router.post("/modelos", response_model=ExtractionModelResponse, status_code=201)
async def criar_modelo_manual(
    data: ExtractionModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria um modelo de extração manual"""
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para criar modelos")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Desativa modelos anteriores da categoria
    session_query(db, ExtractionModel).filter(
        ExtractionModel.categoria_id == data.categoria_id,
        ExtractionModel.ativo == True
    ).update({"ativo": False})

    # Calcula próxima versão
    max_versao = session_query(db, func.max(ExtractionModel.versao)).filter(
        ExtractionModel.categoria_id == data.categoria_id
    ).scalar() or 0

    # Cria o modelo
    modelo = ExtractionModel(
        categoria_id=data.categoria_id,
        modo=data.modo,
        schema_json=data.extraction_schema,
        mapeamento_variaveis=data.mapeamento_variaveis,
        versao=max_versao + 1,
        ativo=True,
        criado_por=current_user.id
    )
    db.add(modelo)
    db.commit()
    db.refresh(modelo)

    logger.info(f"Modelo de extração criado: id={modelo.id}, categoria={categoria.nome}, modo={modelo.modo}")

    return ExtractionModelResponse(
        id=modelo.id,
        categoria_id=modelo.categoria_id,
        categoria_nome=categoria.nome,
        modo=modelo.modo,
        extraction_schema=modelo.schema_json,
        mapeamento_variaveis=modelo.mapeamento_variaveis,
        versao=modelo.versao,
        ativo=modelo.ativo,
        criado_por=modelo.criado_por,
        criado_em=modelo.criado_em
    )





