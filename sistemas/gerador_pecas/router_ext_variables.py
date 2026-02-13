# sistemas/gerador_pecas/router_ext_variables.py
"""
Router de variaveis de extracao. Extraido de router_extraction.py (Fase 5a).

Endpoints para:
- CRUD de variáveis normalizadas do sistema
- Resumo e listagem de variáveis
- Variáveis de processo (XML)
- Renomeação de slug com propagação transacional
- Verificação de consistência e referências
- Tipos de dados disponíveis
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
from utils.timezone import get_utc_now

from .models_extraction import (
    ExtractionQuestion, ExtractionVariable,
    PromptVariableUsage,
)
from .models_resumo_json import CategoriaResumoJSON
from .schemas_extraction import (
    ExtractionVariableCreate, ExtractionVariableUpdate,
    ExtractionVariableResponse, VariableUsageResponse, VariableDetailResponse,
    RenomearSlugRequest, RenomearSlugResponse,
    ConsistenciaSlugResponse, ReferenciasSlugResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# ENDPOINTS - VARIÁVEIS NORMALIZADAS
# ============================================================================

@router.get("/variaveis", response_model=List[ExtractionVariableResponse])
async def listar_variaveis(
    categoria_id: Optional[int] = Query(None, description="Filtrar por categoria"),
    source_question_id: Optional[int] = Query(None, description="Filtrar por pergunta de origem"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    busca: Optional[str] = Query(None, description="Buscar por slug ou label"),
    apenas_ativos: bool = Query(True, description="Filtrar apenas ativos"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista todas as variáveis normalizadas do sistema.

    OTIMIZADO: Usa JOINs e subqueries para evitar N+1 queries.
    """
    from sqlalchemy import func as sql_func, case
    # 1. QUERY PRINCIPAL com JOINs (evita N+1)
    # Subquery para contar uso de variáveis em prompts
    uso_subquery = session_query(db, 
        PromptVariableUsage.variable_slug,
        sql_func.count(PromptVariableUsage.id).label('uso_count')
    ).group_by(PromptVariableUsage.variable_slug).subquery()

    # Query principal com JOINs - agora inclui formato_json para verificação real
    query = session_query(db, 
        ExtractionVariable,
        CategoriaResumoJSON.nome.label('categoria_nome'),
        CategoriaResumoJSON.formato_json.label('categoria_formato_json'),  # Para verificar se slug está no JSON
        ExtractionQuestion.ordem.label('pergunta_ordem'),
        ExtractionQuestion.depends_on_variable.label('pergunta_depends_on'),
        sql_func.coalesce(uso_subquery.c.uso_count, 0).label('uso_count')
    ).outerjoin(
        CategoriaResumoJSON,
        ExtractionVariable.categoria_id == CategoriaResumoJSON.id
    ).outerjoin(
        ExtractionQuestion,
        ExtractionVariable.source_question_id == ExtractionQuestion.id
    ).outerjoin(
        uso_subquery,
        ExtractionVariable.slug == uso_subquery.c.variable_slug
    )

    # Aplica filtros
    if categoria_id:
        query = query.filter(ExtractionVariable.categoria_id == categoria_id)

    if source_question_id:
        query = query.filter(ExtractionVariable.source_question_id == source_question_id)

    if tipo:
        query = query.filter(ExtractionVariable.tipo == tipo)

    if busca:
        busca_like = f"%{busca}%"
        query = query.filter(
            (ExtractionVariable.slug.ilike(busca_like)) |
            (ExtractionVariable.label.ilike(busca_like))
        )

    if apenas_ativos:
        query = query.filter(ExtractionVariable.ativo == True)

    # Ordena e pagina
    query = query.order_by(
        ExtractionVariable.categoria_id,
        ExtractionQuestion.ordem.nulls_last(),
        ExtractionVariable.slug
    ).offset(offset).limit(limit)

    # Executa query principal (1 query apenas!)
    resultados_query = query.all()

    # 2. PRÉ-CALCULAR PROFUNDIDADES (sem queries adicionais)
    # Primeiro, monta mapa de dependências a partir dos resultados
    deps_map = {}
    for row in resultados_query:
        v = row[0]  # ExtractionVariable
        pergunta_depends_on = row.pergunta_depends_on
        depends_on = pergunta_depends_on if pergunta_depends_on else v.depends_on_variable
        if depends_on:
            deps_map[v.slug] = depends_on

    # Calcula profundidades sem queries
    depth_map = {}

    def calcular_profundidade_local(slug: str, visitados: set = None) -> int:
        if visitados is None:
            visitados = set()
        if slug in depth_map:
            return depth_map[slug]
        if slug in visitados:
            return 0  # Evita ciclos
        if slug not in deps_map:
            depth_map[slug] = 0
            return 0

        visitados.add(slug)
        parent_depth = calcular_profundidade_local(deps_map[slug], visitados)
        depth_map[slug] = parent_depth + 1
        return depth_map[slug]

    # Pré-calcula todas as profundidades
    for slug in deps_map:
        calcular_profundidade_local(slug)

    # 3. PRÉ-CARREGAR NOMES DE PROMPTS QUE USAM VARIÁVEIS
    # Busca todos os usos de variáveis com nomes dos prompts
    from admin.models_prompts import PromptModulo
    prompts_por_variavel = {}

    usos_com_nomes = session_query(db, 
        PromptVariableUsage.variable_slug,
        PromptModulo.titulo
    ).join(
        PromptModulo,
        PromptVariableUsage.prompt_id == PromptModulo.id
    ).all()

    for uso in usos_com_nomes:
        slug = uso.variable_slug
        if slug not in prompts_por_variavel:
            prompts_por_variavel[slug] = []
        if uso.titulo not in prompts_por_variavel[slug]:
            prompts_por_variavel[slug].append(uso.titulo)

    # 4. MONTA RESPOSTA
    resultado = []

    for row in resultados_query:
        v = row[0]  # ExtractionVariable
        categoria_nome = row.categoria_nome
        categoria_formato_json = row.categoria_formato_json
        pergunta_ordem = row.pergunta_ordem
        pergunta_depends_on = row.pergunta_depends_on
        uso_count = row.uso_count or 0

        # Determina dependência (prioriza pergunta sobre variável)
        is_conditional = v.is_conditional or False
        depends_on = v.depends_on_variable

        if pergunta_depends_on:
            is_conditional = True
            depends_on = pergunta_depends_on

        # Usa ordem da pergunta ou 0
        ordem = pergunta_ordem or 0

        # Usa profundidade pré-calculada
        depth = depth_map.get(v.slug, 0) if depends_on else 0

        # VERIFICAÇÃO REAL: Determina se está presente no JSON da categoria
        em_uso_json = False
        if categoria_formato_json:
            try:
                json_data = json.loads(categoria_formato_json)
                em_uso_json = v.slug in json_data
            except json.JSONDecodeError:
                em_uso_json = False

        # Lista de prompts que usam esta variável
        prompts_usando = prompts_por_variavel.get(v.slug, [])

        resp = ExtractionVariableResponse(
            id=v.id,
            slug=v.slug,
            label=v.label,
            descricao=v.descricao,
            tipo=v.tipo,
            categoria_id=v.categoria_id,
            categoria_nome=categoria_nome,
            opcoes=v.opcoes,
            fonte_verdade_codigo=v.fonte_verdade_codigo,
            fonte_verdade_tipo=v.fonte_verdade_tipo,
            fonte_verdade_override=v.fonte_verdade_override or False,
            source_question_id=v.source_question_id,
            ativo=v.ativo if v.ativo is not None else True,
            criado_em=v.criado_em,
            atualizado_em=v.atualizado_em,
            uso_count=uso_count,  # Mantém para retrocompatibilidade
            uso_count_prompts=uso_count,  # Novo campo explícito
            is_conditional=is_conditional,
            depends_on_variable=depends_on,
            depth=depth,
            ordem=ordem,
            em_uso_json=em_uso_json,
            prompts_usando=prompts_usando if prompts_usando else None
        )
        resultado.append(resp)

    # 4. ADICIONA VARIÁVEIS DO PROCESSO (categoria "Sistema")
    # Só adiciona se não houver filtro de categoria específica ou se for busca
    if not categoria_id or busca:
        from .services_process_variables import ProcessVariableResolver
        variaveis_processo = ProcessVariableResolver.get_all_definitions()

        # Filtra por busca se necessário
        if busca:
            busca_lower = busca.lower()
            variaveis_processo = [
                v for v in variaveis_processo
                if busca_lower in v.slug.lower() or busca_lower in v.label.lower()
            ]

        # Filtra por tipo se necessário
        if tipo:
            variaveis_processo = [v for v in variaveis_processo if v.tipo == tipo]

        # Adiciona ao resultado
        now = datetime.now()
        for idx, v in enumerate(variaveis_processo):
            # Verifica se variável do sistema está em uso por prompts
            prompts_usando_sistema = prompts_por_variavel.get(v.slug, [])
            uso_count_sistema = len(prompts_usando_sistema)

            resp = ExtractionVariableResponse(
                id=-(idx + 1),  # IDs negativos para variáveis do processo
                slug=v.slug,
                label=v.label,
                descricao=v.descricao,
                tipo=v.tipo,
                categoria_id=None,
                categoria_nome="Sistema",
                opcoes=None,
                fonte_verdade_codigo=None,
                fonte_verdade_tipo="processo_xml",
                fonte_verdade_override=False,
                source_question_id=None,
                ativo=True,
                criado_em=now,
                atualizado_em=now,
                uso_count=uso_count_sistema,
                uso_count_prompts=uso_count_sistema,
                is_conditional=False,
                depends_on_variable=None,
                depth=0,
                ordem=idx,
                em_uso_json=False,  # Variáveis de sistema não ficam em JSON de categoria
                prompts_usando=prompts_usando_sistema if prompts_usando_sistema else None
            )
            resultado.append(resp)

    return resultado


