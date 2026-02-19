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

@router.get("/tipos-peca", response_model=List[TipoPecaResponse])
async def listar_tipos_peca(
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista todos os tipos de peca com suas categorias."""
    query = session_query(db, TipoPeca)
    if ativo is not None:
        query = query.filter(TipoPeca.ativo == ativo)
    return query.order_by(TipoPeca.ordem, TipoPeca.titulo).all()


@router.put("/tipos-peca/{tipo_id}/categorias")
async def atualizar_categorias_tipo_peca(
    tipo_id: int,
    dados: AssociacaoCategoriasRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Atualiza associacao de categorias a um tipo de peca."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    tipo = session_query(db, TipoPeca).filter(TipoPeca.id == tipo_id).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de peca nao encontrado")

    categorias = session_query(db, CategoriaDocumento).filter(
        CategoriaDocumento.id.in_(dados.categorias_ids)
    ).all()
    tipo.categorias_documento = categorias
    db.commit()

    return {
        "message": "Categorias atualizadas com sucesso",
        "tipo_id": tipo_id,
        "categorias_count": len(categorias),
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
