# sistemas/gerador_pecas/router_ext_deps.py
"""
Router de dependencias e regras deterministicas.
Extraido de router_extraction.py (Fase 5a).

Endpoints para:
- Regras determinísticas (gerar, validar, avaliar)
- Dependências entre perguntas (inferir, aplicar, definir, remover)
- Grafo de dependências e cadeia de dependências
- Sincronização de tipos de perguntas
- Restauração de slugs a partir de backup
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.repositories.sqlalchemy.session_ops import session_query
from database.connection import get_db
from auth.dependencies import get_current_active_user
from auth.models import User

from .models_extraction import (
    ExtractionQuestion, ExtractionVariable,
    DependencyOperator
)
from .models_resumo_json import CategoriaResumoJSON
from .services_dependencies import (
    DependencyInferenceService, DependencyEvaluator, DependencyGraphBuilder
)
from .schemas_extraction import (
    GenerateDeterministicRuleRequest, SugestaoVariavel,
    GenerateDeterministicRuleResponse, ValidateDeterministicRuleRequest,
    ValidateDeterministicRuleResponse, EvaluateDeterministicRuleRequest,
    EvaluateDeterministicRuleResponse,
    SetDependencyRequest, InferDependenciesRequest,
    InferDependenciesResponse, ApplyDependenciesRequest,
    ApplyDependenciesResponse, DependencyGraphResponse,
    DependentQuestionsResponse,
    SyncTiposRequest, SyncTiposResponse,
    RestaurarSlugsRequest, RestaurarSlugsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# ENDPOINTS - REGRAS DETERMINÍSTICAS
# ============================================================================

@router.post("/regras-deterministicas/gerar", response_model=GenerateDeterministicRuleResponse)
async def gerar_regra_deterministica(
    data: GenerateDeterministicRuleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Gera uma regra determinística (AST JSON) a partir de uma condição em linguagem natural.

    Este endpoint:
    1. Recebe a condição em texto
    2. Busca as variáveis disponíveis no sistema
    3. Usa o Gemini 3 Flash Preview para converter em AST
    4. Valida se todas as variáveis usadas existem
    5. Retorna a regra estruturada
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para gerar regras")

    from .services_deterministic import DeterministicRuleGenerator

    try:
        generator = DeterministicRuleGenerator(db)
        resultado = await generator.gerar_regra(
            condicao_texto=data.condicao_texto,
            contexto=data.contexto
        )

        if not resultado.get("success"):
            # Converte sugestões para o formato do schema
            sugestoes_raw = resultado.get("sugestoes_variaveis", [])
            sugestoes = [
                SugestaoVariavel(
                    slug=s.get("slug", ""),
                    label_sugerido=s.get("label_sugerido", ""),
                    tipo_sugerido=s.get("tipo_sugerido", "text")
                )
                for s in sugestoes_raw
            ] if sugestoes_raw else None

            return GenerateDeterministicRuleResponse(
                success=False,
                erro=resultado.get("erro"),
                detalhes=resultado.get("detalhes"),
                variaveis_faltantes=resultado.get("variaveis_faltantes"),
                sugestoes_variaveis=sugestoes
            )

        return GenerateDeterministicRuleResponse(
            success=True,
            regra=resultado.get("regra"),
            variaveis_usadas=resultado.get("variaveis_usadas"),
            regra_texto_original=resultado.get("regra_texto_original")
        )

    except Exception as e:
        logger.error(f"Erro ao gerar regra determinística: {e}")
        return GenerateDeterministicRuleResponse(
            success=False,
            erro=str(e)
        )


@router.post("/regras-deterministicas/validar", response_model=ValidateDeterministicRuleResponse)
async def validar_regra_deterministica(
    data: ValidateDeterministicRuleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Valida uma regra determinística (AST JSON).

    Verifica:
    - Estrutura do AST
    - Operadores válidos
    - Existência das variáveis referenciadas
    """
    from .services_deterministic import DeterministicRuleGenerator

    try:
        generator = DeterministicRuleGenerator(db)
        variaveis = generator._buscar_variaveis_disponiveis()
        resultado = generator._validar_regra(data.regra, variaveis)

        return ValidateDeterministicRuleResponse(
            valid=resultado.get("valid", False),
            errors=resultado.get("errors", []),
            warnings=[],
            variaveis_faltantes=resultado.get("variaveis_faltantes", [])
        )

    except Exception as e:
        logger.error(f"Erro ao validar regra: {e}")
        return ValidateDeterministicRuleResponse(
            valid=False,
            errors=[str(e)],
            warnings=[],
            variaveis_faltantes=[]
        )