@router.get("/variaveis/resumo")
async def resumo_variaveis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna um resumo das variáveis do sistema.

    Inclui:
    - Total de variáveis de extração (PDFs)
    - Total de variáveis de processo (XML)
    - Distribuição por tipo
    - Variáveis mais usadas
    - Variáveis não utilizadas
    """
    try:
        # Variáveis derivadas do processo XML
        from .services_process_variables import ProcessVariableResolver
        variaveis_processo = ProcessVariableResolver.get_all_definitions()
        # Total de variáveis
        total = session_query(db, ExtractionVariable).filter(ExtractionVariable.ativo == True).count()

        # Por tipo
        tipos = session_query(db, 
            ExtractionVariable.tipo,
            func.count(ExtractionVariable.id)
        ).filter(
            ExtractionVariable.ativo == True
        ).group_by(ExtractionVariable.tipo).all()

        distribuicao_tipos = {t[0]: t[1] for t in tipos}

        # Variáveis com uso em prompts (regras determinísticas)
        # Nota: usamos query apenas pelo ID para evitar erro de DISTINCT em colunas JSON no PostgreSQL
        variaveis_com_uso_prompts = session_query(db, ExtractionVariable.id).join(
            PromptVariableUsage,
            PromptVariableUsage.variable_slug == ExtractionVariable.slug
        ).filter(
            ExtractionVariable.ativo == True
        ).distinct().count()

        # Variáveis em uso no JSON de categorias com json_gerado_por_ia=True
        variaveis_em_uso_json = session_query(db, ExtractionVariable.id).join(
            CategoriaResumoJSON,
            ExtractionVariable.categoria_id == CategoriaResumoJSON.id
        ).filter(
            ExtractionVariable.ativo == True,
            CategoriaResumoJSON.json_gerado_por_ia == True
        ).distinct().count()

        # Total de variáveis em uso (união dos dois conjuntos)
        # Para evitar contagem dupla, usamos uma abordagem diferente
        variaveis_ids_em_uso = set()

        # IDs de variáveis usadas em prompts
        ids_prompts = session_query(db, ExtractionVariable.id).join(
            PromptVariableUsage,
            PromptVariableUsage.variable_slug == ExtractionVariable.slug
        ).filter(ExtractionVariable.ativo == True).distinct().all()
        variaveis_ids_em_uso.update(id[0] for id in ids_prompts)

        # IDs de variáveis em uso no JSON
        ids_json = session_query(db, ExtractionVariable.id).join(
            CategoriaResumoJSON,
            ExtractionVariable.categoria_id == CategoriaResumoJSON.id
        ).filter(
            ExtractionVariable.ativo == True,
            CategoriaResumoJSON.json_gerado_por_ia == True
        ).distinct().all()
        variaveis_ids_em_uso.update(id[0] for id in ids_json)

        variaveis_com_uso = len(variaveis_ids_em_uso)

        # Variáveis mais usadas (top 10)
        mais_usadas_query = session_query(db, 
            PromptVariableUsage.variable_slug,
            func.count(PromptVariableUsage.id).label('uso_count')
        ).group_by(
            PromptVariableUsage.variable_slug
        ).order_by(
            func.count(PromptVariableUsage.id).desc()
        ).limit(10).all()

        mais_usadas = []
        for slug, count in mais_usadas_query:
            variavel = session_query(db, ExtractionVariable).filter(
                ExtractionVariable.slug == slug
            ).first()
            if variavel:
                mais_usadas.append({
                    "slug": slug,
                    "label": variavel.label,
                    "tipo": variavel.tipo,
                    "uso_count": count
                })

        return {
            "total": total,
            "total_extracao": total,
            "total_processo": len(variaveis_processo),
            "distribuicao_tipos": distribuicao_tipos,
            "variaveis_com_uso": variaveis_com_uso,
            "variaveis_sem_uso": total - variaveis_com_uso,
            "mais_usadas": mais_usadas,
            "variaveis_processo": [
                {
                    "slug": d.slug,
                    "label": d.label,
                    "tipo": d.tipo,
                    "descricao": d.descricao,
                    "fonte": "processo_xml"
                }
                for d in variaveis_processo
            ]
        }
    except Exception as e:
        logger.error(f"Erro ao carregar resumo de variáveis: {e}")
        # Retorna valores default em caso de erro
        return {
            "total": 0,
            "total_extracao": 0,
            "total_processo": 0,
            "distribuicao_tipos": {},
            "variaveis_com_uso": 0,
            "variaveis_sem_uso": 0,
            "mais_usadas": [],
            "variaveis_processo": []
        }


@router.get("/variaveis/processo")
async def listar_variaveis_processo(
    current_user: User = Depends(get_current_active_user)
):
    """
    Lista as variáveis derivadas do processo XML.

    Estas variáveis são calculadas automaticamente a partir do DadosProcesso
    (extraído do XML do TJ-MS) e podem ser usadas em regras determinísticas.

    Diferente das ExtractionVariable (extraídas de PDFs via IA), estas
    variáveis são:
    - Calculadas deterministicamente do XML do processo
    - Definidas no código (hardcoded)
    - Sempre disponíveis quando há DadosProcesso
    """
    from .services_process_variables import ProcessVariableResolver

    definitions = ProcessVariableResolver.get_all_definitions()

    return {
        "total": len(definitions),
        "variaveis": [
            {
                "slug": d.slug,
                "label": d.label,
                "tipo": d.tipo,
                "descricao": d.descricao,
                "fonte": "processo_xml",
                "editavel": False  # Não pode ser editada pelo usuário
            }
            for d in definitions
        ],
        "info": {
            "descricao": "Variáveis calculadas a partir do XML do processo (DadosProcesso)",
            "uso": "Podem ser usadas em regras determinísticas para ativação de módulos",
            "exemplo_regra": {
                "type": "condition",
                "variable": "processo_ajuizado_apos_2024_09_19",
                "operator": "equals",
                "value": True
            }
        }
    }


@router.get("/variaveis/{variavel_id}", response_model=VariableDetailResponse)
async def obter_variavel(
    variavel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtém detalhes de uma variável com lista de usos"""
    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variável não encontrada")

    categoria = None
    if variavel.categoria_id:
        categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == variavel.categoria_id).first()

    # Busca usos da variável
    from admin.models_prompts import PromptModulo

    usages = session_query(db, PromptVariableUsage).filter(
        PromptVariableUsage.variable_slug == variavel.slug
    ).all()

    prompt_usages = []
    # REGRA DE OURO: Calcula modo efetivo para cada prompt
    from sistemas.gerador_pecas.services_deterministic import resolve_activation_mode_from_db
    for usage in usages:
        prompt = session_query(db, PromptModulo).filter(PromptModulo.id == usage.prompt_id).first()
        if prompt:
            effective_mode = resolve_activation_mode_from_db(
                db=db,
                modulo_id=prompt.id,
                modo_ativacao_salvo=prompt.modo_ativacao,
                regra_primaria=prompt.regra_deterministica,
                regra_secundaria=prompt.regra_deterministica_secundaria,
                fallback_habilitado=prompt.fallback_habilitado or False
            )
            prompt_usages.append(VariableUsageResponse(
                prompt_id=prompt.id,
                prompt_nome=prompt.nome,
                prompt_titulo=prompt.titulo,
                modo_ativacao=prompt.modo_ativacao,
                effective_activation_mode=effective_mode,
                criado_em=usage.criado_em
            ))

    uso_count = len(prompt_usages)

    return VariableDetailResponse(
        id=variavel.id,
        slug=variavel.slug,
        label=variavel.label,
        descricao=variavel.descricao,
        tipo=variavel.tipo,
        categoria_id=variavel.categoria_id,
        categoria_nome=categoria.nome if categoria else None,
        opcoes=variavel.opcoes,
        source_question_id=variavel.source_question_id,
        ativo=variavel.ativo,
        criado_em=variavel.criado_em,
        atualizado_em=variavel.atualizado_em,
        uso_count=uso_count,
        prompt_usages=prompt_usages
    )


