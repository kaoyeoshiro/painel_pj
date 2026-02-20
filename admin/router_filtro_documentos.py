# admin/router_filtro_documentos.py
"""
Router para Filtro de Documentos (consolidacao das tabs de config-pecas).

Agrupa endpoints de CRUD de CategoriaDocumento e TipoPeca que antes viviam
em router_config_pecas.py. Os endpoints antigos permanecem por retrocompatibilidade;
este router adiciona novos endpoints com prefixo /admin/api/filtro-documentos.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from database.connection import get_db
from auth.dependencies import get_current_active_user
from auth.models import User
from app.repositories.sqlalchemy.session_ops import session_query

from sistemas.gerador_pecas.models_config_pecas import (
    CategoriaDocumento,
    TipoPeca,
    carregar_categorias_json,
    get_categorias_documento_seed,
    get_tipos_peca_seed,
)
from sistemas.gerador_pecas.schemas import (
    CategoriaDocumentoBase,
    CategoriaDocumentoResponse,
    TipoPecaBase,
    TipoPecaCreate,
    TipoPecaResponse,
    AssociacaoCategoriasRequest,
    AssociacaoCategoriasGrupoRequest,
)
from sistemas.gerador_pecas.services_source_resolver import invalidar_cache_source_resolver

router = APIRouter(prefix="/filtro-documentos", tags=["Filtro de Documentos"])


# ===========================================
# Categorias de Documento
# ===========================================

@router.get("/categorias", response_model=List[CategoriaDocumentoResponse])
async def listar_categorias(
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista todas as categorias de documento (filtro do Agente 1)."""
    query = session_query(db, CategoriaDocumento)
    if ativo is not None:
        query = query.filter(CategoriaDocumento.ativo == ativo)
    return query.order_by(CategoriaDocumento.ordem, CategoriaDocumento.titulo).all()


@router.get("/categorias/{categoria_id}", response_model=CategoriaDocumentoResponse)
async def obter_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtem uma categoria de documento especifica."""
    categoria = session_query(db, CategoriaDocumento).filter(
        CategoriaDocumento.id == categoria_id
    ).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    return categoria


@router.post("/categorias", response_model=CategoriaDocumentoResponse)
async def criar_categoria(
    dados: CategoriaDocumentoBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Cria uma nova categoria de documento."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    existente = session_query(db, CategoriaDocumento).filter(
        func.lower(CategoriaDocumento.nome) == dados.nome.lower()
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ja existe categoria com esse nome")

    categoria = CategoriaDocumento(**dados.dict())
    db.add(categoria)
    db.commit()
    db.refresh(categoria)

    if categoria.is_primeiro_documento:
        invalidar_cache_source_resolver(categoria.nome)

    return categoria


@router.put("/categorias/{categoria_id}", response_model=CategoriaDocumentoResponse)
async def atualizar_categoria(
    categoria_id: int,
    dados: CategoriaDocumentoBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Atualiza uma categoria de documento."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    categoria = session_query(db, CategoriaDocumento).filter(
        CategoriaDocumento.id == categoria_id
    ).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")

    if dados.nome.lower() != categoria.nome.lower():
        existente = session_query(db, CategoriaDocumento).filter(
            func.lower(CategoriaDocumento.nome) == dados.nome.lower(),
            CategoriaDocumento.id != categoria_id,
        ).first()
        if existente:
            raise HTTPException(status_code=400, detail="Ja existe categoria com esse nome")

    for key, value in dados.dict().items():
        setattr(categoria, key, value)

    db.commit()
    db.refresh(categoria)
    invalidar_cache_source_resolver(categoria.nome)
    return categoria


@router.delete("/categorias/{categoria_id}")
async def excluir_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Exclui uma categoria de documento."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    categoria = session_query(db, CategoriaDocumento).filter(
        CategoriaDocumento.id == categoria_id
    ).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")

    nome_categoria = categoria.nome
    db.delete(categoria)
    db.commit()
    invalidar_cache_source_resolver(nome_categoria)
    return {"message": "Categoria excluida com sucesso"}


# ===========================================
# Tipos de Peca
# ===========================================

@router.get("/tipos-peca")
async def listar_tipos_peca(
    group_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Lista tipos de peca derivados de prompt_modulos (tipo='peca').
    Se group_id informado, retorna apenas os tipos com template naquele grupo.
    Inclui categorias associadas via tipo_peca_grupo_categorias.
    """
    from admin.models_prompts import PromptModulo
    from sistemas.gerador_pecas.models_config_pecas import TipoPecaGrupoCategoria

    query = db.query(PromptModulo).filter(
        PromptModulo.tipo == "peca",
        PromptModulo.ativo == True,
    )
    if group_id:
        query = query.filter(PromptModulo.group_id == group_id)

    modulos_peca = query.order_by(PromptModulo.ordem).all()

    resultado = []
    for m in modulos_peca:
        cats = []
        cat_count = 0
        effective_group_id = group_id or m.group_id
        if effective_group_id:
            assocs = db.query(TipoPecaGrupoCategoria).filter(
                TipoPecaGrupoCategoria.tipo_peca_nome == m.nome,
                TipoPecaGrupoCategoria.group_id == effective_group_id,
            ).all()
            cat_ids = [a.categoria_documento_id for a in assocs]
            if cat_ids:
                cats_db = session_query(db, CategoriaDocumento).filter(
                    CategoriaDocumento.id.in_(cat_ids)
                ).order_by(CategoriaDocumento.ordem).all()
                cats = [
                    {
                        "id": c.id,
                        "nome": c.nome,
                        "titulo": c.titulo,
                        "descricao": c.descricao,
                        "codigos_documento": c.codigos_documento or [],
                        "cor": c.cor,
                        "ordem": c.ordem,
                        "ativo": c.ativo,
                        "is_primeiro_documento": c.is_primeiro_documento,
                    }
                    for c in cats_db
                ]
            cat_count = len(cats)

        resultado.append({
            "nome": m.nome,
            "titulo": m.titulo,
            "group_id": effective_group_id,
            "categorias_count": cat_count,
            "categorias_documento": cats,
        })

    return resultado