@router.post("/regras-deterministicas/avaliar", response_model=EvaluateDeterministicRuleResponse)
async def avaliar_regra_deterministica(
    data: EvaluateDeterministicRuleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Avalia uma regra determinística com dados fornecidos.

    Útil para testar regras antes de salvá-las.
    """
    from .services_deterministic import DeterministicRuleEvaluator

    try:
        evaluator = DeterministicRuleEvaluator()
        resultado = evaluator.avaliar(data.regra, data.dados)

        return EvaluateDeterministicRuleResponse(
            resultado=resultado
        )

    except Exception as e:
        logger.error(f"Erro ao avaliar regra: {e}")
        return EvaluateDeterministicRuleResponse(
            resultado=False,
            erro=str(e)
        )


# ============================================================================
# ENDPOINTS - DEPENDÊNCIAS ENTRE PERGUNTAS
# ============================================================================

@router.get("/operadores-dependencia")
async def listar_operadores_dependencia(
    current_user: User = Depends(get_current_active_user)
):
    """Lista os operadores disponíveis para dependências"""
    return [
        {"value": "equals", "label": "Igual a", "description": "Valor exato"},
        {"value": "not_equals", "label": "Diferente de", "description": "Valor diferente"},
        {"value": "in_list", "label": "Está na lista", "description": "Um dos valores"},
        {"value": "not_in_list", "label": "Não está na lista", "description": "Nenhum dos valores"},
        {"value": "exists", "label": "Existe", "description": "Variável tem valor"},
        {"value": "not_exists", "label": "Não existe", "description": "Variável não tem valor"},
        {"value": "greater_than", "label": "Maior que", "description": "Para números"},
        {"value": "less_than", "label": "Menor que", "description": "Para números"}
    ]


@router.post("/dependencias/inferir", response_model=InferDependenciesResponse)
async def inferir_dependencias(
    data: InferDependenciesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Infere dependências entre perguntas de uma categoria usando IA.

    Este endpoint:
    1. Analisa todas as perguntas ativas da categoria
    2. Usa o Gemini para identificar dependências condicionais
    3. Retorna as dependências inferidas e um grafo de visualização
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para inferir dependências")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    try:
        service = DependencyInferenceService(db)
        resultado = await service.inferir_dependencias(data.categoria_id)

        if not resultado.get("success"):
            return InferDependenciesResponse(
                success=False,
                erro=resultado.get("erro")
            )

        return InferDependenciesResponse(
            success=True,
            dependencias_inferidas=resultado.get("dependencias_inferidas", []),
            grafo=resultado.get("grafo")
        )

    except Exception as e:
        logger.error(f"Erro ao inferir dependências: {e}")
        return InferDependenciesResponse(
            success=False,
            erro=str(e)
        )


@router.post("/dependencias/aplicar", response_model=ApplyDependenciesResponse)
async def aplicar_dependencias(
    data: ApplyDependenciesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Aplica dependências inferidas às perguntas.

    Este endpoint:
    1. Recebe a lista de dependências a aplicar
    2. Atualiza as perguntas com as dependências
    3. Retorna quais perguntas foram atualizadas
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para aplicar dependências")

    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == data.categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    try:
        service = DependencyInferenceService(db)
        resultado = await service.aplicar_dependencias(data.categoria_id, data.dependencias)

        if not resultado.get("success"):
            return ApplyDependenciesResponse(
                success=False,
                erro=resultado.get("erro")
            )

        return ApplyDependenciesResponse(
            success=True,
            perguntas_atualizadas=resultado.get("perguntas_atualizadas", [])
        )

    except Exception as e:
        logger.error(f"Erro ao aplicar dependências: {e}")
        return ApplyDependenciesResponse(
            success=False,
            erro=str(e)
        )


@router.put("/perguntas/{pergunta_id}/dependencia")
async def definir_dependencia_pergunta(
    pergunta_id: int,
    data: SetDependencyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Define manualmente a dependência de uma pergunta.
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para editar perguntas")

    pergunta = session_query(db, ExtractionQuestion).filter(ExtractionQuestion.id == pergunta_id).first()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    # Valida operador
    operadores_validos = [e.value for e in DependencyOperator]
    if data.dependency_operator not in operadores_validos:
        raise HTTPException(
            status_code=400,
            detail=f"Operador inválido. Use um de: {', '.join(operadores_validos)}"
        )

    # Atualiza dependência
    pergunta.depends_on_variable = data.depends_on_variable
    pergunta.dependency_operator = data.dependency_operator
    pergunta.dependency_value = data.dependency_value
    pergunta.dependency_inferred = False  # Definido manualmente
    pergunta.atualizado_por = current_user.id
    pergunta.atualizado_em = datetime.utcnow()

    db.commit()
    db.refresh(pergunta)

    logger.info(f"Dependência definida para pergunta {pergunta_id}: {data.depends_on_variable}")

    return {
        "success": True,
        "pergunta_id": pergunta.id,
        "depends_on_variable": pergunta.depends_on_variable,
        "dependency_operator": pergunta.dependency_operator,
        "dependency_value": pergunta.dependency_value,
        "dependency_summary": pergunta.dependency_summary
    }


@router.delete("/perguntas/{pergunta_id}/dependencia")
async def remover_dependencia_pergunta(
    pergunta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Remove a dependência de uma pergunta.
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para editar perguntas")

    pergunta = session_query(db, ExtractionQuestion).filter(ExtractionQuestion.id == pergunta_id).first()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    # Remove dependência
    pergunta.depends_on_variable = None
    pergunta.dependency_operator = None
    pergunta.dependency_value = None
    pergunta.dependency_config = None
    pergunta.dependency_inferred = False
    pergunta.atualizado_por = current_user.id
    pergunta.atualizado_em = datetime.utcnow()

    db.commit()

    logger.info(f"Dependência removida da pergunta {pergunta_id}")

    return {"success": True, "message": "Dependência removida com sucesso"}


@router.get("/categorias/{categoria_id}/grafo-dependencias", response_model=DependencyGraphResponse)
async def obter_grafo_dependencias(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna o grafo de dependências de uma categoria para visualização.

    Inclui:
    - Nós (perguntas/variáveis)
    - Arestas (dependências)
    - Hierarquia (árvore de dependências)
    - Perguntas raiz (sem dependência)
    """
    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    try:
        builder = DependencyGraphBuilder(db)
        grafo = builder.construir_grafo_categoria(categoria_id)

        return DependencyGraphResponse(
            nodes=grafo.get("nodes", []),
            edges=grafo.get("edges", []),
            hierarchy=grafo.get("hierarchy", {}),
            root_questions=grafo.get("root_questions", [])
        )

    except Exception as e:
        logger.error(f"Erro ao construir grafo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/variaveis/{variable_slug}/dependentes", response_model=DependentQuestionsResponse)
async def obter_perguntas_dependentes(
    variable_slug: str,
    categoria_id: int = Query(..., description="ID da categoria"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna todas as perguntas que dependem de uma variável específica.
    """
    # Verifica se a categoria existe
    categoria = session_query(db, CategoriaResumoJSON).filter(CategoriaResumoJSON.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    try:
        builder = DependencyGraphBuilder(db)
        perguntas = builder.obter_perguntas_dependentes(variable_slug, categoria_id)

        return DependentQuestionsResponse(perguntas=perguntas)

    except Exception as e:
        logger.error(f"Erro ao buscar dependentes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/perguntas/{pergunta_id}/cadeia-dependencias")
async def obter_cadeia_dependencias(
    pergunta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna a cadeia completa de dependências de uma pergunta.

    Exemplo: ["medicamento", "registro_anvisa", "incorporado_sus"]
    """
    pergunta = session_query(db, ExtractionQuestion).filter(ExtractionQuestion.id == pergunta_id).first()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    try:
        builder = DependencyGraphBuilder(db)
        cadeia = builder.obter_cadeia_dependencias(pergunta_id)

        return {
            "pergunta_id": pergunta_id,
            "cadeia": cadeia,
            "profundidade": len(cadeia)
        }

    except Exception as e:
        logger.error(f"Erro ao obter cadeia: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dependencias/avaliar-visibilidade")
async def avaliar_visibilidade_pergunta(
    pergunta_id: int = Query(..., description="ID da pergunta"),
    dados: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Avalia se uma pergunta deve estar visível com base nos dados fornecidos.

    Útil para testar condições de visibilidade no frontend.
    """
    pergunta = session_query(db, ExtractionQuestion).filter(ExtractionQuestion.id == pergunta_id).first()
    if not pergunta:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada")

    if dados is None:
        dados = {}

    try:
        evaluator = DependencyEvaluator()
        visivel = evaluator.avaliar_visibilidade(pergunta, dados)

        return {
            "pergunta_id": pergunta_id,
            "visivel": visivel,
            "is_conditional": pergunta.is_conditional,
            "dependency_summary": pergunta.dependency_summary
        }

    except Exception as e:
        logger.error(f"Erro ao avaliar visibilidade: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/perguntas/sync-tipos", response_model=SyncTiposResponse)
async def sincronizar_tipos_perguntas(
    data: SyncTiposRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Sincroniza tipos, slugs e opções das perguntas com o mapeamento gerado pela IA.

    Chamado após "Aceitar e Usar" o JSON gerado pela IA para:
    1. Atualizar nome_variavel_sugerido (slug) das perguntas que não tinham
    2. Atualizar tipo_sugerido das perguntas que estavam como "ia_decide"
    3. Atualizar opcoes_sugeridas quando a IA definir options
    """
    # Verifica permissão
    if current_user.role != "admin" and not current_user.tem_permissao("edit_prompts"):
        raise HTTPException(status_code=403, detail="Sem permissão para editar perguntas")

    try:
        perguntas_atualizadas = 0
        detalhes = []

        # Busca namespace da categoria
        categoria = session_query(db, CategoriaResumoJSON).filter(
            CategoriaResumoJSON.id == data.categoria_id
        ).first()
        namespace = categoria.namespace if categoria else ""

        # Mapeamento de tipos da IA para tipos do modelo
        tipo_mapping = {
            "text": "text",
            "string": "text",
            "number": "number",
            "integer": "number",
            "float": "number",
            "date": "date",
            "datetime": "date",
            "boolean": "boolean",
            "bool": "boolean",
            "choice": "choice",
            "enum": "choice",
            "list": "list",
            "array": "list",
            "currency": "currency",
            "money": "currency"
        }

        for pergunta_id_str, info in data.mapeamento_variaveis.items():
            try:
                pergunta_id = int(pergunta_id_str)
            except ValueError:
                continue

            pergunta = session_query(db, ExtractionQuestion).filter(
                ExtractionQuestion.id == pergunta_id,
                ExtractionQuestion.categoria_id == data.categoria_id
            ).first()

            if not pergunta:
                continue

            alteracoes = {}

            # Atualiza slug (nome_variavel_sugerido) se não tinha
            slug_ia = info.get("slug")
            if slug_ia and not pergunta.nome_variavel_sugerido:
                # Remove namespace se presente para armazenar slug base
                slug_base = slug_ia
                if namespace and slug_ia.startswith(f"{namespace}_"):
                    slug_base = slug_ia[len(namespace) + 1:]
                pergunta.nome_variavel_sugerido = slug_base
                alteracoes["slug"] = slug_base

            # Só atualiza tipo se estava como "ia_decide" ou vazio
            tipo_ia = info.get("tipo") or info.get("type")
            tipo_normalizado = tipo_mapping.get(tipo_ia, tipo_ia) if tipo_ia else None

            if tipo_normalizado and (not pergunta.tipo_sugerido or pergunta.tipo_sugerido == "ia_decide"):
                pergunta.tipo_sugerido = tipo_normalizado
                alteracoes["tipo"] = tipo_normalizado

            # Atualiza opções se a IA definiu e a pergunta não tinha
            opcoes_ia = info.get("options") or info.get("opcoes")
            if opcoes_ia and isinstance(opcoes_ia, list):
                # Se não tinha opções ou estava vazio, usa as da IA
                if not pergunta.opcoes_sugeridas or len(pergunta.opcoes_sugeridas) == 0:
                    pergunta.opcoes_sugeridas = opcoes_ia
                    alteracoes["opcoes"] = opcoes_ia

            if alteracoes:
                pergunta.atualizado_por = current_user.id
                pergunta.atualizado_em = datetime.utcnow()
                perguntas_atualizadas += 1
                detalhes.append({
                    "pergunta_id": pergunta_id,
                    "pergunta": pergunta.pergunta[:50],
                    "alteracoes": alteracoes
                })

        db.commit()

        logger.info(f"Tipos sincronizados: {perguntas_atualizadas} perguntas atualizadas")

        return SyncTiposResponse(
            success=True,
            perguntas_atualizadas=perguntas_atualizadas,
            detalhes=detalhes
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao sincronizar tipos: {e}")
        return SyncTiposResponse(
            success=False,
            erro=str(e)
        )


# ============================================================================
# ENDPOINT PARA RESTAURAR SLUGS A PARTIR DE JSON DE BACKUP
# ============================================================================

@router.post("/restaurar-slugs", response_model=RestaurarSlugsResponse)
async def restaurar_slugs_de_backup(
    data: RestaurarSlugsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Restaura slugs das variáveis a partir de um JSON de backup.

    Este endpoint:
    1. Recebe o JSON antigo com os slugs corretos
    2. Mapeia variáveis existentes por descrição
    3. Atualiza os slugs para os valores do JSON
    4. Remove variáveis duplicadas
    5. Sincroniza nome_variavel_sugerido nas perguntas
    """
    # Apenas admin pode restaurar
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem restaurar slugs")

    try:
        categoria = session_query(db, CategoriaResumoJSON).filter(
            CategoriaResumoJSON.id == data.categoria_id
        ).first()

        if not categoria:
            return RestaurarSlugsResponse(
                success=False,
                erro=f"Categoria ID={data.categoria_id} não encontrada"
            )

        # Busca variáveis e perguntas da categoria
        variaveis = session_query(db, ExtractionVariable).filter(
            ExtractionVariable.categoria_id == categoria.id
        ).all()

        perguntas = session_query(db, ExtractionQuestion).filter(
            ExtractionQuestion.categoria_id == categoria.id,
            ExtractionQuestion.ativo == True
        ).all()

        # Cria índice de descrições para matching
        desc_to_slug = {}
        for slug, info in data.json_backup.items():
            desc = info.get("description", "").lower()
            desc_key = desc.split("?")[0].strip() if "?" in desc else desc[:60]
            if desc_key:
                desc_to_slug[desc_key] = slug

        detalhes = []
        variaveis_atualizadas = 0
        variaveis_removidas = 0
        slugs_usados = set()

        # Processa variáveis
        for variavel in variaveis:
            slug_antigo = variavel.slug

            # Se já está no JSON, mantém
            if slug_antigo in data.json_backup:
                slugs_usados.add(slug_antigo)
                continue

            # Tenta encontrar por descrição
            desc_var = (variavel.descricao or variavel.label or "").lower()
            desc_key = desc_var.split("?")[0].strip() if "?" in desc_var else desc_var[:60]

            slug_correto = None
            for desc_json, slug_json in desc_to_slug.items():
                if desc_key and len(desc_key) > 10:
                    if desc_key in desc_json or desc_json in desc_key:
                        slug_correto = slug_json
                        break

            if slug_correto:
                if slug_correto in slugs_usados:
                    # Duplicata - remove
                    detalhes.append({
                        "acao": "remover",
                        "slug_antigo": slug_antigo,
                        "motivo": f"duplicata de {slug_correto}"
                    })
                    db.delete(variavel)
                    variaveis_removidas += 1
                else:
                    detalhes.append({
                        "acao": "atualizar",
                        "slug_antigo": slug_antigo,
                        "slug_novo": slug_correto
                    })
                    variavel.slug = slug_correto
                    variavel.tipo = data.json_backup[slug_correto].get("type", variavel.tipo)
                    slugs_usados.add(slug_correto)
                    variaveis_atualizadas += 1

        # Sincroniza perguntas
        perguntas_sincronizadas = 0
        for pergunta in perguntas:
            variavel = session_query(db, ExtractionVariable).filter(
                ExtractionVariable.source_question_id == pergunta.id
            ).first()

            if variavel:
                if pergunta.nome_variavel_sugerido != variavel.slug:
                    pergunta.nome_variavel_sugerido = variavel.slug
                    perguntas_sincronizadas += 1
            else:
                # Tenta vincular por descrição
                desc_pergunta = (pergunta.pergunta or "").lower()
                desc_key = desc_pergunta.split("?")[0].strip() if "?" in desc_pergunta else desc_pergunta[:60]

                for desc_json, slug_json in desc_to_slug.items():
                    if desc_key and len(desc_key) > 10:
                        if desc_key in desc_json or desc_json in desc_key:
                            variavel = session_query(db, ExtractionVariable).filter(
                                ExtractionVariable.slug == slug_json
                            ).first()
                            if variavel and not variavel.source_question_id:
                                variavel.source_question_id = pergunta.id
                                pergunta.nome_variavel_sugerido = slug_json
                                perguntas_sincronizadas += 1
                            break

        db.commit()

        logger.info(f"Slugs restaurados para categoria {categoria.id}: "
                   f"{variaveis_atualizadas} atualizadas, {variaveis_removidas} removidas, "
                   f"{perguntas_sincronizadas} perguntas sincronizadas")

        return RestaurarSlugsResponse(
            success=True,
            variaveis_atualizadas=variaveis_atualizadas,
            variaveis_removidas=variaveis_removidas,
            perguntas_sincronizadas=perguntas_sincronizadas,
            detalhes=detalhes
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao restaurar slugs: {e}")
        return RestaurarSlugsResponse(
            success=False,
            erro=str(e)
        )