@router.post("/variaveis", response_model=ExtractionVariableResponse, status_code=201)
async def criar_variavel(
    data: ExtractionVariableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cria uma nova variável manualmente"""
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para criar variáveis")

    # Verifica se slug já existe
    existing = session_query(db, ExtractionVariable).filter(ExtractionVariable.slug == data.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Slug '{data.slug}' já existe")

    # Verifica se a categoria existe
    categoria = None
    if data.categoria_id:
        categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
        if not categoria:
            raise HTTPException(status_code=404, detail="Categoria não encontrada")

    # Cria a variável
    variavel = ExtractionVariable(
        slug=data.slug,
        label=data.label,
        descricao=data.descricao,
        tipo=data.tipo,
        categoria_id=data.categoria_id,
        opcoes=data.opcoes,
        ativo=True
    )
    db.add(variavel)
    db.commit()
    db.refresh(variavel)

    logger.info(f"Variável criada: slug={variavel.slug}")

    return ExtractionVariableResponse(
        id=variavel.id,
        slug=variavel.slug,
        label=variavel.label,
        descricao=variavel.descricao,
        tipo=variavel.tipo,
        categoria_id=variavel.categoria_id,
        categoria_nome=categoria.nome if categoria else None,
        opcoes=variavel.opcoes,
        source_question_id=variavel.source_question_id,
        ativo=variavel.ativo,
        criado_em=variavel.criado_em,
        atualizado_em=variavel.atualizado_em,
        uso_count=0
    )


@router.put("/variaveis/{variavel_id}", response_model=ExtractionVariableResponse)
async def atualizar_variavel(
    variavel_id: int,
    data: ExtractionVariableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Atualiza uma variável existente"""
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para editar variáveis")

    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variável não encontrada")

    # Atualiza campos fornecidos
    update_data = data.model_dump(exclude_unset=True)

    # Guarda valores antigos para detectar mudanças relevantes
    tipo_antigo = variavel.tipo
    descricao_antiga = variavel.descricao

    for field, value in update_data.items():
        setattr(variavel, field, value)

    variavel.atualizado_em = get_utc_now()

    # Se tipo ou descrição mudou, atualiza o JSON da categoria
    categoria = None
    if variavel.categoria_id:
        categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == variavel.categoria_id).first()

        # Sincroniza JSON da categoria se tipo ou descrição mudou
        if categoria and categoria.formato_json and (variavel.tipo != tipo_antigo or variavel.descricao != descricao_antiga):
            try:
                import json
                schema = json.loads(categoria.formato_json)

                # Atualiza o campo correspondente ao slug da variável
                if variavel.slug in schema:
                    schema[variavel.slug]["type"] = variavel.tipo
                    if variavel.descricao:
                        schema[variavel.slug]["description"] = variavel.descricao

                    categoria.formato_json = json.dumps(schema, ensure_ascii=False, indent=2)
                    logger.info(f"JSON da categoria {categoria.id} atualizado para refletir mudança na variável {variavel.slug}")
            except Exception as e:
                logger.warning(f"Não foi possível atualizar JSON da categoria: {e}")

    db.commit()
    db.refresh(variavel)

    uso_count = session_query(db, PromptVariableUsage).filter(
        PromptVariableUsage.variable_slug == variavel.slug
    ).count()

    logger.info(f"Variável atualizada: slug={variavel.slug}")

    return ExtractionVariableResponse(
        id=variavel.id,
        slug=variavel.slug,
        label=variavel.label,
        descricao=variavel.descricao,
        tipo=variavel.tipo,
        categoria_id=variavel.categoria_id,
        categoria_nome=categoria.nome if categoria else None,
        opcoes=variavel.opcoes,
        fonte_verdade_codigo=variavel.fonte_verdade_codigo,
        fonte_verdade_tipo=variavel.fonte_verdade_tipo,
        fonte_verdade_override=variavel.fonte_verdade_override,
        source_question_id=variavel.source_question_id,
        ativo=variavel.ativo,
        criado_em=variavel.criado_em,
        atualizado_em=variavel.atualizado_em,
        uso_count=uso_count
    )