@router.put("/tipos-peca/{tipo_peca_nome}/categorias")
async def atualizar_categorias_tipo_peca(
    tipo_peca_nome: str,
    dados: AssociacaoCategoriasGrupoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Atualiza associacao de categorias para um tipo de peca em um grupo.
    Substitui todas as associacoes existentes para (tipo_peca_nome, group_id).
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    from sistemas.gerador_pecas.models_config_pecas import TipoPecaGrupoCategoria

    # Remove associacoes antigas
    db.query(TipoPecaGrupoCategoria).filter(
        TipoPecaGrupoCategoria.tipo_peca_nome == tipo_peca_nome,
        TipoPecaGrupoCategoria.group_id == dados.group_id,
    ).delete()

    # Cria novas associacoes
    for cat_id in dados.categorias_ids:
        db.add(TipoPecaGrupoCategoria(
            tipo_peca_nome=tipo_peca_nome,
            group_id=dados.group_id,
            categoria_documento_id=cat_id,
        ))

    db.commit()

    return {
        "message": "Categorias atualizadas com sucesso",
        "tipo_peca": tipo_peca_nome,
        "group_id": dados.group_id,
        "categorias_count": len(dados.categorias_ids),
    }


# ===========================================
# Referencia JSON (leitura do arquivo estatico)
# ===========================================

# ===========================================
# Seed Inicial
# ===========================================

@router.post("/seed")
async def seed_dados_iniciais(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Popula dados iniciais de categorias e tipos de peca a partir do JSON de referencia."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    categorias_criadas = 0
    tipos_criados = 0

    # Criar categorias
    for cat_data in get_categorias_documento_seed():
        existente = session_query(db, CategoriaDocumento).filter(
            CategoriaDocumento.nome == cat_data["nome"]
        ).first()

        if not existente:
            categoria = CategoriaDocumento(**cat_data)
            db.add(categoria)
            categorias_criadas += 1
        else:
            if cat_data.get("is_primeiro_documento") and not existente.is_primeiro_documento:
                existente.is_primeiro_documento = True
            if cat_data.get("resolver_config") and not existente.resolver_config:
                existente.resolver_config = cat_data["resolver_config"]

    db.commit()

    # Criar tipos de peca e associar categorias
    for tipo_data in get_tipos_peca_seed():
        existente = session_query(db, TipoPeca).filter(
            TipoPeca.nome == tipo_data["nome"]
        ).first()

        if not existente:
            categorias_nomes = tipo_data.pop("categorias", [])
            tipo = TipoPeca(**tipo_data)

            categorias = session_query(db, CategoriaDocumento).filter(
                CategoriaDocumento.nome.in_(categorias_nomes)
            ).all()
            tipo.categorias_documento = categorias

            db.add(tipo)
            tipos_criados += 1

    db.commit()

    return {
        "message": "Seed executado com sucesso",
        "categorias_criadas": categorias_criadas,
        "tipos_criados": tipos_criados,
    }


# ===========================================
# Referencia JSON (leitura do arquivo estatico)
# ===========================================

@router.get("/categorias-json")
async def listar_categorias_json(
    current_user: User = Depends(get_current_active_user),
):
    """Lista categorias e documentos do arquivo categorias_documentos.json (referencia)."""
    categorias = carregar_categorias_json()

    resultado = []
    for cat_nome, documentos in categorias.items():
        resultado.append({
            "categoria": cat_nome,
            "nome_id": cat_nome.lower()
                .replace(" ", "_")
                .replace("\u00e3", "a")
                .replace("\u00e7", "c")
                .replace("\u00e9", "e")
                .replace("\u00f3", "o"),
            "documentos": documentos,
            "codigos": [d["codigo"] for d in documentos],
        })

    resultado.sort(key=lambda x: x["categoria"])
    return resultado
