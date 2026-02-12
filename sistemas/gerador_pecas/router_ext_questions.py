# sistemas/gerador_pecas/router_ext_questions.py
"""
Router de perguntas de extracao. Extraido de router_extraction.py (Fase 5a).

Endpoints para:
- CRUD de perguntas de extração
- Criação em lote com análise de dependências (IA)
- Ordenação e posicionamento por IA
- Agrupamento determinístico por dependências
"""

import json
import re
import logging
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from auth.dependencies import get_current_active_user
from auth.models import User
from admin.perf_context import perf_ctx

from .models_extraction import (
    ExtractionQuestion, ExtractionVariable,
    PromptVariableUsage,
)
from .models_resumo_json import CategoriaResumoJSON
from .extraction_helpers import (
    _aplicar_namespace,
    ensure_variable_for_question,
    _garantir_hierarquia_dependencias,
    _agrupar_por_dependencias_algoritmo,
)
from .schemas_extraction import (
    ExtractionQuestionCreate, ExtractionQuestionUpdate,
    ExtractionQuestionResponse,
    BulkQuestionsCreate, BulkQuestionResult, BulkQuestionsResponse,
    OrdenarPerguntasRequest, PosicionarPerguntaRequest,
    OrdemPerguntaItem, AtualizarOrdemLoteRequest, AtualizarOrdemLoteResponse,
    AgruparPorDependenciasRequest, AgruparPorDependenciasResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# ENDPOINTS - PERGUNTAS DE EXTRAÇÃO
# ============================================================================



# Helpers importados de extraction_helpers.py:
# _slugify, _get_unique_slug, _aplicar_namespace, _remover_namespace


@router.get("/categorias/{categoria_id}/perguntas", response_model=List[ExtractionQuestionResponse])
async def listar_perguntas_categoria(
    categoria_id: int,
    apenas_ativos: bool = Query(True, description="Filtrar apenas ativos"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista todas as perguntas de extração de uma categoria"""
    perf_ctx.set_action("listar_perguntas_categoria")

    # Verifica se a categoria existe
    categoria = db.query(CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    query = db.query(ExtractionQuestion).filter(ExtractionQuestion.categoria_id == categoria_id)

    if apenas_ativos:
        query = query.filter(ExtractionQuestion.ativo == True)

    perguntas = query.order_by(ExtractionQuestion.ordem, ExtractionQuestion.id).all()

    # Monta resposta com nome da categoria
    resultado = []
    for p in perguntas:
        resp = ExtractionQuestionResponse(
            id=p.id,
            categoria_id=p.categoria_id,
            categoria_nome=categoria.nome,
            pergunta=p.pergunta,
            nome_variavel_sugerido=p.nome_variavel_sugerido,
            tipo_sugerido=p.tipo_sugerido,
            opcoes_sugeridas=p.opcoes_sugeridas,
            descricao=p.descricao,
            depends_on_variable=p.depends_on_variable,
            dependency_operator=p.dependency_operator,
            dependency_value=p.dependency_value,
            dependency_inferred=p.dependency_inferred,
            ativo=p.ativo,
            ordem=p.ordem,
            criado_por=p.criado_por,
            criado_em=p.criado_em,
            atualizado_em=p.atualizado_em
        )
        resultado.append(resp)

    return resultado


@router.post("/perguntas", response_model=ExtractionQuestionResponse, status_code=201)
async def criar_pergunta(
    data: ExtractionQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria uma nova pergunta de extração"""
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para criar perguntas")

    # Verifica se a categoria existe
    categoria = db.query(CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # NORMALIZA nome_variavel_sugerido COM PREFIXO DA CATEGORIA
    # Esta é a fonte de verdade - o prefixo é SEMPRE aplicado pelo backend
    nome_variavel_normalizado = None
    if data.nome_variavel_sugerido and data.nome_variavel_sugerido.strip():
        slug_input = data.nome_variavel_sugerido.strip()
        namespace = categoria.namespace
        nome_variavel_normalizado = _aplicar_namespace(slug_input, namespace)
        logger.debug(f"[PREFIXO] Normalizado: '{slug_input}' -> '{nome_variavel_normalizado}' (namespace={namespace})")

    # Valida slug duplicado na mesma categoria (usando slug JÁ normalizado)
    if nome_variavel_normalizado:
        slug_existente = db.query(ExtractionQuestion).filter(
            ExtractionQuestion.categoria_id == data.categoria_id,
            ExtractionQuestion.nome_variavel_sugerido == nome_variavel_normalizado,
            ExtractionQuestion.ativo == True
        ).first()
        if slug_existente:
            raise HTTPException(
                status_code=400,
                detail=f"Já existe uma pergunta ativa com o slug '{nome_variavel_normalizado}' nesta categoria"
            )

    # Cria a pergunta com nome_variavel_sugerido JÁ normalizado
    pergunta = ExtractionQuestion(
        categoria_id=data.categoria_id,
        pergunta=data.pergunta,
        nome_variavel_sugerido=nome_variavel_normalizado,
        tipo_sugerido=data.tipo_sugerido,
        opcoes_sugeridas=data.opcoes_sugeridas,
        descricao=data.descricao,
        depends_on_variable=data.depends_on_variable,
        dependency_operator=data.dependency_operator,
        dependency_value=data.dependency_value,
        dependency_inferred=data.dependency_inferred,
        ativo=data.ativo,
        ordem=data.ordem,
        criado_por=current_user.id
    )
    db.add(pergunta)
    db.flush()  # Obtém ID antes de criar variável

    # Cria/atualiza variável correspondente (se pergunta tiver campos mínimos)
    variavel = ensure_variable_for_question(db, pergunta, categoria)

    db.commit()
    db.refresh(pergunta)

    logger.info(f"Pergunta de extração criada: id={pergunta.id}, categoria={categoria.nome}"
                f"{f', variavel={variavel.slug}' if variavel else ''}")

    return ExtractionQuestionResponse(
        id=pergunta.id,
        categoria_id=pergunta.categoria_id,
        categoria_nome=categoria.nome,
        pergunta=pergunta.pergunta,
        nome_variavel_sugerido=pergunta.nome_variavel_sugerido,
        tipo_sugerido=pergunta.tipo_sugerido,
        opcoes_sugeridas=pergunta.opcoes_sugeridas,
        descricao=pergunta.descricao,
        depends_on_variable=pergunta.depends_on_variable,
        dependency_operator=pergunta.dependency_operator,
        dependency_value=pergunta.dependency_value,
        dependency_inferred=pergunta.dependency_inferred,
        ativo=pergunta.ativo,
        ordem=pergunta.ordem,
        criado_por=pergunta.criado_por,
        criado_em=pergunta.criado_em,
        atualizado_em=pergunta.atualizado_em
    )


@router.post("/perguntas/lote", response_model=BulkQuestionsResponse, status_code=201)
async def criar_perguntas_lote(
    data: BulkQuestionsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Cria múltiplas perguntas de extração de uma vez.

    Se analisar_dependencias=True:
    1. Envia todas as perguntas para a IA (Gemini)
    2. A IA NORMALIZA cada pergunta (reescreve de forma clara e institucional)
    3. A IA GERA o nome_base_variavel para cada pergunta
    4. A IA analisa relações de dependência entre elas
    5. Cria as perguntas com texto normalizado e variáveis definidas
    6. Retorna as perguntas criadas com suas dependências inferidas

    IMPORTANTE:
    - O texto da pergunta salvo é o NORMALIZADO pela IA (não o texto bruto)
    - O nome_variavel_sugerido é GERADO pela IA automaticamente
    - Se a IA falhar em normalizar, a operação é abortada com rollback
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para criar perguntas")

    # Verifica se a categoria existe
    categoria = db.query(CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    perguntas_resultado = []
    total_criadas = 0
    total_com_dependencias = 0
    grafo_dependencias = None

    try:
        # Mapas para dados normalizados e dependências
        perguntas_normalizadas_map = {}
        dependencias_map = {}

        # Análise com IA (normalização + dependências)
        if data.analisar_dependencias:
            from .services_dependencies import DependencyInferenceService

            service = DependencyInferenceService(db)
            resultado_analise = await service.analisar_dependencias_batch(
                perguntas=[p.pergunta for p in data.perguntas],
                nomes_variaveis=[p.nome_variavel_sugerido for p in data.perguntas],
                categoria_nome=categoria.nome
            )

            # Se a IA falhou, aborta a operação
            if not resultado_analise.get("success"):
                erro_ia = resultado_analise.get("erro", "Erro desconhecido na análise com IA")
                logger.error(f"Falha na análise com IA: {erro_ia}")
                return BulkQuestionsResponse(
                    success=False,
                    total_enviadas=len(data.perguntas),
                    total_criadas=0,
                    total_com_dependencias=0,
                    perguntas=[],
                    erro=f"Erro na normalização com IA: {erro_ia}"
                )

            perguntas_normalizadas_map = resultado_analise.get("perguntas_normalizadas", {})
            dependencias_map = resultado_analise.get("dependencias", {})
            grafo_dependencias = resultado_analise.get("grafo")

            # Valida que todas as perguntas foram normalizadas
            if len(perguntas_normalizadas_map) != len(data.perguntas):
                faltando = len(data.perguntas) - len(perguntas_normalizadas_map)
                return BulkQuestionsResponse(
                    success=False,
                    total_enviadas=len(data.perguntas),
                    total_criadas=0,
                    total_com_dependencias=0,
                    perguntas=[],
                    erro=f"A IA não conseguiu normalizar {faltando} pergunta(s). Tente novamente."
                )

        # Conta perguntas existentes para definir ordem
        perguntas_existentes = db.query(ExtractionQuestion).filter(
            ExtractionQuestion.categoria_id == data.categoria_id
        ).count()

        # Cria as perguntas na ordem, aplicando normalização e dependências
        for i, p in enumerate(data.perguntas):
            try:
                # Busca dados normalizados pela IA
                normalizado = perguntas_normalizadas_map.get(str(i), {})

                # Se tem análise de IA, usa texto normalizado, nome, tipo e opções gerados
                if data.analisar_dependencias and normalizado:
                    texto_pergunta = normalizado.get("texto_final", p.pergunta)
                    nome_variavel = normalizado.get("nome_base_variavel", p.nome_variavel_sugerido)
                    tipo_sugerido = normalizado.get("tipo_sugerido") or p.tipo_sugerido
                    opcoes_sugeridas = normalizado.get("opcoes_sugeridas") or p.opcoes_sugeridas
                else:
                    # Sem análise de IA, usa dados originais
                    texto_pergunta = p.pergunta
                    nome_variavel = p.nome_variavel_sugerido
                    tipo_sugerido = p.tipo_sugerido
                    opcoes_sugeridas = p.opcoes_sugeridas

                # NORMALIZA nome_variavel COM PREFIXO DA CATEGORIA
                # Esta é a fonte de verdade - o prefixo é SEMPRE aplicado pelo backend
                namespace = categoria.namespace
                if nome_variavel and nome_variavel.strip():
                    nome_variavel_normalizado = _aplicar_namespace(nome_variavel.strip(), namespace)
                    logger.debug(f"[PREFIXO-LOTE] Normalizado: '{nome_variavel}' -> '{nome_variavel_normalizado}'")
                    nome_variavel = nome_variavel_normalizado

                # Busca dependência inferida para esta pergunta
                dep_info = dependencias_map.get(str(i), {})
                depends_on = dep_info.get("depends_on_variable")
                dep_operator = dep_info.get("operator", "equals") if depends_on else None
                dep_value = dep_info.get("value") if depends_on else None

                # Também normaliza depends_on com prefixo
                if depends_on and depends_on.strip():
                    depends_on = _aplicar_namespace(depends_on.strip(), namespace)

                pergunta = ExtractionQuestion(
                    categoria_id=data.categoria_id,
                    pergunta=texto_pergunta,
                    nome_variavel_sugerido=nome_variavel,
                    tipo_sugerido=tipo_sugerido,
                    opcoes_sugeridas=opcoes_sugeridas,
                    depends_on_variable=depends_on,
                    dependency_operator=dep_operator,
                    dependency_value=dep_value,
                    dependency_inferred=bool(depends_on),
                    ativo=True,
                    ordem=perguntas_existentes + i,
                    criado_por=current_user.id
                )
                db.add(pergunta)
                db.flush()  # Obtém o ID antes do commit

                perguntas_resultado.append(BulkQuestionResult(
                    index=i,
                    pergunta_texto=texto_pergunta,
                    id=pergunta.id,
                    slug_sugerido=nome_variavel,
                    depends_on_variable=depends_on,
                    dependency_operator=dep_operator,
                    dependency_value=dep_value
                ))

                total_criadas += 1
                if depends_on:
                    total_com_dependencias += 1

            except Exception as e:
                # Em caso de erro, faz rollback de tudo
                db.rollback()
                logger.error(f"Erro ao criar pergunta {i}: {e}")
                return BulkQuestionsResponse(
                    success=False,
                    total_enviadas=len(data.perguntas),
                    total_criadas=0,
                    total_com_dependencias=0,
                    perguntas=[],
                    erro=f"Erro ao criar pergunta {i + 1}: {str(e)}"
                )

        db.commit()

        logger.info(f"Criadas {total_criadas} perguntas em lote para categoria {categoria.nome}")

        return BulkQuestionsResponse(
            success=True,
            total_enviadas=len(data.perguntas),
            total_criadas=total_criadas,
            total_com_dependencias=total_com_dependencias,
            perguntas=perguntas_resultado,
            grafo_dependencias=grafo_dependencias
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Erro na criação em lote: {e}")
        return BulkQuestionsResponse(
            success=False,
            total_enviadas=len(data.perguntas),
            total_criadas=0,
            total_com_dependencias=0,
            perguntas=[],
            erro=str(e)
        )


# ============================================================================
# ORDENAÇÃO DE PERGUNTAS POR IA
# ============================================================================

@router.post("/perguntas/ordenar-ia")
async def ordenar_perguntas_ia(
    data: OrdenarPerguntasRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Reordena todas as perguntas usando IA para determinar a ordem mais lógica.
    Usa gemini-3-flash-preview para análise semântica.
    """
    from services.gemini_service import gemini_service, get_thinking_level

    if len(data.perguntas) < 2:
        return {"success": False, "erro": "Necessário pelo menos 2 perguntas para ordenar"}

    # Obtém thinking_level da config
    thinking_level = get_thinking_level(db, "gerador_pecas")

    # Monta prompt para IA com informações de dependência
    perguntas_texto = "\n".join([
        f"- {p.pergunta}" +
        (f" (tipo: {p.tipo_sugerido})" if p.tipo_sugerido else "") +
        (f" [CONDICIONAL: depende de '{p.depends_on_variable}']" if p.depends_on_variable else "")
        for p in data.perguntas
    ])

    prompt = f"""Você é um especialista em extração de dados de documentos jurídicos.

TAREFA: Reordenar as perguntas de extração para a categoria "{data.categoria_nome}" na ordem mais lógica.

REGRA CENTRAL DE ORDENAÇÃO (MUITO IMPORTANTE):
⚠️ Perguntas condicionais NÃO devem ser jogadas todas para o final.
A regra correta é:
- Cada pergunta CONDICIONAL deve ficar LOGO ABAIXO da sua pergunta âncora (a pergunta da qual depende)
- A estrutura deve seguir este padrão:
  * Pergunta âncora (pergunta principal)
  * Suas perguntas condicionais imediatas (logo abaixo)
  * Próxima pergunta âncora
  * Condicionais dela (logo abaixo)
  * E assim por diante...
- Apenas perguntas realmente residuais ou finais ficam no final do fluxo

CRITÉRIOS ADICIONAIS DE ORDENAÇÃO:
1. Informações de identificação primeiro (partes, número do processo, tipo de ação, datas)
2. Informações gerais/estruturais antes de específicas
3. Para perguntas âncora: seguir fluxo lógico de leitura do documento
4. Para perguntas condicionais: sempre imediatamente após sua âncora
5. Valores monetários e cálculos geralmente no final
6. Não separar uma pergunta condicional da sua âncora - elas devem estar adjacentes

EXEMPLO CONCEITUAL:
- "Existe pedido de tutela de urgência?" (âncora)
- "Quais são os detalhes da tutela?" (condicional - logo abaixo)
- "Existe pedido alternativo?" (âncora)
- "Qual é o pedido alternativo?" (condicional - logo abaixo)
- "Qual o valor da causa?" (pergunta final)

PERGUNTAS PARA ORDENAR:
{perguntas_texto}

RESPONDA APENAS com um JSON válido no formato:
{{"ordered_question_ids": ["pergunta exata 1", "pergunta exata 2", ...]}}

REGRAS DE RESPOSTA:
- Use EXATAMENTE o texto das perguntas fornecidas, sem modificar
- Não adicione, remova ou modifique perguntas
- Não inclua markdown, apenas JSON puro
- O campo deve ser "ordered_question_ids" com array de strings"""

    try:
        response = await gemini_service.generate(
            prompt=prompt,
            system_prompt="Você reordena perguntas de extração de dados. Responda APENAS com JSON válido.",
            model="gemini-3-flash-preview",
            temperature=0.1,
            thinking_level=thinking_level  # Configurável em /admin/prompts-config
        )

        if not response.success:
            return {"success": False, "erro": f"Erro na IA: {response.error}"}

        # Parseia resposta
        content = response.content.strip()
        # Remove markdown se houver
        if content.startswith("```"):
            content = re.sub(r'^```\w*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)

        resultado = json.loads(content)
        # Suporta ambos os formatos: "ordered_question_ids" (novo) e "ordem" (legado)
        ordem = resultado.get("ordered_question_ids", resultado.get("ordem", []))

        # Mapeia perguntas originais para a nova ordem
        pergunta_map = {p.pergunta.strip().lower(): p for p in data.perguntas}
        ordem_final = []

        for pergunta_texto in ordem:
            p = pergunta_map.get(pergunta_texto.strip().lower())
            if p:
                ordem_final.append({
                    "id": p.id,
                    "pergunta": p.pergunta
                })

        # Adiciona perguntas que não foram incluídas na ordem (fallback)
        incluidas = {o["pergunta"].strip().lower() for o in ordem_final}
        for p in data.perguntas:
            if p.pergunta.strip().lower() not in incluidas:
                ordem_final.append({
                    "id": p.id,
                    "pergunta": p.pergunta
                })

        # CORREÇÃO DETERMINÍSTICA: Garante que dependentes fiquem imediatamente após suas âncoras
        ordem_final = _garantir_hierarquia_dependencias(ordem_final, data.perguntas)

        logger.info(f"Perguntas reordenadas por IA para categoria '{data.categoria_nome}'")

        return {
            "success": True,
            "ordem": ordem_final
        }

    except Exception as e:
        logger.error(f"Erro ao ordenar perguntas com IA: {e}")
        return {"success": False, "erro": str(e)}


@router.post("/perguntas/posicionar-ia")
async def posicionar_pergunta_ia(
    data: PosicionarPerguntaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Determina a melhor posição para uma nova pergunta usando IA.
    Usa gemini-3-flash-preview para análise semântica.
    """
    from services.gemini_service import gemini_service, get_thinking_level

    if not data.perguntas_existentes:
        return {"success": True, "posicao": 0}

    # Obtém thinking_level da config
    thinking_level = get_thinking_level(db, "gerador_pecas")

    # Monta lista de perguntas existentes com suas posições
    perguntas_existentes = "\n".join([
        f"{i}. {p.get('pergunta', '')}"
        for i, p in enumerate(data.perguntas_existentes)
    ])

    prompt = f"""Você é um especialista em extração de dados de documentos jurídicos.

TAREFA: Determinar a melhor posição para inserir uma NOVA pergunta na lista existente.

CATEGORIA: {data.categoria_nome}

NOVA PERGUNTA: {data.nova_pergunta.pergunta}
{f"Tipo sugerido: {data.nova_pergunta.tipo_sugerido}" if data.nova_pergunta.tipo_sugerido else ""}

PERGUNTAS EXISTENTES (ordenadas):
{perguntas_existentes}

REGRA CENTRAL:
- Se a nova pergunta é CONDICIONAL (depende de outra), deve ficar LOGO APÓS a pergunta âncora
- Se a nova pergunta é uma ÂNCORA (pode ter condicionais), considere onde ela se encaixa no fluxo

CRITÉRIOS DE POSICIONAMENTO:
1. Identificação primeiro (partes, número, tipo de ação, datas)
2. Informações gerais/estruturais antes de específicas
3. Se condicional: imediatamente após sua âncora (pergunta da qual depende)
4. Valores monetários e cálculos geralmente no final
5. Mantenha o fluxo lógico de leitura do documento

RESPONDA APENAS com um JSON: {{"posicao": N}}
Onde N é o índice onde inserir (0 = primeira posição, antes de todas).
Se a posição sugerida estiver fora dos limites (0 a {len(data.perguntas_existentes)}), será ajustada automaticamente."""

    try:
        response = await gemini_service.generate(
            prompt=prompt,
            system_prompt="Você posiciona perguntas de extração. Responda APENAS com JSON válido.",
            model="gemini-3-flash-preview",
            temperature=0.1,
            thinking_level=thinking_level  # Configurável em /admin/prompts-config
        )

        if not response.success:
            return {"success": False, "posicao": len(data.perguntas_existentes)}

        # Parseia resposta
        content = response.content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```\w*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)

        resultado = json.loads(content)
        posicao = resultado.get("posicao", len(data.perguntas_existentes))

        # Garante que posição está dentro dos limites
        posicao = max(0, min(posicao, len(data.perguntas_existentes)))

        logger.info(f"IA posicionou nova pergunta em {posicao} para categoria '{data.categoria_nome}'")

        return {
            "success": True,
            "posicao": posicao
        }

    except Exception as e:
        logger.error(f"Erro ao posicionar pergunta com IA: {e}")
        return {"success": False, "posicao": len(data.perguntas_existentes)}


@router.get("/perguntas/{pergunta_id}", response_model=ExtractionQuestionResponse)
async def obter_pergunta(
    pergunta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém uma pergunta específica"""
    perf_ctx.set_action("obter_pergunta")

    # PERFORMANCE: Usa LEFT JOIN para buscar categoria em uma única query
    # (ExtractionQuestion não tem relacionamento direto com CategoriaResumoJSON)
    result = db.query(
        ExtractionQuestion,
        CategoriaResumoJSON.nome.label("categoria_nome")
    ).outerjoin(
        CategoriaResumoJSON,
        ExtractionQuestion.categoria_id == CategoriaResumoJSON.id
    ).filter(ExtractionQuestion.id == pergunta_id).first()

    if not result:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    pergunta, categoria_nome = result

    return ExtractionQuestionResponse(
        id=pergunta.id,
        categoria_id=pergunta.categoria_id,
        categoria_nome=categoria_nome,
        pergunta=pergunta.pergunta,
        nome_variavel_sugerido=pergunta.nome_variavel_sugerido,
        tipo_sugerido=pergunta.tipo_sugerido,
        opcoes_sugeridas=pergunta.opcoes_sugeridas,
        descricao=pergunta.descricao,
        depends_on_variable=pergunta.depends_on_variable,
        dependency_operator=pergunta.dependency_operator,
        dependency_value=pergunta.dependency_value,
        dependency_inferred=pergunta.dependency_inferred,
        fonte_verdade_tipo=pergunta.fonte_verdade_tipo,
        fonte_verdade_override=pergunta.fonte_verdade_override,
        ativo=pergunta.ativo,
        ordem=pergunta.ordem,
        criado_por=pergunta.criado_por,
        criado_em=pergunta.criado_em,
        atualizado_em=pergunta.atualizado_em
    )


@router.put("/perguntas/{pergunta_id}", response_model=ExtractionQuestionResponse)
async def atualizar_pergunta(
    pergunta_id: int,
    data: ExtractionQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza uma pergunta existente"""
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para editar perguntas")

    pergunta = db.query(ExtractionQuestion).filter(ExtractionQuestion.id == pergunta_id).first()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    # Busca categoria ANTES para poder normalizar o slug
    categoria = db.query(CategoriaResumoJSON).filter(CategoriaResumoJSON.id == pergunta.categoria_id).first()
    namespace = categoria.namespace if categoria else ""

    # Guarda slug antigo ANTES de atualizar
    slug_antigo = pergunta.nome_variavel_sugerido

    # NORMALIZA nome_variavel_sugerido COM PREFIXO DA CATEGORIA
    # Esta é a fonte de verdade - o prefixo é SEMPRE aplicado pelo backend
    update_data = data.model_dump(exclude_unset=True)
    if "nome_variavel_sugerido" in update_data:
        novo_slug_input = update_data.get("nome_variavel_sugerido")
        if novo_slug_input and novo_slug_input.strip():
            novo_slug_normalizado = _aplicar_namespace(novo_slug_input.strip(), namespace)
            update_data["nome_variavel_sugerido"] = novo_slug_normalizado
            logger.debug(f"[PREFIXO-UPDATE] Normalizado: '{novo_slug_input}' -> '{novo_slug_normalizado}' (namespace={namespace})")

    # Valida slug duplicado na mesma categoria (usando slug JÁ normalizado)
    novo_slug = update_data.get("nome_variavel_sugerido")
    if novo_slug and novo_slug.strip() and novo_slug != slug_antigo:
        slug_existente = db.query(ExtractionQuestion).filter(
            ExtractionQuestion.categoria_id == pergunta.categoria_id,
            ExtractionQuestion.nome_variavel_sugerido == novo_slug,
            ExtractionQuestion.id != pergunta_id,
            ExtractionQuestion.ativo == True
        ).first()
        if slug_existente:
            raise HTTPException(
                status_code=400,
                detail=f"Já existe uma pergunta ativa com o slug '{novo_slug}' nesta categoria"
            )

    # Atualiza campos fornecidos (com nome_variavel_sugerido JÁ normalizado)
    for field, value in update_data.items():
        setattr(pergunta, field, value)

    pergunta.atualizado_por = current_user.id
    pergunta.atualizado_em = datetime.utcnow()

    # Nota: categoria já foi buscada acima para normalizar o slug

    # =========================================================================
    # DETECCAO DE MUDANCA DE SLUG - PROPAGACAO AUTOMATICA
    # =========================================================================
    # Se o slug mudou, precisamos RENOMEAR a variavel existente (nao sobrescrever)
    novo_slug_final = pergunta.nome_variavel_sugerido
    variavel = None

    if slug_antigo and novo_slug_final and slug_antigo != novo_slug_final:
        # Slug foi alterado pelo usuario - RENOMEAR a variavel
        variavel_existente = db.query(ExtractionVariable).filter(
            ExtractionVariable.source_question_id == pergunta.id
        ).first()

        if variavel_existente:
            from .services_slug_rename import SlugRenameService

            service = SlugRenameService(db)
            result = service.renomear(
                variavel_id=variavel_existente.id,
                novo_slug=novo_slug_final,
                normalizar=False,  # Slug ja esta no formato desejado
                skip_pergunta=True  # Pergunta ja foi atualizada acima
            )

            if result.success:
                variavel = variavel_existente
                logger.info(
                    f"[SLUG-RENAME-PERGUNTA] Slug renomeado: {result.old_slug} -> {result.new_slug} "
                    f"(pergunta_id={pergunta.id}, prompts={result.prompts_atualizados}, "
                    f"deps={result.variaveis_dependentes_atualizadas + result.perguntas_dependentes_atualizadas})"
                )
            else:
                # Falha na renomeacao - reverte slug da pergunta e lanca erro
                pergunta.nome_variavel_sugerido = slug_antigo
                raise HTTPException(
                    status_code=400,
                    detail=f"Erro ao renomear slug: {result.error}"
                )
        else:
            # Nao existe variavel vinculada - cria nova com o novo slug
            variavel = ensure_variable_for_question(db, pergunta, categoria) if categoria else None
    else:
        # Slug nao mudou - comportamento normal
        variavel = ensure_variable_for_question(db, pergunta, categoria) if categoria else None

    db.commit()
    db.refresh(pergunta)

    logger.info(f"Pergunta de extração atualizada: id={pergunta.id}"
                f"{f', variavel={variavel.slug}' if variavel else ''}")

    return ExtractionQuestionResponse(
        id=pergunta.id,
        categoria_id=pergunta.categoria_id,
        categoria_nome=categoria.nome if categoria else None,
        pergunta=pergunta.pergunta,
        nome_variavel_sugerido=pergunta.nome_variavel_sugerido,
        tipo_sugerido=pergunta.tipo_sugerido,
        opcoes_sugeridas=pergunta.opcoes_sugeridas,
        descricao=pergunta.descricao,
        depends_on_variable=pergunta.depends_on_variable,
        dependency_operator=pergunta.dependency_operator,
        dependency_value=pergunta.dependency_value,
        dependency_inferred=pergunta.dependency_inferred,
        ativo=pergunta.ativo,
        ordem=pergunta.ordem,
        criado_por=pergunta.criado_por,
        criado_em=pergunta.criado_em,
        atualizado_em=pergunta.atualizado_em
    )


@router.put("/perguntas/ordem-lote", response_model=AtualizarOrdemLoteResponse)
async def atualizar_ordem_perguntas_lote(
    data: AtualizarOrdemLoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Atualiza a ordem de múltiplas perguntas em uma única requisição.

    PERFORMANCE: Este endpoint substitui N requisições PUT individuais por uma única
    requisição batch, reduzindo drasticamente a latência em conexões de alta latência.

    Exemplo de uso:
    ```json
    {
        "categoria_id": 1,
        "perguntas": [
            {"id": 10, "ordem": 0},
            {"id": 15, "ordem": 1},
            {"id": 12, "ordem": 2}
        ]
    }
    ```
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para editar perguntas")

    # Verifica se a categoria existe
    categoria = db.query(CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Extrai IDs para buscar todas as perguntas de uma vez
    ids_perguntas = [p.id for p in data.perguntas]

    # Busca todas as perguntas em uma única query
    perguntas_db = db.query(ExtractionQuestion).filter(
        ExtractionQuestion.id.in_(ids_perguntas),
        ExtractionQuestion.categoria_id == data.categoria_id
    ).all()

    # Cria mapa id -> pergunta para acesso O(1)
    perguntas_map = {p.id: p for p in perguntas_db}

    # Valida que todas as perguntas existem e pertencem à categoria
    ids_encontrados = set(perguntas_map.keys())
    ids_solicitados = set(ids_perguntas)
    ids_faltantes = ids_solicitados - ids_encontrados

    if ids_faltantes:
        raise HTTPException(
            status_code=404,
            detail=f"Perguntas não encontradas ou não pertencem à categoria: {list(ids_faltantes)}"
        )

    # Atualiza ordem de todas as perguntas
    now = datetime.utcnow()
    atualizadas = 0

    for item in data.perguntas:
        pergunta = perguntas_map[item.id]
        if pergunta.ordem != item.ordem:  # Só atualiza se mudou
            pergunta.ordem = item.ordem
            pergunta.atualizado_por = current_user.id
            pergunta.atualizado_em = now
            atualizadas += 1

    # Commit único para todas as mudanças
    db.commit()

    logger.info(f"Ordem de {atualizadas} perguntas atualizada em lote para categoria {categoria.nome}")

    return AtualizarOrdemLoteResponse(
        success=True,
        atualizadas=atualizadas,
        message=f"{atualizadas} perguntas reordenadas com sucesso"
    )


@router.post("/perguntas/agrupar-por-dependencias", response_model=AgruparPorDependenciasResponse)
async def agrupar_perguntas_por_dependencias(
    data: AgruparPorDependenciasRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Agrupa perguntas por dependências de forma determinística (sem IA).

    Move as perguntas dependentes para perto das perguntas mães,
    mantendo a hierarquia (mãe → filhos → netos) e preservando
    a ordem relativa original.

    Regras:
    1. Perguntas "mãe" (raízes) mantêm ordem relativa original
    2. Filhos ficam imediatamente abaixo de seus pais
    3. Hierarquia é preservada em múltiplos níveis
    4. Ciclos são detectados e reportados (perguntas mantêm ordem atual)
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para reordenar perguntas")

    # Verifica se a categoria existe
    categoria = db.query(CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Busca todas as perguntas ativas da categoria
    perguntas = db.query(ExtractionQuestion).filter(
        ExtractionQuestion.categoria_id == data.categoria_id,
        ExtractionQuestion.ativo == True
    ).order_by(ExtractionQuestion.ordem, ExtractionQuestion.id).all()

    if len(perguntas) < 2:
        return AgruparPorDependenciasResponse(
            success=True,
            nova_ordem=[],
            ciclos_detectados=[],
            atualizadas=0,
            message="Categoria tem menos de 2 perguntas, nada a reordenar"
        )

    # Aplica algoritmo de agrupamento
    resultado, ciclos = _agrupar_por_dependencias_algoritmo(perguntas)

    # Atualiza ordem no banco
    now = datetime.utcnow()
    atualizadas = 0
    nova_ordem = []

    for nova_pos, item in enumerate(resultado):
        p = item["pergunta"]
        nova_ordem.append({
            "id": p.id,
            "pergunta": p.pergunta[:100],
            "ordem": nova_pos,
            "nivel": item["nivel"],
            "depends_on": p.depends_on_variable
        })

        if p.ordem != nova_pos:
            p.ordem = nova_pos
            p.atualizado_por = current_user.id
            p.atualizado_em = now
            atualizadas += 1

    db.commit()

    logger.info(f"Perguntas agrupadas por dependências para categoria {categoria.nome}: {atualizadas} reordenadas")

    if ciclos:
        logger.warning(f"Ciclos detectados na categoria {categoria.nome}: {ciclos}")

    return AgruparPorDependenciasResponse(
        success=True,
        nova_ordem=nova_ordem,
        ciclos_detectados=ciclos,
        atualizadas=atualizadas,
        message=f"{atualizadas} perguntas reordenadas. " +
                (f"Atenção: {len(ciclos)} ciclo(s) detectado(s)." if ciclos else "Hierarquia organizada com sucesso.")
    )


@router.delete("/perguntas/{pergunta_id}")
async def excluir_pergunta(
    pergunta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Exclui uma pergunta e a variável associada (HARD DELETE).

    COMPORTAMENTO:
    - SEMPRE faz HARD DELETE (apaga do banco)
    - Remove automaticamente a variável do JSON da categoria
    - Remove automaticamente referências em PromptVariableUsage
    - Remove automaticamente dependências de outras perguntas/variáveis

    Isso garante limpeza completa e evita variáveis órfãs no sistema.
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para excluir perguntas")

    pergunta = db.query(ExtractionQuestion).filter(ExtractionQuestion.id == pergunta_id).first()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    categoria_id = pergunta.categoria_id
    categoria = db.query(CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()

    # Busca a variável associada
    variavel = db.query(ExtractionVariable).filter(
        ExtractionVariable.source_question_id == pergunta_id
    ).first()

    limpezas_realizadas = {
        "json_atualizado": False,
        "prompts_removidos": 0,
        "dependencias_perguntas_removidas": 0,
        "dependencias_variaveis_removidas": 0
    }

    variavel_info = None

    if variavel:
        slug = variavel.slug

        variavel_info = {
            "slug": slug,
            "id": variavel.id
        }

        # 1. REMOVE DO JSON DA CATEGORIA
        if categoria and categoria.formato_json:
            try:
                json_data = json.loads(categoria.formato_json)
                if slug in json_data:
                    del json_data[slug]
                    categoria.formato_json = json.dumps(json_data, ensure_ascii=False, indent=2)
                    categoria.atualizado_em = datetime.utcnow()
                    limpezas_realizadas["json_atualizado"] = True
                    logger.info(f"Variável '{slug}' removida do JSON da categoria {categoria.nome}")
            except json.JSONDecodeError:
                logger.warning(f"JSON inválido na categoria {categoria_id}, não foi possível limpar variável")

        # 2. REMOVE REFERÊNCIAS EM PROMPTS (PromptVariableUsage)
        usos_prompts = db.query(PromptVariableUsage).filter(
            PromptVariableUsage.variable_slug == slug
        ).all()

        for uso in usos_prompts:
            db.delete(uso)

        limpezas_realizadas["prompts_removidos"] = len(usos_prompts)
        if usos_prompts:
            logger.info(f"Removidos {len(usos_prompts)} usos da variável '{slug}' em prompts")

        # 3. REMOVE DEPENDÊNCIAS DE OUTRAS PERGUNTAS
        perguntas_dependentes = db.query(ExtractionQuestion).filter(
            ExtractionQuestion.depends_on_variable == slug
        ).all()

        for p in perguntas_dependentes:
            p.depends_on_variable = None
            p.dependency_operator = None
            p.dependency_value = None
            p.dependency_inferred = False
            p.atualizado_em = datetime.utcnow()

        limpezas_realizadas["dependencias_perguntas_removidas"] = len(perguntas_dependentes)
        if perguntas_dependentes:
            logger.info(f"Removidas dependências de {len(perguntas_dependentes)} perguntas para '{slug}'")

        # 4. REMOVE DEPENDÊNCIAS DE OUTRAS VARIÁVEIS
        variaveis_dependentes = db.query(ExtractionVariable).filter(
            ExtractionVariable.depends_on_variable == slug
        ).all()

        for v in variaveis_dependentes:
            v.depends_on_variable = None
            v.is_conditional = False
            v.dependency_config = None
            v.atualizado_em = datetime.utcnow()

        limpezas_realizadas["dependencias_variaveis_removidas"] = len(variaveis_dependentes)
        if variaveis_dependentes:
            logger.info(f"Removidas dependências de {len(variaveis_dependentes)} variáveis para '{slug}'")

        # 5. HARD DELETE DA VARIÁVEL
        db.delete(variavel)
        logger.info(f"Variável HARD DELETE: slug={slug}")

    # HARD DELETE DA PERGUNTA
    pergunta_texto = pergunta.pergunta[:100]
    db.delete(pergunta)

    db.commit()

    logger.info(f"Pergunta de extração excluída permanentemente: id={pergunta_id}")

    # Monta mensagem de retorno
    message_parts = ["Pergunta excluída permanentemente"]

    if variavel_info:
        message_parts.append(f"variável '{variavel_info['slug']}' excluída")

        if limpezas_realizadas["json_atualizado"]:
            message_parts.append("removida do JSON")

        if limpezas_realizadas["prompts_removidos"] > 0:
            message_parts.append(f"removida de {limpezas_realizadas['prompts_removidos']} prompt(s)")

        if limpezas_realizadas["dependencias_perguntas_removidas"] > 0:
            message_parts.append(
                f"{limpezas_realizadas['dependencias_perguntas_removidas']} dependência(s) de pergunta(s) limpas"
            )

    return {
        "success": True,
        "message": ", ".join(message_parts),
        "variavel_info": variavel_info,
        "limpezas_realizadas": limpezas_realizadas
    }