@router.get("/variaveis/{variavel_id}/dependentes")
async def obter_variaveis_dependentes(
    variavel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retorna variáveis e perguntas que dependem desta variável"""
    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variável não encontrada")

    # Busca variáveis que dependem desta
    variaveis_dependentes = session_query(db, ExtractionVariable).filter(
        ExtractionVariable.depends_on_variable == variavel.slug,
        ExtractionVariable.ativo == True
    ).all()

    # Busca perguntas que dependem desta variável
    perguntas_dependentes = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.depends_on_variable == variavel.slug,
        ExtractionQuestion.ativo == True
    ).all()

    return {
        "variavel_slug": variavel.slug,
        "variaveis_dependentes": [
            {"id": v.id, "slug": v.slug, "label": v.label}
            for v in variaveis_dependentes
        ],
        "perguntas_dependentes": [
            {"id": p.id, "pergunta": p.pergunta[:50] + "..." if len(p.pergunta) > 50 else p.pergunta}
            for p in perguntas_dependentes
        ],
        "total_dependentes": len(variaveis_dependentes) + len(perguntas_dependentes)
    }


@router.delete("/variaveis/{variavel_id}")
async def excluir_variavel(
    variavel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Exclui uma variável permanentemente (HARD DELETE).

    COMPORTAMENTO:
    - SEMPRE faz HARD DELETE (apaga do banco)
    - Remove automaticamente do JSON da categoria
    - Remove automaticamente referências em PromptVariableUsage
    - Remove automaticamente dependências de outras perguntas/variáveis
    - Remove a pergunta de origem se existir

    Isso garante limpeza completa e evita variáveis órfãs no sistema.
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para excluir variáveis")

    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variável não encontrada")

    slug = variavel.slug

    limpezas_realizadas = {
        "json_atualizado": False,
        "prompts_removidos": 0,
        "dependencias_perguntas_removidas": 0,
        "dependencias_variaveis_removidas": 0,
        "pergunta_origem_removida": False
    }

    # 1. REMOVE DO JSON DA CATEGORIA
    if variavel.categoria_id:
        categoria = session_query(db, CategoriaResumoJSON).filter(
            CategoriaResumoJSON.id == variavel.categoria_id
        ).first()

        if categoria and categoria.formato_json:
            try:
                json_data = json.loads(categoria.formato_json)
                if slug in json_data:
                    del json_data[slug]
                    categoria.formato_json = json.dumps(json_data, ensure_ascii=False, indent=2)
                    categoria.atualizado_em = get_utc_now()
                    limpezas_realizadas["json_atualizado"] = True
                    logger.info(f"Variável '{slug}' removida do JSON da categoria {categoria.nome}")
            except json.JSONDecodeError:
                logger.warning(f"JSON inválido na categoria {variavel.categoria_id}")

    # 2. REMOVE REFERÊNCIAS EM PROMPTS (PromptVariableUsage)
    usos_prompts = session_query(db, PromptVariableUsage).filter(
        PromptVariableUsage.variable_slug == slug
    ).all()

    for uso in usos_prompts:
        db.delete(uso)

    limpezas_realizadas["prompts_removidos"] = len(usos_prompts)
    if usos_prompts:
        logger.info(f"Removidos {len(usos_prompts)} usos da variável '{slug}' em prompts")

    # 3. REMOVE DEPENDÊNCIAS DE OUTRAS VARIÁVEIS
    variaveis_dependentes = session_query(db, ExtractionVariable).filter(
        ExtractionVariable.depends_on_variable == slug
    ).all()

    for v in variaveis_dependentes:
        v.depends_on_variable = None
        v.is_conditional = False
        v.dependency_config = None
        v.atualizado_em = get_utc_now()

    limpezas_realizadas["dependencias_variaveis_removidas"] = len(variaveis_dependentes)

    # 4. REMOVE DEPENDÊNCIAS DE OUTRAS PERGUNTAS
    perguntas_dependentes = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.depends_on_variable == slug
    ).all()

    for p in perguntas_dependentes:
        p.depends_on_variable = None
        p.dependency_operator = None
        p.dependency_value = None
        p.dependency_inferred = False
        p.atualizado_em = get_utc_now()

    limpezas_realizadas["dependencias_perguntas_removidas"] = len(perguntas_dependentes)

    # 5. REMOVE PERGUNTA DE ORIGEM (se existir)
    if variavel.source_question_id:
        pergunta_origem = session_query(db, ExtractionQuestion).filter(
            ExtractionQuestion.id == variavel.source_question_id
        ).first()
        if pergunta_origem:
            db.delete(pergunta_origem)
            limpezas_realizadas["pergunta_origem_removida"] = True
            logger.info(f"Pergunta de origem {variavel.source_question_id} removida junto com variável")

    # 6. HARD DELETE DA VARIÁVEL
    db.delete(variavel)
    db.commit()

    logger.info(
        f"Variável HARD DELETE: slug={slug}, "
        f"json={limpezas_realizadas['json_atualizado']}, "
        f"prompts={limpezas_realizadas['prompts_removidos']}, "
        f"deps_vars={limpezas_realizadas['dependencias_variaveis_removidas']}, "
        f"deps_pergs={limpezas_realizadas['dependencias_perguntas_removidas']}"
    )

    # Monta mensagem
    message_parts = [f"Variável '{slug}' excluída permanentemente"]

    if limpezas_realizadas["json_atualizado"]:
        message_parts.append("removida do JSON")

    if limpezas_realizadas["prompts_removidos"] > 0:
        message_parts.append(f"removida de {limpezas_realizadas['prompts_removidos']} prompt(s)")

    if limpezas_realizadas["dependencias_perguntas_removidas"] > 0:
        message_parts.append(
            f"{limpezas_realizadas['dependencias_perguntas_removidas']} dependência(s) de pergunta(s) limpas"
        )

    if limpezas_realizadas["pergunta_origem_removida"]:
        message_parts.append("pergunta de origem removida")

    return {
        "success": True,
        "message": ", ".join(message_parts),
        "limpezas_realizadas": limpezas_realizadas
    }


@router.post("/variaveis/{variavel_id}/reativar")
async def reativar_variavel(
    variavel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reativa uma variável desativada"""
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para reativar variáveis")

    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variável não encontrada")

    variavel.ativo = True
    variavel.atualizado_em = get_utc_now()

    db.commit()

    logger.info(f"Variável reativada: slug={variavel.slug}")

    return {"success": True, "message": "Variável reativada com sucesso"}


# ============================================================================
# ENDPOINTS - RENOMEACAO DE SLUG
# ============================================================================


@router.put("/variaveis/{variavel_id}/renomear-slug", response_model=RenomearSlugResponse)
async def renomear_slug_variavel(
    variavel_id: int,
    data: RenomearSlugRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Renomeia o slug de uma variavel de forma transacional.

    Esta operacao propaga a mudanca automaticamente para:
    - JSON da categoria (formato_json)
    - Perguntas de extracao (nome_variavel_sugerido)
    - Regras deterministicas de prompts modulares
    - Regras deterministicas por tipo de peca
    - PromptVariableUsage
    - Dependencias de outras variaveis e perguntas

    IMPORTANTE: Use este endpoint para renomear slugs. Nao edite
    diretamente o JSON da categoria pois isso causa inconsistencias.
    """
    # Verifica permissao
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissao para renomear variaveis")

    from .services_slug_rename import SlugRenameService

    service = SlugRenameService(db)
    result = service.renomear(
        variavel_id=variavel_id,
        novo_slug=data.novo_slug,
        normalizar=data.normalizar
    )

    if result.success:
        db.commit()
        logger.info(
            f"[SLUG-RENAME] Renomeacao concluida por {current_user.username}: "
            f"{result.old_slug} -> {result.new_slug}"
        )
    else:
        db.rollback()

    return RenomearSlugResponse(
        success=result.success,
        old_slug=result.old_slug,
        new_slug=result.new_slug,
        error=result.error,
        categoria_json_atualizada=result.categoria_json_atualizada,
        perguntas_atualizadas=result.perguntas_atualizadas,
        prompts_atualizados=result.prompts_atualizados,
        regras_tipo_peca_atualizadas=result.regras_tipo_peca_atualizadas,
        prompt_usages_atualizados=result.prompt_usages_atualizados,
        variaveis_dependentes_atualizadas=result.variaveis_dependentes_atualizadas,
        perguntas_dependentes_atualizadas=result.perguntas_dependentes_atualizadas,
        detalhes=result.detalhes
    )


@router.get("/variaveis/{variavel_id}/verificar-consistencia", response_model=ConsistenciaSlugResponse)
async def verificar_consistencia_variavel(
    variavel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Verifica consistencia entre o slug da variavel e suas referencias.

    Retorna:
    - Se a variavel esta no JSON da categoria
    - Se ha slugs orfaos no JSON
    - Se ha variaveis sem entrada no JSON
    """
    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variavel nao encontrada")

    if not variavel.categoria_id:
        return ConsistenciaSlugResponse(
            consistente=True,
            mensagem="Variavel nao pertence a nenhuma categoria"
        )

    from .services_slug_rename import SlugConsistencyChecker

    checker = SlugConsistencyChecker(db)
    resultado = checker.verificar_categoria(variavel.categoria_id)

    if resultado.get("erro"):
        return ConsistenciaSlugResponse(
            consistente=False,
            erro=resultado["erro"]
        )

    return ConsistenciaSlugResponse(
        consistente=resultado["consistente"],
        categoria_id=resultado["categoria_id"],
        categoria_nome=resultado["categoria_nome"],
        total_slugs_json=resultado["total_slugs_json"],
        total_variaveis_ativas=resultado["total_variaveis_ativas"],
        slugs_orfaos_json=resultado["slugs_orfaos_json"],
        slugs_orfaos_variaveis=resultado["slugs_orfaos_variaveis"],
        mensagem=resultado["mensagem"]
    )


@router.get("/variaveis/{variavel_id}/referencias", response_model=ReferenciasSlugResponse)
async def verificar_referencias_variavel(
    variavel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Verifica onde o slug da variavel esta sendo usado em regras deterministicas.

    Util para saber quais prompts serao afetados antes de renomear.
    """
    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variavel nao encontrada")

    from .services_slug_rename import SlugConsistencyChecker

    checker = SlugConsistencyChecker(db)
    resultado = checker.verificar_referencias_prompts(variavel.slug)

    return ReferenciasSlugResponse(
        slug=resultado["slug"],
        total_prompts=resultado["total_prompts"],
        total_regras_tipo_peca=resultado["total_regras_tipo_peca"],
        prompts=resultado["prompts"],
        regras_tipo_peca=resultado["regras_tipo_peca"]
    )


@router.delete("/variaveis/{variavel_id}/permanente")
async def excluir_variavel_permanente(
    variavel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Exclui permanentemente uma variável (hard delete)"""
    # Verifica permissão - apenas admin
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir permanentemente")

    variavel = session_query(db, ExtractionVariable).filter(ExtractionVariable.id == variavel_id).first()
    if not variavel:
        raise HTTPException(status_code=404, detail="Variável não encontrada")

    # Verifica se está em uso
    uso_count = session_query(db, PromptVariableUsage).filter(
        PromptVariableUsage.variable_slug == variavel.slug
    ).count()

    if uso_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Variável está em uso por {uso_count} prompt(s). Remova os usos antes de excluir."
        )

    # Remove dependências de variáveis que dependem desta
    variaveis_dependentes = session_query(db, ExtractionVariable).filter(
        ExtractionVariable.depends_on_variable == variavel.slug
    ).all()

    for v in variaveis_dependentes:
        v.depends_on_variable = None
        v.dependency_operator = None
        v.dependency_value = None
        v.atualizado_em = get_utc_now()

    # Remove dependências de perguntas que dependem desta
    perguntas_dependentes = session_query(db, ExtractionQuestion).filter(
        ExtractionQuestion.depends_on_variable == variavel.slug
    ).all()

    for p in perguntas_dependentes:
        p.depends_on_variable = None
        p.dependency_operator = None
        p.dependency_value = None
        p.dependency_inferred = False
        p.atualizado_em = get_utc_now()

    slug = variavel.slug
    db.delete(variavel)
    db.commit()

    logger.info(f"Variável excluída permanentemente: slug={slug}, dependências removidas: {len(variaveis_dependentes)} variáveis, {len(perguntas_dependentes)} perguntas")

    return {
        "success": True,
        "message": "Variável excluída permanentemente",
        "dependencias_removidas": {
            "variaveis": len(variaveis_dependentes),
            "perguntas": len(perguntas_dependentes)
        }
    }


# ============================================================================
# ENDPOINTS - TIPOS DE DADOS DISPONÍVEIS
# ============================================================================

@router.get("/tipos-variaveis")
async def listar_tipos_variaveis(
    current_user: User = Depends(get_current_active_user)
):
    """Lista os tipos de dados disponíveis para variáveis"""
    return [
        {"value": "text", "label": "Texto", "description": "Texto livre"},
        {"value": "number", "label": "Número", "description": "Valor numérico"},
        {"value": "date", "label": "Data", "description": "Data no formato YYYY-MM-DD"},
        {"value": "boolean", "label": "Sim/Não", "description": "Valor booleano"},
        {"value": "choice", "label": "Escolha Única", "description": "Uma opção entre várias"},
        {"value": "list", "label": "Lista", "description": "Lista de valores"},
        {"value": "currency", "label": "Valor Monetário", "description": "Valor em reais (R$)"}
    ]





